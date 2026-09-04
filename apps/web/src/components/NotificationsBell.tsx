'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchRealtimeToken, supabaseBrowser } from '@/lib/supabase-browser';

const MONO = 'var(--font-sans)';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string | null;
}

const ICON: Record<string, string> = {
  quote_answered: '📄',
  service_status: '🚜',
  order_status: '📦',
  payment_confirmed: '💳',
  question_answered: '💬',
  withdraw: '💰',
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

/**
 * Campana de avisos del cliente. Se actualiza EN VIVO por Supabase Realtime:
 * la tabla `notifications` ya tenía RLS por usuario (`notif_own_select`) y está
 * en la publicación, así que solo llegan los INSERT del dueño.
 */
export function NotificationsBell({ userId }: { userId: number }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
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

  // Suscripción en vivo a los avisos propios.
  useEffect(() => {
    let active = true;
    const sb = supabaseBrowser();
    let channel: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      const token = await fetchRealtimeToken();
      if (!token || !active) return;
      sb.realtime.setAuth(token);
      channel = sb
        .channel(`notif-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          () => { if (active) load(); },
        )
        .subscribe();
    })();
    return () => { active = false; if (channel) sb.removeChannel(channel); };
  }, [userId, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

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

  const iconBtn: React.CSSProperties = {
    position: 'relative', width: 38, height: 38, borderRadius: '50%',
    border: 'none', background: 'transparent', color: 'var(--color-text-muted)',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="hdr-icon"
        style={iconBtn}
        onClick={() => setOpen((v) => !v)}
        title="Notificaciones"
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span style={{ position: 'absolute', top: 3, right: 2, minWidth: 16, height: 16, padding: '0 4px', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', borderRadius: 999, border: '1.5px solid var(--color-surface)', fontSize: 9.5, fontWeight: 800, display: 'grid', placeItems: 'center', fontFamily: MONO }}>
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 340, maxWidth: 'calc(100vw - 32px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, boxShadow: '0 20px 50px -18px rgba(0,0,0,0.35)', zIndex: 60, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--color-text-muted)' }}>NOTIFICACIONES</span>
            {unread > 0 ? (
              <button type="button" onClick={markAll} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                Marcar todas como leídas
              </button>
            ) : null}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '34px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.5 }}>🔔</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sin novedades</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  Aquí te avisamos cuando respondamos tus cotizaciones o cambie tu pedido.
                </div>
              </div>
            ) : (
              items.map((n) => {
                const inner = (
                  <>
                    <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }} aria-hidden>{ICON[n.type] ?? '🔔'}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: 'var(--color-text)', lineHeight: 1.4 }}>{n.title}</span>
                      {n.body ? (
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.45 }}>{n.body}</span>
                      ) : null}
                      <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, color: 'var(--color-text-muted)', marginTop: 5 }}>{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead ? <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} /> : null}
                  </>
                );
                const style: React.CSSProperties = {
                  display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                  padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
                  background: n.isRead ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                  textDecoration: 'none', color: 'inherit', border: 'none', borderLeft: 'none', cursor: 'pointer', fontFamily: 'inherit',
                };
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => openOne(n)} style={style}>{inner}</Link>
                ) : (
                  <button key={n.id} type="button" onClick={() => openOne(n)} style={style}>{inner}</button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
