'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { D } from './design-tokens';
import { usePonerAlDia } from './usePonerAlDia';

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
 *
 * La misma respuesta trae `cambio`, la hora del último guardado en todo el
 * sistema (2026-10-26, API common/cambios.ts). Si avanzó —un cobro, un pago,
 * algo que guardó otra persona o el cliente— la pantalla abierta se pone al
 * día aunque no haya aviso, y se lanza `adm:cambios` para lo que se carga
 * desde el navegador (contadores del menú, ficha de cotización).
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

// 10 s con la pestaña a la vista (eran 5; rendimiento, 2026-10-29): cada pestaña
// abierta del panel preguntaba 12 veces por minuto al mismo servidor.
const VISIBLE_MS = 10_000;
const OCULTA_MS = 20_000;

const ICONO: Record<string, string> = {
  solicitud: 'ph-clipboard-text',
  respuesta_aliado: 'ph-handshake',
  oferta_aliado: 'ph-package',
  mensaje: 'ph-envelope-simple',
  cotizacion: 'ph-file-text',
  registro_proveedor: 'ph-user-plus',
  correo_fallido: 'ph-warning-circle',
  resena: 'ph-star',
  pregunta: 'ph-question',
  choque_reserva: 'ph-calendar-x',
  mantenimiento: 'ph-wrench',
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
  const cambio = useRef<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const ponerAlDia = usePonerAlDia();

  const consultar = useCallback(async () => {
    try {
      /*
       * Se decide ANTES de pedir si esta vuelta es la carga inicial o una de
       * "lo nuevo" (2026-10-08). Antes se leía `cargado` al llegar la
       * respuesta: con dos consultas al montar (StrictMode, o volver a la
       * pestaña mientras carga) la segunda llegaba con `cargado` ya en true,
       * tomaba la lista completa por nueva y el letrero repetía el último aviso
       * en cada pantalla que se abría.
       */
      const despues = cargado.current ? ultimo.current : null;
      const r = await fetch(`/api/admin/avisos${despues !== null ? `?despues=${despues}` : ''}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { items: Aviso[]; unread: number; ultimo: number; cambio?: number };
      setUnread(d.unread);
      // Solo cuenta si AVANZÓ respecto a lo ya visto en esta pestaña (la primera vuelta solo lo anota).
      const visto = cambio.current;
      const huboCambio = typeof d.cambio === 'number' && visto !== null && d.cambio > visto;
      if (typeof d.cambio === 'number') cambio.current = Math.max(visto ?? 0, d.cambio);
      const alDia = () => {
        window.dispatchEvent(new Event('adm:cambios'));
        ponerAlDia();
      };
      if (despues === null) {
        if (!cargado.current) setAvisos(d.items);
        cargado.current = true;
        ultimo.current = Math.max(ultimo.current, d.ultimo);
        if (huboCambio) alDia();
        return;
      }
      // Solo lo que de verdad es posterior a lo ya visto en esta pestaña.
      const nuevos = d.items.filter((n) => n.id > ultimo.current);
      if (nuevos.length === 0) {
        if (huboCambio) alDia();
        return;
      }
      ultimo.current = Math.max(ultimo.current, d.ultimo);
      setAvisos((prev) => [...nuevos, ...prev.filter((p) => !nuevos.some((n) => n.id === p.id))].slice(0, 30));
      const nuevo = nuevos[0];
      sonar();
      setLetrero(nuevo);
      window.dispatchEvent(new Event('adm:avisos'));
      /*
       * La pantalla abierta se pone al día sola (2026-10-26): "el cliente ya
       * aceptó, pero no cambia hasta que recargue". `refresh` vuelve a pedir
       * los datos del servidor sin perder el filtro, la búsqueda ni el detalle
       * abierto; lo que se está escribiendo queda igual (y si se está
       * escribiendo, espera a que se salga del campo: usePonerAlDia).
       */
      ponerAlDia();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const n = new Notification(nuevo.title, { body: nuevo.body ?? undefined, tag: `aviso-${nuevo.id}`, icon: '/favicon.ico' });
        n.onclick = () => { window.focus(); if (nuevo.link) router.push(nuevo.link); n.close(); };
      }
    } catch { /* sin red: se reintenta en la siguiente vuelta */ }
  }, [router, ponerAlDia]);

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

  // Mi cuenta (2026-10-28) enseña el mismo conteo en su menú y abre esta campana desde ahí.
  useEffect(() => {
    const avisar = () => window.dispatchEvent(new CustomEvent('adm:avisos-estado', { detail: { unread } }));
    const abrir = () => setAbierto(true);
    avisar();
    window.addEventListener('adm:avisos-pedir', avisar);
    window.addEventListener('adm:avisos-abrir', abrir);
    return () => { window.removeEventListener('adm:avisos-pedir', avisar); window.removeEventListener('adm:avisos-abrir', abrir); };
  }, [unread]);

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
              border: '2px solid var(--adm-page)',
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
            display: 'flex', flexDirection: 'column', background: 'var(--adm-card)', border: '1px solid var(--adm-border-strong)',
            borderRadius: 12, boxShadow: '0 24px 60px -20px var(--adm-sombra)', zIndex: 900, overflow: 'hidden',
          }}
        >
          {/* Estilo del kit (2026-10-08): filas con línea fina, sin bloques de color; lo no leído lo marca el punto. */}
          <style>{`
            .av-item { transition: background .12s ease; }
            .av-item:hover { background: rgba(var(--adm-ink),0.03) !important; }
            .av-item:last-child { border-bottom: 0 !important; }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 50, padding: '10px 16px', borderBottom: '1px solid var(--adm-border)' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--adm-text)' }}>
              Avisos
              {unread > 0 ? <span className="adm-num" style={{ marginLeft: 7, fontSize: 13, fontWeight: 500, color: 'var(--adm-faint)' }}>{unread}</span> : null}
            </span>
            {unread > 0 ? (
              <button type="button" className="adm-panel-link" onClick={() => void marcar()}>
                Marcar todo como leído
              </button>
            ) : null}
          </div>

          {permiso === 'default' ? (
            <button
              type="button"
              onClick={() => void activarEscritorio()}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, margin: '12px 12px 4px', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--adm-border-strong)', background: 'rgba(var(--adm-ink),0.02)', color: 'var(--adm-text-2)',
                fontSize: 12.5, lineHeight: 1.5, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <i className="ph ph-desktop" aria-hidden style={{ fontSize: 15, marginTop: 1, color: 'var(--adm-accent)' }} />
              <span>Activar avisos del escritorio: te llegan aunque estés en otra pestaña.</span>
            </button>
          ) : null}

          <div style={{ overflowY: 'auto' }}>
            {avisos.length === 0 ? (
              <div className="adm-empty" style={{ padding: '32px 20px' }}>
                <i className="ph ph-bell" aria-hidden />
                <div className="adm-empty-title">Sin avisos todavía</div>
                <div className="adm-empty-sub">Aquí aparecen las solicitudes nuevas, las respuestas de los aliados y los mensajes.</div>
              </div>
            ) : (
              avisos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="av-item"
                  onClick={() => ir(a)}
                  style={{
                    width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '12px 16px',
                    border: 'none', borderBottom: '1px solid var(--adm-border)', cursor: 'pointer', fontFamily: 'inherit',
                    background: a.isRead ? 'transparent' : 'rgba(var(--adm-ink),0.02)',
                  }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid var(--adm-border)', background: 'rgba(var(--adm-ink),0.03)', color: a.isRead ? 'var(--adm-muted)' : 'var(--adm-accent)' }}>
                    <i className={`ph ${ICONO[a.evento] ?? 'ph-bell'}`} aria-hidden style={{ fontSize: 16 }} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: a.isRead ? 500 : 600, color: a.isRead ? 'var(--adm-text-2)' : 'var(--adm-text)', lineHeight: 1.4 }}>{a.title}</span>
                    {a.body ? <span style={{ display: 'block', fontSize: 12.5, color: 'var(--adm-muted)', marginTop: 2, lineHeight: 1.45 }}>{a.body}</span> : null}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--adm-faint)', marginTop: 4 }}>{hace(a.createdAt)}</span>
                  </span>
                  {!a.isRead ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--adm-accent)', marginTop: 7, flexShrink: 0 }} /> : null}
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
            display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '14px 16px', borderRadius: 12,
            background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', boxShadow: '0 20px 50px -20px var(--adm-sombra)',
            color: 'var(--adm-text)', cursor: 'pointer', fontFamily: 'inherit', animation: 'fadeIn .2s ease',
          }}
        >
          <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--adm-accent) 14%, transparent)', color: 'var(--adm-accent)' }}>
            <i className={`ph ${ICONO[letrero.evento] ?? 'ph-bell'}`} aria-hidden style={{ fontSize: 17 }} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--adm-accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Nuevo aviso</span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--adm-text)', marginTop: 3, lineHeight: 1.4 }}>{letrero.title}</span>
            {letrero.body ? <span style={{ display: 'block', fontSize: 12.5, color: 'var(--adm-muted)', marginTop: 2, lineHeight: 1.45 }}>{letrero.body}</span> : null}
          </span>
        </button>
      , document.body) : null}
    </div>
  );
}
