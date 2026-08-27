'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

/**
 * CORREO — configuración, prueba y registro.
 *
 * Está armada alrededor de una pregunta incómoda: ¿de verdad salió? La
 * respuesta va arriba y en grande, porque lo peor que puede pasar con el correo
 * no es que falle, es que falle en silencio y la operación crea que informó.
 */

export interface EstadoCorreo {
  configurado: boolean;
  habilitado: boolean;
  resumen: string;
  conteo: Record<string, number>;
  ultimoFallo: { created_at: string; to_email: string; detail: string | null } | null;
}

export interface RegistroCorreo {
  id: number;
  kind: string;
  to: string;
  toName: string | null;
  subject: string;
  state: string;
  detail: string | null;
  quoteId: number | null;
  createdAt: string | null;
}

const C = {
  panel: '#141416', panel2: '#1b1e26', line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

const ESTADO: Record<string, { texto: string; color: string; nota: string }> = {
  enviado: { texto: 'Enviado', color: C.ok, nota: 'Salió del servidor' },
  fallido: { texto: 'Falló', color: C.bad, nota: 'El servidor lo rechazó' },
  simulado: { texto: 'Simulado', color: C.warn, nota: 'No salió: el envío está apagado' },
  omitido: { texto: 'Omitido', color: C.dim, nota: 'Dirección inválida' },
};

const TIPO: Record<string, string> = {
  quote_answered: 'Cotización respondida',
  quote_expiring: 'Cotización por vencer',
  service_status: 'Avance del servicio',
  provider_offer: 'Oferta a un aliado',
  provider_assigned: 'Asignación a un aliado',
  provider_access: 'Enlace de acceso',
  availability_reminder: 'Recordatorio de disponibilidad',
  prueba: 'Prueba',
};

const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
};
const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 9,
  padding: '9px 15px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9,
  padding: '9px 15px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export function MailPanel({
  estado, registro, total,
}: {
  estado: EstadoCorreo | null;
  registro: RegistroCorreo[];
  total: number;
}) {
  const router = useRouter();
  const [destino, setDestino] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState<string | null>(null);
  /**
   * Vista previa de los recordatorios. Se pide primero y se manda despues:
   * antes de escribirle a la red entera hay que poder ver a quien le toca y
   * por que.
   */
  const [previa, setPrevia] = useState<{
    mensaje: string;
    alcanzados: number;
    omitidos: number;
    candidatos: Array<{ providerId: number; name: string; motivo: string; seLeEscribe: boolean; equipos: unknown[]; documentos: unknown[] }>;
  } | null>(null);

  const encendido = estado?.habilitado ?? false;
  const color = encendido ? C.ok : estado?.configurado ? C.warn : C.bad;

  async function probarConexion() {
    setOcupado(true); setMsg(null);
    const r = await fetch('/api/admin/mail/probar');
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setMsg(d ? `${d.ok ? '✓' : '✗'} ${d.detalle}` : 'No se pudo comprobar.');
  }

  async function mandarPrueba() {
    if (!destino.trim()) return;
    setOcupado(true); setMsg(null);
    const r = await fetch('/api/admin/mail/prueba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: destino.trim() }),
    });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setMsg(d?.mensaje ?? 'No se pudo mandar.');
    router.refresh();
  }

  async function verRecordatorios() {
    setOcupado(true); setMsg(null);
    const r = await fetch('/api/admin/mail/recordatorios');
    setPrevia(r.ok ? await r.json() : null);
    setOcupado(false);
  }

  async function mandarRecordatorios() {
    setOcupado(true); setMsg(null);
    const r = await fetch('/api/admin/mail/recordatorios', { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setPrevia(null);
    setMsg(d?.mensaje ?? 'No se pudo.');
    router.refresh();
  }

  const filtrado = filtro ? registro.filter((r) => r.state === filtro) : registro;

  return (
    <div style={{ color: C.ink }}>
      <header style={{ marginBottom: 22 }}>
        <h1 className="adm-page-title">Correo</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 0', maxWidth: 640, lineHeight: 1.6 }}>
          Los avisos que salen del sitio: cotización respondida, avance del servicio y las
          solicitudes que se le ofrecen a un aliado.
        </p>
      </header>

      {/* Lo primero: ¿de verdad sale correo? */}
      <div style={{
        background: `color-mix(in srgb, ${color} 7%, ${C.panel})`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
        borderRadius: 14, padding: '17px 19px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {encendido ? 'El correo está encendido' : estado?.configurado ? 'Configurado, pero apagado' : 'Sin servidor de correo'}
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>{estado?.resumen}</p>

        {!encendido ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
            {/* El freno es deliberado: en la base hay cotizaciones con correos
                de clientes reales, y encenderlo tiene que ser una decisión. */}
            En la API hacen falta estas variables. Va apagado a propósito: en la base hay correos de
            clientes reales, y encenderlo debe ser una decisión y no un descuido.
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: C.ink, marginTop: 8, lineHeight: 1.85 }}>
              SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS<br />
              MAIL_FROM · MAIL_FROM_NAME<br />
              <span style={{ color: C.warn }}>MAIL_ENABLED = true</span> ← esto es lo que lo enciende
            </div>
          </div>
        ) : null}

        {estado?.ultimoFallo ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.bad }}>
            Último fallo: {estado.ultimoFallo.to_email} — {estado.ultimoFallo.detail}
          </div>
        ) : null}
      </div>

      {/* Probar */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Probar</div>
        <p style={{ margin: '0 0 13px', fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          El correo va a la dirección que escribas aquí, nunca a un cliente de la base: probar no
          puede ser la forma accidental de escribirle a alguien real.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...input, maxWidth: 320 }}
            type="email"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="tu@correo.com"
          />
          <button type="button" style={{ ...boton, opacity: ocupado ? 0.6 : 1 }} onClick={mandarPrueba} disabled={ocupado}>
            Mandar prueba
          </button>
          <button type="button" style={botonSec} onClick={probarConexion} disabled={ocupado}>
            Sólo probar conexión
          </button>
        </div>
        {msg ? (
          <div style={{ marginTop: 12, fontSize: 13, color: C.ink, background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '10px 13px' }}>
            {msg}
          </div>
        ) : null}
      </div>

      {/*
        RECORDATORIOS (documento institucional, 18).
        La regla de los 14 dias ya existia y ya funcionaba: un equipo sin
        confirmar deja de proponerse solo. Faltaba que alguien se enterara.
      */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Recordar a los aliados</div>
        <p style={{ margin: '0 0 13px', fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          Un correo por aliado con sus equipos sin confirmar y sus papeles por vencer, con su enlace
          para resolverlo en un clic. A nadie se le escribe dos veces en la misma semana.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={botonSec} onClick={verRecordatorios} disabled={ocupado}>
            Ver a quién le toca
          </button>
          {previa && previa.alcanzados > 0 ? (
            <button type="button" style={{ ...boton, opacity: ocupado ? 0.6 : 1 }} onClick={mandarRecordatorios} disabled={ocupado}>
              Mandar a {previa.alcanzados}
            </button>
          ) : null}
        </div>

        {previa ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>{previa.mensaje}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {previa.candidatos.map((c) => (
                <div key={c.providerId} style={{ display: 'flex', gap: 11, fontSize: 12.5, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ minWidth: 12, color: c.seLeEscribe ? C.ok : C.dim }}>{c.seLeEscribe ? '→' : '·'}</span>
                  <span style={{ color: c.seLeEscribe ? C.ink : C.dim, minWidth: 210 }}>{c.name}</span>
                  {/* El motivo se lee siempre, tambien cuando NO se le escribe:
                      un aliado sin correo es un dato a corregir, no una fila
                      que desaparece. */}
                  <span style={{ color: C.muted }}>{c.motivo}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Registro */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setFiltro(null)}
          style={{ ...botonSec, ...(filtro === null ? { borderColor: C.accent, color: C.ink } : {}) }}
        >
          Todos ({total})
        </button>
        {Object.entries(estado?.conteo ?? {}).map(([k, n]) => {
          const e = ESTADO[k] ?? { texto: k, color: C.dim, nota: '' };
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFiltro(filtro === k ? null : k)}
              title={e.nota}
              style={{ ...botonSec, color: e.color, ...(filtro === k ? { borderColor: e.color } : {}) }}
            >
              {e.texto} ({n})
            </button>
          );
        })}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
        {filtrado.length === 0 ? (
          <div style={{ padding: '46px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.muted }}>
              {registro.length === 0 ? 'Todavía no se ha mandado ningún correo' : 'Sin resultados con ese filtro'}
            </div>
            {registro.length === 0 ? (
              <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>
                Aparecerán aquí en cuanto se responda una cotización o avance un servicio.
              </div>
            ) : null}
          </div>
        ) : null}

        {filtrado.map((r, i) => {
          const e = ESTADO[r.state] ?? { texto: r.state, color: C.dim, nota: '' };
          return (
            <div
              key={r.id}
              style={{
                padding: '13px 18px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.line}`,
                display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: C.ink }}>{r.subject}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
                  {TIPO[r.kind] ?? r.kind} · {r.toName ? `${r.toName} · ` : ''}{r.to}
                </div>
                {/* El detalle sólo aparece cuando dice algo: en un "enviado" es
                    null y una fila vacía no informa. */}
                {r.detail ? (
                  <div style={{ fontSize: 12, color: r.state === 'fallido' ? C.bad : C.dim, marginTop: 4, lineHeight: 1.5 }}>
                    {r.detail}
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: e.color }}>{e.texto.toUpperCase()}</span>
                <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>{fecha(r.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
