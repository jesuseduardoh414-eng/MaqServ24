'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/Enlace';
import { Modal } from '@/components/Modal';
import { Btn, Note, StatusText } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';
import { TIPO, estadoDe, fecha } from './textos';

interface Detalle {
  id: number;
  kind: string;
  to: string;
  toName: string | null;
  subject: string;
  state: string;
  detail: string | null;
  createdAt: string | null;
  html: string | null;
  conEnlacePersonal: boolean;
  reenviable: boolean;
  solicitud: { id: number; numero: string | null } | null;
  aliado: { id: number; nombre: string | null } | null;
}

const etiqueta: React.CSSProperties = { fontSize: 12, color: 'var(--adm-faint)', paddingTop: 2 };

/**
 * UN CORREO ABIERTO (2026-10-12).
 *
 * "No viene detallada la vista del correo, no puedo ver más información."
 * Se ve tal como le llegó a la persona, con a quién, cuándo, cómo terminó y
 * de qué solicitud o aliado es. Así no hay que pedirle a nadie que abra su
 * Gmail para saber qué se le dijo.
 *
 * El contenido va en un iframe sin scripts: es HTML que armó la plataforma,
 * pero lleva datos que escribió un cliente, y un registro no es lugar para
 * ejecutar nada.
 */
export function CorreoDetalle({ id, onCerrar, onReenviado }: { id: number; onCerrar: () => void; onReenviado: () => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const marco = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let vivo = true;
    setD(null); setError(null); setMsg(null);
    fetch(`/api/admin/mail/log/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok) setError(j?.message ?? 'No se pudo abrir el correo.');
        else setD(j as Detalle);
      })
      .catch(() => vivo && setError('No se pudo abrir el correo.'));
    return () => { vivo = false; };
  }, [id]);

  /** El marco crece con el correo: un scroll dentro de otro scroll se pierde. */
  function ajustarAlto() {
    const doc = marco.current?.contentDocument;
    if (marco.current && doc) marco.current.style.height = `${Math.max(240, doc.documentElement.scrollHeight + 8)}px`;
  }

  async function reenviar() {
    if (!d) return;
    if (!(await confirmar({
      titulo: '¿Volver a mandar este correo?',
      mensaje: `Le llega otra vez a ${d.toName ? `${d.toName} (${d.to})` : d.to}, igual que la primera vez.`,
      confirmar: 'Reenviar',
    }))) return;
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/mail/log/${d.id}/reenviar`, { method: 'POST' });
    const j = await r.json().catch(() => null);
    setOcupado(false);
    setMsg(j?.mensaje ?? j?.message ?? 'No se pudo reenviar.');
    if (r.ok) onReenviado();
  }

  const e = d ? estadoDe(d.state) : null;

  return (
    <Modal
      abierto
      titulo={d?.subject ?? 'Correo'}
      subtitulo={d ? `${TIPO[d.kind] ?? d.kind} · ${fecha(d.createdAt)}` : undefined}
      onCerrar={onCerrar}
      ancho={780}
      pie={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          {msg ? <span role="status" style={{ fontSize: 13, color: 'var(--adm-muted)', marginRight: 'auto' }}>{msg}</span> : null}
          {d?.reenviable ? (
            <Btn icon="ph-paper-plane-tilt" onClick={() => void reenviar()} disabled={ocupado}>
              Reenviar
            </Btn>
          ) : null}
          <Btn variant="ghost" onClick={onCerrar}>Cerrar</Btn>
        </div>
      }
    >
      {error ? <Note tone="bad">{error}</Note> : null}
      {!d && !error ? <div style={{ fontSize: 13.5, color: 'var(--adm-muted)' }}>Abriendo…</div> : null}

      {d && e ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(84px, auto) minmax(0, 1fr)', gap: '8px 16px', fontSize: 13.5, color: 'var(--adm-text)' }}>
            <span style={etiqueta}>Para</span>
            <span style={{ overflowWrap: 'anywhere' }}>
              {d.toName ? <><strong style={{ fontWeight: 600 }}>{d.toName}</strong> · </> : null}{d.to}
            </span>

            <span style={etiqueta}>Estado</span>
            <span>
              <StatusText tone={e.tone} title={e.nota}>{e.texto}</StatusText>
              <span style={{ color: 'var(--adm-muted)', marginLeft: 8, fontSize: 12.5 }}>{e.nota}</span>
              {d.detail ? (
                <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5, color: d.state === 'fallido' ? 'var(--adm-bad)' : 'var(--adm-faint)', overflowWrap: 'anywhere' }}>
                  {d.detail}
                </div>
              ) : null}
            </span>

            {d.solicitud ? (
              <>
                <span style={etiqueta}>Solicitud</span>
                <span><Link href="/cotizaciones" className="adm-link">{d.solicitud.numero ?? `#${d.solicitud.id}`}</Link></span>
              </>
            ) : null}

            {d.aliado ? (
              <>
                <span style={etiqueta}>Aliado</span>
                <span><Link href="/proveedores" className="adm-link">{d.aliado.nombre ?? `#${d.aliado.id}`}</Link></span>
              </>
            ) : null}
          </div>

          {d.conEnlacePersonal ? (
            <Note tone="warn">
              Este correo lleva un enlace personal (para entrar o cambiar una contraseña). Por seguridad no se guarda: aparece
              como <span className="adm-mono">[enlace-personal]</span>. Para mandarlo otra vez, repite la acción que lo envía.
            </Note>
          ) : null}

          {d.html ? (
            // Fondo blanco: las plantillas están hechas para la bandeja de correo, no para el panel oscuro.
            <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--adm-border)' }}>
              <iframe
                ref={marco}
                title={`Contenido de "${d.subject}"`}
                // Sin allow-scripts: nada del correo se ejecuta. allow-same-origin
                // deja medir su alto; los enlaces abren en otra pestaña.
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                srcDoc={`<base target="_blank">${d.html}`}
                onLoad={ajustarAlto}
                style={{ width: '100%', height: 480, border: 0, display: 'block' }}
              />
            </div>
          ) : (
            <Note>Este correo se mandó antes de que se guardara el contenido: solo quedan los datos de arriba.</Note>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
