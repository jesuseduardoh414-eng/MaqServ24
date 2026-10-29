/**
 * ESTILOS DEL PORTAL DEL ALIADO (rediseño 2026-10-27).
 *
 * El portal usa las piezas `ms-*` del sistema de diseño (EstilosSistema) como
 * la cuenta del cliente; aquí solo va lo propio del portal, con prefijo `al-`
 * (marco y pantallas) y `so-` (la lista + detalle de Solicitudes).
 *
 * Los campos van a 16 px en teléfono: por debajo de eso, iOS hace zoom al
 * enfocar el campo (el sistema los deja en 14.5 px).
 */
export const CSS = `
/* ── Marco: barra lateral + contenido ─────────────────────── */
.al-root{ max-width:1180px; margin:0 auto; padding:32px 32px 80px; }
.al-grid{ display:grid; grid-template-columns:248px minmax(0,1fr); gap:44px; align-items:start; }
.al-side{ position:sticky; top:92px; display:grid; gap:18px; min-width:0; }
.al-main{ min-width:0; }
.al-vista{ display:grid; gap:28px; align-content:start; }
.al-vh{ margin-bottom:0; }
.al-vh .ms-title{ font-size:26px; }

.al-me{ display:flex; gap:12px; align-items:flex-start; padding-bottom:18px; border-bottom:1px solid var(--color-border); min-width:0; }
.al-avatar{ width:48px; height:48px; border-radius:12px; flex-shrink:0; display:grid; place-items:center; background:var(--color-surface); color:var(--color-text); font-family:var(--font-display); font-weight:700; font-size:17px; letter-spacing:.02em; border:1px solid var(--color-border); }
.al-me-txt{ min-width:0; }
.al-me-k{ margin:0; font-size:12px; font-weight:600; color:var(--color-primary); }
.al-me-n{ margin:2px 0 0; font-size:15px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; }
.al-me-chips{ display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }

.al-nav{ display:grid; gap:2px; }
.al-nav-b{ display:flex; align-items:center; gap:11px; min-height:42px; padding:0 12px; border-radius:8px; color:var(--color-text-muted); text-decoration:none; font-size:14.5px; font-weight:500; position:relative; transition:background .18s ease, color .18s ease; min-width:0; }
.al-nav-b:hover{ background:color-mix(in srgb, var(--color-text) 6%, transparent); color:var(--color-text); }
.al-nav-b[aria-current="page"]{ background:color-mix(in srgb, var(--color-primary) 13%, transparent); color:var(--color-text); font-weight:600; }
.al-nav-b[aria-current="page"]::before{ content:''; position:absolute; left:0; top:10px; bottom:10px; width:3px; border-radius:3px; background:var(--color-primary); }
.al-nav-b[aria-current="page"] > svg{ color:var(--color-primary); }
.al-nav-b:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.al-nav-b > svg{ flex-shrink:0; }
.al-nav-b > span{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-nav-b .al-insignia, .al-nav-b .al-punto{ margin-left:auto; }
.al-insignia{ display:inline-grid; place-items:center; min-width:22px; height:22px; padding:0 7px; border-radius:999px; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; line-height:1; background:var(--color-primary); color:var(--color-primary-fg); flex-shrink:0; }
.al-insignia[data-tono="warn"]{ background:var(--color-warning); color:#15181d; }
.al-insignia[data-tono="bad"]{ background:var(--color-error); color:#fff; }
.al-insignia[data-tono="muted"]{ background:color-mix(in srgb, var(--color-text) 10%, transparent); color:var(--color-text-muted); }
.al-punto{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }

.al-ayuda{ padding-top:16px; border-top:1px solid var(--color-border); display:grid; gap:2px; }
.al-ayuda-k{ margin:0 0 4px; padding:0 12px; font-size:12px; font-weight:600; color:var(--color-text-muted); }
.al-ayuda a{ display:flex; align-items:center; gap:10px; min-height:36px; padding:0 12px; border-radius:8px; color:var(--color-text-muted); text-decoration:none; font-size:13.5px; font-weight:500; min-width:0; overflow-wrap:anywhere; transition:background .18s ease, color .18s ease; }
.al-ayuda a:hover{ background:color-mix(in srgb, var(--color-text) 6%, transparent); color:var(--color-text); }
.al-ayuda a svg{ flex-shrink:0; }
.al-ayuda-h{ display:flex; gap:10px; align-items:center; padding:0 12px; min-height:32px; font-size:13px; color:var(--color-text-muted); }
.al-ayuda-nota{ margin:8px 0 0; padding:0 12px; font-size:12px; color:var(--color-text-muted); line-height:1.5; }
.al-ayuda-mob{ display:none; }
.al-tabs-mob{ display:none; }

/* ── Pestañas dentro de una pantalla ───────────────────────── */
.al-sub{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.al-sub .ms-tab{ gap:8px; }
.al-sub .ms-tab .al-insignia{ min-width:20px; height:20px; font-size:11.5px; padding:0 6px; }
.al-sub .ms-tab[aria-selected="false"] .al-insignia{ background:color-mix(in srgb, var(--color-text) 10%, transparent); color:var(--color-text-muted); }
.al-orden{ margin:0; font-size:13px; color:var(--color-text-muted); display:flex; gap:6px; align-items:center; line-height:1.5; }
.al-orden svg{ flex-shrink:0; }
.al-barra-sup{ display:flex; justify-content:space-between; align-items:center; gap:12px 20px; flex-wrap:wrap; }

/* ── Inicio ────────────────────────────────────────────────── */
.al-avisos{ display:grid; gap:10px; }
.al-aviso{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:14px; align-items:center; padding:16px 18px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; }
.al-aviso[data-tono="info"]{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.al-aviso[data-tono="warn"]{ border-color:color-mix(in srgb, var(--color-warning) 50%, var(--color-border)); }
.al-aviso[data-tono="bad"]{ border-color:color-mix(in srgb, var(--color-error) 50%, var(--color-border)); }
.al-aviso-t{ margin:0; font-size:15px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; }
.al-aviso-p{ margin:3px 0 0; font-size:13.5px; color:var(--color-text-muted); line-height:1.5; overflow-wrap:anywhere; }
.al-kpis{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; }
.al-kpi{ display:block; width:100%; text-align:left; padding:16px 18px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; color:inherit; font:inherit; cursor:pointer; transition:border-color .18s ease; min-width:0; }
.al-kpi:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.al-kpi:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.al-kpi .ms-stat-l{ display:flex; align-items:center; gap:6px; margin:0 0 6px; }
.al-kpi .ms-stat-n{ font-size:26px; }
.al-kpi .al-stat-txt{ font-size:17px; line-height:1.55; }
.al-hoy{ display:grid; gap:10px; }
.al-hoy-i{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px 16px; align-items:center; padding:14px 18px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; }
.al-hoy-t{ font-size:14.5px; font-weight:600; overflow-wrap:anywhere; }
.al-hoy-s{ display:block; font-size:13px; color:var(--color-text-muted); margin-top:3px; overflow-wrap:anywhere; }

.al-barra{ height:6px; border-radius:999px; background:color-mix(in srgb, var(--color-text) 10%, transparent); overflow:hidden; }
.al-barra > span{ display:block; height:100%; border-radius:999px; }

.al-pasos{ list-style:none; padding:0; margin:16px 0 0; display:grid; gap:12px; }
.al-pasos li{ display:flex; gap:11px; align-items:flex-start; }
.al-paso-ico{ width:22px; height:22px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; margin-top:1px; border:1.5px solid var(--color-border); }
.al-paso-ico[data-on="true"]{ background:var(--color-success); border-color:var(--color-success); color:var(--color-bg); }
.al-paso-t{ font-size:14.5px; font-weight:600; }
.al-paso-t[data-on="true"]{ text-decoration:line-through; color:var(--color-text-muted); font-weight:500; }
.al-paso-a{ display:block; font-size:13px; color:var(--color-text-muted); margin-top:2px; line-height:1.5; }
.al-paso-a button{ font-size:13px; }

/* ── Solicitudes: lista a la izquierda, la elegida a la derecha ── */
.so-grid{ display:grid; grid-template-columns:minmax(0,330px) minmax(0,1fr); gap:20px; align-items:start; }
.so-lista{ display:grid; gap:8px; min-width:0; }
.so-fila{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:3px 12px; align-items:start; width:100%; text-align:left; padding:13px 15px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; color:inherit; font:inherit; cursor:pointer; transition:border-color .18s ease, background .18s ease; min-width:0; }
.so-fila:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.so-fila[aria-current="true"]{ border-color:color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
.so-fila:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.so-fila-top{ grid-column:1 / -1; display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:12px; color:var(--color-text-muted); margin-bottom:4px; }
.so-fila-top .ms-num{ white-space:nowrap; }
.so-fila-t{ font-size:14.5px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; min-width:0; }
.so-fila-s{ font-size:13px; color:var(--color-text-muted); margin-top:2px; overflow-wrap:anywhere; grid-column:1; }
.so-fila-m{ grid-row:2 / span 2; grid-column:2; font-size:13.5px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; text-align:right; align-self:center; }
.so-fila-n{ grid-column:1 / -1; margin-top:6px; font-size:12.5px; font-weight:600; color:var(--color-warning); display:flex; gap:5px; align-items:center; }
.so-fila-n[data-tono="muted"]{ color:var(--color-text-muted); font-weight:500; }
.so-fila-n svg{ flex-shrink:0; }
.so-fila-ir{ display:none; }
.so-detalle{ min-width:0; scroll-margin-top:90px; }
.so-detalle .al-importe{ text-align:left; }
.so-volver{ display:none; }
.so-sugerencia{ padding:22px 24px; border:1px dashed var(--color-border); border-radius:12px; font-size:14px; color:var(--color-text-muted); line-height:1.55; }

/* ── Tarjeta de una solicitud o servicio ───────────────────── */
.al-card-top{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start; }
.al-card-top > div{ min-width:0; }
.al-nueva{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.al-folio{ font-size:13px; color:var(--color-text-muted); }
.al-card-t{ margin:8px 0 0; font-size:18px; font-weight:700; line-height:1.3; overflow-wrap:anywhere; }
.al-importe{ text-align:right; }
.al-importe b{ display:block; font-family:var(--font-display); font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; }
.al-detalle{ margin-top:14px; padding:12px 14px; border-radius:8px; background:var(--color-bg); border:1px solid var(--color-border); font-size:14px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
.al-acciones{ display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
.al-acciones > .ms-btn{ flex:1 1 150px; }
.al-acciones > .ms-btn-sec.al-cancelar{ flex:0 1 auto; }
.al-form{ display:grid; gap:14px; margin-top:16px; }
.al-dos{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px 16px; }
.al-stack{ display:grid; gap:12px; }
.al-pide{ margin-top:14px; padding:12px 14px; border-radius:10px; background:rgba(127,127,127,.06); border:1px solid var(--color-border); }
.al-pide dl{ margin:8px 0 0; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px 16px; }
.al-pide dl > div{ min-width:0; }
.al-pide dt{ font-size:12px; color:var(--color-text-muted); }
.al-pide dd{ margin:2px 0 0; font-size:14px; font-weight:600; overflow-wrap:anywhere; }
.al-dato-l{ font-size:13px; color:var(--color-text-muted); }
.al-dato-v{ font-size:14.5px; margin-top:3px; overflow-wrap:anywhere; }
.al-dato-v a{ color:var(--color-primary); font-weight:600; }
.al-exige{ margin-top:12px; font-size:13px; color:var(--color-warning); display:flex; gap:6px; align-items:flex-start; }
.al-exige svg{ flex-shrink:0; margin-top:2px; }
.al-avance{ margin-top:16px; display:grid; gap:6px; }
.al-pasos-serv{ display:flex; gap:4px; margin-top:14px; }
.al-pasos-serv span{ flex:1; height:6px; border-radius:999px; background:color-mix(in srgb, var(--color-text) 10%, transparent); }
.al-pasos-serv span[data-on="true"]{ background:var(--color-primary); }

/* ── Equipos ───────────────────────────────────────────────── */
.al-equipo{ grid-template-columns:minmax(0,1fr) auto; }
.al-equipo-t{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.al-equipo-t b{ font-size:15px; overflow-wrap:anywhere; }
.al-equipo-m{ font-size:13px; margin-top:6px; display:flex; gap:4px 14px; flex-wrap:wrap; color:var(--color-text-muted); }
.al-equipo-m span{ display:inline-flex; align-items:center; gap:5px; }
.al-equipo-acts{ display:flex; gap:8px; flex-wrap:wrap; }
.al-mant{ flex:1 1 100%; display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; padding-top:12px; margin-top:4px; border-top:1px solid var(--color-border); }
.al-mant .ms-field{ flex:1 1 160px; margin:0; }

/* ── Listas con filas (papeles, propuestas, historial corto) ── */
.al-lista{ padding:0; overflow:hidden; }
.al-lista-h{ padding:16px 20px 12px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
.al-lista-i{ display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:13px 20px; border-top:1px solid var(--color-border); }
.al-lista-i > div, .al-lista-i > span{ min-width:0; }
.al-lista-i img{ width:44px; height:44px; object-fit:cover; border-radius:8px; border:1px solid var(--color-border); flex-shrink:0; }
.al-lista-t{ font-size:14px; font-weight:600; overflow-wrap:anywhere; }
.al-lista-s{ display:block; font-size:13px; color:var(--color-text-muted); overflow-wrap:anywhere; }
.al-lista-pie{ padding:16px 20px; border-top:1px solid var(--color-border); }
.al-revision{ border-color:color-mix(in srgb, var(--color-warning) 40%, var(--color-border)); }

/* ── Cobros, cuenta ────────────────────────────────────────── */
.al-cifras{ display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px; }
.al-cifra{ padding:14px 16px; border-radius:12px; background:var(--color-surface); border:1px solid var(--color-border); min-width:0; }
.al-cifra .ms-stat-n{ font-size:22px; overflow-wrap:anywhere; }
.al-cifra .ms-stat-l{ margin:0 0 4px; }
.al-cuenta{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:20px; align-items:start; }
.al-contacto .ms-btn{ white-space:normal; overflow-wrap:anywhere; text-align:center; min-width:0; }
.al-vacio{ padding:28px 24px 30px; }
.al-ofrece{ list-style:none; margin:0; padding:0; display:grid; gap:4px; font-size:13px; color:var(--color-text-muted); line-height:1.5; }
.al-ofrece b{ color:var(--color-text); font-weight:600; }
.al-meta{ display:flex; gap:6px 18px; flex-wrap:wrap; margin:0; }
.al-meta span{ display:inline-flex; align-items:flex-start; gap:6px; min-width:0; overflow-wrap:anywhere; }
.al-meta svg{ flex-shrink:0; margin-top:3px; }

/* ── Tableta y teléfono ────────────────────────────────────── */
@media (max-width: 980px){
  .al-grid{ grid-template-columns:220px minmax(0,1fr); gap:28px; }
  .al-kpis{ grid-template-columns:repeat(2, minmax(0,1fr)); }
  .so-grid{ grid-template-columns:minmax(0,290px) minmax(0,1fr); gap:16px; }
  .al-cuenta{ grid-template-columns:minmax(0,1fr); }
}
@media (max-width: 840px){
  .al-root{ padding:20px 16px 64px; }
  .al-grid{ grid-template-columns:minmax(0,1fr); gap:14px; }
  .al-side{ position:static; gap:0; }
  .al-me{ padding-bottom:0; border-bottom:0; align-items:center; }
  .al-avatar{ width:44px; height:44px; font-size:16px; }
  .al-nav-desk, .al-ayuda-desk{ display:none; }
  /* Barra fija ABAJO con las seis pantallas (2026-10-28): arriba, deslizable, solo se
     veían tres y Cobros (con su aviso), Papeles y Mi cuenta quedaban escondidas. */
  .al-root{ padding-bottom:96px; }
  .al-tabs-mob{ display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); position:fixed; left:0; right:0; bottom:0; z-index:40;
    padding:6px 4px calc(6px + env(safe-area-inset-bottom, 0px)); background:color-mix(in srgb, var(--color-bg) 96%, transparent);
    backdrop-filter:blur(8px); border-top:1px solid var(--color-border); }
  .al-tabs-mob .al-nav-b{ flex-direction:column; justify-content:center; gap:3px; min-height:52px; padding:4px 2px; border-radius:10px; font-size:10.5px; text-align:center; }
  .al-tabs-mob .al-nav-b > span:not([class]){ max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .al-tabs-mob .al-nav-b[aria-current="page"]{ color:var(--color-primary); }
  .al-tabs-mob .al-nav-b[aria-current="page"]::before{ display:none; }
  .al-tabs-mob .al-insignia{ position:absolute; top:2px; left:calc(50% + 4px); margin-left:0; min-width:17px; height:17px; font-size:10px; padding:0 4px; }
  .al-tabs-mob .al-punto{ position:absolute; top:6px; left:calc(50% + 7px); }
  /* Con una solicitud abierta, el detalle empieza arriba (antes, a media pantalla). */
  .al-vista:has(.so-grid[data-abierto="true"]) :is(.al-vh, .al-barra-sup, .al-orden){ display:none; }
  .al-ayuda-mob{ display:grid; margin-top:36px; }
  .al-vista{ gap:22px; }
  .al-vh .ms-title{ font-size:23px; }
  .so-grid{ grid-template-columns:minmax(0,1fr); }
  .so-grid[data-abierto="true"] .so-lista{ display:none; }
  .so-grid[data-abierto="false"] .so-detalle{ display:none; }
  .so-grid[data-abierto="false"] .so-fila[aria-current="true"]{ border-color:var(--color-border); background:var(--color-surface); }
  .so-volver{ display:inline-flex; margin-bottom:12px; }
  .so-fila-ir{ display:inline-flex; grid-column:1 / -1; justify-self:end; align-items:center; gap:3px; margin-top:6px; font-size:12.5px; font-weight:600; color:var(--color-primary); }
  .so-detalle{ scroll-margin-top:80px; }
  .so-volver{ min-height:40px; align-items:center; }
}
@media (max-width: 720px){
  .al-dos{ grid-template-columns:minmax(0,1fr); }
  .al-pide dl{ grid-template-columns:minmax(0,1fr); }
  .al-aviso{ grid-template-columns:auto minmax(0,1fr); }
  .al-aviso > .ms-btn{ grid-column:2; justify-self:start; }
}
@media (max-width: 640px){
  .al-root .ms-input, .al-root .ms-textarea, .al-root .ms-select{ font-size:16px; }
  .al-kpi{ padding:14px 16px; }
  .al-equipo{ grid-template-columns:minmax(0,1fr); }
  .al-equipo-acts > .ms-btn{ flex:1 1 140px; }
  .al-lista-h, .al-lista-i, .al-lista-pie{ padding-left:16px; padding-right:16px; }
  .al-importe{ text-align:left; }
  .al-hoy-i{ grid-template-columns:minmax(0,1fr); }
}
`;
