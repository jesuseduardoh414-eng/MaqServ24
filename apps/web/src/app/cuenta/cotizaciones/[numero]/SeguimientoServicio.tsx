import type { QuoteDetail } from '@maqserv/types';
import { Icon, type IconName } from '@/components/Icon';
import { MapaServicio } from './MapaServicio';

const ZONA = 'America/Monterrey';
const FECHA_HORA = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: ZONA });
const CORTA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: ZONA });
const HORA = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: ZONA });

/** Los pasos que ve el cliente. "Cerrado" cuenta como el último: para él, ya terminó. */
const PASOS: Array<{ k: string[]; t: string; icono: IconName }> = [
  { k: ['asignado'], t: 'Asignado', icono: 'check' },
  { k: ['en_traslado'], t: 'En camino', icono: 'truck' },
  { k: ['en_sitio'], t: 'En tu obra', icono: 'mapPin' },
  { k: ['en_curso'], t: 'Trabajando', icono: 'clock' },
  { k: ['terminado', 'cerrado'], t: 'Terminado', icono: 'star' },
];

const CSS = `
.sv{ border:1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border)); border-radius:18px; overflow:hidden;
  background:linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 9%, var(--color-surface)) 0%, var(--color-surface) 220px); }
.sv-in{ padding:20px 20px 18px; }
.sv-top{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.sv-k{ font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--color-text-muted); }
.sv-pill{ display:inline-flex; align-items:center; gap:6px; padding:4px 11px; border-radius:999px; font-size:12.5px; font-weight:600;
  color:var(--sv-c); background:color-mix(in srgb, var(--sv-c) 14%, transparent); border:1px solid color-mix(in srgb, var(--sv-c) 35%, transparent); }
.sv-pill::before{ content:''; width:7px; height:7px; border-radius:50%; background:currentColor; }
.sv-h{ margin:12px 0 4px; font-size:clamp(19px, 2.4vw, 23px); line-height:1.25; font-weight:700; color:var(--color-text); letter-spacing:-.01em; }
.sv-p{ margin:0; font-size:14.5px; line-height:1.55; color:var(--color-text-muted); }
.sv-steps{ display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); margin:20px 0 4px; position:relative; }
.sv-step{ display:grid; justify-items:center; gap:7px; text-align:center; position:relative; }
.sv-step::before{ content:''; position:absolute; top:15px; left:-50%; width:100%; height:3px; background:var(--color-border); z-index:0; }
.sv-step:first-child::before{ display:none; }
.sv-step.hecho::before, .sv-step.actual::before{ background:var(--color-primary); }
.sv-dot{ width:32px; height:32px; border-radius:50%; display:grid; place-items:center; position:relative; z-index:1;
  background:var(--color-surface); border:2px solid var(--color-border); color:var(--color-text-muted); }
.sv-step.hecho .sv-dot{ background:var(--color-primary); border-color:var(--color-primary); color:#fff; }
.sv-step.actual .sv-dot{ border-color:var(--color-primary); color:var(--color-primary); box-shadow:0 0 0 5px color-mix(in srgb, var(--color-primary) 18%, transparent); }
.sv-step span{ font-size:12px; font-weight:600; color:var(--color-text-muted); }
.sv-step.hecho span, .sv-step.actual span{ color:var(--color-text); }
.sv-map{ position:relative; }
.sv-map .sv-badge{ position:absolute; top:24px; right:12px; z-index:2; display:flex; gap:8px; align-items:center; padding:7px 12px; border-radius:10px;
  background:var(--color-surface); border:1px solid var(--color-border); box-shadow:0 4px 14px rgba(0,0,0,.18); font-size:13.5px; }
.sv-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(210px,1fr)); gap:10px; margin-top:16px; }
.sv-tile{ display:flex; gap:11px; align-items:flex-start; padding:12px; border-radius:12px; background:color-mix(in srgb, var(--color-text) 4%, transparent); border:1px solid var(--color-border); min-width:0; }
.sv-tile i{ flex-shrink:0; width:34px; height:34px; border-radius:10px; display:grid; place-items:center; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 12%, transparent); }
.sv-tile small{ display:block; font-size:12px; color:var(--color-text-muted); }
.sv-tile b{ display:block; font-size:14px; font-weight:600; color:var(--color-text); overflow-wrap:anywhere; line-height:1.35; }
.sv-hist{ margin-top:16px; border-top:1px solid var(--color-border); padding-top:12px; }
.sv-hist summary{ cursor:pointer; font-size:13.5px; font-weight:600; color:var(--color-text-muted); }
.sv-hist ol{ margin:10px 0 0; padding:0; list-style:none; display:grid; gap:8px; }
.sv-hist li{ display:flex; gap:10px; font-size:13.5px; color:var(--color-text-muted); }
.sv-hist li::before{ content:''; width:8px; height:8px; margin-top:6px; border-radius:50%; background:var(--color-primary); flex-shrink:0; }
@media (max-width:560px){ .sv-in{ padding:16px 14px; } .sv-step span{ font-size:10.5px; } .sv-dot{ width:28px; height:28px; } .sv-step::before{ top:13px; } }
`;

/**
 * "TU SERVICIO" (rediseño 2026-10-15). Lo que el cliente pregunta después de
 * aceptar —"¿y ahora?"—, contestado de un vistazo: el dato del momento en
 * grande (cuándo llega, a cuántos km va, si ya está en su obra), la línea de
 * pasos, el mapa y quién lo atiende. No enseña a quién más se le ofreció ni
 * quién dijo que no: eso es de operaciones.
 */
export function SeguimientoServicio({ servicio, rastreo, direccion }: {
  servicio: NonNullable<QuoteDetail['service']>;
  rastreo: QuoteDetail['tracking'];
  direccion: string | null;
}) {
  const cancelado = servicio.state === 'cancelado';
  const color = cancelado ? 'var(--color-error)' : servicio.state === 'cerrado' || servicio.state === 'terminado' ? 'var(--color-success)' : 'var(--color-primary)';
  const idx = PASOS.findIndex((p) => p.k.includes(servicio.state));
  const llega = servicio.arrival ? FECHA_HORA.format(new Date(servicio.arrival)) : null;

  // El dato del momento, en grande.
  const titular =
    cancelado ? 'Este servicio se canceló'
      : servicio.state === 'por_asignar' ? 'Estamos asignando a tu proveedor'
        : servicio.state === 'asignado' ? (llega ? `Llega el ${llega}` : 'Ya tienes proveedor')
          : servicio.state === 'en_traslado' ? (rastreo?.km != null ? `Tu unidad va en camino · a ${rastreo.km} km` : 'Tu unidad va en camino')
            : servicio.state === 'en_sitio' ? 'La unidad ya está en tu obra'
              : servicio.state === 'en_curso' ? 'Trabajando en tu obra'
                : 'Servicio terminado';

  const todas: Array<{ icono: IconName; k: string; v: string | null }> = [
    { icono: 'shield', k: 'Te atiende', v: servicio.providers.join(' y ') || null },
    { icono: 'user', k: 'Tu operador', v: servicio.operator ?? null },
    { icono: 'mapPin', k: 'Tu obra', v: rastreo?.site?.name ?? direccion },
    { icono: 'clock', k: servicio.state === 'asignado' || servicio.state === 'en_traslado' ? 'Llegada' : 'Llegada comprometida', v: llega },
  ];
  const fichas = todas.filter((f) => f.v);

  return (
    <section className="sv" aria-label="Seguimiento del servicio" style={{ ['--sv-c' as string]: color }}>
      <style>{CSS}</style>
      <div className="sv-in">
        <div className="sv-top">
          <span className="sv-k">Tu servicio</span>
          <span className="sv-pill">{servicio.label}</span>
        </div>
        <h2 className="sv-h">{titular}</h2>
        <p className="sv-p">{servicio.message}</p>

        {!cancelado && idx >= 0 ? (
          <ol className="sv-steps" aria-label="Avance del servicio" style={{ listStyle: 'none', padding: 0 }}>
            {PASOS.map((p, i) => (
              <li key={p.t} className={`sv-step${i < idx ? ' hecho' : i === idx ? ' actual' : ''}`} aria-current={i === idx ? 'step' : undefined}>
                <span className="sv-dot"><Icon name={i < idx ? 'check' : p.icono} size={15} /></span>
                <span>{p.t}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {rastreo?.site || rastreo?.unit ? (
          <div className="sv-map">
            <MapaServicio obra={rastreo.site ?? null} unidad={rastreo.unit ?? null} ruta={rastreo.route ?? []} alto={320} />
            {rastreo.moving && rastreo.unit ? (
              <div className="sv-badge" role="status">
                <span style={{ color: 'var(--color-primary)', display: 'flex' }}><Icon name="truck" size={16} /></span>
                <span>
                  {rastreo.km != null ? <b>A {rastreo.km} km</b> : <b>En camino</b>}
                  {rastreo.updatedAt ? <span style={{ color: 'var(--color-text-muted)' }}> · {HORA.format(new Date(rastreo.updatedAt))}</span> : null}
                </span>
              </div>
            ) : null}
            <p className="sv-p" style={{ fontSize: 13, marginTop: 8 }}>
              {rastreo.moving
                ? rastreo.unit ? 'La ubicación la comparte el operador desde su teléfono; se actualiza sola.' : 'La unidad ya salió. En cuanto el operador comparta su ubicación la verás aquí.'
                : servicio.state === 'asignado' ? 'Aquí te espera la unidad. Cuando salga, verás en este mapa por dónde va.'
                  : 'La unidad está en tu obra.'}
              {rastreo.approximate ? ' La ubicación de tu obra es aproximada.' : ''}
            </p>
          </div>
        ) : null}

        {fichas.length ? (
          <div className="sv-grid">
            {fichas.map((f) => (
              <div key={f.k} className="sv-tile">
                <i aria-hidden><Icon name={f.icono} size={17} /></i>
                <div style={{ minWidth: 0 }}><small>{f.k}</small><b>{f.v}</b></div>
              </div>
            ))}
          </div>
        ) : null}

        {servicio.closed ? (
          <p className="sv-p" style={{ marginTop: 14 }}>
            Se registraron <strong style={{ color: 'var(--color-text)' }}>{servicio.closed}</strong>
            {servicio.closedAt ? ` el ${new Date(servicio.closedAt).toLocaleDateString('es-MX', { timeZone: ZONA })}` : ''}.
          </p>
        ) : null}

        {servicio.history.length > 1 ? (
          <details className="sv-hist">
            <summary>Historial ({servicio.history.length})</summary>
            <ol>
              {servicio.history.map((h, i) => (
                <li key={`${h.label}-${i}`}>
                  <span><b style={{ color: 'var(--color-text)', fontWeight: 600 }}>{h.label}</b>{h.at ? ` · ${CORTA.format(new Date(h.at))}` : ''}</span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </section>
  );
}
