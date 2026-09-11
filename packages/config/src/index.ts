export * from './schema';
export { defaultTheme } from './default-theme';
export { LEGAL_DEFAULTS, type LegalDocDefault } from './legal-defaults';
export { themeToCss } from './css-vars';
export { slugify, productSlug, parseProductSlug } from './slug';
export { googleFontsHrefs } from './google-fonts';
export {
  REQUEST_FORMS,
  requestFormFor,
  requestAnswersToText,
  type RequestField,
  type RequestFieldType,
  type RequestForm,
} from './request-fields';
export {
  UNIDADES,
  UNIDADES_POR_CATEGORIA,
  unidadesDe,
  unidadPorDefectoDe,
  formatearCantidad,
  esUnidadDeTiempo,
  precioEnUnidad,
  unidadesEquivalentes,
  etiquetaPrecio,
  unidadDeCarrito,
  claveDeCarrito,
  precioPeriodoCarrito,
  unidadDeCobro,
  type UnidadServicio,
} from './service-units';
export {
  ATRIBUTOS_POR_CATEGORIA,
  atributosDe,
  numeroDe,
  desajustes,
  fichaDe,
  type AtributoProducto,
  type Desajuste,
} from './product-attributes';
export {
  MODULOS_ADMIN,
  ROLES_ADMIN,
  ROL_POR_DEFECTO,
  rolDeAdmin,
  puedeVer,
  modulosDe,
  type ModuloAdmin,
  type RolAdmin,
  type DefinicionRol,
} from './admin-roles';
