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
.cz{
  --cz-surface: var(--color-surface, #fff);
  --cz-surface-2: var(--surface-2, color-mix(in srgb, var(--color-bg, #fff) 55%, var(--color-surface, #fff)));
  --cz-border: var(--color-border, rgba(0,0,0,.12));
  --cz-text: var(--color-text, #15181c);
  --cz-muted: var(--color-text-muted, #6b7280);
  --cz-accent: var(--color-primary, #008CFF);
  --cz-accent-fg: var(--color-primary-fg, #fff);
  --cz-accent-soft: color-mix(in srgb, var(--cz-accent) 13%, transparent);
  --cz-radius: var(--radius-md, 12px);
  --cz-ok: var(--color-success, #22C55E);
  --cz-bad: var(--color-error, #F87171);
  color: var(--cz-text);
  font-family: var(--font-sans, 'Inter'), system-ui, sans-serif;
}
/* Panel: superficies fijas del admin (ver design-tokens.ts). El acento sigue al tema. */
.cz[data-variante="panel"]{
  --cz-surface:#141416; --cz-surface-2:#101012; --cz-border:rgba(255,255,255,.07);
  --cz-text:#f5f5f4; --cz-muted:#8a8a93;
}
.cz *{ box-sizing:border-box; }
.cz button{ font-family:inherit; }

/* ---- Cabecera + pasos ---- */
.cz-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px; flex-wrap:wrap; margin-bottom:18px; }
.cz-title{ margin:0; font-family:var(--font-heading, inherit); font-size:clamp(23px,3.2vw,31px); letter-spacing:-0.025em; line-height:1.1; }
.cz-sub{ margin:6px 0 0; color:var(--cz-muted); font-size:13.5px; max-width:62ch; }
.cz-steps{ display:flex; gap:6px; list-style:none; margin:0 0 22px; padding:0; flex-wrap:wrap; }
.cz-step{ flex:1 1 118px; min-width:96px; }
.cz-step button{ width:100%; text-align:left; background:transparent; border:none; padding:0 0 9px;
  border-bottom:2px solid var(--cz-border); cursor:default; }
.cz-step button:not(:disabled){ cursor:pointer; }
.cz-step[data-estado="hecho"] button, .cz-step[data-estado="activo"] button{ border-bottom-color:var(--cz-accent); }
.cz-step-n{ display:block; font-size:10px; letter-spacing:.1em; font-weight:700; color:var(--cz-muted); text-transform:uppercase; }
.cz-step[data-estado="hecho"] .cz-step-n, .cz-step[data-estado="activo"] .cz-step-n{ color:var(--cz-accent); }
.cz-step-t{ display:block; margin-top:4px; font-size:12.5px; color:var(--cz-muted); }
.cz-step[data-estado="activo"] .cz-step-t{ color:var(--cz-text); font-weight:700; }

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
.cz-pick{ position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:7px;
  padding:15px 14px; border-radius:var(--cz-radius); border:1px solid var(--cz-border);
  background:var(--cz-surface-2); color:var(--cz-text); cursor:pointer; text-align:left;
  transition:border-color .16s, transform .16s, background .16s; }
.cz-pick:hover{ border-color:color-mix(in srgb, var(--cz-accent) 55%, var(--cz-border)); transform:translateY(-2px); }
.cz-pick[data-on="1"]{ border-color:var(--cz-accent); background:var(--cz-accent-soft); }
.cz-pick .ico{ color:var(--cz-accent); display:flex; }
.cz-pick b{ font-size:13.5px; line-height:1.3; }
.cz-pick .pu{ font-size:11.5px; color:var(--cz-muted); }
.cz-pick .n{ position:absolute; top:9px; right:9px; min-width:21px; height:21px; padding:0 6px;
  border-radius:999px; background:var(--cz-accent); color:var(--cz-accent-fg);
  font-size:11.5px; font-weight:800; display:grid; place-items:center; }

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
.cz-stp{ display:flex; align-items:center; border:1px solid var(--cz-border); border-radius:10px; overflow:hidden; background:var(--cz-surface); }
.cz-stp button{ width:38px; height:42px; border:none; background:transparent; color:var(--cz-text);
  font-size:17px; cursor:pointer; flex-shrink:0; }
.cz-stp button:hover{ background:var(--cz-accent-soft); color:var(--cz-accent); }
.cz-stp input{ flex:1; min-width:0; width:100%; height:42px; border:none; background:transparent;
  color:var(--cz-text); text-align:center; font-size:14px; font-weight:700; font-family:inherit; outline:none; }
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
