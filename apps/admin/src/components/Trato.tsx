'use client';

import { useCallback, useEffect, useState } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { AdminDatePicker } from '@/components/AdminFecha';
import { confirmar } from '@/components/Dialogos';
import { Btn, btnClass, IconBtn } from '@/components/ui';
import { waDe } from '@/app/proveedores/wa';
import {
  CANAL, RESULTADO, anotarSolo, hoyMty, siguienteDiaHabil,
  type Canal, type ConQuien, type ObjetivoTrato, type RenglonTrato, type Resultado,
} from '@/lib/trato';

/**
 * EL TRATO CON EL CLIENTE O EL ALIADO (2026-11-09).
 *
 * Una bitácora ligera en tres lugares (la solicitud, el cliente y el
 * expediente del aliado): por dónde se le habló, quién, cuándo y cómo quedó.
 * Anotar cuesta un clic ("Ya le hablé por: Llamada") y, si se quiere, otro
 * para ponerle cómo quedó. Llamar o abrir WhatsApp desde aquí se anota solo,
 * y queda abierto para ponerle la nota al volver.
 *
 * En gris, lo que el sistema ya le mandó por correo: todo el trato en un lugar.
 * «Ya le hablé» de Solicitudes ahora es esto: el renglón sella el primer
 * contacto como antes (ver apps/api/src/admin/trato.ts).
 */

type Cambios = { nota?: string | null; res?: Resultado | null; recordar?: string | null; hecho?: boolean; quitado?: boolean };

const CANALES: Canal[] = ['llamada', 'whatsapp', 'correo', 'visita'];
const RESULTADOS: Resultado[] = ['no_contesto', 'confirmar', 'confirmado'];
const TZ = 'America/Monterrey';

const ESTADO_CORREO: Record<string, string> = {
  fallido: 'no salió',
  simulado: 'no salió: el envío de correos está apagado',
  omitido: 'no salió: la dirección no es válida',
};

const diaDe = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

/** "hoy 10:32", "ayer 16:02", "5 nov" (con año si no es este). */
function cuandoCorto(iso: string): string {
  const d = new Date(iso);
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);
  const k = diaDe(d);
  if (k === diaDe(new Date())) return `hoy ${hora}`;
  if (k === diaDe(new Date(Date.now() - 86_400_000))) return `ayer ${hora}`;
  const mismoAno = k.slice(0, 4) === diaDe(new Date()).slice(0, 4);
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', ...(mismoAno ? {} : { year: 'numeric' }), timeZone: TZ }).format(d);
}

/** "hoy", "mañana" o "mar 12 nov". */
function diaCorto(ymd: string): string {
  if (ymd === hoyMty()) return 'hoy';
  if (ymd === diaDe(new Date(Date.now() + 86_400_000))) return 'mañana';
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const primerNombre = (n: string) => (n.includes('@') ? n.split('@')[0] : n.split(/\s+/)[0]);

const CSS = `
  .trt { display: grid; gap: 10px; min-width: 0; }
  .trt-head { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; }
  .trt-h { margin: 0; font-family: inherit; font-size: 11.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--adm-faint); }
  .trt-acc { display: flex; gap: 6px; flex-wrap: wrap; }
  .trt-anotar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; color: var(--adm-muted); }
  .trt-op { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 999px;
    border: 1px solid var(--adm-border-strong); background: transparent; color: var(--adm-text-2);
    font-family: inherit; font-size: 12.5px; cursor: pointer; transition: border-color .15s ease, color .15s ease, background .15s ease; }
  .trt-op:hover { color: var(--adm-text); border-color: var(--adm-text-2); }
  .trt-op:disabled { opacity: .5; cursor: default; }
  .trt-op[aria-pressed="true"] { color: var(--adm-text); border-color: color-mix(in srgb, var(--adm-accent) 65%, transparent); background: color-mix(in srgb, var(--adm-accent) 14%, transparent); }
  .trt-op i { font-size: 14px; }
  .trt-list { list-style: none; margin: 0; padding: 0; display: grid; }
  .trt-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 2px 10px; align-items: start; padding: 8px 0; border-top: 1px solid var(--adm-border); font-size: 13.5px; }
  .trt-row:first-child { border-top: 0; }
  .trt-ico { font-size: 16px; color: var(--adm-muted); margin-top: 2px; }
  .trt-tit { color: var(--adm-text); font-weight: 500; overflow-wrap: anywhere; }
  .trt-sub { color: var(--adm-muted); font-weight: 400; }
  .trt-nota { margin-top: 2px; font-size: 13px; color: var(--adm-text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
  .trt-rec { margin-top: 3px; display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--adm-warn); }
  .trt-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--adm-faint); white-space: nowrap; }
  .trt-meta .adm-ibtn { width: 26px; height: 26px; }
  /* Lo que mandó el sistema, en gris: es contexto, no algo que alguien hizo. */
  .trt-row.is-correo .trt-tit { color: var(--adm-muted); font-weight: 400; }
  .trt-row.is-correo .trt-ico { color: var(--adm-faint); }
  .trt-asunto { color: inherit; text-decoration: none; }
  .trt-asunto:hover { color: var(--adm-accent); }
  .trt-mal { color: var(--adm-bad); font-weight: 400; }
  .trt-ok { color: var(--adm-ok); }
  .trt-ed { grid-column: 2 / -1; display: grid; gap: 10px; margin-top: 8px; padding: 12px; border: 1px solid var(--adm-border); border-radius: 8px; background: rgba(var(--adm-ink), 0.02); }
  .trt-fila { display: flex; align-items: center; gap: 6px 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--adm-muted); }
  .trt-fila .adm-input { flex: 1 1 220px; height: 32px; font-size: 13px; }
  .trt-link { background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; color: var(--adm-text-2); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .trt-link:hover { color: var(--adm-accent); }
  .trt-link.is-tenue { color: var(--adm-faint); }
  .trt-fecha { width: 170px; }
  .trt-vacio { margin: 0; font-size: 13px; color: var(--adm-faint); line-height: 1.5; }
  .trt-mas { justify-self: start; background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; color: var(--adm-text-2); cursor: pointer; }
  .trt-mas:hover { color: var(--adm-accent); }
  /* Teléfono: una columna para el texto, quién y cuándo debajo, y botones al tamaño del dedo. */
  @media (max-width: 760px) {
    .trt-row { grid-template-columns: 20px minmax(0, 1fr); }
    .trt-meta { grid-column: 2; }
    .trt-ed { grid-column: 1 / -1; }
    .trt-op { height: 34px; }
    .trt-meta .adm-ibtn { width: 34px; height: 34px; }
  }
`;

export function Trato({
  objetivo, con, telefono, nombre, titulo, textoWhatsApp, compacto = false, onCambio,
}: {
  /** UNA cosa: la solicitud, el cliente o el aliado. */
  objetivo: ObjetivoTrato;
  con: ConQuien;
  /** Para "Llamar" y "WhatsApp" (que se anotan solos). */
  telefono?: string | null;
  /** A quién se saluda en el WhatsApp. */
  nombre?: string | null;
  titulo?: string;
  /** El mensaje con que abre el chat; por defecto, un saludo. */
  textoWhatsApp?: string;
  /** Menos renglones a la vista (los demás con "Ver todo"). */
  compacto?: boolean;
  /** Tras anotar algo que cuenta como contacto: p. ej. refrescar el "Primer contacto" de la solicitud. */
  onCambio?: () => void;
}) {
  const [renglones, setRenglones] = useState<RenglonTrato[] | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const consulta = objetivo.solicitud ? `solicitud=${objetivo.solicitud}`
    : objetivo.cliente ? `cliente=${objetivo.cliente}`
      : objetivo.aliado ? `aliado=${objetivo.aliado}` : null;

  const cargar = useCallback(async () => {
    if (!consulta) return;
    const r = await fetch(`/api/admin/trato?${consulta}`).catch(() => null);
    // Sin el permiso de esto, el trato no se enseña (no es un error de la pantalla).
    if (r?.status === 403) { setSinPermiso(true); return; }
    const b = r?.ok ? ((await r.json().catch(() => null)) as { renglones?: RenglonTrato[] } | null) : null;
    setRenglones(b?.renglones ?? []);
  }, [consulta]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Lo que anota otra persona aparece solo (la campana lanza `adm:cambios`),
  // salvo mientras se escribe una nota: no se le borra de enfrente.
  useEffect(() => {
    if (editando) return;
    const al = () => { void cargar(); };
    window.addEventListener('adm:cambios', al);
    return () => window.removeEventListener('adm:cambios', al);
  }, [cargar, editando]);

  if (sinPermiso || !consulta) return null;

  const persona = { ...objetivo, con };

  /** "Ya le hablé por…": un clic deja el renglón; el editor queda abierto por si quiere ponerle cómo quedó. */
  async function anotar(canal: Canal) {
    setOcupado(true);
    const r = await fetch('/api/admin/trato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...persona, canal }),
    }).catch(() => null);
    const b = (await r?.json().catch(() => null)) as { renglon?: RenglonTrato } | null;
    setOcupado(false);
    if (!r?.ok || !b?.renglon) return; // el aviso de "No se guardó" sale solo
    mostrarResultado(`Anotado: ${CANAL[canal].label.toLowerCase()}. Si quieres, ponle cómo quedó.`, 'ok');
    setRenglones((rs) => [b.renglon!, ...(rs ?? [])]);
    setEditando(b.renglon.id);
    onCambio?.();
  }

  /** Llamar o abrir WhatsApp desde aquí: se anota solo y queda listo para la nota. */
  async function alAbrir(canal: 'llamada' | 'whatsapp') {
    const r = await anotarSolo({ ...persona, canal });
    if (!r) return;
    setRenglones((rs) => [r, ...(rs ?? [])]);
    setEditando(r.id);
  }

  async function cambiar(r: RenglonTrato, cambios: Cambios): Promise<boolean> {
    const resp = await fetch(`/api/admin/trato/${Number(r.id.slice(1))}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    }).catch(() => null);
    const b = (await resp?.json().catch(() => null)) as { renglon?: RenglonTrato | null } | null;
    if (!resp?.ok) return false;
    setRenglones((rs) => (rs ?? []).flatMap((x) => (x.id === r.id ? (b?.renglon ? [b.renglon] : []) : [x])));
    if (cambios.quitado) { setEditando(null); mostrarResultado('Se quitó ese renglón.', 'ok'); }
    if (cambios.res !== undefined) onCambio?.();
    return true;
  }

  const tel = telefono?.replace(/[^\d+]/g, '') || null;
  const wa = waDe(telefono);
  const saludo = textoWhatsApp ?? `Hola${nombre ? ` ${nombre.split(/\s+/)[0]}` : ''}, te escribo de MAQSER24.`;
  const lista = renglones ?? [];
  const max = compacto ? 4 : 8;
  const visibles = todos ? lista : lista.slice(0, max);

  return (
    <div className="trt">
      <style>{CSS}</style>
      <div className="trt-head">
        <h3 className="trt-h">{titulo ?? (con === 'aliado' ? 'Trato con el aliado' : 'Trato con el cliente')}</h3>
        {tel || wa ? (
          <div className="trt-acc">
            {tel ? (
              <a href={`tel:${tel}`} className={btnClass('secondary', 'sm')} onClick={() => void alAbrir('llamada')} title={`Llamar al ${telefono}: se anota solo`}>
                <i className="ph ph-phone" aria-hidden />Llamar
              </a>
            ) : null}
            {wa ? (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(saludo)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnClass('secondary', 'sm')}
                onClick={() => void alAbrir('whatsapp')}
                title={`Abre el chat con ${telefono}: se anota solo`}
              >
                <i className="ph ph-whatsapp-logo" aria-hidden />WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="trt-anotar" role="group" aria-label="Anotar que ya le hablaste">
        <span>Ya le hablé por</span>
        {CANALES.map((c) => (
          <button key={c} type="button" className="trt-op" disabled={ocupado} onClick={() => void anotar(c)}>
            <i className={`ph ${CANAL[c].icon}`} aria-hidden />{CANAL[c].label}
          </button>
        ))}
      </div>

      {renglones === null ? (
        <p className="trt-vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="trt-vacio">Todavía no hay llamadas ni mensajes anotados. Lo que el sistema le mande por correo también sale aquí.</p>
      ) : (
        <ol className="trt-list">
          {visibles.map((r) => (
            <Renglon
              key={r.id}
              r={r}
              con={con}
              enSolicitud={objetivo.solicitud ?? null}
              abierto={editando === r.id}
              onAbrir={() => setEditando(editando === r.id ? null : r.id)}
              onCambiar={(c) => cambiar(r, c)}
            />
          ))}
        </ol>
      )}
      {lista.length > max ? (
        <button type="button" className="trt-mas" onClick={() => setTodos(!todos)}>
          {todos ? 'Ver menos' : `Ver todo (${lista.length})`} <i className={`ph ${todos ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function Renglon({ r, con, enSolicitud, abierto, onAbrir, onCambiar }: {
  r: RenglonTrato;
  con: ConQuien;
  enSolicitud: number | null;
  abierto: boolean;
  onAbrir: () => void;
  onCambiar: (c: Cambios) => Promise<boolean>;
}) {
  const correo = r.tipo === 'correo';
  // Lo que anotó el panel solo dice lo que pasó ("Se abrió WhatsApp") hasta que le ponen cómo quedó.
  const titulo = r.auto && !r.res && !correo ? CANAL[r.canal].solo : CANAL[r.canal].label;
  // En la solicitud se ve también el trato con el aliado: dice con quién.
  const conQuien = r.con !== con && r.a ? `con ${r.a}` : null;
  // Desde el cliente o el aliado: de qué solicitud era.
  const deOtra = r.folio && r.solicitudId !== enSolicitud ? r.folio : null;
  const pendiente = r.recordar && !r.hecho;

  return (
    <li className={`trt-row${correo ? ' is-correo' : ''}`}>
      <i className={`ph ${correo ? 'ph-envelope-simple' : CANAL[r.canal].icon} trt-ico`} aria-hidden />
      <div style={{ minWidth: 0 }}>
        <div className="trt-tit">
          {correo ? (
            <>
              Correo del sistema:{' '}
              {r.correoId ? <a href={`/correo?ver=${r.correoId}`} className="trt-asunto">{r.asunto}</a> : r.asunto}
              {r.estado && ESTADO_CORREO[r.estado] ? <span className="trt-mal"> · {ESTADO_CORREO[r.estado]}</span> : null}
            </>
          ) : (
            <>
              {titulo}
              {r.res ? <span className={r.res === 'confirmado' ? 'trt-ok' : r.res === 'no_contesto' ? 'trt-sub' : undefined}> · {RESULTADO[r.res]}</span> : null}
            </>
          )}
          {conQuien ? <span className="trt-sub"> · {conQuien}</span> : null}
          {deOtra ? <span className="trt-sub adm-mono" style={{ fontSize: 12 }}> · {deOtra}</span> : null}
        </div>
        {r.nota ? <div className="trt-nota">{r.nota}</div> : null}
        {pendiente && !abierto ? (
          <div className="trt-rec"><i className="ph ph-bell-ringing" aria-hidden />Recordatorio {diaCorto(r.recordar!)}</div>
        ) : null}
      </div>
      <div className="trt-meta">
        <span title={r.quien ?? 'Lo mandó el sistema'}>{r.quien ? primerNombre(r.quien) : 'Sistema'}</span>
        <span aria-hidden>·</span>
        <time dateTime={r.cuando}>{cuandoCorto(r.cuando)}</time>
        {r.editable ? (
          <IconBtn icon={abierto ? 'ph-x' : 'ph-pencil-simple'} label={abierto ? 'Cerrar' : 'Ponerle cómo quedó'} plain onClick={onAbrir} />
        ) : null}
      </div>
      {abierto ? <Editor r={r} onCambiar={onCambiar} onCerrar={onAbrir} /> : null}
    </li>
  );
}

/**
 * Cómo quedó, en un clic; la nota y el recordatorio si hacen falta. «Quedó de
 * confirmar» pone solo el recordatorio para el siguiente día hábil (se cambia
 * o se quita); «Confirmado» lo quita: ya no hay a qué darle seguimiento.
 */
function Editor({ r, onCambiar, onCerrar }: { r: RenglonTrato; onCambiar: (c: Cambios) => Promise<boolean>; onCerrar: () => void }) {
  const [nota, setNota] = useState(r.nota ?? '');
  const [guardando, setGuardando] = useState(false);
  const pendiente = Boolean(r.recordar && !r.hecho);

  async function elegir(res: Resultado) {
    const nuevo = r.res === res ? null : res;
    const cambios: Cambios = { res: nuevo };
    if (nuevo === 'confirmar' && !pendiente) cambios.recordar = siguienteDiaHabil();
    if (nuevo === 'confirmado' && pendiente) cambios.recordar = null;
    // Lo escrito en la nota se guarda de una vez: nadie aprieta dos botones.
    if (nota.trim() !== (r.nota ?? '')) cambios.nota = nota.trim() || null;
    await onCambiar(cambios);
  }

  async function guardarNota() {
    setGuardando(true);
    await onCambiar({ nota: nota.trim() || null });
    setGuardando(false);
  }

  return (
    <div className="trt-ed">
      <div className="trt-fila" role="group" aria-label="Cómo quedó">
        <span>¿Cómo quedó?</span>
        {RESULTADOS.map((k) => (
          <button key={k} type="button" className="trt-op" aria-pressed={r.res === k} onClick={() => void elegir(k)}>{RESULTADO[k]}</button>
        ))}
      </div>
      <div className="trt-fila">
        <input
          className="adm-input"
          value={nota}
          maxLength={300}
          placeholder="Nota corta (opcional)"
          aria-label="Nota"
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardarNota(); } }}
        />
        <Btn size="sm" onClick={() => void guardarNota()} disabled={guardando || nota.trim() === (r.nota ?? '')}>
          {guardando ? 'Guardando…' : 'Guardar nota'}
        </Btn>
      </div>
      <div className="trt-fila">
        <i className="ph ph-bell-ringing" aria-hidden style={{ fontSize: 15, color: pendiente ? 'var(--adm-warn)' : undefined }} />
        {pendiente ? (
          <>
            <span>Te sale en tu Inicio el</span>
            <span className="trt-fecha">
              <AdminDatePicker size="sm" value={r.recordar!} min={hoyMty()} onChange={(v) => { if (v) void onCambiar({ recordar: v }); }} aria-label="Fecha del recordatorio" />
            </span>
            <button type="button" className="trt-link" onClick={() => void onCambiar({ recordar: null })}>Quitar</button>
          </>
        ) : (
          <button type="button" className="trt-link" onClick={() => void onCambiar({ recordar: siguienteDiaHabil() })}>Recuérdamelo</button>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="trt-link is-tenue"
          onClick={async () => {
            if (await confirmar({ titulo: 'Quitar este renglón', mensaje: 'Deja de verse en el trato. Úsalo si se anotó por error (por ejemplo, si marcaste sin querer).', confirmar: 'Quitar' })) {
              void onCambiar({ quitado: true });
            }
          }}
        >
          Quitar renglón
        </button>
        <Btn size="sm" variant="ghost" onClick={onCerrar}>Listo</Btn>
      </div>
    </div>
  );
}
