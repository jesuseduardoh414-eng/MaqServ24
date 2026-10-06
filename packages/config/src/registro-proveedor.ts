/**
 * REGISTRO PÚBLICO DE PROVEEDORES (2026-10-06).
 *
 * "Regístrate como proveedor": empresas y propietarios de equipo piden entrar a
 * la red desde el sitio. La solicitud se guarda como aliado con
 * `status = ESTADO_SOLICITUD_PROVEEDOR` (2): no entra a asignaciones, cotizador
 * ni recordatorios (todos piden `status = 1`) hasta que MAQSER24 la acepta en
 * el panel (Red de aliados → Solicitudes).
 *
 * La lista la comparten el formulario del sitio y la API. `categoria` es el slug
 * de la línea de servicio que se guarda en `providers.categories`; las que no
 * tienen línea (venta, otro) solo quedan escritas en la nota.
 */
export const ESTADO_SOLICITUD_PROVEEDOR = 2;

export const TIPOS_PROVEEDOR = [
  { clave: 'empresa', nombre: 'Empresa' },
  { clave: 'propietario', nombre: 'Propietario de equipo' },
] as const;
export type TipoProveedor = (typeof TIPOS_PROVEEDOR)[number]['clave'];

export const OFERTAS_PROVEEDOR = [
  { clave: 'renta-maquinaria', nombre: 'Renta de maquinaria pesada', categoria: 'maquinaria-pesada' },
  { clave: 'venta-maquinaria', nombre: 'Venta de maquinaria pesada', categoria: null },
  { clave: 'pipas-volteos', nombre: 'Pipas de agua y volteos', categoria: 'transporte-y-servicios-de-obra' },
  { clave: 'triturados', nombre: 'Triturados: grava, arena y base', categoria: 'triturados' },
  { clave: 'materiales', nombre: 'Materiales para construcción', categoria: 'materiales-para-construccion' },
  { clave: 'asfalto', nombre: 'Carpeta asfáltica', categoria: 'soluciones-asfalticas' },
  { clave: 'otro', nombre: 'Otro servicio', categoria: null },
] as const;
export type OfertaProveedor = (typeof OFERTAS_PROVEEDOR)[number]['clave'];
