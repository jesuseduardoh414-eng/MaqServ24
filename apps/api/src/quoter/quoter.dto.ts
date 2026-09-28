import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import {
  esCotizadorTipo,
  opcionesCotizadorSchema,
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
  correo: z.string().trim().max(190).optional().default(''),
  telefono: z.string().trim().max(40).optional().default(''),
  opciones: opcionesCotizadorSchema.partial().optional().default({}),
  partidas: z.array(z.unknown()).min(1, 'Agrega al menos una partida').max(60),
});

/**
 * La solicitud del SITIO pide más que la del panel: el visitante no está en
 * ninguna base, así que sin correo o teléfono la cotización nace muerta —
 * nadie puede contestarla. En el panel esos campos son opcionales porque quien
 * captura ya tiene al cliente enfrente.
 */
export const solicitudSitioSchema = contactoSchema.extend({
  correo: z.string().trim().email('Escribe un correo válido').max(190),
  telefono: z.string().trim().min(7, 'Escribe un teléfono de contacto').max(40),
  opciones: opcionesCotizadorSchema.partial().optional().default({}),
  partidas: z.array(z.unknown()).min(1, 'Agrega al menos una partida').max(60),
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
 *    `nombre`; el flete por tonelada, solo uno de la lista `fletes_ton`.
 *  - banco: `precio_m3` 0 = el del tabulador.
 */
export function partidasPublicas(tipo: CotizadorTipo, crudas: unknown[], cat: CatalogoCotizador): PartidaCotizador[] {
  const partidas = partidasDe(tipo, crudas);
  return partidas.map((p, i) => {
    const n = i + 1;
    if (cat.tipo === 'maquinaria') {
      if (p.tipo === 'equipo') {
        return { ...p, precio_hora: null, horas: Math.min(p.horas ?? 0, Math.max(0, cat.jornada_horas - 1)) };
      }
      if (p.tipo === 'servicio') return { ...p, precio: 0 };
    } else {
      if (p.tipo === 'material') {
        if (!cat.productos.some((x) => x.id === p.id)) {
          throw new BadRequestException(`Partida ${n}: ese material no está en el tabulador. Pídelo a la medida en /cotizar.`);
        }
        if (p.flete_ton !== undefined && Number(p.flete_ton) > 0 && !cat.fletes_ton.includes(Number(p.flete_ton))) {
          throw new BadRequestException(`Partida ${n}: ese flete no está en el tabulador.`);
        }
        const { precio: _p, nombre: _n, ...resto } = p;
        return resto as PartidaCotizador;
      }
      if (p.tipo === 'banco') return { ...p, precio_m3: 0 };
    }
    return p;
  });
}

/** Primer mensaje de error de zod, ya listo para un 400. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos';
}
