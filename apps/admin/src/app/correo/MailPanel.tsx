'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, EmptyState, Note, PageHeader, Panel, SectionHead, Segmented, StatusText, Toolbar, type Tone } from '@/components/ui';
import { CorreoDetalle } from './CorreoDetalle';
import { DisenoCorreos } from './DisenoCorreos';
import { TIPO, estadoDe, fecha } from './textos';

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
  /** El servidor es el buzón falso de esta máquina (Mailpit): nada sale a internet. */
  local?: boolean;
  resumen: string;
  conteo: Record<string, number>;
  /** El último fallo que nadie ha vuelto a mandar (los resueltos no cuentan). */
  ultimoFallo: { id: number; created_at: string; to_email: string; detail: string | null } | null;
  fallosPendientes?: number;
}

export interface RegistroCorreo {
  id: number;
  kind: string;
  to: string;
  toName: string | null;
  subject: string;
  state: string;
  detail: string | null;
  /** Falló, pero después salió uno igual: ya no le falta a nadie. */
  resuelto?: boolean;
  quoteId: number | null;
  createdAt: string | null;
}

interface PaginaRegistro { items: RegistroCorreo[]; total: number; page: number; pages: number }

export function MailPanel({
  completo, estado, registro, total, conteo, abrir,
}: {
  /** Dirección (Configuración): estado del servidor, prueba y recordatorios. Los demás, solo el registro. */
  completo: boolean;
  estado: EstadoCorreo | null;
  registro: RegistroCorreo[];
  total: number;
  /** Cuántos hay por estado, ya con el filtro de módulos de quien mira. */
  conteo: Record<string, number>;
  /** Correo a abrir al entrar (?ver=, desde el aviso de la campana). */
  abrir: number | null;
}) {
  const router = useRouter();
  const [verId, setVerId] = useState<number | null>(abrir);
  const [destino, setDestino] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState<string | null>(null);
  /**
   * Lo que se ve del registro. Empieza con la primera página que trae el
   * servidor; filtrar y "Ver más" piden a la API, porque filtrar solo lo
   * cargado escondía los correos de las páginas siguientes ("40 de 135").
   */
  const [lista, setLista] = useState<PaginaRegistro>({ items: registro, total, page: 1, pages: Math.max(1, Math.ceil(total / 40)) });
  const [cargando, setCargando] = useState(false);
  // Tras un reenvío (router.refresh) llega un registro nuevo: se vuelve a la primera página.
  useEffect(() => {
    setFiltro(null);
    setLista({ items: registro, total, page: 1, pages: Math.max(1, Math.ceil(total / 40)) });
  }, [registro, total]);

  async function pedir(estadoFiltro: string | null, page: number) {
    setCargando(true);
    try {
      const qs = new URLSearchParams({ page: String(page), ...(estadoFiltro ? { estado: estadoFiltro } : {}) });
      const r = await fetch(`/api/admin/mail/log?${qs}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as PaginaRegistro;
      setLista((prev) => ({ ...d, items: page === 1 ? d.items : [...prev.items, ...d.items] }));
    } finally {
      setCargando(false);
    }
  }

  function filtrar(k: string) {
    const nuevo = k === 'todos' || k === filtro ? null : k;
    setFiltro(nuevo);
    void pedir(nuevo, 1);
  }
  /**
   * Vista previa de los recordatorios. Se pide primero y se manda despues:
   * antes de escribirle a la red entera hay que poder ver a quien le toca y
   * por que.
   */
  const [previa, setPrevia] = useState<{
    mensaje: string;
    alcanzados: number;
    omitidos: number;
    candidatos: Array<{ providerId: number; name: string; motivo: string; seLeEscribe: boolean; documentos: unknown[] }>;
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

  const filtrado = lista.items;
  const pendientes = estado?.fallosPendientes ?? (estado?.ultimoFallo ? 1 : 0);

  return (
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Configuración']}
        title="Correo"
        subtitle={
          completo
            ? 'Cómo llegan los correos que manda el sistema (diseño y textos), si el envío está encendido, y el registro de todo lo que salió. Abre uno para verlo como le llegó.'
            : 'Los correos de tus módulos: a quién le llegó qué y si salió. Abre uno para verlo como le llegó.'
        }
      />

      {/* El estado del servidor, la prueba y los recordatorios son de Dirección. */}
      {completo ? (
      <>

      {/* Lo primero: cómo llegan tus correos (diseño y textos), 2026-10-28. */}
      <div style={{ marginBottom: 24 }}><DisenoCorreos /></div>

      {/* Lo primero: ¿de verdad sale correo? */}
      <Note tone={tono} style={{ marginBottom: 24, padding: '14px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--adm-text)' }}>
          {encendido ? (estado?.local ? 'El correo está en modo prueba' : 'El correo está encendido') : estado?.configurado ? 'Configurado, pero apagado' : 'Sin servidor de correo'}
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

        {/* Solo los fallos que nadie ha vuelto a mandar: uno ya resuelto en rojo
            hacía creer que alguien seguía sin su correo. */}
        {estado?.ultimoFallo ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--adm-border)', fontSize: 12.5, color: 'var(--adm-bad)', display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {pendientes === 1 ? '1 correo falló y no se ha vuelto a mandar' : `${pendientes} correos fallaron y no se han vuelto a mandar`}.
              El último ({fecha(estado.ultimoFallo.created_at)}): {estado.ultimoFallo.to_email} — {estado.ultimoFallo.detail}
            </span>
            <Btn size="sm" onClick={() => setVerId(estado.ultimoFallo!.id)}>Abrir</Btn>
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
        Solo papeles (2026-10-26): ya no se pide confirmar equipos cada 14 dias.
      */}
      <Panel
        title="Recordar a los aliados"
        icon="ph-bell-simple"
        desc="Un correo por aliado con los papeles que le faltan o están por vencer, con su enlace para subirlos en un clic. A nadie se le escribe dos veces en la misma semana."
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

      </>
      ) : null}

      {/* Registro */}
      <section className="adm-section">
        <SectionHead title="Registro" />
        <Toolbar end={`${filtrado.length} de ${lista.total}`}>
          <Segmented
            ariaLabel="Filtrar por estado"
            value={filtro ?? 'todos'}
            onChange={filtrar}
            items={[
              { key: 'todos', label: 'Todos', count: total },
              ...Object.entries(conteo).map(([k, n]) => {
                const e = estadoDe(k);
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
              title={cargando ? 'Cargando…' : !filtro ? 'Todavía no se ha mandado ningún correo' : 'Sin resultados con ese filtro'}
              sub={!filtro && !cargando ? 'Aparecerán aquí en cuanto se responda una cotización o avance un servicio.' : undefined}
            />
          ) : null}

          {filtrado.map((r) => {
            const e = estadoDe(r.state);
            return (
              <div
                key={r.id}
                className="adm-trow"
                role="button"
                tabIndex={0}
                aria-label={`Abrir el correo ${r.subject}`}
                onClick={() => setVerId(r.id)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setVerId(r.id); } }}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 12, alignItems: 'start', cursor: 'pointer' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--adm-text)' }}>{r.subject}</div>
                  <div className="adm-cell-sub">
                    {TIPO[r.kind] ?? r.kind} · {r.toName ? `${r.toName} · ` : ''}{r.to}
                  </div>
                  {/* El detalle sólo aparece cuando dice algo: en un "enviado" es
                      null y una fila vacía no informa. */}
                  {r.detail ? (
                    <div style={{ fontSize: 12.5, color: r.state === 'fallido' && !r.resuelto ? 'var(--adm-bad)' : 'var(--adm-faint)', marginTop: 4, lineHeight: 1.5 }}>
                      {r.detail}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {/* Un fallo que después salió ya no es pendiente: se dice, y deja de ser rojo. */}
                  {r.resuelto ? (
                    <StatusText tone="ok" title="Falló, pero después se volvió a mandar y salió">Falló · ya salió</StatusText>
                  ) : (
                    <StatusText tone={e.tone} title={e.nota}>{e.texto}</StatusText>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--adm-faint)', marginTop: 3 }}>{fecha(r.createdAt)}</div>
                </div>
                <i className="ph ph-caret-right" aria-hidden style={{ color: 'var(--adm-faint)', fontSize: 15, alignSelf: 'center' }} />
              </div>
            );
          })}
        </Panel>

        {lista.page < lista.pages ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <Btn onClick={() => void pedir(filtro, lista.page + 1)} disabled={cargando}>
              {cargando ? 'Cargando…' : `Ver ${Math.min(40, lista.total - filtrado.length)} más`}
            </Btn>
          </div>
        ) : null}
      </section>

      {verId !== null ? (
        <CorreoDetalle
          id={verId}
          onCerrar={() => {
            setVerId(null);
            // Abierto desde la campana (?ver=): se limpia para que al refrescar no se vuelva a abrir solo.
            if (abrir !== null) router.replace('/correo', { scroll: false });
          }}
          onReenviado={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
