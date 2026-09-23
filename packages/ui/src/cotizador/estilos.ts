/**
 * Estilos del cotizador.
 *
 * Van como hoja de estilos y no como `style={{}}` inline por dos razones que
 * pesan más que la comodidad: el flujo tiene que responder a móvil (y los
 * estilos inline no admiten media queries) y el mismo componente se monta en
 * DOS apps con cromo distinto — el panel oscuro y el sitio con tema claro u
 * oscuro según el visitante.
 *
 * La conciliación es un juego corto de variables propias (`--cz-*`) declaradas
 * en la raíz del componente: por defecto siguen a los tokens del tema, y la
 * variante `panel` las reapunta a la paleta fija del admin. Ningún color
 * literal de marca aparece más abajo: cambiar el azul en Diseño mueve también
 * el cotizador, en las dos apps.
 */
export const COTIZADOR_CSS = `
/* Las superficies salen del contrato --ui-* que cada app declara en :root
   (ver el bloque "CONTRATO DE SUPERFICIE" de sus globals.css). Antes se
   redefinían aquí con un override por variante, pero los menús de Radix se
   abren en un portal colgado de <body> y ahí no llegaba nada declarado en
   la raíz del componente: el desplegable salía sin color. */
.cz{
  --cz-surface: var(--ui-surface);
  --cz-surface-2: var(--ui-surface-2);
  --cz-border: var(--ui-border);
  --cz-text: var(--ui-text);
  --cz-muted: var(--ui-muted);
  --cz-accent: var(--ui-accent);
  --cz-accent-fg: var(--ui-accent-fg);
  --cz-accent-soft: var(--ui-accent-soft);
  --cz-radius: var(--ui-radius);
  --cz-ok: var(--color-success, #22C55E);
  --cz-bad: var(--ui-danger);
  color: var(--cz-text);
  font-family: var(--font-sans, 'Inter'), system-ui, sans-serif;
}
.cz *{ box-sizing:border-box; }
.cz button{ font-family:inherit; }

/* ---- Cabecera + pasos ---- */
.cz-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px; flex-wrap:wrap; margin-bottom:18px; }
.cz-title{ margin:0; font-family:var(--font-heading, inherit); font-size:clamp(23px,3.2vw,31px); letter-spacing:-0.025em; line-height:1.1; }
.cz-sub{ margin:6px 0 0; color:var(--cz-muted); font-size:13.5px; max-width:62ch; }
/* ---- Paso a paso ----
   UNA SOLA FILA, siempre. Antes era "flex-wrap: wrap" con celdas de 118px: en
   un teléfono los cinco pasos se acomodaban en una rejilla de dos columnas que
   ya no se leía como una secuencia, que es lo único que un indicador de pasos
   tiene que comunicar. Ahora es una fila que se desplaza, con la línea de
   avance uniéndolos y el paso activo centrado solo (ver "Cotizador.tsx"). */
.cz-steps{
  display:flex; gap:0; list-style:none; margin:0 0 24px; padding:2px 2px 4px;
  flex-wrap:nowrap; overflow-x:auto; overscroll-behavior-x:contain; scroll-behavior:smooth;
}
.cz-step{ position:relative; flex:1 0 auto; min-width:124px; }
/* La línea que une un paso con el siguiente. Arranca del borde del círculo y
   muere en el del siguiente, de ahí los 17px de descuento a cada lado. */
.cz-step::before{
  content:''; position:absolute; top:13px; height:2px; z-index:0;
  left:calc(50% + 17px); right:calc(-50% + 17px);
  background:var(--cz-border); transition:background-color .3s ease;
}
.cz-step:last-child::before{ display:none; }
.cz-step[data-estado="hecho"]::before{ background:var(--cz-accent); }
.cz-step button{
  position:relative; z-index:1; width:100%; display:flex; flex-direction:column; align-items:center;
  gap:7px; background:transparent; border:none; padding:0 8px; cursor:default;
}
.cz-step button:not(:disabled){ cursor:pointer; }
/* El número, dentro de su círculo. Es lo que de verdad marca el estado. */
.cz-step-n{
  position:relative; /* ancla del halo; sin esto se dibujaba en la esquina del paso */
  width:28px; height:28px; border-radius:999px; display:grid; place-items:center; flex-shrink:0;
  font-size:12.5px; font-weight:800; font-variant-numeric:tabular-nums;
  border:2px solid var(--cz-border); background:var(--cz-surface); color:var(--cz-muted);
  transition:background-color .25s ease, border-color .25s ease, color .25s ease, transform .25s ease;
}
.cz-step[data-estado="hecho"] .cz-step-n{
  border-color:var(--cz-accent); background:var(--cz-accent-soft); color:var(--cz-accent);
}
.cz-step[data-estado="activo"] .cz-step-n{
  border-color:var(--cz-accent); background:var(--cz-accent); color:var(--cz-accent-fg);
  transform:scale(1.08);
}
/* Halo del paso activo: late despacio para que el ojo vuelva ahí tras cambiar
   de pantalla, sin competir con el formulario. */
.cz-step[data-estado="activo"] .cz-step-n::after{
  content:''; position:absolute; inset:-2px; border-radius:999px; pointer-events:none;
  border:2px solid var(--cz-accent); animation:czLatido 2s ease-out infinite;
}
@keyframes czLatido{
  0%{ transform:scale(1); opacity:.55; }
  70%{ transform:scale(1.85); opacity:0; }
  100%{ transform:scale(1.85); opacity:0; }
}
.cz-step-t{
  display:block; font-size:12px; line-height:1.3; text-align:center; color:var(--cz-muted);
  transition:color .25s ease;
}
.cz-step[data-estado="activo"] .cz-step-t{ color:var(--cz-text); font-weight:700; }
.cz-step[data-estado="hecho"] .cz-step-t{ color:var(--cz-text); }
@media (prefers-reduced-motion: reduce){
  .cz-steps{ scroll-behavior:auto; }
  .cz-step[data-estado="activo"] .cz-step-n::after{ animation:none; }
  .cz-step-n, .cz-step-t, .cz-step::before{ transition:none; }
}

/* Ayuda del paso: a todo el ancho y ANTES de la rejilla, para que la tarjeta
   del paso y el resumen empiecen a la misma altura. */
.cz-ayuda{ margin:0 0 14px; }

/* ---- Rejilla principal ---- */
.cz-grid{ display:grid; grid-template-columns:minmax(0,1fr) 336px; gap:22px; align-items:start; }
@media (max-width:1000px){ .cz-grid{ grid-template-columns:minmax(0,1fr); } }

.cz-card{ background:var(--cz-surface); border:1px solid var(--cz-border); border-radius:var(--cz-radius); padding:20px; }
.cz-card + .cz-card{ margin-top:14px; }
.cz-card-h{ margin:0 0 4px; font-size:15.5px; font-weight:700; font-family:var(--font-heading, inherit); }
.cz-card-s{ margin:0 0 16px; font-size:12.5px; color:var(--cz-muted); }

/* ---- Campos ---- */
.cz-row{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:13px; }
.cz-field{ display:grid; gap:6px; min-width:0; }
.cz-field.full{ grid-column:1/-1; }
.cz-lbl{ font-size:11.5px; font-weight:700; color:var(--cz-muted); letter-spacing:.02em; }
.cz-lbl .req{ color:var(--cz-accent); }
.cz-input, .cz-select, .cz-textarea{
  width:100%; height:44px; padding:0 13px; border-radius:10px; font-size:14px; font-family:inherit;
  border:1px solid var(--cz-border); background:var(--cz-surface-2); color:var(--cz-text); outline:none;
}
.cz-textarea{ height:auto; min-height:86px; padding:11px 13px; line-height:1.55; resize:vertical; }
.cz-input:focus, .cz-select:focus, .cz-textarea:focus{ border-color:var(--cz-accent); }
.cz-input[aria-invalid="true"]{ border-color:var(--cz-bad); }
.cz-help{ font-size:11.5px; color:var(--cz-muted); }
.cz-err{ font-size:12px; color:var(--cz-bad); }

/* ---- Tarjetas de catálogo ---- */
.cz-cards{ display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:11px; }
/* El "+" y el contador van FUERA del botón: un <button> dentro de otro no es
   HTML válido y el navegador lo desanida, con lo que el "+" dejaba de recibir
   sus propios clics. */
.cz-pick-wrap{ position:relative; display:flex; }
.cz-pick{ flex:1; display:flex; flex-direction:column; align-items:flex-start; gap:7px;
  padding:15px 14px; border-radius:var(--cz-radius); border:1px solid var(--cz-border);
  background:var(--cz-surface-2); color:var(--cz-text); cursor:pointer; text-align:left;
  transition:border-color .16s, transform .16s, background .16s; }
.cz-pick:hover{ border-color:color-mix(in srgb, var(--cz-accent) 55%, var(--cz-border)); transform:translateY(-2px); }
.cz-pick[data-on="1"]{ border-color:var(--cz-accent); background:var(--cz-accent-soft); }
.cz-pick .ico{ color:var(--cz-accent); display:flex; }
.cz-pick b{ font-size:13.5px; line-height:1.3; }
.cz-pick .pu{ font-size:11.5px; color:var(--cz-muted); }
/* Dice en palabras lo que hace el segundo toque: el color por sí solo no
   distingue "elegido" de "elegido y se puede quitar". */
.cz-pick-quitar{ display:inline-flex; align-items:center; gap:4px; margin-top:2px;
  font-size:10.5px; font-weight:700; letter-spacing:.02em; color:var(--cz-accent); opacity:.85; }
.cz-pick-badges{ position:absolute; top:8px; right:8px; display:flex; align-items:center; gap:5px; }
.cz-pick-n{ min-width:21px; height:21px; padding:0 6px; border-radius:999px;
  background:var(--cz-accent); color:var(--cz-accent-fg);
  font-size:11.5px; font-weight:800; display:grid; place-items:center; }
.cz-pick-mas{ width:21px; height:21px; border-radius:999px; display:grid; place-items:center;
  border:1px solid var(--cz-accent); background:var(--cz-surface); color:var(--cz-accent); cursor:pointer; padding:0; }
.cz-pick-mas:hover{ background:var(--cz-accent); color:var(--cz-accent-fg); }

/* ---- Líneas del carrito ---- */
.cz-line{ border:1px solid var(--cz-border); border-radius:var(--cz-radius); background:var(--cz-surface-2); padding:14px; }
.cz-line + .cz-line{ margin-top:11px; }
.cz-line-h{ display:flex; align-items:flex-start; gap:11px; margin-bottom:12px; }
.cz-line-h .ico{ color:var(--cz-accent); flex-shrink:0; }
.cz-line-h .nm{ flex:1; min-width:0; }
.cz-line-h .nm b{ display:block; font-size:14px; }
.cz-line-h .nm span{ display:block; font-size:11.5px; color:var(--cz-muted); margin-top:2px; }
.cz-tier{ font-size:10.5px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
  color:var(--cz-accent); background:var(--cz-accent-soft); padding:4px 9px; border-radius:999px; white-space:nowrap; }
.cz-rm{ border:none; background:transparent; color:var(--cz-muted); cursor:pointer; font-size:17px; line-height:1; padding:2px 4px; }
.cz-rm:hover{ color:var(--cz-bad); }
.cz-ctrl{ display:flex; flex-wrap:wrap; gap:11px; }
.cz-qty{ flex:1 1 120px; min-width:104px; display:grid; gap:5px; }
.cz-qty.wide{ flex-basis:100%; }
.cz-stp{ display:flex; align-items:center; border:1px solid var(--cz-border);
  border-radius:var(--cz-radius); overflow:hidden; background:var(--cz-surface-2); }
.cz-stp:focus-within{ border-color:var(--cz-accent); }
.cz-stp button{ width:38px; height:42px; border:none; background:transparent; color:var(--cz-text);
  display:grid; place-items:center; cursor:pointer; flex-shrink:0; }
.cz-stp button:hover:not(:disabled){ background:var(--cz-accent-soft); color:var(--cz-accent); }
.cz-stp button:disabled{ opacity:.35; cursor:not-allowed; }
.cz-stp input{ flex:1; min-width:0; width:100%; height:42px; border:none; background:transparent;
  color:var(--cz-text); text-align:center; font-size:14px; font-weight:700; font-family:inherit; outline:none;
  -moz-appearance:textfield; }
.cz-stp input::-webkit-outer-spin-button, .cz-stp input::-webkit-inner-spin-button{ appearance:none; margin:0; }
.cz-chips{ display:flex; flex-wrap:wrap; gap:6px; }
.cz-chip{ border:1px solid var(--cz-border); background:var(--cz-surface); color:var(--cz-muted);
  border-radius:999px; padding:6px 11px; font-size:12px; font-weight:600; cursor:pointer; }
.cz-chip:hover{ border-color:var(--cz-accent); color:var(--cz-text); }
.cz-chip[data-on="1"]{ background:var(--cz-accent); border-color:var(--cz-accent); color:var(--cz-accent-fg); }
.cz-money{ margin-top:12px; padding-top:11px; border-top:1px dashed var(--cz-border); display:grid; gap:4px; }
.cz-money .mr{ display:flex; justify-content:space-between; gap:12px; font-size:12.5px; color:var(--cz-muted); }
.cz-money .mr.sub{ color:var(--cz-text); font-weight:700; font-size:13.5px; }

/* ---- Resumen lateral ---- */
.cz-side{ position:sticky; top:16px; background:var(--cz-surface); border:1px solid var(--cz-border);
  border-radius:var(--cz-radius); overflow:hidden; }
@media (max-width:1000px){ .cz-side{ position:static; } }
.cz-side-h{ display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:14px 17px; border-bottom:1px solid var(--cz-border); }
.cz-side-h h3{ margin:0; font-size:14.5px; font-family:var(--font-heading, inherit); }
.cz-side-h span{ font-size:11.5px; color:var(--cz-muted); }
.cz-side-b{ padding:14px 17px; display:grid; gap:7px; }
.cz-fr{ display:flex; justify-content:space-between; gap:12px; font-size:13px; color:var(--cz-muted); }
.cz-fr b{ color:var(--cz-text); font-weight:600; }
.cz-fr.total{ margin-top:6px; padding-top:11px; border-top:1px solid var(--cz-border);
  font-size:15px; color:var(--cz-text); font-weight:800; }
.cz-fr.total b{ font-size:21px; font-weight:800; letter-spacing:-0.02em; }
.cz-side-empty{ padding:26px 17px; text-align:center; color:var(--cz-muted); font-size:12.5px; }
.cz-side-empty .ico{ color:var(--cz-border); display:flex; justify-content:center; margin-bottom:8px; }

/* ---- Botones ---- */
.cz-nav{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; flex-wrap:wrap; }
.cz-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; height:46px; padding:0 20px;
  border-radius:var(--radius-button, 10px); font-size:14px; font-weight:700; cursor:pointer; border:1px solid transparent; }
.cz-btn:disabled{ opacity:.5; cursor:not-allowed; }
.cz-btn.primary{ background:var(--cz-accent); color:var(--cz-accent-fg); }
.cz-btn.ghost{ background:transparent; border-color:var(--cz-border); color:var(--cz-text); }
.cz-btn.ghost:hover:not(:disabled){ border-color:var(--cz-accent); color:var(--cz-accent); }
.cz-btn.sm{ height:38px; padding:0 14px; font-size:13px; }

/* ---- Bloque de aviso ---- */
.cz-note{ border-left:3px solid var(--cz-accent); background:var(--cz-accent-soft);
  padding:11px 14px; border-radius:0 10px 10px 0; font-size:12.5px; color:var(--cz-text); }
.cz-note.bad{ border-left-color:var(--cz-bad); background:color-mix(in srgb, var(--cz-bad) 12%, transparent); }

/* ---- Ajustes del total (último paso) ----
   Solo aparece cuando los importes NO acompañan los pasos: el flete y la
   factura se piden aquí, junto al documento. Va en punteado y sobre la
   superficie 2 para leerse como un apartado DENTRO de la tarjeta del resumen
   y no como otra tarjeta suelta. */
.cz-ajuste{ display:grid; gap:13px; margin:16px 0 0; padding:15px 16px;
  border:1px dashed var(--cz-border); border-radius:var(--cz-radius); background:var(--cz-surface-2); }
.cz-ajuste > header{ display:grid; gap:3px; }
.cz-ajuste h3{ margin:0; font-size:13.5px; font-weight:700; font-family:var(--font-heading, inherit); }
.cz-ajuste header p{ margin:0; font-size:12px; color:var(--cz-muted); }

/* ---- El costo, al final ----
   Solo en el sitio: cierra el último paso con el número que la persona vino a
   buscar, antes del documento. Va sobre el acento —no en gris como el resto
   del desglose— porque es la respuesta, no un dato más. */
.cz-total{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap;
  margin-top:16px; padding:15px 17px; border-radius:var(--cz-radius);
  border:1px solid var(--cz-accent); background:var(--cz-accent-soft); }
.cz-total .n{ display:grid; gap:3px; }
.cz-total .n > span{ font-size:11.5px; font-weight:700; letter-spacing:.02em; color:var(--cz-muted); }
.cz-total .n b{ font-size:clamp(26px,6vw,32px); font-weight:800; letter-spacing:-0.03em; line-height:1; }
.cz-total .d{ margin:0; font-size:12px; color:var(--cz-muted); text-align:right; }
@media (max-width:560px){ .cz-total .d{ text-align:left; } }

/* ---- Vista previa del documento ---- */
.cz-preview{ border:1px solid var(--cz-border); border-radius:var(--cz-radius); overflow:auto; background:#fff; }
.cz-preview .czdoc{ min-width:620px; }

/* ---- Acuse ---- */
.cz-done{ text-align:center; padding:38px 20px; }
.cz-done .mark{ width:62px; height:62px; margin:0 auto 16px; border-radius:999px;
  background:var(--cz-accent-soft); color:var(--cz-accent); display:grid; place-items:center; font-size:29px; }
.cz-done h2{ margin:0 0 8px; font-family:var(--font-heading, inherit); font-size:24px; }
.cz-done p{ margin:0 auto 20px; color:var(--cz-muted); font-size:14px; max-width:46ch; }
.cz-folio{ display:inline-block; font-size:20px; font-weight:800; letter-spacing:.04em;
  padding:9px 18px; border-radius:10px; border:1px dashed var(--cz-accent); color:var(--cz-accent); margin-bottom:20px; }
.cz-done-acts{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
`;
