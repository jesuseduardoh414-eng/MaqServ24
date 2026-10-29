import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { zCorreo, zTelefono, zTelefonoRequerido } from '../common/campos';
import {
  esCotizadorTipo,
  esUbicacionDeMapas,
  faltaZona,
  opcionesCotizadorSchema,
  porZona,
  servicioDe,
  zonaDeMunicipio,
  partidaMaquinariaSchema,
  partidaTrituradosSchema,
  type CatalogoCotizador,
  type CotizadorTipo,
  type PartidaCotizador,
} from '@maqserv/config';

/**
 * Lo que la API acepta de los cotizadores.
 *
 * Las partidas se validan con el esquema del TIPO correspondiente, no con uno
 * genérico: mandar una partida de triturados al cotizador de maquinaria tiene
 * que ser un 400, no un renglón que el motor ignora en silencio. Un renglón
 * ignorado es un total más bajo de lo que el cliente cree haber pedido.
 */
export function tipoDe(valor: string): CotizadorTipo {
  if (!esCotizadorTipo(valor)) throw new BadRequestException('Cotizador desconocido');
  return valor;
}

const contactoSchema = z.object({
  cliente: z.string().trim().min(2, 'Falta el nombre del cliente').max(190),
  obra: z.string().trim().max(190).optional().default(''),
  atencion: z.string().trim().max(190).optional().default(''),
  municipio: z.string().trim().max(90).optional().default(''),
  notas: z.string().trim().max(2000).optional().default(''),
});

export const calcularSchema = z.object({
  opciones: opcionesCotizadorSchema.partial().optional().default({}),
  partidas: z.array(z.unknown()).max(60),
});

export const cotizacionPanelSchema = contactoSchema.extend({
  correo: zCorreo().optional().default(''),
  telefono: zTelefono().optional().default(''),
  opciones: opcionesCotizadorSchema.partial().optional().default({}),
  partidas: z.array(z.unknown()).min(1, 'Agrega al menos una partida').max(60),
  /** Cliente y obra registrados que eligió (2026-10-23); sin ellos se dan de alta con lo escrito. */
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  obraId: z.coerce.number().int().positive().nullable().optional(),
  /** Dirección de la obra nueva. */
  direccion: z.string().trim().max(300).optional().default(''),
  /** Fecha de inicio del servicio o de entrega (2026-10-23), AAAA-MM-DD. */
  fecha: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida').optional().default(''),
  /** Triturados con flete (2026-10-29): la ubicación de la obra en Google Maps; en el panel es opcional. */
  ubicacion: z.string().trim().max(500).optional().default('')
    .refine((v) => !v || esUbicacionDeMapas(v), 'Esa ubicación no es de Google Maps: en Maps toca «Compartir» y pega el enlace.'),
});

/**
 * La solicitud del SITIO pide más que la del panel: el visitante no está en
 * ninguna base, así que sin correo o teléfono la cotización nace muerta —
 * nadie puede contestarla. En el panel esos campos son opcionales porque quien
 * captura ya tiene al cliente enfrente.
 */
export const solicitudSitioSchema = contactoSchema.extend({
  correo: z.string().trim().email('Escribe un correo válido').max(190),
  telefono: zTelefonoRequerido('Escribe un teléfono de contacto'),
  opciones: opcionesCotizadorSchema.partial().optional().default({}),
  partidas: z.array(z.unknown()).min(1, 'Agrega al menos una partida').max(60),
  /** Empresa y obra elegidas de las de su cuenta (2026-10-23). */
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  obraId: z.coerce.number().int().positive().nullable().optional(),
  /** Dirección de la obra nueva: calle, número y colonia. */
  direccion: z.string().trim().max(300).optional().default(''),
  /** Fecha de inicio del servicio o de entrega (2026-10-23), AAAA-MM-DD. */
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha del servicio.'),
  /** Triturados con flete (2026-10-29): la ubicación de la obra en Google Maps. */
  ubicacion: z.string().trim().max(500).optional().default('')
    .refine((v) => !v || esUbicacionDeMapas(v), 'Esa ubicación no es de Google Maps: en Maps toca «Compartir» y pega el enlace.'),
})
  // Toda solicitud es para una obra: una de las suyas, o una nueva con nombre y dirección.
  .refine((d) => !!d.obraId || (d.obra.trim().length >= 2 && d.direccion.trim().length >= 5), {
    message: 'Elige tu obra, o escribe el nombre y la dirección de la obra nueva.',
    path: ['obra'],
  });

/** Valida las partidas contra el esquema del tipo. Lanza 400 con el motivo. */
export function partidasDe(tipo: CotizadorTipo, crudas: unknown[]): PartidaCotizador[] {
  const esquema = tipo === 'maquinaria' ? partidaMaquinariaSchema : partidaTrituradosSchema;
  const out: PartidaCotizador[] = [];
  for (const [i, cruda] of crudas.entries()) {
    const parsed = esquema.safeParse(cruda);
    if (!parsed.success) {
      throw new BadRequestException(`Partida ${i + 1}: ${parsed.error.issues[0]?.message ?? 'datos inválidos'}`);
    }
    out.push(parsed.data as PartidaCotizador);
  }
  return out;
}

/**
 * PRECIO ÚNICO en el SITIO (QA 2026-09-28): el cliente elige QUÉ y CUÁNTO,
 * nunca el precio. El motor acepta sobreprecios para el PANEL (costo/hora
 * negociado, precio de un servicio, material a mano), y por la API directa el
 * cliente mandaba `precio_hora: 0.01` y el documento salía a su precio. Aquí
 * se quitan todos esos campos y solo pasan renglones del tabulador:
 *
 *  - equipo: sin `precio_hora`; las horas no pasan de la jornada.
 *  - servicio: `precio` 0 = el del tabulador.
 *  - material: solo ids del catálogo (nada de "custom"), sin `precio` ni
 *    `nombre`; el flete por tonelada lo pone el SERVIDOR con la zona elegida
 *    (2026-10-23, ver `fleteDelSitio`).
 *  - banco: `precio_m3` 0 = el del tabulador.
 *  - zona: sin `precio` negociado; vale la tabla de zonas.
 *  - servicio por zona (el agua, 2026-10-29): la zona es la del municipio de
 *    la obra, no la que mande el navegador; fuera de las zonas no se ofrece.
 */
export function partidasPublicas(tipo: CotizadorTipo, crudas: unknown[], cat: CatalogoCotizador, municipio = ''): PartidaCotizador[] {
  const partidas = partidasDe(tipo, crudas);
  const zonaObra = cat.tipo === 'maquinaria' ? zonaDeMunicipio(cat, municipio)?.id : undefined;
  const limpias = partidas.map((p, i) => {
    const n = i + 1;
    // "Sale en el cotizador" apagado en su ficha, o la ficha de baja (2026-10-19).
    const oculto =
      cat.tipo === 'maquinaria'
        ? (p.tipo === 'equipo' && cat.equipos.find((e) => e.id === p.id)?.oculto) ||
          (p.tipo === 'servicio' && cat.servicios.find((s) => s.id === p.id)?.oculto)
        : (p.tipo === 'material' && cat.productos.find((x) => x.id === p.id)?.oculto) ||
          (p.tipo === 'zona' && cat.productos.find((x) => x.id === p.producto_id)?.oculto);
    if (oculto) throw new BadRequestException(`Partida ${n}: eso ya no está en el cotizador. Pídelo a la medida en /cotizar.`);
    if (cat.tipo === 'maquinaria') {
      if (p.tipo === 'equipo') {
        return { ...p, precio_hora: null, flete: null, horas: Math.min(p.horas ?? 0, Math.max(0, cat.jornada_horas - 1)) };
      }
      if (p.tipo === 'servicio') {
        const sv = servicioDe(cat, p.id);
        const { zona: _elegida, ...resto } = p;
        return sv && porZona(sv) && zonaObra ? { ...resto, precio: 0, zona: zonaObra } : { ...resto, precio: 0 };
      }
    } else {
      if (p.tipo === 'material') {
        if (!cat.productos.some((x) => x.id === p.id)) {
          throw new BadRequestException(`Partida ${n}: ese material no está en el tabulador. Pídelo a la medida en /cotizar.`);
        }
        const { precio: _p, nombre: _n, ...resto } = p;
        return { ...resto, flete_ton: fleteDelSitio(cat, p.flete_zona, p.flete_ton) } as PartidaCotizador;
      }
      if (p.tipo === 'banco') return { ...p, precio_m3: 0 };
      if (p.tipo === 'zona') {
        const { precio: _z, ...resto } = p;
        return resto as PartidaCotizador;
      }
    }
    return p;
  });
  const falta = faltaZona(cat, limpias, municipio);
  if (falta) throw new BadRequestException(falta);
  return limpias;
}

/** Lo que el cotizador del sitio escribe cuando el material no se lleva a obra. */
const RECOGE_EN_PLANTA = 'recoge en planta';

/**
 * EL FLETE POR TONELADA DEL SITIO, PUESTO POR EL SERVIDOR (2026-10-23).
 *
 * El sitio ya no enseña precios: el navegador recibe el tabulador en ceros y
 * con él calcula un flete de $0 aunque el cliente haya elegido su zona. Si se
 * tomara lo que manda, la solicitud llegaría al panel sin flete. Aquí manda la
 * ZONA que eligió (su nombre viaja en `flete_zona`): flete del viaje entre las
 * toneladas por viaje, igual que `fleteTonDeZona` del cotizador. "Recoge en
 * planta" no lleva flete. Una zona que no existe deja el flete en 0 si no es
 * uno de la lista: el panel lo ve en el desglose y lo corrige antes de mandarlo.
 */
function fleteDelSitio(cat: Extract<CatalogoCotizador, { tipo: 'triturados' }>, zona: string | undefined, enviado: number | undefined): number {
  const nombre = (zona ?? '').trim().toLowerCase();
  if (nombre === RECOGE_EN_PLANTA) return 0;
  const z = nombre ? cat.zonas.find((x) => x.nombre.trim().toLowerCase() === nombre) : undefined;
  if (z) return cat.ton_por_viaje > 0 ? Math.round(Number(z.flete) / cat.ton_por_viaje) : 0;
  const n = Number(enviado ?? 0);
  return n > 0 && cat.fletes_ton.includes(n) ? n : 0;
}

/** Primer mensaje de error de zod, ya listo para un 400. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos';
}
