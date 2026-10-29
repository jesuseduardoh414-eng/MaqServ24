import { prisma } from '@maqserv/db';
import {
  CATALOGOS_DEFAULT,
  COTIZADOR_TIPOS,
  calcularCotizacion,
  calcularEquipo,
  catalogoCotizadorSchema,
  requestFormFor,
  type CatalogoCotizador,
  type CotizadorTipo,
  type PartidaCotizador,
} from '@maqserv/config';

/**
 * EL PRECIO ESTIMADO DE UNA SOLICITUD DEL FORMULARIO (2026-10-23).
 *
 * "Que no importa si lo hizo por el formulario o desde la ventana de
 * servicios: que llegue al panel con el precio estimado." El formulario
 * /cotizar recibe lo que no se arma en un cotizador del sitio: fichas cuyo
 * renglón está oculto, cotizadores apagados en el sitio, enlaces directos.
 * Si la ficha de ese tipo tiene renglón en un tabulador, el precio sale del
 * MISMO motor que los cotizadores (por hora con su mínimo, flete, IVA); si no, del
 * precio de la ficha (`cprice`, como antes); si tampoco hay, queda en cero y el
 * panel lo marca "Falta tarifa". El cliente nunca lo ve: solo el panel.
 */

/** De qué renglón del tabulador salió el precio. */
export interface RenglonDelTabulador {
  tipo: CotizadorTipo;
  clase: 'equipo' | 'servicio' | 'material';
  id: string;
}

export interface Estimado {
  renglon: RenglonDelTabulador;
  /** Por hora (maquinaria, desde 2026-10-29), por viaje o por tonelada. */
  precioUnitario: number;
  /** Sin flete ni IVA. */
  subtotal: number;
  flete: number;
  iva: number;
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** Los tabuladores guardados; el de fábrica si no hay fila o no pasa validación. */
async function tabuladores(): Promise<CatalogoCotizador[]> {
  const filas = await prisma.quoter_catalogs.findMany({ where: { kind: { in: [...COTIZADOR_TIPOS] } } });
  return COTIZADOR_TIPOS.map((tipo) => {
    const parsed = catalogoCotizadorSchema.safeParse(filas.find((f) => f.kind === tipo)?.data);
    return parsed.success && parsed.data.tipo === tipo ? parsed.data : CATALOGOS_DEFAULT[tipo];
  });
}

/**
 * Cuántas unidades pidió, cuando el formulario de la línea pregunta su propia
 * cantidad ("Viajes estimados", "Cantidad"). Solo un número claro: "8 m³" de un
 * material que se cobra por tonelada no se convierte a ciegas.
 */
export function cantidadDelFormulario(categoria: string | null | undefined, requirements: Record<string, unknown> | null | undefined): number | null {
  const form = requestFormFor(categoria);
  const campo = form?.fields.find((f) => f.key === 'cantidad' || f.key === 'viajes');
  if (!campo || !requirements) return null;
  const crudo = String(requirements[campo.key] ?? '').trim();
  if (!crudo || /m3|m³|metro/i.test(crudo)) return null;
  const n = Number(crudo.replace(',', '.').match(/\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * El estimado de cada producto pedido, por id de producto. Los que no tienen
 * renglón (o dan cero) no vienen en el mapa. Nunca lanza: una solicitud no se
 * cae porque no se pudo estimar.
 */
export async function estimarDelTabulador(
  entradas: Array<{
    productId: number;
    /** La ficha del tipo: el producto mismo si es ficha, o su `tipo_id` si es de un aliado. */
    fichaId: number | null;
    /** Equipos, viajes o toneladas. */
    cantidad: number;
    /** Solo renta: cuánto tiempo, en la unidad de la ficha. */
    tiempo: number;
    unidad: string | null;
  }>,
): Promise<Map<number, Estimado>> {
  const out = new Map<number, Estimado>();
  if (!entradas.length) return out;
  let cats: CatalogoCotizador[];
  try {
    cats = await tabuladores();
  } catch {
    return out;
  }

  for (const e of entradas) {
    try {
      const ids = new Set([e.productId, ...(e.fichaId ? [e.fichaId] : [])]);
      const ligado = (r: { productos?: number[]; oculto?: boolean }) => !r.oculto && (r.productos ?? []).some((id) => ids.has(id));
      for (const cat of cats) {
        let partida: PartidaCotizador | null = null;
        let renglon: RenglonDelTabulador | null = null;
        let precioUnitario = 0;
        if (cat.tipo === 'maquinaria') {
          const eq = cat.equipos.find(ligado);
          const sv = eq ? undefined : cat.servicios.find(ligado);
          if (eq) {
            // El tiempo llega en la unidad de la ficha; el motor cuenta días y horas.
            const jornada = cat.jornada_horas;
            const horasTotales = e.unidad === 'hora' ? e.tiempo
              : e.unidad === 'semana' ? e.tiempo * 7 * jornada
                : e.unidad === 'mes' ? e.tiempo * 30 * jornada
                  : e.tiempo * jornada;
            const dias = Math.floor(horasTotales / jornada);
            const horas = Math.min(jornada - 1, Math.round(horasTotales - dias * jornada));
            const p = { tipo: 'equipo' as const, id: eq.id, dias, horas, cantidad: Math.max(1, Math.round(e.cantidad)) };
            partida = p;
            renglon = { tipo: 'maquinaria', clase: 'equipo', id: eq.id };
            precioUnitario = calcularEquipo(cat, p).tarifaHora;
          } else if (sv) {
            partida = { tipo: 'servicio', id: sv.id, precio: 0, cantidad: Math.max(1, Math.round(e.cantidad)) };
            renglon = { tipo: 'maquinaria', clase: 'servicio', id: sv.id };
            precioUnitario = sv.precio;
          }
        } else {
          const prod = cat.productos.find(ligado);
          if (prod) {
            // Sin zona elegida: el flete por tonelada se pone al revisarla en el panel.
            partida = { tipo: 'material', id: prod.id, toneladas: e.cantidad, flete_ton: 0 };
            renglon = { tipo: 'triturados', clase: 'material', id: prod.id };
            precioUnitario = prod.precio_ton;
          }
        }
        if (!partida || !renglon) continue;
        const calc = calcularCotizacion(cat, [partida], {});
        if (calc.total <= 0) break;
        const flete = calc.renglones.filter((r) => r.clase === 'flete').reduce((s, r) => s + r.importe, 0);
        out.set(e.productId, {
          renglon,
          precioUnitario: r2(precioUnitario),
          subtotal: r2(calc.subtotal - flete),
          flete: r2(flete),
          iva: r2(calc.iva),
        });
        break;
      }
    } catch {
      // Sin estimado para este producto: sigue con el precio de la ficha.
    }
  }
  return out;
}
