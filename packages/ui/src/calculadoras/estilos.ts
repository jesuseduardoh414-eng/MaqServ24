/**
 * Estilos de las calculadoras (prefijo `cm-`). Lo común —tarjeta, campos,
 * botones, chips, total— sale del cotizador (`.cz-*`, COTIZADOR_CSS), que
 * cada app ya monta con su contrato de superficie `--ui-*`.
 */
export const CALCULADORAS_CSS = `
.cm-unidad{ position:relative; }
.cm-unidad .cz-input{ padding-right:52px; font-variant-numeric:tabular-nums; -moz-appearance:textfield; appearance:textfield; }
.cm-unidad .cz-input::-webkit-inner-spin-button, .cm-unidad .cz-input::-webkit-outer-spin-button{ -webkit-appearance:none; margin:0; }
.cm-unidad > span{ position:absolute; right:13px; top:50%; transform:translateY(-50%); font-size:13px; font-weight:700; color:var(--cz-muted); pointer-events:none; }
.cm-campos{ display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:13px; }
.cm-res{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; }
.cm-mat{ display:grid; gap:6px; align-content:start; padding:14px 15px; border-radius:calc(var(--cz-radius) - 2px); border:1px solid var(--cz-border); background:var(--cz-surface-2); min-width:0; }
.cm-mat-h{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.cm-mat-h b{ font-size:13.5px; }
.cm-tag{ font-size:11px; font-weight:600; color:var(--cz-muted); border:1px solid var(--cz-border); border-radius:999px; padding:2px 8px; white-space:nowrap; }
.cm-cant{ margin:2px 0 0; font-size:26px; font-weight:800; letter-spacing:-0.025em; line-height:1.1; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.cm-cant small{ font-size:13px; font-weight:700; letter-spacing:0; color:var(--cz-muted); margin-left:4px; }
.cm-sec{ margin:0; font-size:12px; color:var(--cz-muted); font-variant-numeric:tabular-nums; }
.cm-formula{ margin:2px 0 0; padding-top:8px; border-top:1px solid var(--cz-border); font-size:11.5px; line-height:1.5; color:var(--cz-muted); }
.cm-total .n b small{ font-size:14px; font-weight:700; color:var(--cz-muted); margin-left:4px; letter-spacing:0; }
.cm-acciones{ display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
.cm-acciones .cz-btn{ text-decoration:none; }
.cm-cabeza{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.cm-cabeza > div{ min-width:0; }
.cm-cabeza .cm-borrar{ flex:none; }
.cm-angosto{ max-width:760px; }
.cm-cabeza .cz-card-s{ margin-bottom:14px; }
.cm-borrar{ border:0; background:none; padding:4px 0; font:inherit; font-size:12.5px; font-weight:600; color:var(--cz-muted); cursor:pointer; }
.cm-borrar:hover{ color:var(--cz-text); }
.cm-conv-top{ display:grid; gap:7px; margin-bottom:16px; }
.cm-sentido{ display:grid; grid-template-columns:1fr 1fr; gap:3px; padding:3px; border:1px solid var(--cz-border); border-radius:10px; background:var(--cz-surface-2); }
.cm-sentido button{ min-height:42px; padding:0 10px; border:0; border-radius:8px; background:transparent; color:var(--cz-muted); font:inherit; font-size:13.5px; font-weight:700; cursor:pointer; }
.cm-sentido button:hover{ color:var(--cz-text); }
.cm-sentido button[data-on="1"]{ background:var(--cz-accent); color:var(--cz-accent-fg); }
.cm-sentido button:focus-visible{ outline:2px solid var(--cz-accent); outline-offset:2px; }
.cm-como{ margin:10px 0 0; padding-left:18px; display:grid; gap:5px; font-size:12.5px; line-height:1.55; color:var(--cz-muted); }
.cm-como b{ color:var(--cz-text); font-weight:600; }
@media (max-width: 960px){
  .cm-campos{ grid-template-columns:repeat(2, minmax(0,1fr)); }
  .cm-campos > :first-child{ grid-column:1 / -1; }
  .cm-res{ grid-template-columns:repeat(2, minmax(0,1fr)); }
}
@media (max-width: 560px){
  .cm-res{ grid-template-columns:minmax(0,1fr); }
  .cm-acciones .cz-btn{ width:100%; }
}
`;
