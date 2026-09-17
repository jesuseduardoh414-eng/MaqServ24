import type {
  CatalogoMaquinaria,
  CatalogoTriturados,
  PartidaCotizador,
} from '@maqserv/config';

/**
 * LO QUE EL USUARIO ESTÁ EDITANDO, que no es lo mismo que una partida.
 *
 * Los campos donde se teclea guardan CADENAS aunque representen números. No es
 * descuido: mientras alguien escribe "0.5" pasa por "0." , y `Number('0.')` no
 * es finito — guardarlo como número borraba el campo a media escritura. Se
 * convierte a partida (números de verdad) al calcular y al enviar, en un solo
 * sitio: `aPartidas`.
 *
 * Las que sí son números (días, cantidades, viajes) se manejan con contadores
 * +/− acotados, así que nunca pasan por un estado intermedio inválido.
 */

export interface LineaEquipo {
  uid: number;
  tipo: 'equipo';
  id: string;
  dias: number;
  horas: number;
  cantidad: number;
  /** Costo/hora negociado. Vacío = el del tabulador. */
  precioHora: string;
}

export interface LineaServicio {
  uid: number;
  tipo: 'servicio';
  id: string;
  precio: string;
  cantidad: number;
}

export interface LineaMaterial {
  uid: number;
  tipo: 'material';
  /** `custom` = material que el usuario nombra a mano. */
  id: string;
  nombre: string;
  precio: string;
  toneladas: string;
  fleteTon: number;
  fleteZona: string;
}

export interface LineaBanco {
  uid: number;
  tipo: 'banco';
  precioM3: string;
  m3: string;
}

export interface LineaZona {
  uid: number;
  tipo: 'zona';
  zonaId: string;
  productoId: string;
  viajes: number;
}

export type LineaMaquinaria = LineaEquipo | LineaServicio;
export type LineaTriturados = LineaMaterial | LineaBanco | LineaZona;
export type LineaCotizador = LineaMaquinaria | LineaTriturados;

/** Cadena → número, tolerando vacío y basura. */
export const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

let siguiente = 1;
export const nuevoUid = (): number => siguiente++;

// ---- altas ----

export const lineaDeEquipo = (id: string): LineaEquipo => ({
  uid: nuevoUid(), tipo: 'equipo', id, dias: 1, horas: 0, cantidad: 1, precioHora: '',
});

export const lineaDeServicio = (cat: CatalogoMaquinaria, id: string): LineaServicio => ({
  uid: nuevoUid(),
  tipo: 'servicio',
  id,
  precio: String(cat.servicios.find((s) => s.id === id)?.precio ?? 0),
  cantidad: 1,
});

export const lineaDeMaterial = (cat: CatalogoTriturados, id: string): LineaMaterial => {
  const prod = cat.productos.find((p) => p.id === id);
  return {
    uid: nuevoUid(),
    tipo: 'material',
    id: prod ? id : 'custom',
    nombre: prod?.nombre ?? '',
    precio: prod ? String(prod.precio_ton) : '',
    toneladas: '',
    fleteTon: 0,
    fleteZona: '',
  };
};

export const lineaDeBanco = (cat: CatalogoTriturados): LineaBanco => ({
  uid: nuevoUid(), tipo: 'banco', precioM3: String(cat.material_banco.precio_m3_default || ''), m3: '',
});

export const lineaDeZona = (cat: CatalogoTriturados): LineaZona => ({
  uid: nuevoUid(),
  tipo: 'zona',
  zonaId: cat.zonas[0]?.id ?? '',
  productoId: cat.productos[0]?.id ?? '',
  viajes: 1,
});

// ---- conversión ----

/**
 * De lo que se edita a lo que entiende el motor.
 *
 * Fuente ÚNICA: la usa el cálculo en vivo de la pantalla y el envío al
 * servidor. Si fueran dos conversiones, la vista previa y lo que se guarda
 * podrían diferir en un decimal — y ese decimal es una queja del cliente.
 */
export function aPartidas(lineas: LineaCotizador[]): PartidaCotizador[] {
  return lineas.map((l): PartidaCotizador => {
    switch (l.tipo) {
      case 'equipo':
        return {
          tipo: 'equipo',
          id: l.id,
          dias: l.dias,
          horas: l.horas,
          cantidad: l.cantidad,
          precio_hora: num(l.precioHora) || null,
        };
      case 'servicio':
        return { tipo: 'servicio', id: l.id, precio: num(l.precio), cantidad: l.cantidad };
      case 'material':
        return {
          tipo: 'material',
          id: l.id,
          nombre: l.nombre.trim(),
          precio: num(l.precio),
          toneladas: num(l.toneladas),
          flete_ton: l.fleteTon,
          flete_zona: l.fleteZona.trim(),
        };
      case 'banco':
        return { tipo: 'banco', precio_m3: num(l.precioM3), m3: num(l.m3) };
      case 'zona':
      default:
        return { tipo: 'zona', zona_id: l.zonaId, producto_id: l.productoId, viajes: l.viajes };
    }
  });
}

/** Rehidrata una cotización guardada para volver a editarla. */
export function aLineas(partidas: PartidaCotizador[]): LineaCotizador[] {
  return partidas.map((p): LineaCotizador => {
    switch (p.tipo) {
      case 'equipo':
        return {
          uid: nuevoUid(), tipo: 'equipo', id: p.id,
          dias: p.dias ?? 0, horas: p.horas ?? 0, cantidad: p.cantidad ?? 1,
          precioHora: p.precio_hora ? String(p.precio_hora) : '',
        };
      case 'servicio':
        return { uid: nuevoUid(), tipo: 'servicio', id: p.id, precio: String(p.precio ?? ''), cantidad: p.cantidad ?? 1 };
      case 'material':
        return {
          uid: nuevoUid(), tipo: 'material', id: p.id, nombre: p.nombre ?? '',
          precio: String(p.precio ?? ''), toneladas: String(p.toneladas ?? ''),
          fleteTon: p.flete_ton ?? 0, fleteZona: p.flete_zona ?? '',
        };
      case 'banco':
        return { uid: nuevoUid(), tipo: 'banco', precioM3: String(p.precio_m3 ?? ''), m3: String(p.m3 ?? '') };
      case 'zona':
      default:
        return { uid: nuevoUid(), tipo: 'zona', zonaId: p.zona_id, productoId: p.producto_id, viajes: p.viajes ?? 1 };
    }
  });
}

/** Los datos de contacto y obra que acompañan a la cotización. */
export interface ContextoCotizador {
  cliente: string;
  obra: string;
  atencion: string;
  municipio: string;
  correo: string;
  telefono: string;
  notas: string;
}

export const CONTEXTO_VACIO: ContextoCotizador = {
  cliente: '', obra: '', atencion: '', municipio: '', correo: '', telefono: '', notas: '',
};
