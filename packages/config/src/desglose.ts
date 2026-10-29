import {
  calcularCotizacion,
  equipoDe,
  precioHoraDe,
  porZona,
  precioDeServicio,
  precioZona,
  productoDe,
  servicioDe,
  zonaDe,
  zonaPrecioDe,
  LEYENDA_NEGOCIAR,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type OpcionesCotizador,
  type PartidaCotizador,
  type RenglonCotizacion,
} from './quoter';

/**
 * CÓMO SE CALCULÓ CADA RENGLÓN (2026-10-23).
 *
 * El desglose de una cotización con de dónde sale cada precio y qué tarifa se
 * corrige con el lápiz. Vive aquí, junto al motor, porque lo usan los dos
 * lados: la API (al guardar, al corregir una tarifa y al recalcular las
 * solicitudes pendientes) y la ficha de la cotización del panel, que recalcula
 * en vivo mientras se editan cantidades. Si cada lado tuviera su copia, la
 * pantalla y lo guardado podrían diferir en un peso.
 */

/**
 * LAS CONDICIONES SIN CARGOS (2026-10-23). Las condiciones del tabulador traen
 * cargos con precio ("Hora extra de operador: $200", "Capacitación: $1,500").
 * En un documento SIN precios (el que el cliente revisa antes de recibir la
 * cotización, o el del aliado) esos renglones se quitan: el sitio nunca enseña
 * precios. Un bloque que se queda sin renglones se quita entero. La leyenda
 * para negociar el costo (2026-10-29) también: sin costo no hay qué negociar.
 */
export function condicionesSinPrecios<T extends { titulo: string; puntos: string[] }>(bloques: T[]): T[] {
  const conPrecio = /\$\s?\d/;
  return bloques
    .map((b) => ({ ...b, puntos: b.puntos.filter((p) => !conPrecio.test(p) && !p.startsWith(LEYENDA_NEGOCIAR)) }))
    .filter((b) => b.puntos.length > 0);
}

/** A qué tarifa del tabulador apunta un renglón. */
export type RefTarifa =
  /** Precio POR HORA de un equipo (2026-10-29). `tramo` solo lo traen las de antes, del cobro por día. */
  | { clase: 'equipo'; id: string; tramo?: string }
  /** Un tipo de flete de maquinaria (lo comparten todos los equipos que lo usan). */
  | { clase: 'flete'; tipo: string }
  /** Precio por viaje de un servicio; `zona` en los que cobran por zona (el agua, 2026-10-29). */
  | { clase: 'servicio'; id: string; zona?: string }
  /** Precio por tonelada de un material de triturados. */
  | { clase: 'material'; id: string }
  /** El flete de una zona de triturados; se edita por tonelada y se guarda por viaje. */
  | { clase: 'flete_zona'; zonaId: string }
  | { clase: 'banco' }
  /** Precio por viaje de un material a una zona (la tabla de zonas). */
  | { clase: 'zona'; zonaId: string; productoId: string };

export interface FilaDesglose {
  concepto: string;
  cantidad: number;
  unidad: string;
  pu: number;
  importe: number;
  /** La clase del renglón (equipo, flete, servicio…): dice qué campo de la partida cambia el lápiz. */
  clase: string;
  /** De dónde sale el precio, en palabras. */
  fuente: string;
  /** Trae un precio especial solo para esta cotización. */
  negociado: boolean;
  /**
   * Lo que edita el lápiz: el precio en la unidad en que se piensa la tarifa
   * (un equipo, por día aunque el documento diga por hora). `tarifa` null = no
   * hay tarifa que corregir (un material escrito a mano). null entero = la
   * fila no se edita.
   */
  edicion: { unidad: string; valor: number; tarifa: number | null; usos?: number } | null;
}

/** La fila con su partida (índice) y la tarifa que corrige. */
export interface FilaExplicada extends FilaDesglose {
  partida: number | null;
  ref: RefTarifa | null;
}

/** Qué ficha de inventario es cada renglón del tabulador (QuoterService.fichasDeRenglones). */
export type FichasDeRenglones = Record<string, { id: number; nombre: string; activa: boolean } | null>;

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Cada renglón de un cálculo ya hecho (el documento GUARDADO, que suma lo que
 * dice el total) ligado a su partida. Se reconoce por clase e id y en orden: un
 * flete es siempre del equipo o material que va justo antes.
 */
export function filasDelDocumento(
  cat: CatalogoCotizador,
  partidas: PartidaCotizador[],
  calc: CalculoCotizacion,
  fichas: FichasDeRenglones,
): FilaExplicada[] {
  const usadas = new Set<number>();
  const tomar = (pred: (p: PartidaCotizador) => boolean): number | null => {
    const i = partidas.findIndex((p, j) => !usadas.has(j) && pred(p));
    if (i < 0) return null;
    usadas.add(i);
    return i;
  };
  let anterior: number | null = null;
  return calc.renglones.map((r) => {
    let i: number | null = null;
    if (r.clase === 'equipo') i = tomar((p) => p.tipo === 'equipo' && p.id === r.id);
    else if (r.clase === 'flete') i = anterior;
    else if (r.clase === 'servicio') i = tomar((p) => p.tipo === 'servicio' && p.id === r.id);
    else if (r.clase === 'material') i = tomar((p) => p.tipo === 'material' && p.id === r.id && (p.id !== 'custom' || (p.nombre ?? '').trim().toUpperCase() === r.concepto));
    else if (r.clase === 'banco') i = tomar((p) => p.tipo === 'banco');
    else if (r.clase === 'zona') i = tomar((p) => p.tipo === 'zona' && `${p.zona_id}:${p.producto_id}` === r.id);
    if (r.clase !== 'flete') anterior = i;
    const p = i === null ? null : partidas[i];
    return explicada(cat, r, p, i, fichas);
  });
}

/**
 * Los renglones de CADA partida, calculados con el tabulador de hoy: lo que la
 * ficha de la cotización pinta mientras se editan cantidades y precios. Una
 * partida sin cantidad (recién agregada) sale sin renglones.
 */
export function renglonesPorPartida(
  cat: CatalogoCotizador,
  partidas: PartidaCotizador[],
  opciones: Partial<OpcionesCotizador>,
  fichas: FichasDeRenglones,
): FilaExplicada[][] {
  return partidas.map((p, i) => calcularCotizacion(cat, [p], opciones).renglones.map((r) => explicada(cat, r, p, i, fichas)));
}

function explicada(cat: CatalogoCotizador, r: RenglonCotizacion, p: PartidaCotizador | null, i: number | null, fichas: FichasDeRenglones): FilaExplicada {
  const base = { concepto: r.concepto, cantidad: r.cantidad, unidad: r.unidad, pu: r.pu, importe: r.importe, clase: r.clase };
  if (!p) return { ...base, fuente: 'Renglón del documento', negociado: false, edicion: null, partida: null, ref: null };
  return { ...base, ...explicarRenglon(cat, r, p, fichas), partida: i };
}

type Explicacion = Pick<FilaExplicada, 'fuente' | 'negociado' | 'edicion' | 'ref'>;
const sinTarifa = (fuente: string): Explicacion => ({ fuente, negociado: false, edicion: null, ref: null });

/** De dónde sale el precio de un renglón y qué se edita con el lápiz. */
export function explicarRenglon(cat: CatalogoCotizador, r: RenglonCotizacion, p: PartidaCotizador, fichas: FichasDeRenglones): Explicacion {
  const deFicha = (id: string, nombre: string) => (fichas[id] ? `Ficha «${fichas[id]!.nombre}»` : `«${nombre}» del tabulador`);
  const especial = (tarifa: string) => `Precio especial solo de esta cotización (la tarifa es ${tarifa})`;

  if (cat.tipo === 'maquinaria' && p.tipo === 'equipo') {
    const eq = equipoDe(cat, p.id);
    if (!eq) return sinTarifa('El equipo ya no está en el tabulador');
    if (r.clase === 'flete') {
      const tarifa = Number(cat.fletes[eq.flete_tipo] ?? 0);
      const negociado = Number(p.flete ?? 0) > 0;
      const usos = cat.equipos.filter((e) => e.flete_tipo === eq.flete_tipo).length;
      return {
        fuente: negociado ? especial(dinero(tarifa)) : `Flete «${eq.flete_tipo}» del tabulador${usos > 1 ? ` (lo usan ${usos} equipos)` : ''}`,
        negociado,
        edicion: { unidad: 'por equipo, ida y vuelta', valor: r.pu, tarifa, usos },
        ref: { clase: 'flete', tipo: eq.flete_tipo },
      };
    }
    const tarifa = r2(precioHoraDe(cat, eq));
    const negociado = Number(p.precio_hora ?? 0) > 0;
    const valor = negociado ? r2(Number(p.precio_hora)) : tarifa;
    return {
      fuente: negociado ? especial(`${dinero(tarifa)} por hora`) : `${deFicha(eq.id, eq.nombre)} · ${dinero(tarifa)} por hora`,
      negociado,
      edicion: { unidad: 'por hora', valor, tarifa },
      ref: { clase: 'equipo', id: eq.id },
    };
  }
  if (cat.tipo === 'maquinaria' && p.tipo === 'servicio') {
    const sv = servicioDe(cat, p.id);
    if (!sv) return sinTarifa('El servicio ya no está en el tabulador');
    // Por zona (el agua): la tarifa es la de su zona, y corregirla cambia solo esa zona.
    const zona = porZona(sv) ? zonaPrecioDe(cat, p.zona) : null;
    const tarifa = precioDeServicio(cat, sv, p.zona) ?? 0;
    const negociado = Number(p.precio ?? 0) > 0 && Number(p.precio) !== tarifa;
    const donde = zona ? ` · ${zona.nombre}` : '';
    return {
      fuente: negociado ? especial(dinero(tarifa)) : `${deFicha(sv.id, sv.nombre)}${donde} · ${dinero(tarifa)} por ${sv.unidad || 'viaje'}`,
      negociado,
      edicion: { unidad: `por ${sv.unidad || 'viaje'}${zona ? ` en ${zona.nombre}` : ''}`, valor: r.pu, tarifa },
      ref: zona ? { clase: 'servicio', id: sv.id, zona: zona.id } : { clase: 'servicio', id: sv.id },
    };
  }
  if (cat.tipo === 'triturados' && p.tipo === 'material') {
    if (r.clase === 'flete') {
      const zona = cat.zonas.find((z) => z.nombre === (p.flete_zona ?? '').trim());
      const tarifa = zona && cat.ton_por_viaje > 0 ? Math.round(zona.flete / cat.ton_por_viaje) : null;
      const negociado = tarifa !== null && Number(p.flete_ton ?? 0) !== tarifa;
      return {
        fuente: zona
          ? negociado ? especial(`${dinero(tarifa!)} por tonelada`) : `Zona «${zona.nombre}»: ${dinero(zona.flete)} por viaje de ${cat.ton_por_viaje} t`
          : 'Flete por tonelada escrito a mano',
        negociado,
        edicion: { unidad: 'por tonelada', valor: r.pu, tarifa },
        ref: zona ? { clase: 'flete_zona', zonaId: zona.id } : null,
      };
    }
    const prod = productoDe(cat, p.id);
    const negociado = Number(p.precio ?? 0) > 0 && (!prod || Number(p.precio) !== prod.precio_ton);
    return {
      fuente: prod
        ? negociado ? especial(`${dinero(prod.precio_ton)} por tonelada`) : `${deFicha(prod.id, prod.nombre)} · ${dinero(prod.precio_ton)} por tonelada`
        : 'Material escrito a mano',
      negociado,
      edicion: { unidad: 'por tonelada', valor: r.pu, tarifa: prod?.precio_ton ?? null },
      ref: prod ? { clase: 'material', id: prod.id } : null,
    };
  }
  if (cat.tipo === 'triturados' && p.tipo === 'banco') {
    const b = cat.material_banco;
    const negociado = Number(p.precio_m3 ?? 0) > 0 && Number(p.precio_m3) !== b.precio_m3_default;
    return {
      fuente: negociado ? especial(`${dinero(b.precio_m3_default)} por m³`) : `${b.nombre} (Tarifas y condiciones): ${dinero(b.precio_m3_default)} por m³`,
      negociado,
      edicion: { unidad: 'por m³', valor: r.pu, tarifa: b.precio_m3_default },
      ref: { clase: 'banco' },
    };
  }
  if (cat.tipo === 'triturados' && p.tipo === 'zona') {
    const z = zonaDe(cat, p.zona_id);
    const prod = productoDe(cat, p.producto_id);
    if (!z || !prod) return sinTarifa('La zona o el material ya no están en el tabulador');
    const tarifa = precioZona(cat, z, prod.id);
    const negociado = Number(p.precio ?? 0) > 0;
    const deTabla = z.precios?.[prod.id] !== undefined;
    return {
      fuente: negociado
        ? especial(`${dinero(tarifa ?? 0)} por viaje`)
        : deTabla ? `Tabla de zonas · «${z.nombre}»` : `Zona «${z.nombre}»: flete ${dinero(z.flete)} + ${dinero(prod.precio_ton)}/t × ${cat.ton_por_viaje} t`,
      negociado,
      edicion: { unidad: 'por viaje', valor: r.pu, tarifa },
      ref: { clase: 'zona', zonaId: z.id, productoId: prod.id },
    };
  }
  return sinTarifa('Renglón del documento');
}

/** "Solo esta cotización": el precio especial va en la partida, como el costo/hora negociado. Cambia la partida en su lugar. */
export function ponerPrecio(cat: CatalogoCotizador, partidas: PartidaCotizador[], i: number, clase: string, valor: number): void {
  const p = partidas[i];
  if (p.tipo === 'equipo' && cat.tipo === 'maquinaria') {
    if (clase === 'flete') p.flete = r2(valor);
    else p.precio_hora = r2(valor);
  } else if (p.tipo === 'servicio') p.precio = r2(valor);
  else if (p.tipo === 'material') {
    if (clase === 'flete') p.flete_ton = r2(valor);
    else p.precio = r2(valor);
  } else if (p.tipo === 'banco') p.precio_m3 = r2(valor);
  else if (p.tipo === 'zona') p.precio = r2(valor);
}

/** Al corregir la tarifa, la fila editada deja su precio especial y toma la tarifa. */
export function quitarPrecio(partidas: PartidaCotizador[], i: number, clase: string, valor: number): void {
  const p = partidas[i];
  if (p.tipo === 'equipo') {
    if (clase === 'flete') p.flete = null;
    else p.precio_hora = null;
  } else if (p.tipo === 'servicio') p.precio = 0;
  else if (p.tipo === 'material') {
    // El flete de material no tiene "el del tabulador": se escribe el de la zona.
    if (clase === 'flete') p.flete_ton = r2(valor);
    else delete p.precio;
  } else if (p.tipo === 'banco') p.precio_m3 = 0;
  else if (p.tipo === 'zona') delete p.precio;
}

/**
 * Lo que traía ESCRITA la tarifa vieja pasa a la nueva. El cotizador del panel
 * llena el precio del servicio, del material y del banco al agregarlos, y el
 * flete por tonelada sale de la zona: sin esto, corregir la tarifa no movería
 * esas partidas. Lo que trae otro precio es un precio especial y se respeta.
 */
export function alinearATarifa(cat: CatalogoCotizador, partidas: PartidaCotizador[], ref: RefTarifa, antes: number | null, nuevo: number): PartidaCotizador[] {
  if (antes === null) return partidas;
  const igual = (v: unknown) => Math.abs(Number(v ?? NaN) - antes) < 0.005;
  for (const p of partidas) {
    if (ref.clase === 'servicio' && p.tipo === 'servicio' && p.id === ref.id && (!ref.zona || p.zona === ref.zona) && igual(p.precio)) p.precio = 0;
    else if (ref.clase === 'material' && p.tipo === 'material' && p.id === ref.id && igual(p.precio)) delete p.precio;
    else if (ref.clase === 'banco' && p.tipo === 'banco' && igual(p.precio_m3)) p.precio_m3 = 0;
    else if (ref.clase === 'flete_zona' && p.tipo === 'material' && cat.tipo === 'triturados') {
      const zona = cat.zonas.find((z) => z.id === ref.zonaId);
      if (zona && (p.flete_zona ?? '').trim() === zona.nombre && igual(p.flete_ton)) p.flete_ton = r2(nuevo);
    }
  }
  return partidas;
}
