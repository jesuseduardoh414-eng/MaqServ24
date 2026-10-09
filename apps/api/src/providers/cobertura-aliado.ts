import { centroDeMunicipio, normalizarNombre, radioDeCobertura, type Punto } from '@maqserv/config';
import { prisma } from '@maqserv/db';
import { lista } from '../common/json-list';

/** ¿`b` aparece en `a` como palabras completas? (ya normalizados) */
const contiene = (a: string, b: string) => b.length > 0 && ` ${a} `.includes(` ${b} `);

/**
 * UBICAR AL ALIADO Y CALCULAR HASTA DÓNDE LLEGA (decisión del cliente, 2026-10-09).
 *
 * El radio ya no se escribe: sale de su base y de su lista de municipios (ver
 * `radioDeCobertura` en @maqserv/config). Esto es lo que lo mantiene al día, y
 * por eso se llama desde todos los caminos que cambian una de las dos cosas:
 * el alta, la edición y el botón de ubicar del panel, y el portal del aliado
 * cuando él mismo cambia sus zonas.
 */

/** El geocodificador del cotizador de traslado (FreightService.geocode). */
export type Geocodificar = (consulta: string) => Promise<{ lat: number; lon: number; precision?: string } | null>;

/**
 * Municipios fuera de la tabla que se buscan en línea en una sola guardada.
 * Nominatim pide máximo una consulta por segundo: más de tres haría esperar
 * varios segundos al que guarda, por un nombre que casi siempre es un error
 * de dedo.
 */
const MAX_EN_LINEA = 3;

export interface UbicacionAliado {
  /** Quedó con un punto en el mapa. */
  ubicado: boolean;
  lat: number | null;
  lng: number | null;
  radioKm: number | null;
  /** Lo que se le dice a quien guardó, en una o dos frases. */
  mensaje: string;
}

export async function ubicarAliado(
  id: number,
  opciones: {
    /** Volver a buscar su base (cambió la dirección o el municipio). */
    buscarBase: boolean;
    /** Punto ya decidido (clic en el mapa o coordenadas pegadas). Gana a todo. */
    punto?: Punto | null;
    geocodificar?: Geocodificar;
  },
): Promise<UbicacionAliado> {
  const p = await prisma.providers.findUnique({
    where: { id },
    select: { address: true, city: true, state: true, coverage: true, lat: true, lng: true },
  });
  if (!p) return { ubicado: false, lat: null, lng: null, radioKm: null, mensaje: '' };

  const estado = p.state?.trim() || 'Nuevo León';
  let base: Punto | null = p.lat != null && p.lng != null ? { lat: Number(p.lat), lng: Number(p.lng) } : null;
  let comoQuedo = '';

  if (opciones.punto) {
    base = opciones.punto;
    comoQuedo = 'Quedó en el punto que marcaste.';
  } else if (opciones.buscarBase) {
    // El municipio y el estado se agregan si la dirección no los menciona ya.
    // Antes la regla era "si trae coma, ya trae municipio", pero desde que el
    // municipio tiene su propio campo la dirección es "calle, número y colonia":
    // con coma y sin municipio, y Nominatim no la encontraba.
    const dir = p.address?.trim() ?? '';
    const dirNorm = normalizarNombre(dir);
    const falta = (x: string | null | undefined) => Boolean(x?.trim()) && !contiene(dirNorm, normalizarNombre(x as string));
    const consulta = [dir, falta(p.city) ? p.city : null, falta(estado) ? estado : null]
      .map((x) => x?.trim())
      .filter(Boolean)
      .join(', ');
    const hallado = consulta && opciones.geocodificar ? await opciones.geocodificar(consulta).catch(() => null) : null;
    if (hallado) {
      base = { lat: hallado.lat, lng: hallado.lon };
      comoQuedo =
        hallado.precision === 'municipio' ? 'No encontramos la calle: quedó en el centro del municipio; ajústalo en el mapa del expediente.'
          : hallado.precision === 'colonia' ? 'Quedó en la colonia, no en el número exacto; si hace falta, ajústalo en el mapa del expediente.'
            : 'Quedó sobre la calle; revisa el punto en el mapa del expediente.';
    } else {
      // Sin respuesta del mapa (o dirección que no existe en OSM): al menos su
      // municipio, para que el radio y el emparejamiento por distancia sirvan.
      const centro = p.city ? centroDeMunicipio(p.city, estado) : null;
      if (centro) {
        base = { lat: centro.lat, lng: centro.lng };
        comoQuedo = `No encontramos la dirección: quedó en el centro de ${centro.nombre}; ajústalo en el mapa del expediente.`;
      } else if (dir || p.city) {
        comoQuedo = 'No encontramos su dirección ni su municipio: márcalo a mano en el mapa del expediente.';
      }
    }
  }

  const municipios = lista(p.coverage);
  let radio = base ? radioDeCobertura(base, municipios, estado) : null;

  // Lo que no está en la tabla (un municipio de otro estado, una localidad)
  // se busca en línea, con la pausa que pide Nominatim entre consultas.
  if (base && radio && radio.sinUbicar.length && opciones.geocodificar) {
    const extra: Array<Punto & { nombre: string }> = [];
    for (const [i, m] of radio.sinUbicar.slice(0, MAX_EN_LINEA).entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      const g = await opciones.geocodificar(m.includes(',') ? m : `${m}, ${estado}`).catch(() => null);
      if (g) extra.push({ lat: g.lat, lng: g.lon, nombre: m });
    }
    if (extra.length) {
      const encontrados = new Set(extra.map((e) => e.nombre));
      const resto = municipios.filter((m) => !encontrados.has(m.trim()));
      radio = radioDeCobertura(base, resto, estado, extra);
      radio.sinUbicar = radio.sinUbicar.filter((m) => !encontrados.has(m));
    }
  }

  await prisma.providers.update({
    where: { id },
    data: {
      ...(base ? { lat: base.lat, lng: base.lng } : {}),
      coverage_radius_km: radio?.km ?? null,
      updated_at: new Date(),
    },
  });

  const partes = [comoQuedo];
  if (radio?.km) partes.push(`Llega hasta ~${radio.km} km (su municipio más lejano es ${radio.masLejano}).`);
  else if (base && !municipios.length) partes.push('Sin municipios en su lista: no se puede calcular hasta dónde llega.');
  if (radio?.sinUbicar.length) partes.push(`No reconocimos: ${radio.sinUbicar.join(', ')}.`);

  return {
    ubicado: Boolean(base),
    lat: base?.lat ?? null,
    lng: base?.lng ?? null,
    radioKm: radio?.km ?? null,
    mensaje: partes.filter(Boolean).join(' '),
  };
}
