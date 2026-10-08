'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, EmptyState, Note, PageHeader, Panel, SectionHead, Segmented, StatusText, Toolbar, type Tone } from '@/components/ui';

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

const ESTADO: Record<string, { texto: string; tone: Tone; nota: string }> = {
  enviado: { texto: 'Enviado', tone: 'ok', nota: 'Salió del servidor' },
  fallido: { texto: 'Falló', tone: 'bad', nota: 'El servidor lo rechazó' },
  simulado: { texto: 'Simulado', tone: 'warn', nota: 'No salió: el envío está apagado' },
  omitido: { texto: 'Omitido', tone: 'muted', nota: 'Dirección inválida' },
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
  const tono: Tone = encendido ? 'ok' : estado?.configurado ? 'warn' : 'bad';

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
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Configuración']}
        title="Correo"
        subtitle="Los avisos que salen del sitio: cotización respondida, avance del servicio y las solicitudes que se le ofrecen a un aliado."
      />

      {/* Lo primero: ¿de verdad sale correo? */}
      <Note tone={tono} style={{ marginBottom: 24, padding: '14px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--adm-text)' }}>
          {encendido ? 'El correo está encendido' : estado?.configurado ? 'Configurado, pero apagado' : 'Sin servidor de correo'}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.6 }}>{estado?.resumen}</p>

        {!encendido ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--adm-border)', fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.7 }}>
            {/* El freno es deliberado: en la base hay cotizaciones con correos
                de clientes reales, y encenderlo tiene que ser una decisión. */}
            En la API hacen falta estas variables. Va apagado a propósito: en la base hay correos de
            clientes reales, y encenderlo debe ser una decisión y no un descuido.
            <div className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-text)', marginTop: 8, lineHeight: 1.85 }}>
              SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS<br />
              MAIL_FROM · MAIL_FROM_NAME<br />
              <span style={{ color: 'var(--adm-warn)' }}>MAIL_ENABLED = true</span> ← esto es lo que lo enciende
            </div>
          </div>
        ) : null}

        {estado?.ultimoFallo ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--adm-border)', fontSize: 12.5, color: 'var(--adm-bad)' }}>
            Último fallo: {estado.ultimoFallo.to_email} — {estado.ultimoFallo.detail}
          </div>
        ) : null}
      </Note>

      {/* Probar */}
      <Panel
        title="Probar"
        icon="ph-paper-plane-tilt"
        desc="El correo va a la dirección que escribas aquí, nunca a un cliente de la base: probar no puede ser la forma accidental de escribirle a alguien real."
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="adm-input"
            style={{ maxWidth: 320 }}
            type="email"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="tu@correo.com"
            aria-label="Correo de prueba"
          />
          <Btn icon="ph-paper-plane-tilt" onClick={mandarPrueba} disabled={ocupado}>
            Mandar prueba
          </Btn>
          <Btn variant="ghost" onClick={probarConexion} disabled={ocupado}>
            Sólo probar conexión
          </Btn>
        </div>
        {msg ? <Note style={{ marginTop: 12 }}>{msg}</Note> : null}
      </Panel>

      {/*
        RECORDATORIOS (documento institucional, 18).
        La regla de los 14 dias ya existia y ya funcionaba: un equipo sin
        confirmar deja de proponerse solo. Faltaba que alguien se enterara.
      */}
      <Panel
        title="Recordar a los aliados"
        icon="ph-bell-simple"
        desc="Un correo por aliado con sus equipos sin confirmar y sus papeles por vencer, con su enlace para resolverlo en un clic. A nadie se le escribe dos veces en la misma semana."
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn icon="ph-eye" onClick={verRecordatorios} disabled={ocupado}>
            Ver a quién le toca
          </Btn>
          {/* Único primario de la página: es el envío que sí le llega a gente real. */}
          {previa && previa.alcanzados > 0 ? (
            <Btn variant="primary" icon="ph-paper-plane-tilt" onClick={mandarRecordatorios} disabled={ocupado}>
              Mandar a {previa.alcanzados}
            </Btn>
          ) : null}
        </div>

        {previa ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13.5, color: 'var(--adm-text)', marginBottom: 10 }}>{previa.mensaje}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {previa.candidatos.map((c) => (
                <div key={c.providerId} style={{ display: 'flex', gap: 11, fontSize: 13, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ minWidth: 12, color: c.seLeEscribe ? 'var(--adm-ok)' : 'var(--adm-faint)' }} aria-hidden>{c.seLeEscribe ? '→' : '·'}</span>
                  <span style={{ color: c.seLeEscribe ? 'var(--adm-text)' : 'var(--adm-faint)', minWidth: 210 }}>{c.name}</span>
                  {/* El motivo se lee siempre, tambien cuando NO se le escribe:
                      un aliado sin correo es un dato a corregir, no una fila
                      que desaparece. */}
                  <span style={{ color: 'var(--adm-muted)' }}>{c.motivo}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      {/* Registro */}
      <section className="adm-section">
        <SectionHead title="Registro" />
        <Toolbar end={`${filtrado.length} de ${total}`}>
          <Segmented
            ariaLabel="Filtrar por estado"
            value={filtro ?? 'todos'}
            onChange={(k) => (k === 'todos' ? setFiltro(null) : setFiltro(filtro === k ? null : k))}
            items={[
              { key: 'todos', label: 'Todos', count: total },
              ...Object.entries(estado?.conteo ?? {}).map(([k, n]) => {
                const e = ESTADO[k] ?? { texto: k, tone: 'muted' as Tone, nota: '' };
                return {
                  key: k,
                  label: <span className={`adm-status t-${e.tone}`} style={{ fontSize: 'inherit', fontWeight: 'inherit' }} title={e.nota}>{e.texto}</span>,
                  count: n,
                };
              }),
            ]}
          />
        </Toolbar>

        <Panel flush clip>
          {filtrado.length === 0 ? (
            <EmptyState
              icon="ph-envelope-simple"
              title={registro.length === 0 ? 'Todavía no se ha mandado ningún correo' : 'Sin resultados con ese filtro'}
              sub={registro.length === 0 ? 'Aparecerán aquí en cuanto se responda una cotización o avance un servicio.' : undefined}
            />
          ) : null}

          {filtrado.map((r) => {
            const e = ESTADO[r.state] ?? { texto: r.state, tone: 'muted' as Tone, nota: '' };
            return (
              <div
                key={r.id}
                className="adm-trow"
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'start' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--adm-text)' }}>{r.subject}</div>
                  <div className="adm-cell-sub">
                    {TIPO[r.kind] ?? r.kind} · {r.toName ? `${r.toName} · ` : ''}{r.to}
                  </div>
                  {/* El detalle sólo aparece cuando dice algo: en un "enviado" es
                      null y una fila vacía no informa. */}
                  {r.detail ? (
                    <div style={{ fontSize: 12.5, color: r.state === 'fallido' ? 'var(--adm-bad)' : 'var(--adm-faint)', marginTop: 4, lineHeight: 1.5 }}>
                      {r.detail}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <StatusText tone={e.tone} title={e.nota}>{e.texto}</StatusText>
                  <div style={{ fontSize: 12, color: 'var(--adm-faint)', marginTop: 3 }}>{fecha(r.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </Panel>
      </section>
    </div>
  );
}
