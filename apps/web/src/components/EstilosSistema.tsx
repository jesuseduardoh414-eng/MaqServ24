/**
 * SISTEMA DE DISEÑO DEL SITIO (2026-09-30).
 *
 * Una sola hoja con las piezas que comparten TODAS las pantallas: contenedor,
 * encabezado de página, secciones, etiquetas, campos, botones, tarjetas, chips,
 * estados vacíos y cifras. Salió de las pantallas que se rediseñaron primero
 * (cuenta, carrito, buscador) y es la regla para las demás.
 *
 * Reglas que esto fija (identidad MAQSER24):
 *  - Fondos en negro (`--color-bg`); tarjetas en `--color-surface` con borde
 *    de 1 px. El gunmetal solo en elementos, nunca de fondo.
 *  - El azul solo marca acción o datos (botones, enlaces, estado activo).
 *  - Nada de etiquetas en MAYÚSCULAS ESPACIADAS ni rayas gruesas de 2 px:
 *    texto en tipo oración, jerarquía por tamaño y peso.
 *  - Radios: 8 en controles, 12 en tarjetas, 14 en contenedores grandes.
 *  - Movimiento corto (150–220 ms) y foco visible en todo lo que se pulsa.
 *
 * Va como <style> en el layout y no en globals.css porque Turbopack no
 * recompila el global de forma fiable (ver memoria "responsivo").
 */
export function EstilosSistema() {
  return <style id="estilos-sistema" dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
/* ── Página ─────────────────────────────────────────────── */
.ms-page{ background:var(--color-bg); color:var(--color-text); }
.ms-wrap{ max-width:1180px; margin:0 auto; padding:40px 32px 80px; }
.ms-wrap-narrow{ max-width:760px; margin:0 auto; padding:40px 32px 80px; }

/* Encabezado de página (pantallas de trabajo: cuenta, carrito, pedido…) */
.ms-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:28px; }
.ms-head-txt{ min-width:0; }
.ms-kicker{ margin:0 0 8px; font-size:13px; font-weight:600; color:var(--color-primary); }
.ms-title{ margin:0; font-family:var(--font-display); font-size:30px; font-weight:700; letter-spacing:-.025em; line-height:1.15; text-wrap:balance; }
.ms-desc{ margin:8px 0 0; font-size:14.5px; line-height:1.55; color:var(--color-text-muted); max-width:62ch; text-wrap:pretty; }

/* Encabezado de página de presentación (contacto, soluciones, quiénes somos…) */
.ms-hero{ padding:56px 0 40px; border-bottom:1px solid var(--color-border); margin-bottom:48px; }
.ms-hero-title{ margin:0; font-family:var(--font-display); font-size:clamp(32px, 4.4vw, 48px); font-weight:700; letter-spacing:-.03em; line-height:1.08; text-wrap:balance; max-width:22ch; }
.ms-hero-desc{ margin:14px 0 0; font-size:16.5px; line-height:1.6; color:var(--color-text-muted); max-width:60ch; text-wrap:pretty; }
.ms-hero-acts{ display:flex; align-items:center; gap:14px 20px; flex-wrap:wrap; margin-top:24px; }

/* Secciones */
.ms-section{ margin-top:48px; }
.ms-section:first-child{ margin-top:0; }
.ms-h2{ margin:0; font-family:var(--font-display); font-size:21px; font-weight:700; letter-spacing:-.015em; line-height:1.25; }
.ms-h2-desc{ margin:6px 0 0; font-size:14px; line-height:1.55; color:var(--color-text-muted); max-width:62ch; }
.ms-sec-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
.ms-h3{ margin:0; font-size:15.5px; font-weight:600; line-height:1.35; }
.ms-sep{ border:none; border-top:1px solid var(--color-border); margin:28px 0; }
.ms-muted{ color:var(--color-text-muted); }
.ms-small{ font-size:13px; }

/* Tarjetas */
.ms-panel{ background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; padding:24px; min-width:0; }
.ms-panel-lg{ border-radius:14px; padding:28px; }
.ms-panel-flat{ background:transparent; }
a.ms-panel{ color:inherit; text-decoration:none; transition:border-color .18s ease; }
a.ms-panel:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.ms-rows{ display:grid; grid-template-columns:minmax(0,1fr); gap:10px; }
.ms-row{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px 24px; align-items:center; padding:18px 22px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; color:var(--color-text); text-decoration:none; transition:border-color .18s ease; }
a.ms-row:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.ms-kv{ display:flex; justify-content:space-between; gap:12px; padding:6px 0; font-size:14px; color:var(--color-text-muted); }
.ms-kv b, .ms-kv strong{ color:var(--color-text); font-weight:600; font-variant-numeric:tabular-nums; }

/* Rejillas */
.ms-grid2{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:18px 16px; }
.ms-grid3{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; }
.ms-cards{ display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
.ms-split{ display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:40px; align-items:start; }
.ms-span{ grid-column:1 / -1; }

/* Formularios */
.ms-field{ display:grid; gap:7px; align-content:start; min-width:0; }
.ms-label{ font-size:13px; font-weight:500; color:var(--color-text); }
.ms-label .ms-req{ color:var(--color-primary); margin-left:2px; }
.ms-hint{ margin:0; font-size:12.5px; line-height:1.45; color:var(--color-text-muted); }
.ms-error{ margin:0; font-size:12.5px; line-height:1.45; color:var(--color-error); }
.ms-input, .ms-select, .ms-textarea{ width:100%; box-sizing:border-box; min-height:44px; padding:0 13px; font-family:inherit; font-size:14.5px; color:var(--color-text); background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; transition:border-color .18s ease, box-shadow .18s ease; }
.ms-textarea{ padding:11px 13px; min-height:120px; line-height:1.55; resize:vertical; }
.ms-input::placeholder, .ms-textarea::placeholder{ color:color-mix(in srgb, var(--color-text-muted) 70%, transparent); }
.ms-input:hover:not(:disabled), .ms-select:hover:not(:disabled), .ms-textarea:hover:not(:disabled){ border-color:color-mix(in srgb, var(--color-text) 28%, var(--color-border)); }
.ms-input:focus, .ms-select:focus, .ms-textarea:focus{ outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent); }
.ms-input[aria-invalid="true"], .ms-textarea[aria-invalid="true"], .ms-select[aria-invalid="true"]{ border-color:var(--color-error); }
.ms-input:disabled{ color:var(--color-text-muted); cursor:not-allowed; background:color-mix(in srgb, var(--color-text) 3%, var(--color-bg)); }
.ms-check{ width:20px; height:20px; flex-shrink:0; border-radius:6px; border:1.5px solid var(--color-border); background:transparent; color:var(--color-primary-fg); display:grid; place-items:center; padding:0; cursor:pointer; }
.ms-check[data-on="true"], .ms-check[aria-checked="true"]{ background:var(--color-primary); border-color:var(--color-primary); }
.ms-actions{ display:flex; align-items:center; justify-content:flex-end; gap:12px; flex-wrap:wrap; margin-top:22px; }

/* Botones */
.ms-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:0 20px; border-radius:var(--radius-button, 8px); border:1px solid transparent; background:var(--color-primary); color:var(--color-primary-fg); font-family:var(--font-sans); font-size:14.5px; font-weight:600; letter-spacing:0; text-transform:none; text-decoration:none; cursor:pointer; white-space:nowrap; transition:filter .18s ease, transform .12s ease, opacity .18s ease, border-color .18s ease; }
.ms-btn:hover{ filter:brightness(1.08); }
.ms-btn:active{ transform:translateY(1px); }
.ms-btn[disabled], .ms-btn[aria-disabled="true"]{ opacity:.45; cursor:not-allowed; filter:none; transform:none; pointer-events:none; }
.ms-btn-lg{ min-height:50px; padding:0 26px; font-size:15.5px; }
.ms-btn-sm{ min-height:36px; padding:0 14px; font-size:13.5px; }
.ms-btn-block{ width:100%; }
.ms-btn-sec{ background:transparent; color:var(--color-text); border-color:var(--color-border); }
.ms-btn-sec:hover{ filter:none; border-color:var(--color-text-muted); }
.ms-btn-danger{ background:transparent; color:var(--color-error); border-color:color-mix(in srgb, var(--color-error) 45%, var(--color-border)); }
.ms-link{ display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--color-primary); text-decoration:none; background:none; border:none; padding:0; font-family:inherit; cursor:pointer; }
.ms-link svg{ transition:transform .18s ease; }
.ms-link:hover svg{ transform:translateX(3px); }
.ms-link-muted{ color:var(--color-text-muted); }
.ms-link-muted:hover{ color:var(--color-text); }
.ms-btn:focus-visible, .ms-link:focus-visible, .ms-row:focus-visible, a.ms-panel:focus-visible, .ms-check:focus-visible, .ms-tab:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }

/* Chips, pestañas y avisos */
.ms-chip{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; border-radius:6px; padding:3px 9px; white-space:nowrap; border:1px solid var(--color-border); color:var(--color-text-muted); }
.ms-chip-dot::before{ content:''; width:6px; height:6px; border-radius:50%; background:currentColor; }
.ms-chip-ok{ color:var(--color-success); border-color:color-mix(in srgb, var(--color-success) 40%, transparent); background:color-mix(in srgb, var(--color-success) 10%, transparent); }
.ms-chip-warn{ color:var(--color-warning); border-color:color-mix(in srgb, var(--color-warning) 40%, transparent); background:color-mix(in srgb, var(--color-warning) 10%, transparent); }
.ms-chip-bad{ color:var(--color-error); border-color:color-mix(in srgb, var(--color-error) 40%, transparent); background:color-mix(in srgb, var(--color-error) 10%, transparent); }
.ms-chip-info{ color:var(--color-primary); border-color:color-mix(in srgb, var(--color-primary) 40%, transparent); background:color-mix(in srgb, var(--color-primary) 10%, transparent); }
.ms-tabs{ display:flex; gap:6px; flex-wrap:wrap; }
.ms-tab{ display:inline-flex; align-items:center; gap:7px; min-height:36px; padding:0 14px; border-radius:999px; border:1px solid var(--color-border); background:transparent; color:var(--color-text-muted); font:inherit; font-size:13.5px; font-weight:600; text-decoration:none; cursor:pointer; white-space:nowrap; transition:border-color .18s ease, color .18s ease; }
.ms-tab:hover{ color:var(--color-text); }
.ms-tab[aria-current="page"], .ms-tab[aria-selected="true"], .ms-tab[data-on="true"]{ color:var(--color-text); border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 12%, transparent); }
.ms-alert{ display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border-radius:12px; border:1px solid var(--color-border); background:var(--color-surface); font-size:14px; line-height:1.55; }
.ms-alert-warn{ border-color:color-mix(in srgb, var(--color-warning) 40%, var(--color-border)); background:color-mix(in srgb, var(--color-warning) 6%, var(--color-surface)); }
.ms-alert-ok{ border-color:color-mix(in srgb, var(--color-success) 40%, var(--color-border)); background:color-mix(in srgb, var(--color-success) 6%, var(--color-surface)); }
.ms-alert-bad{ border-color:color-mix(in srgb, var(--color-error) 40%, var(--color-border)); background:color-mix(in srgb, var(--color-error) 6%, var(--color-surface)); }
.ms-alert-info{ border-color:color-mix(in srgb, var(--color-primary) 40%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); }

/* Iconos en recuadro, estados vacíos y cifras */
.ms-ico{ width:40px; height:40px; flex-shrink:0; border-radius:10px; display:grid; place-items:center; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 10%, transparent); border:1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); }
.ms-ico-lg{ width:48px; height:48px; border-radius:12px; }
.ms-ico-ok{ color:var(--color-success); background:color-mix(in srgb, var(--color-success) 10%, transparent); border-color:color-mix(in srgb, var(--color-success) 30%, transparent); }
.ms-ico-warn{ color:var(--color-warning); background:color-mix(in srgb, var(--color-warning) 10%, transparent); border-color:color-mix(in srgb, var(--color-warning) 30%, transparent); }
.ms-ico-bad{ color:var(--color-error); background:color-mix(in srgb, var(--color-error) 10%, transparent); border-color:color-mix(in srgb, var(--color-error) 30%, transparent); }
.ms-ico-muted{ color:var(--color-text-muted); background:var(--color-bg); border-color:var(--color-border); }
.ms-empty{ border:1px dashed var(--color-border); border-radius:14px; padding:44px 32px 48px; display:grid; justify-items:start; gap:6px; }
.ms-empty-t{ margin:10px 0 0; font-family:var(--font-display); font-size:20px; font-weight:700; letter-spacing:-.015em; }
.ms-empty-p{ margin:0; font-size:14.5px; color:var(--color-text-muted); line-height:1.55; max-width:56ch; }
.ms-empty-acts{ display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin-top:16px; }
.ms-stats{ display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; }
.ms-stat-n{ display:block; font-family:var(--font-display); font-size:30px; font-weight:700; letter-spacing:-.025em; line-height:1.1; font-variant-numeric:tabular-nums; }
.ms-stat-l{ display:block; margin-top:4px; font-size:13px; color:var(--color-text-muted); }
.ms-num{ font-variant-numeric:tabular-nums; }

/* Pasos (cotizar, checkout) */
.ms-steps{ list-style:none; margin:0; padding:0; display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px; color:var(--color-text-muted); }
.ms-steps li{ display:flex; align-items:center; gap:7px; }
.ms-steps li + li::before{ content:''; width:24px; height:1px; background:var(--color-border); margin-right:1px; }
.ms-steps li > span{ width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font-size:11.5px; font-weight:700; border:1px solid var(--color-border); }
.ms-steps li[data-on="true"]{ color:var(--color-text); font-weight:600; }
.ms-steps li[data-on="true"] > span{ background:var(--color-primary); border-color:var(--color-primary); color:var(--color-primary-fg); }
.ms-steps li[data-done="true"] > span{ border-color:var(--color-primary); color:var(--color-primary); }

@media (max-width: 960px){
  .ms-split{ grid-template-columns:minmax(0,1fr); gap:24px; }
  .ms-grid3{ grid-template-columns:repeat(2, minmax(0,1fr)); }
}
@media (max-width: 640px){
  .ms-wrap, .ms-wrap-narrow{ padding:24px 16px 64px; }
  .ms-title{ font-size:25px; }
  .ms-hero{ padding:32px 0 28px; margin-bottom:32px; }
  .ms-hero-desc{ font-size:15.5px; }
  .ms-grid2, .ms-grid3{ grid-template-columns:minmax(0,1fr); }
  .ms-panel{ padding:18px; }
  .ms-panel-lg{ padding:20px; }
  .ms-empty{ padding:32px 20px 36px; }
  .ms-row{ grid-template-columns:minmax(0,1fr); padding:16px; }
  .ms-section{ margin-top:36px; }
}
`;
