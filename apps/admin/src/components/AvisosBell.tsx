'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { D } from './design-tokens';

/**
 * CAMPANA DEL PANEL (2026-09-25).
 *
 * "¿Cómo puedo saber dentro del sistema que ya me cotizaron? Pon
 * notificaciones en tiempo real."
 *
 * Pregunta a la API cada pocos segundos por avisos NUEVOS (`?despues=<id>`;
 * sin novedades la respuesta es mínima). Se eligió consulta periódica y no
 * una conexión abierta (SSE/websocket) porque el hosting de cPanel limita los
 * procesos e hilos, y un proxy de Passenger no garantiza mantener conexiones
 * largas. En la práctica: el aviso llega en segundos.
 *
 * Al llegar uno: suena, se ve un letrero abajo a la derecha, el título de la
 * pestaña dice cuántos hay y, si el administrador lo permitió, sale el aviso
 * del escritorio aunque esté en otra pestaña. Además los contadores del menú
 * se refrescan (evento `adm:avisos`).
 */

interface Aviso {
  id: number;
  modulo: string;
  evento: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string | null;
}

const VISIBLE_MS = 8_000;
const OCULTA_MS = 20_000;

const ICONO: Record<string, string> = {
  solicitud: 'ph-clipboard-text',
  respuesta_aliado: 'ph-handshake',
  oferta_aliado: 'ph-package',
  mensaje: 'ph-envelope-simple',
  cotizacion: 'ph-file-text',
};

function hace(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

/** Dos tonos cortos con Web Audio: sin archivo que descargar. */
function sonar() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.15);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch { /* sin audio: el letrero basta */ }
}

export function AvisosBell() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [unread, setUnread] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [letrero, setLetrero] = useState<Aviso | null>(null);
  const [permiso, setPermiso] = useState<NotificationPermission | 'nada'>('nada');
  const ultimo = useRef(0);
  const cargado = useRef(false);
  const caja = useRef<HTMLDivElement>(null);

  const consultar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/avisos${cargado.current ? `?despues=${ultimo.current}` : ''}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { items: Aviso[]; unread: number; ultimo: number };
      setUnread(d.unread);
      if (!cargado.current) {
        cargado.current = true;
        setAvisos(d.items);
        ultimo.current = d.ultimo;
        return;
      }
      if (d.items.length === 0) return;
      ultimo.current = Math.max(ultimo.current, d.ultimo);
      setAvisos((prev) => [...d.items, ...prev.filter((p) => !d.items.some((n) => n.id === p.id))].slice(0, 30));
      const nuevo = d.items[0];
      sonar();
      setLetrero(nuevo);
      window.dispatchEvent(new Event('adm:avisos'));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const n = new Notification(nuevo.title, { body: nuevo.body ?? undefined, tag: `aviso-${nuevo.id}`, icon: '/favicon.ico' });
        n.onclick = () => { window.focus(); if (nuevo.link) router.push(nuevo.link); n.close(); };
      }
    } catch { /* sin red: se reintenta en la siguiente vuelta */ }
  }, [router]);

  // Vuelta periódica: más seguido con la pestaña a la vista.
  useEffect(() => {
    void consultar();
    let t: ReturnType<typeof setTimeout>;
    const vuelta = () => {
      t = setTimeout(async () => { await consultar(); vuelta(); }, document.visibilityState === 'visible' ? VISIBLE_MS : OCULTA_MS);
    };
    vuelta();
    const alVolver = () => { if (document.visibilityState === 'visible') void consultar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [consultar]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermiso(Notification.permission);
  }, []);

  // El título de la pestaña cuenta lo pendiente: se ve aunque esté en otra.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread, avisos]);

  useEffect(() => {
    if (!letrero) return;
    const t = setTimeout(() => setLetrero(null), 7000);
    return () => clearTimeout(t);
  }, [letrero]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  async function marcar(id?: number) {
    const r = await fetch('/api/admin/avisos/leido', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : {}),
    });
    if (r.ok) setUnread(((await r.json()) as { unread: number }).unread);
    setAvisos((prev) => prev.map((a) => (!id || a.id === id ? { ...a, isRead: true } : a)));
  }

  function ir(a: Aviso) {
    if (!a.isRead) void marcar(a.id);
    setAbierto(false);
    setLetrero(null);
    if (a.link) router.push(a.link);
  }

  async function activarEscritorio() {
    if (typeof Notification === 'undefined') return;
    setPermiso(await Notification.requestPermission());
  }

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button"
        className="adm-iconbtn"
        onClick={() => setAbierto((v) => !v)}
        aria-label={unread > 0 ? `Avisos: ${unread} sin leer` : 'Avisos'}
        title="Avisos"
      >
        <i className={`ph ${unread > 0 ? 'ph-bell-ringing' : 'ph-bell'}`} aria-hidden />
        {unread > 0 ? (
          <span
            style={{
              position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999,
              background: D.bad, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center',
              border: '2px solid #0b0b0d',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-label="Avisos"
          style={{
            position: 'absolute', right: 0, top: 48, width: 'min(400px, calc(100vw - 32px))', maxHeight: '70vh',
            display: 'flex', flexDirection: 'column', background: D.card, border: `1px solid ${D.cardBorder}`,
            borderRadius: 14, boxShadow: '0 30px 70px -20px rgba(0,0,0,.85)', zIndex: 900, overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${D.cardBorder}` }}>
            <strong style={{ fontSize: 15, color: D.text }}>Avisos</strong>
            {unread > 0 ? (
              <button type="button" onClick={() => void marcar()} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Marcar todo como leído
              </button>
            ) : null}
          </div>

          {permiso === 'default' ? (
            <button
              type="button"
              onClick={() => void activarEscritorio()}
              style={{ margin: '10px 12px 0', padding: '9px 12px', borderRadius: 10, border: `1px dashed ${D.cardBorder}`, background: D.accentSoft, color: D.text, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <i className="ph ph-desktop" aria-hidden /> Activar avisos del escritorio: te llegan aunque estés en otra pestaña.
            </button>
          ) : null}

          <div style={{ overflowY: 'auto', padding: 6 }}>
            {avisos.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: D.muted, fontSize: 13.5 }}>
                Sin avisos todavía. Aquí aparecen las solicitudes nuevas, las respuestas de los aliados y los mensajes.
              </div>
            ) : (
              avisos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => ir(a)}
                  style={{
                    width: '100%', display: 'flex', gap: 11, alignItems: 'flex-start', textAlign: 'left', padding: '10px 10px',
                    borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: a.isRead ? 'transparent' : D.accentSoft,
                  }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', color: a.isRead ? D.muted : D.accent }}>
                    <i className={`ph ${ICONO[a.evento] ?? 'ph-bell'}`} aria-hidden style={{ fontSize: 17 }} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: a.isRead ? 500 : 700, color: D.text, lineHeight: 1.35 }}>{a.title}</span>
                    {a.body ? <span style={{ display: 'block', fontSize: 12.5, color: '#a1a1aa', marginTop: 2, lineHeight: 1.4 }}>{a.body}</span> : null}
                    <span style={{ display: 'block', fontSize: 11.5, color: D.muted, marginTop: 4 }}>{hace(a.createdAt)}</span>
                  </span>
                  {!a.isRead ? <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: D.accent, marginTop: 6, flexShrink: 0 }} /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Letrero: el aviso nuevo se ve aunque la campana esté cerrada. Va en un portal al <body>: el topbar usa backdrop-filter, que atrapa position:fixed y lo pegaba arriba. */}
      {letrero && typeof document !== 'undefined' ? createPortal(
        <button
          type="button"
          onClick={() => ir(letrero)}
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 1100, width: 'min(380px, calc(100vw - 40px))',
            display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '14px 16px', borderRadius: 14,
            background: D.card, border: '1px solid var(--color-primary)', boxShadow: '0 30px 70px -20px rgba(0,0,0,.9)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: D.accentSoft, color: D.accent }}>
            <i className={`ph ${ICONO[letrero.evento] ?? 'ph-bell'}`} aria-hidden style={{ fontSize: 19 }} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: D.accent, textTransform: 'uppercase', letterSpacing: '.06em' }}>Nuevo aviso</span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: D.text, marginTop: 2 }}>{letrero.title}</span>
            {letrero.body ? <span style={{ display: 'block', fontSize: 12.5, color: '#a1a1aa', marginTop: 2 }}>{letrero.body}</span> : null}
          </span>
        </button>
      , document.body) : null}
    </div>
  );
}
