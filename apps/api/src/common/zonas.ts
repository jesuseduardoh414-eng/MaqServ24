import { guardarAjuste, leerAjuste } from './platform-settings';

/**
 * ZONAS DE SERVICIO (2026-10-22, Fase B).
 *
 * El único lugar donde se dice DÓNDE da servicio MAQSER24. Antes eran tres
 * listas sueltas: los "municipios sugeridos" de cada tabulador (capturados a
 * mano en Tarifas) y los estados que el sitio anuncia (una constante). Ahora:
 *
 *  - `sitio`: se anuncia y se cotiza en el sitio público.
 *  - `interna`: se atiende a quien la pida (el panel la cotiza), pero el sitio
 *    no la anuncia. Es lo que pasa hoy con Saltillo.
 *  - `pausada`: no se toman solicitudes nuevas.
 *
 * De aquí salen solos los municipios de los dos cotizadores. Las zonas NO
 * cambian el precio (Dirección no lo decidió; el flete de triturados sigue por
 * distancia a las pedreras, que es otra cosa). Va en `platform_settings`: no
 * necesita SQL.
 */
export type EstadoZona = 'sitio' | 'interna' | 'pausada';
export interface Zona {
  id: string;
  nombre: string;
  estado: EstadoZona;
  municipios: string[];
}

/** Las cinco zonas que proponía el cuestionario de Dirección (pregunta 9). */
export const ZONAS_DEFAULT: Zona[] = [
  {
    id: 'mty-metro', nombre: 'Monterrey metropolitano', estado: 'sitio',
    municipios: ['Monterrey', 'San Nicolás', 'Guadalupe', 'San Pedro', 'Apodaca', 'Escobedo', 'Santa Catarina', 'Juárez', 'García'],
  },
  {
    id: 'periferia-norte', nombre: 'Periferia norte', estado: 'sitio',
    municipios: ['El Carmen', 'Salinas Victoria', 'Ciénega de Flores', 'Pesquería', 'Zuazua', 'Marín', 'Abasolo', 'Hidalgo', 'Mina'],
  },
  {
    id: 'periferia-sur', nombre: 'Periferia sur', estado: 'sitio',
    municipios: ['Cadereyta Jiménez', 'Santiago', 'Allende', 'Montemorelos'],
  },
  {
    id: 'saltillo', nombre: 'Saltillo–Ramos Arizpe', estado: 'interna',
    municipios: ['Saltillo, Coah.', 'Ramos Arizpe, Coah.', 'Arteaga, Coah.'],
  },
  {
    id: 'chihuahua', nombre: 'Chihuahua', estado: 'pausada',
    municipios: ['Chihuahua, Chih.', 'Aldama, Chih.'],
  },
];

const CLAVE = 'zonas_servicio';

export async function leerZonas(): Promise<Zona[]> {
  const z = await leerAjuste<Zona[]>(CLAVE, ZONAS_DEFAULT);
  return Array.isArray(z) && z.length ? z : ZONAS_DEFAULT;
}

export async function guardarZonas(zonas: Zona[], por: string): Promise<void> {
  await guardarAjuste(CLAVE, zonas, por);
}

/** Los municipios de las zonas en esos estados, sin repetir y en el orden de las zonas. */
export function municipiosDe(zonas: Zona[], estados: EstadoZona[]): string[] {
  return [...new Set(zonas.filter((z) => estados.includes(z.estado)).flatMap((z) => z.municipios))];
}
