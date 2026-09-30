'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string | null;
}

/** Icono del sitio por tipo de aviso (antes eran emojis, que cada sistema pinta distinto). */
const ICON: Record<string, IconName> = {
  quote_answered: 'article',
  service_status: 'truck',
  order_status: 'box',
  payment_confirmed: 'check',
  question_answered: 'chat',
  withdraw: 'diamond',
};

/** "hace 5 min" — se calcula en el cliente, pero el componente solo monta ahí. */
function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ayer';
  if (d < 30) return `hace ${d} días`;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

const esHoy = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/**
 * Campana de avisos del cliente. Consulta `/notifications` (solo los del usuario
 * de la sesión: la API filtra por el JWT) y se refresca sola cada 30 s.
 */
export function NotificationsBell({ userId }: { userId: number }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/proxy/notifications');
      if (!r.ok) return;
      const d = (await r.json()) as { items: Notification[]; unread: number };
      setItems(Array.isArray(d.items) ? d.items : []);
      setUnread(d.unread ?? 0);
    } catch {
      /* la campana no debe romper el header */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Se refresca sola: cada 30 s mientras la pestaña esté visible, y al volver a
  // ella. (Antes era Supabase Realtime; sin él, sondear es suficiente para una
  // campana de avisos: un aviso que llega medio minuto tarde sigue siendo un aviso.)
  useEffect(() => {
    const cadaTanto = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    const alVolver = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.clearInterval(cadaTanto); document.removeEventListener('visibilitychange', alVolver); };
  }, [userId, load]);

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, load]);

  async function markAll() {
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch('/api/proxy/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    } catch { load(); }
  }

  async function openOne(n: Notification) {
    setOpen(false);
    if (n.isRead) return;
    setUnread((u) => Math.max(0, u - 1));
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await fetch('/api/proxy/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) });
    } catch { /* se corrige en la próxima carga */ }
  }

  const visibles = soloSinLeer ? items.filter((n) => !n.isRead) : items;
  const grupos = [
    { titulo: 'Hoy', items: visibles.filter((n) => esHoy(n.createdAt)) },
    { titulo: 'Antes', items: visibles.filter((n) => !esHoy(n.createdAt)) },
  ].filter((g) => g.items.length > 0);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{CSS}</style>
      <button
        type="button"
        className="hdr-icon nb-btn"
        onClick={() => setOpen((v) => !v)}
        title="Notificaciones"
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? <span className="nb-count">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="nb-panel" role="dialog" aria-label="Notificaciones">
          <div className="nb-head">
            <div className="nb-head-t">
              <span>Notificaciones</span>
              {unread > 0 ? <span className="nb-pill">{unread} sin leer</span> : null}
            </div>
            {unread > 0 ? <button type="button" className="nb-link" onClick={markAll}>Marcar todo como leído</button> : null}
          </div>

          {items.length > 0 ? (
            <div className="nb-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={!soloSinLeer} onClick={() => setSoloSinLeer(false)}>Todas</button>
              <button type="button" role="tab" aria-selected={soloSinLeer} onClick={() => setSoloSinLeer(true)}>Sin leer</button>
            </div>
          ) : null}

          <div className="nb-body">
            {visibles.length === 0 ? (
              <div className="nb-empty">
                <span className="nb-empty-ico" aria-hidden><Icon name={soloSinLeer ? 'check' : 'bell'} size={20} /></span>
                <p className="nb-empty-t">{soloSinLeer ? 'Estás al día' : 'Sin novedades por ahora'}</p>
                <p className="nb-empty-d">
                  {soloSinLeer
                    ? 'Ya leíste todos tus avisos.'
                    : 'Te avisamos aquí cuando recibamos tu solicitud, se asigne el equipo, salga a tu obra o cambie tu pedido.'}
                </p>
              </div>
            ) : (
              grupos.map((g) => (
                <div key={g.titulo}>
                  <p className="nb-grp">{g.titulo}</p>
                  {g.items.map((n) => {
                    const inner = (
                      <>
                        <span className="nb-ico" aria-hidden><Icon name={ICON[n.type] ?? 'bell'} size={16} /></span>
                        <span className="nb-txt">
                          <span className="nb-t">{n.title}</span>
                          {n.body ? <span className="nb-d">{n.body}</span> : null}
                          <span className="nb-time">{timeAgo(n.createdAt)}</span>
                        </span>
                        {!n.isRead ? <span className="nb-dot" aria-label="Sin leer" /> : null}
                      </>
                    );
                    return n.link ? (
                      <Link key={n.id} href={n.link} onClick={() => openOne(n)} className="nb-item" data-unread={!n.isRead}>{inner}</Link>
                    ) : (
                      <button key={n.id} type="button" onClick={() => openOne(n)} className="nb-item" data-unread={!n.isRead}>{inner}</button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <Link href="/cuenta/cotizaciones" className="nb-foot" onClick={() => setOpen(false)}>
            Ver mis cotizaciones y servicios <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const CSS = `
.nb-btn{ position:relative; width:38px; height:38px; border-radius:50%; border:none; background:transparent; color:var(--color-text-muted); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
.nb-count{ position:absolute; top:3px; right:2px; min-width:16px; height:16px; padding:0 4px; background:var(--color-primary); color:var(--color-primary-fg); border-radius:999px; border:1.5px solid var(--color-surface); font-size:9.5px; font-weight:800; display:grid; place-items:center; font-variant-numeric:tabular-nums; }
.nb-panel{ position:absolute; top:48px; right:-8px; width:380px; max-width:calc(100vw - 24px); background:var(--color-surface); color:var(--color-text); border:1px solid var(--color-border); border-radius:14px; box-shadow:0 28px 64px -24px rgba(0,0,0,.65); z-index:60; overflow:hidden; font-family:var(--font-sans); animation:nb-in .16s ease; }
@keyframes nb-in{ from{ opacity:0; transform:translateY(-4px) } to{ opacity:1; transform:none } }
.nb-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px 10px; }
.nb-head-t{ display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; }
.nb-pill{ font-size:11.5px; font-weight:600; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 13%, transparent); border-radius:6px; padding:2px 7px; }
.nb-link{ border:none; background:none; padding:0; font:inherit; font-size:12.5px; font-weight:600; color:var(--color-primary); cursor:pointer; }
.nb-link:hover{ text-decoration:underline; }
.nb-tabs{ display:flex; gap:4px; padding:0 12px 10px; border-bottom:1px solid var(--color-border); }
.nb-tabs button{ font:inherit; font-size:12.5px; font-weight:600; color:var(--color-text-muted); background:none; border:1px solid transparent; border-radius:999px; padding:4px 11px; cursor:pointer; }
.nb-tabs button[aria-selected="true"]{ color:var(--color-text); border-color:var(--color-border); background:var(--color-bg); }
.nb-body{ max-height:min(420px, 60vh); overflow-y:auto; padding:4px 6px 6px; }
.nb-grp{ margin:0; padding:10px 10px 4px; font-size:11.5px; font-weight:600; color:var(--color-text-muted); }
.nb-item{ display:flex; gap:12px; align-items:flex-start; width:100%; text-align:left; padding:10px; border:none; border-radius:10px; background:transparent; color:inherit; font:inherit; text-decoration:none; cursor:pointer; transition:background .15s ease; }
.nb-item:hover{ background:color-mix(in srgb, var(--color-text) 5%, transparent); }
.nb-item:focus-visible{ outline:2px solid var(--color-primary); outline-offset:-2px; }
.nb-ico{ width:34px; height:34px; flex-shrink:0; border-radius:9px; display:grid; place-items:center; background:var(--color-bg); border:1px solid var(--color-border); color:var(--color-text-muted); }
.nb-item[data-unread="true"] .nb-ico{ color:var(--color-primary); border-color:color-mix(in srgb, var(--color-primary) 40%, var(--color-border)); }
.nb-txt{ flex:1; min-width:0; display:grid; gap:2px; }
.nb-t{ font-size:13.5px; font-weight:500; line-height:1.4; color:var(--color-text-muted); }
.nb-item[data-unread="true"] .nb-t{ font-weight:600; color:var(--color-text); }
.nb-d{ font-size:12.5px; line-height:1.45; color:var(--color-text-muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.nb-time{ font-size:11.5px; color:var(--color-text-muted); margin-top:2px; }
.nb-dot{ width:8px; height:8px; border-radius:50%; background:var(--color-primary); flex-shrink:0; margin-top:6px; }
.nb-empty{ padding:32px 24px 34px; display:grid; justify-items:center; text-align:center; gap:4px; }
.nb-empty-ico{ width:44px; height:44px; border-radius:12px; display:grid; place-items:center; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 10%, transparent); border:1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); margin-bottom:8px; }
.nb-empty-t{ margin:0; font-size:14.5px; font-weight:600; }
.nb-empty-d{ margin:0; font-size:12.5px; line-height:1.5; color:var(--color-text-muted); max-width:30ch; }
.nb-foot{ display:flex; align-items:center; justify-content:center; gap:6px; padding:12px; border-top:1px solid var(--color-border); font-size:13px; font-weight:600; color:var(--color-primary); text-decoration:none; }
.nb-foot:hover{ background:color-mix(in srgb, var(--color-primary) 6%, transparent); }
`;
