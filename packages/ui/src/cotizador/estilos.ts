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

/* ---- Cabecera ---- */
.cz-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px; flex-wrap:wrap; margin-bottom:18px; }
.cz-title{ margin:0; font-family:var(--font-heading, inherit); font-size:clamp(23px,3.2vw,31px); letter-spacing:-0.025em; line-height:1.1; }
.cz-sub{ margin:6px 0 0; color:var(--cz-muted); font-size:13.5px; max-width:62ch; }

/* ---- Rejilla principal ---- */
.cz-grid{ display:grid; grid-template-columns:minmax(0,1fr); gap:22px; align-items:start; }

.cz-card{ background:var(--cz-surface); border:1px solid var(--cz-border); border-radius:var(--cz-radius); padding:22px;
  box-shadow:0 1px 0 color-mix(in srgb, #fff 4%, transparent) inset, 0 18px 40px -30px rgba(0,0,0,.55); }
.cz-card + .cz-card{ margin-top:14px; }
.cz-card-h{ display:flex; align-items:center; gap:10px; margin:0 0 5px; font-size:16px; font-weight:700; font-family:var(--font-heading, inherit); }
.cz-card-h::before{ content:''; width:4px; height:18px; border-radius:3px; flex-shrink:0;
  background:linear-gradient(180deg, var(--cz-accent), color-mix(in srgb, var(--cz-accent) 45%, transparent)); }
.cz-card-s{ margin:0 0 18px 14px; font-size:12.5px; line-height:1.55; color:var(--cz-muted); }

/* ---- Campos ---- */
.cz-row{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:13px; }
/* Su columna acotada (2026-11-06): un valor largo en un selector o buscador se corta con «…» en vez de ensanchar la tarjeta. */
.cz-field{ display:grid; gap:6px; min-width:0; align-content:start; grid-template-columns:minmax(0, 1fr); }
.cz-field.full{ grid-column:1/-1; }
.cz-lbl{ font-size:11.5px; font-weight:700; letter-spacing:.025em; color:var(--cz-muted); }
.cz-lbl .req{ color:var(--cz-accent); }
.cz-input, .cz-select, .cz-textarea{
  width:100%; height:44px; padding:0 13px; border-radius:8px; font-size:14px; font-family:inherit;
  border:1px solid var(--cz-border); background:var(--cz-surface-2); color:var(--cz-text); outline:none;
}
.cz-textarea{ height:auto; min-height:86px; padding:11px 13px; line-height:1.55; resize:vertical; }
/* 16 px en el teléfono (2026-10-28): con menos, el iPhone acerca la pantalla en cada campo. */
@media (max-width: 640px){ .cz-input, .cz-select, .cz-textarea{ font-size:16px; } }
.cz-input:focus, .cz-select:focus, .cz-textarea:focus{ border-color:var(--cz-accent); }
.cz-input[aria-invalid="true"]{ border-color:var(--cz-bad); }
.cz-help{ font-size:11.5px; color:var(--cz-muted); }
.cz-err{ font-size:12px; color:var(--cz-bad); }

/* ---- Tarjetas de catálogo ---- */
.cz-cards{ display:grid; grid-template-columns:repeat(auto-fill,minmax(176px,1fr)); gap:12px; }
/* El "+" y el contador van FUERA del botón: un <button> dentro de otro no es
   HTML válido y el navegador lo desanida, con lo que el "+" dejaba de recibir
   sus propios clics. */
.cz-pick-wrap{ position:relative; display:flex; }
.cz-pick{ flex:1; display:flex; flex-direction:column; align-items:flex-start; gap:8px;
  padding:16px 15px; border-radius:var(--cz-radius); border:1px solid var(--cz-border);
  background:var(--cz-surface-2); color:var(--cz-text); cursor:pointer; text-align:left;
  transition:border-color .16s, transform .16s, background .16s; }
.cz-pick:hover{ border-color:color-mix(in srgb, var(--cz-accent) 55%, var(--cz-border)); transform:translateY(-2px);
  box-shadow:0 14px 28px -20px color-mix(in srgb, var(--cz-accent) 70%, transparent); }
/* El flete del material con tarjetas (2026-10-29): planta u obra; con obra, zonas y ubicación. */
.cz-cards-2{ grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }
.cz-entrega{ display:grid; gap:12px; }
.cz-entrega-zonas{ display:grid; gap:10px; padding-top:4px; }
.cz-entrega-zonas .cz-lbl i{ color:var(--cz-accent); font-style:normal; }
.cz-entrega-zonas .cz-pick .pu{ font-size:12px; line-height:1.4; }
.cz-ubicacion{ display:grid; gap:6px; margin-top:4px; padding-top:14px; border-top:1px dashed var(--cz-border); }
.cz-ubicacion > b{ font-size:14px; }
.cz-ubicacion > .cz-help{ margin:0 0 4px; }
/* "¿Quieres mejorar el precio?" (sitio con precios de lista, 2026-10-29). */
.cz-mejorar{ display:grid; gap:3px; padding:12px 14px; border-radius:12px; font-size:13px; line-height:1.5;
  border:1px solid color-mix(in srgb, var(--cz-accent) 40%, var(--cz-border)); background:var(--cz-accent-soft); }
.cz-mejorar b{ font-size:13.5px; }
.cz-mejorar a{ color:var(--cz-accent); font-weight:600; white-space:nowrap; }
/* No se puede elegir aquí (el agua fuera de zona): se ve apagada y no se mueve. */
.cz-pick:disabled{ opacity:.55; cursor:not-allowed; transform:none; box-shadow:none; border-color:var(--cz-border); }
.cz-pick[data-on="1"]{ border-color:var(--cz-accent); background:var(--cz-accent-soft);
  box-shadow:0 0 0 1px var(--cz-accent) inset, 0 14px 30px -22px color-mix(in srgb, var(--cz-accent) 80%, transparent); }
.cz-pick .ico{ color:var(--cz-accent); display:grid; place-items:center; width:46px; height:46px; border-radius:12px;
  background:var(--cz-accent-soft); margin-bottom:2px; }
.cz-pick .ico svg{ width:30px; height:30px; }
.cz-pick[data-on="1"] .ico{ background:var(--cz-accent); color:var(--cz-accent-fg); }
.cz-pick b{ font-size:14px; line-height:1.3; }
.cz-pick .pu{ font-size:12.5px; font-weight:500; color:var(--cz-muted); }
/* En el panel la nota es el precio ("desde $5,600 / día"): va en color. En el sitio no hay precios. */
.cz[data-variante="panel"] .cz-pick .pu{ font-weight:600; color:var(--cz-accent); }
/* En el celular, dos por fila (2026-10-29, pedido del dueño): una por fila
   eran pantallas enteras de bajar. La tarjeta se compacta para que quepa. */
@media (max-width: 640px){
  .cz-cards, .cz-cards-2{ grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
  .cz-pick{ padding:12px 11px; gap:6px; }
  .cz-pick:hover{ transform:none; }
  .cz-pick .ico{ width:38px; height:38px; border-radius:10px; }
  .cz-pick .ico svg{ width:24px; height:24px; }
  .cz-pick b{ font-size:13.5px; overflow-wrap:anywhere; }
  .cz-pick .pu{ font-size:12px; }
}
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
.cz-line{ border:1px solid var(--cz-border); border-radius:var(--cz-radius); background:var(--cz-surface-2); padding:16px; }
.cz-line + .cz-line{ margin-top:12px; }
.cz-line-h{ display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--cz-border); }
.cz-line-h .ico{ color:var(--cz-accent); flex-shrink:0; display:grid; place-items:center; width:42px; height:42px; border-radius:11px; background:var(--cz-accent-soft); }
.cz-line-h .ico svg{ width:26px; height:26px; }
.cz-line-h .nm{ flex:1; min-width:0; }
.cz-line-h .nm b{ display:block; font-size:15px; }
.cz-line-h .nm span{ display:block; font-size:12px; color:var(--cz-muted); margin-top:3px; }
.cz-tier{ font-size:12px; font-weight:600;
  color:var(--cz-accent); background:var(--cz-accent-soft); padding:4px 9px; border-radius:999px; white-space:nowrap; }
.cz-rm{ border:none; background:transparent; color:var(--cz-muted); cursor:pointer; font-size:17px; line-height:1; padding:2px 4px; }
.cz-rm:hover{ color:var(--cz-bad); }
/* En rejilla: los cuatro campos (días, horas, equipos, costo) del mismo ancho y a la misma altura. */
.cz-ctrl{ display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:14px 12px; align-items:start; }
.cz-qty{ min-width:0; display:grid; gap:6px; align-content:start; }
.cz-qty.wide{ grid-column:1/-1; }
.cz-chips{ display:flex; flex-wrap:wrap; gap:6px; }
.cz-chip{ border:1px solid var(--cz-border); background:var(--cz-surface); color:var(--cz-muted);
  border-radius:999px; padding:6px 11px; font-size:12px; font-weight:600; cursor:pointer; }
.cz-chip:hover{ border-color:var(--cz-accent); color:var(--cz-text); }
.cz-chip[data-on="1"]{ background:var(--cz-accent); border-color:var(--cz-accent); color:var(--cz-accent-fg); }
.cz-money{ margin-top:16px; padding:12px 14px; border-radius:calc(var(--cz-radius) - 2px); background:var(--cz-surface); display:grid; gap:5px; }
.cz-money .mr{ display:flex; justify-content:space-between; gap:12px; font-size:12.5px; color:var(--cz-muted); font-variant-numeric:tabular-nums; }
.cz-money .mr.sub{ color:var(--cz-text); font-weight:800; font-size:14.5px; margin-top:4px; padding-top:8px; border-top:1px solid var(--cz-border); }
.cz-money .mr.sub:first-child{ margin-top:0; padding-top:0; border-top:0; }

/* ---- Triturados: una sección por forma de venta (2026-10-15) ---- */
.cz-bloque + .cz-bloque{ margin-top:14px; }
.cz-bloque-h{ display:flex; align-items:flex-start; gap:12px; }
.cz-bloque-h .ico{ color:var(--cz-accent); flex-shrink:0; display:grid; place-items:center; width:40px; height:40px; border-radius:11px; background:var(--cz-accent-soft); }
/* La sección ya lleva su ícono: sin la barra de color del título, y la ayuda alineada con él. */
.cz-bloque-h .cz-card-h::before{ display:none; }
.cz-bloque-h .cz-card-s{ margin-left:0; }
.cz-bloque-h .cz-card-s{ margin-bottom:14px; }
.cz-bloque[data-vacio] .cz-bloque-h .cz-card-s{ margin-bottom:12px; }
.cz-filas{ display:grid; gap:10px; margin-bottom:12px; }
.cz-fila{ position:relative; display:flex; flex-wrap:wrap; align-items:flex-start; gap:11px 12px;
  border:1px solid var(--cz-border); border-radius:var(--cz-radius); background:var(--cz-surface-2); padding:13px 44px 13px 14px; }
.cz-fila > .cz-field{ flex:1 1 100px; min-width:0; }
/* El primer campo (material, zona) es el de texto largo: más ancho. */
.cz-fila > .cz-field:first-child{ flex:2.4 1 220px; }
/* La columna del campo acotada: sin esto el texto largo de un desplegable
   ("Base hidráulica · $260/ton") medía su ancho y se encimaba al campo vecino. */
.cz-fila .cz-field, .cz-flete .cz-field{ grid-template-columns:minmax(0, 1fr); }
.cz-fila > .cz-qty{ flex:1 1 130px; }
/* El importe al final del renglón, alineado con los campos (antes caía solo en otra línea). */
.cz-fila-imp{ flex:0 1 118px; display:grid; gap:3px; align-content:end; justify-items:end; min-height:66px; text-align:right; padding-bottom:4px; }
.cz-fila-imp span{ font-size:11.5px; color:var(--cz-muted); white-space:nowrap; }
.cz-fila-imp b{ font-size:16px; font-variant-numeric:tabular-nums; color:var(--cz-accent); }
.cz-fila-rm{ position:absolute; top:8px; right:8px; width:30px; height:30px; display:grid; place-items:center; border-radius:8px; }
.cz-fila-rm:hover{ background:color-mix(in srgb, var(--cz-bad) 12%, transparent); }
.cz-agregar{ display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:44px;
  border:1px dashed color-mix(in srgb, var(--cz-accent) 55%, var(--cz-border)); border-radius:var(--cz-radius);
  background:transparent; color:var(--cz-accent); font:inherit; font-size:13.5px; font-weight:600; cursor:pointer;
  transition:background .15s ease, border-color .15s ease; }
.cz-agregar:hover{ background:var(--cz-accent-soft); border-color:var(--cz-accent); }
.cz-agregar:focus-visible{ outline:2px solid var(--cz-accent); outline-offset:2px; }
.cz-sugerencia{ display:inline-flex; align-items:center; gap:8px; justify-self:start; max-width:100%; padding:7px 12px; border-radius:999px;
  border:1px solid color-mix(in srgb, var(--cz-accent) 40%, var(--cz-border)); background:var(--cz-accent-soft); color:var(--cz-text);
  font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; text-align:left; transition:border-color .15s ease; }
.cz-sugerencia svg{ color:var(--cz-accent); flex-shrink:0; }
.cz-sugerencia b{ color:var(--cz-accent); }
.cz-sugerencia:hover{ border-color:var(--cz-accent); }
.cz-flete{ display:grid; gap:11px; margin-top:14px; padding-top:14px; border-top:1px dashed var(--cz-border); }
.cz-flete-h{ display:grid; gap:2px; }
.cz-flete-h b{ font-size:13.5px; }
.cz-flete-h span{ font-size:12px; color:var(--cz-muted); }
.cz-flete .cz-fila-imp{ min-height:0; justify-items:start; text-align:left; }
@media (max-width: 640px){
  .cz-fila-imp{ justify-items:start; text-align:left; min-height:0; }
}

/* ---- El celular, revisado (2026-11-06, el dueño: "en tolva y full los
   botones se ven mal; revisa todo el diseño en móvil") ---- */
@media (max-width: 640px){
  /* Elegir UNA opción (cómo lo quiere, el camión, planta u obra): renglones a
     todo lo ancho, ícono a la izquierda y la palomita centrada. Antes eran
     tarjetas de dos en dos y la tercera quedaba sola. */
  .cz-cards.cz-opciones{ grid-template-columns:minmax(0, 1fr); gap:8px; }
  .cz-opciones .cz-pick{ display:grid; grid-template-columns:38px minmax(0, 1fr); column-gap:12px; row-gap:1px;
    align-items:center; padding:11px 44px 11px 12px; min-height:62px; }
  .cz-opciones .cz-pick .ico{ grid-row:1 / span 2; margin:0; }
  .cz-opciones .cz-pick b, .cz-opciones .cz-pick .pu{ grid-column:2; }
  .cz-opciones .cz-pick-badges{ top:50%; right:12px; transform:translateY(-50%); }
  /* Los renglones (material, viaje): sin el hueco a la derecha que apartaba la
     ✕; el primer campo va solo en su línea y la ✕ queda junto a su etiqueta. */
  .cz-fila{ padding:12px; gap:10px; }
  .cz-fila > .cz-field:first-child{ flex:1 1 100%; }
  .cz-fila > .cz-field:first-child .cz-lbl, .cz-fila > .cz-field:first-child > label{ padding-right:38px; }
  .cz-fila-rm{ top:4px; right:4px; width:36px; height:36px; }
  .cz-fila > .cz-field, .cz-fila > .cz-qty{ flex:1 1 calc(50% - 5px); }
  /* El importe del renglón en una línea: lo que es a la izquierda, el monto a la derecha. */
  .cz-fila-imp{ flex:1 1 100%; display:flex; justify-content:space-between; align-items:baseline; gap:10px;
    padding:8px 0 0; border-top:1px dashed var(--cz-border); }
  .cz-fila-imp span{ white-space:normal; }
  /* Menos margen en las tarjetas anidadas: cada borde le quitaba ancho a los campos. */
  .cz-card{ padding:16px; }
  .cz-line{ padding:12px; }
  .cz-line-h{ margin-bottom:12px; padding-bottom:12px; }
  /* El tiempo de un equipo de dos en dos (días | horas extra, equipos | costo):
     uno debajo de otro eran pantallas enteras. «Horas en total» va completo. */
  .cz-ctrl{ grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px 10px; }
  .cz-ctrl > .cz-field:first-child{ grid-column:1 / -1; }
  /* En el documento, «Editar» y el otro botón (pedir, guardar o nueva) del mismo ancho. */
  .cz-barra-fila[data-final] > button{ flex:1 1 0; min-width:0; }
  /* Los botones punteados («+ Otro material…»): el texto largo baja de línea en vez de salirse del borde. */
  .cz-agregar{ padding:10px 12px; font-size:13px; line-height:1.35; text-align:center; }
  .cz-agregar svg{ flex-shrink:0; }
}
/* El flete y la entrega (2026-11-06): una zona de nombre largo («Zona 7 ·
   Carretera Nacional, Estanzuela, Icamole, Mina, Guadalupe») medía su ancho y
   empujaba toda la sección —Tolva, Full y los textos— fuera de la pantalla.
   La columna queda acotada y el selector corta el nombre con «…». */
.cz-flete, .cz-entrega, .cz-entrega-zonas, .cz-ubicacion{ grid-template-columns:minmax(0, 1fr); }
.cz-flete [role="combobox"], .cz-entrega-zonas [role="combobox"], .cz-fila [role="combobox"]{ min-width:0; }
/* En pantallas táctiles el :hover se queda pegado en lo último que se tocó y
   parecía elegido: el realce solo con mouse. */
@media (hover: none){
  .cz-pick:not([data-on="1"]):hover{ border-color:var(--cz-border); transform:none; box-shadow:none; }
  .cz-agregar:hover{ background:transparent; border-color:color-mix(in srgb, var(--cz-accent) 55%, var(--cz-border)); }
  .cz-chip:not([data-on="1"]):hover{ border-color:var(--cz-border); color:var(--cz-muted); }
  .cz-sugerencia:hover{ border-color:color-mix(in srgb, var(--cz-accent) 40%, var(--cz-border)); }
  .cz-btn.primary:hover:not(:disabled){ transform:none; }
}

/* ---- Botones ---- */
.cz-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; height:46px; padding:0 20px;
  border-radius:var(--radius-button, 10px); font-size:14px; font-weight:700; cursor:pointer; border:1px solid transparent; }
.cz-btn:disabled{ opacity:.5; cursor:not-allowed; }
.cz-btn.primary{ background:var(--cz-accent); color:var(--cz-accent-fg); box-shadow:0 10px 24px -12px color-mix(in srgb, var(--cz-accent) 85%, transparent); transition:transform .15s ease, box-shadow .15s ease; }
.cz-btn.primary:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 14px 28px -12px color-mix(in srgb, var(--cz-accent) 95%, transparent); }
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

/* ---- En una sola pantalla (2026-11-03) ----
   Como el cotizador de PUCSA que mandó el dueño: el cliente arriba (en el
   enlace, una tarjeta compacta con municipio y atención lado a lado), lo que
   se cotiza debajo y una barra con el total y el siguiente paso. La barra va
   PEGADA abajo dentro del contenido (sticky) y no fija a la ventana: en el
   panel, fija, tapaba el menú lateral. */
.cz-cliente label, .cz-datos label{ font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--cz-muted); }
.cz-cliente + .cz-card{ margin-top:14px; }
/* Acotadas al ancho de la tarjeta (2026-11-06): un cliente de nombre largo empujaba el campo fuera. */
.cz-datos{ display:grid; gap:13px; grid-template-columns:minmax(0, 1fr); }
.cz-dos{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; }
.cz-barra{ position:sticky; bottom:0; z-index:30; margin-top:16px; background:var(--cz-surface); border:1px solid var(--cz-border);
  border-radius:var(--cz-radius); box-shadow:0 -18px 40px -24px rgba(0,0,0,.6); padding:12px 14px calc(env(safe-area-inset-bottom, 0px) + 12px); }
.cz-barra-in{ display:grid; gap:10px; }
.cz-barra-fila{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.cz-barra-fila > button{ min-height:48px; }
.cz-barra-total{ display:grid; gap:2px; min-width:0; }
.cz-barra-total span{ font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--cz-muted); }
.cz-barra-total b{ font-size:26px; font-weight:800; letter-spacing:-0.02em; line-height:1.1; color:var(--cz-ok); font-variant-numeric:tabular-nums; }
.cz-barra-total em{ font-style:normal; font-size:12.5px; color:var(--cz-muted); }

/* Solo precios (acceso directo, 2026-10-29): mandar por WhatsApp o descargar el PDF. */
.cz-compartir{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
.cz-compartir > button{ width:100%; min-height:46px; }
.cz-compartir-aviso{ grid-column:1 / -1; margin:0; }
@media (max-width: 420px){ .cz-compartir{ grid-template-columns:1fr; } }

/* ---- Vista previa del documento ---- */
.cz-preview{ border:1px solid var(--cz-border); border-radius:var(--cz-radius); overflow:auto; background:#fff; }
/* En el teléfono ya no se encoge (salía diminuto y cortado): el documento se
   acomoda solo al ancho (container query en DOCUMENTO_CSS, 2026-10-29). */

/* ---- Acuse ---- */
.cz-done{ text-align:center; padding:38px 20px; }
.cz-done .mark{ width:62px; height:62px; margin:0 auto 16px; border-radius:999px;
  background:var(--cz-accent-soft); color:var(--cz-accent); display:grid; place-items:center; font-size:29px; }
.cz-done h2{ margin:0 0 8px; font-family:var(--font-heading, inherit); font-size:24px; }
.cz-done p{ margin:0 auto 20px; color:var(--cz-muted); font-size:14px; max-width:46ch; }
.cz-folio{ display:inline-block; font-size:20px; font-weight:800; letter-spacing:.04em;
  padding:9px 18px; border-radius:10px; border:1px dashed var(--cz-accent); color:var(--cz-accent); margin-bottom:20px; }
.cz-done-acts{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
/* «¿Necesitas cotizar otro servicio?» bajo el acuse (sitio, 2026-11-03). */
.cz-despues{ margin-top:26px; padding-top:22px; border-top:1px solid var(--cz-border); }
`;
