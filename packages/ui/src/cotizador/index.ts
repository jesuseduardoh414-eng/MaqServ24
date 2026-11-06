export { Cotizador, type CotizadorProps, type DatosEnvio, type ResultadoEnvio } from './Cotizador';
export { VistaDocumento } from './VistaDocumento';
export { IconoCotizador } from './iconos';
// Las piezas del cotizador, para lo que el sitio arma junto a él (lo que se cotiza a la medida, 2026-11-03).
export { Tarjeta, NumeroTexto } from './piezas';
// Las categorías de una cotización (sitio, panel y enlace, 2026-11-03).
export { useCategorias, unidadDeProducto, claveDeProducto, type ProductoALaMedida } from './categorias';
export { COTIZADOR_CSS } from './estilos';
// La zona de flete de triturados de un municipio (Tarifas la usa para decir cuáles no tienen, 2026-11-06).
export { zonaDelMunicipio } from './pasos-triturados';
export {
  DOCUMENTO_CSS,
  documentoCuerpo,
  documentoHtml,
  imprimirDocumento,
  type DatosDocumento,
} from './documento';
// El documento como archivo PDF: el panel lo descarga para mandarlo por WhatsApp (2026-11-04).
export { documentoPdf, descargarArchivo } from './pdf';
export { money, money2, cantidad, fechaCorta, fechaLarga } from './formato';
export { aLineas, aPartidas, lineasDeFicha, type ClientePanel, type ContextoCotizador, type EmpresaCliente, type LineaCotizador } from './estado';
