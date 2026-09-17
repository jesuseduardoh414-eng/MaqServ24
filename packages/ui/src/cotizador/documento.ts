import type { CalculoCotizacion, EmpresaCotizador, FirmaCotizador } from '@maqserv/config';
import { cantidad, esc, fechaLarga, money2 } from './formato';

/**
 * EL DOCUMENTO DE COTIZACIÓN.
 *
 * Se genera como HTML plano, no como componente React, por una razón concreta:
 * es lo mismo que se ve en pantalla y lo que sale por la impresora. Si fueran
 * dos implementaciones, el PDF que recibe el cliente podría no coincidir con el
 * que revisó quien lo envió — y eso solo se descubre cuando ya se envió.
 *
 * Se imprime SIEMPRE sobre papel blanco, así que aquí los colores son
 * literales. Es la única parte del proyecto donde eso es correcto: el tema
 * oscuro del sitio no se imprime, y un documento comercial con fondo negro
 * gasta tóner y no se lee en fotocopia. Lo único que sigue a la marca es el
 * acento, que entra por parámetro.
 */
export interface DatosDocumento {
  titulo: string;
  folio: string;
  fecha?: Date | string | null;
  cliente: string;
  obra?: string;
  atencion?: string;
  municipio?: string;
  notas?: string;
  empresa: EmpresaCotizador;
  firma: FirmaCotizador;
  saludo: string;
  calc: CalculoCotizacion;
  /** Con precios ocultos sale como "solicitud": conceptos sí, importes no. */
  mostrarPrecios: boolean;
  /** Logo para fondo claro. Sin él se imprime el nombre de la empresa. */
  logo?: string | null;
  acento?: string;
}

export const DOCUMENTO_CSS = `
.czdoc{ background:#fff; color:#15181c; font-family:'Inter',system-ui,-apple-system,sans-serif;
  font-size:12px; line-height:1.55; padding:34px 38px; box-sizing:border-box; }
.czdoc *{ box-sizing:border-box; }
.czdoc h4{ margin:0 0 6px; font-size:12px; }
.czdoc .czdoc-hd{ display:flex; align-items:flex-start; justify-content:space-between; gap:24px;
  border-bottom:2px solid var(--czdoc-accent); padding-bottom:16px; margin-bottom:18px; }
.czdoc .czdoc-logo img{ height:44px; width:auto; max-width:230px; object-fit:contain; display:block; }
.czdoc .czdoc-logo b{ font-size:22px; letter-spacing:-0.02em; }
.czdoc .czdoc-co{ text-align:right; font-size:10.5px; color:#5a626b; line-height:1.5; }
.czdoc .czdoc-co b{ display:block; font-size:12.5px; color:#15181c; margin-bottom:3px; }
.czdoc .czdoc-kind{ display:inline-block; margin-top:6px; padding:3px 9px; border-radius:4px;
  background:var(--czdoc-accent); color:#fff; font-size:9.5px; font-weight:700;
  letter-spacing:.09em; text-transform:uppercase; }
.czdoc .czdoc-meta{ display:grid; grid-template-columns:repeat(auto-fit,minmax(118px,1fr)); gap:1px;
  background:#e3e7eb; border:1px solid #e3e7eb; border-radius:6px; overflow:hidden; margin-bottom:16px; }
.czdoc .czdoc-meta .b{ background:#f7f9fb; padding:8px 11px; font-size:11.5px; font-weight:600; }
.czdoc .czdoc-meta .b span{ display:block; font-size:9px; letter-spacing:.08em; text-transform:uppercase;
  color:#78818b; font-weight:700; margin-bottom:2px; }
.czdoc .czdoc-greet{ margin:0 0 16px; font-size:11.5px; color:#3d444c; }
.czdoc table{ width:100%; border-collapse:collapse; margin-bottom:14px; }
.czdoc thead th{ background:#11161c; color:#fff; font-size:9.5px; letter-spacing:.07em;
  text-transform:uppercase; padding:7px 8px; text-align:left; font-weight:700; }
.czdoc tbody td{ padding:7px 8px; border-bottom:1px solid #e8ebef; font-size:11px; vertical-align:top; }
.czdoc tbody tr.flete td{ color:#5a626b; font-size:10.5px; }
.czdoc td.r, .czdoc th.r{ text-align:right; white-space:nowrap; }
.czdoc td.concepto{ font-weight:600; }
.czdoc .czdoc-tot{ margin-left:auto; width:262px; }
.czdoc .czdoc-tot .tr{ display:flex; justify-content:space-between; padding:5px 0; font-size:11.5px; }
.czdoc .czdoc-tot .tr.g{ border-top:2px solid #11161c; margin-top:4px; padding-top:8px;
  font-size:15px; font-weight:800; }
.czdoc .czdoc-note{ margin:14px 0 0; padding:9px 12px; border-left:3px solid var(--czdoc-accent);
  background:#f5f8fb; font-size:11px; color:#3d444c; }
.czdoc .czdoc-cond{ margin-top:16px; break-inside:avoid; }
.czdoc .czdoc-cond h4{ font-size:10.5px; text-transform:uppercase; letter-spacing:.07em;
  color:var(--czdoc-accent); }
.czdoc .czdoc-cond ul{ margin:0; padding-left:16px; }
.czdoc .czdoc-cond li{ font-size:10.5px; color:#3d444c; margin-bottom:3px; }
.czdoc .czdoc-sign{ margin-top:30px; padding-top:14px; border-top:1px solid #e3e7eb;
  text-align:center; break-inside:avoid; }
.czdoc .czdoc-sign b{ display:block; font-size:12px; }
.czdoc .czdoc-sign span{ font-size:10.5px; color:#5a626b; }
.czdoc .czdoc-foot{ margin-top:14px; text-align:center; font-size:9.5px; color:#8b939c; }
@media print{
  @page{ size:letter; margin:12mm; }
  .czdoc{ padding:0; }
}
`;

/** El cuerpo del documento. Devuelve HTML ya escapado. */
export function documentoCuerpo(d: DatosDocumento): string {
  const { calc, empresa, firma } = d;
  const acento = d.acento || '#008CFF';
  const fecha = d.fecha ? new Date(d.fecha) : new Date();
  const conPrecio = d.mostrarPrecios;

  // El número de renglón salta los fletes a propósito: el flete no es una
  // partida que el cliente pidió, es el costo de llevarle la que pidió.
  let n = 0;
  const filas = calc.renglones
    .map((r) => {
      const num = r.clase === 'flete' ? '' : String(++n);
      const importes = conPrecio
        ? `<td class="r">${money2(r.pu)}</td><td class="r">${money2(r.importe)}</td>`
        : '';
      return `<tr class="${esc(r.clase)}"><td>${num}</td><td class="concepto">${esc(r.concepto)}</td>
        <td>${esc(r.unidad)}</td><td class="r">${cantidad(r.cantidad, r.unidad)}</td>${importes}</tr>`;
    })
    .join('');

  const encabezados = conPrecio
    ? '<th>No.</th><th>Concepto</th><th>U.</th><th class="r">Cant.</th><th class="r">P.U.</th><th class="r">Importe</th>'
    : '<th>No.</th><th>Concepto</th><th>U.</th><th class="r">Cant.</th>';

  const totales = conPrecio
    ? `<div class="czdoc-tot">
        <div class="tr"><span>Subtotal</span><span>${money2(calc.subtotal)}</span></div>
        ${calc.con_iva ? `<div class="tr"><span>I.V.A. ${Math.round(calc.iva_tasa * 100)}%</span><span>${money2(calc.iva)}</span></div>` : ''}
        <div class="tr g"><span>Total</span><span>${money2(calc.total)}</span></div>
      </div>`
    : `<div class="czdoc-note">Esta solicitud no incluye importes. Un asesor le enviará la
        cotización con precios y vigencia.</div>`;

  const marca = d.logo
    ? `<img src="${esc(d.logo)}" alt="${esc(empresa.nombre)}">`
    : `<b>${esc(empresa.nombre)}</b>`;

  // Cada línea fiscal solo se imprime si existe. Un documento que dice
  // "RFC: —" es peor que uno que no menciona el RFC.
  const datosEmpresa = [
    empresa.rfc ? `RFC: ${esc(empresa.rfc)}` : '',
    empresa.direccion ? esc(empresa.direccion) : '',
    [empresa.telefono ? `Tel. ${esc(empresa.telefono)}` : '', esc(empresa.correo)].filter(Boolean).join(' · '),
    empresa.web ? esc(empresa.web) : '',
  ]
    .filter(Boolean)
    .join('<br>');

  const meta = [
    ['Cliente', d.cliente],
    ['Obra', d.obra],
    ['Atención', d.atencion],
    ['Municipio', d.municipio],
    ['Folio', d.folio],
    ['Fecha', fechaLarga(fecha)],
  ]
    .filter(([, v]) => String(v ?? '').trim().length > 0)
    .map(([k, v]) => `<div class="b"><span>${esc(k)}</span>${esc(v)}</div>`)
    .join('');

  const condiciones = (calc.condiciones ?? [])
    .map(
      (b) =>
        `<div class="czdoc-cond"><h4>${esc(b.titulo)}</h4><ul>${b.puntos
          .map((p) => `<li>${esc(p)}</li>`)
          .join('')}</ul></div>`,
    )
    .join('');

  const notas = d.notas?.trim() ? `<div class="czdoc-note"><b>Notas:</b> ${esc(d.notas)}</div>` : '';

  const firmaHtml = firma.nombre?.trim()
    ? `<div class="czdoc-sign"><b>${esc(firma.nombre)}</b>
        <span>${[esc(firma.puesto), esc(firma.telefono)].filter(Boolean).join(' · ')}</span></div>`
    : '';

  return `<div class="czdoc" style="--czdoc-accent:${esc(acento)}">
    <div class="czdoc-hd">
      <div class="czdoc-logo">${marca}<div class="czdoc-kind">${esc(d.titulo)}</div></div>
      <div class="czdoc-co"><b>${esc(empresa.nombre)}</b>${datosEmpresa}</div>
    </div>
    <div class="czdoc-meta">${meta}</div>
    <p class="czdoc-greet">${esc(d.saludo)}</p>
    <table><thead><tr>${encabezados}</tr></thead><tbody>${filas}</tbody></table>
    ${totales}
    ${notas}
    ${condiciones}
    ${firmaHtml}
    <div class="czdoc-foot">Documento generado por ${esc(empresa.nombre)} · ${esc(d.folio)}</div>
  </div>`;
}

/** Documento completo, con sus estilos: lo que se manda a la ventana de impresión. */
export function documentoHtml(d: DatosDocumento): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${esc(d.folio)} · ${esc(d.titulo)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>html,body{margin:0;padding:0;background:#fff}${DOCUMENTO_CSS}</style>
    </head><body>${documentoCuerpo(d)}</body></html>`;
}

/**
 * Abre el documento en una ventana aparte y lanza el diálogo de impresión
 * (de ahí sale el PDF, con "Guardar como PDF").
 *
 * Va en ventana propia y no con un `@media print` sobre la página actual
 * porque el panel y el sitio traen cada uno su cromo —barras, menús, modales—
 * y esconderlo todo para imprimir es una lista de excepciones que se rompe con
 * cada pantalla nueva. Aquí lo que se imprime es exactamente lo que se ve.
 *
 * Si el navegador bloquea la ventana emergente devuelve `false` y la pantalla
 * lo dice; sin eso, el botón "no hace nada" y parece un error del sistema.
 */
export function imprimirDocumento(d: DatosDocumento): boolean {
  if (typeof window === 'undefined') return false;
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.open();
  win.document.write(documentoHtml(d));
  win.document.close();
  // Sin la espera, Chrome imprime antes de que la fuente y el logo carguen y
  // sale un documento con tipografía de respaldo.
  win.addEventListener('load', () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
  });
  return true;
}
