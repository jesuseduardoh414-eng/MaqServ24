import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { MessagesSearch } from './MessagesSearch';
import { ContactTools, MessageState } from './MessageActions';

interface MsgRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  need: string | null;
  message: string;
  state: string;
  handledBy: string | null;
  handledAt: string | null;
  crmPushed: boolean;
  createdAt: string;
  /** Si ya está registrado en el sitio, su id de cliente. */
  customerId: number | null;
}

interface MsgResponse {
  items: MsgRow[];
  total: number;
  page: number;
  pages: number;
  counts: { nuevos: number; atendidos: number; archivados: number; sinSubir: number };
  perfexEnabled: boolean;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const statCard: React.CSSProperties = { minWidth: 132, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };

const FILTROS = [
  { key: '', label: 'Todos' },
  { key: 'nuevo', label: 'Sin atender' },
  { key: 'atendido', label: 'Atendidos' },
  { key: 'archivado', label: 'Archivados' },
] as const;

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/**
 * Clientes → Mensajes: la bandeja del formulario de /contacto.
 *
 * Antes de esta pantalla, esos mensajes no se guardaban en ningún lado: se
 * intentaban empujar a Perfex y, sin credenciales, se perdían. La lista arranca
 * por los que nadie ha contestado, que es la única pregunta que importa aquí.
 */
export default async function AdminMessages({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; estado?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;
  const q = sp.q ?? '';
  const estado = sp.estado ?? '';

  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (q) qs.set('search', q);
  if (estado) qs.set('state', estado);
  const data = await adminFetch<MsgResponse>(`/admin/contact-messages?${qs.toString()}`);

  const items = data?.items ?? [];
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;
  const c = data?.counts ?? { nuevos: 0, atendidos: 0, archivados: 0, sinSubir: 0 };

  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, estado, page: String(page), ...patch })) {
      if (v && v !== '1') n.set(k, v);
    }
    const s = n.toString();
    return s ? `/mensajes?${s}` : '/mensajes';
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .msg-card:hover{ border-color: rgba(255,255,255,0.13); }
          .msg-pg:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }
          .msg-link:hover{ color:var(--color-primary); text-decoration: underline; }
          .msg-tab:hover{ color:#EDEDEC; }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Clientes</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Mensajes</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Mensajes de contacto</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F', maxWidth: '72ch' }}>
              Lo que la gente escribe desde la página de Contacto del sitio. Contesta por correo o teléfono y marca el mensaje como atendido para que nadie lo conteste dos veces.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.nuevos > 0 ? D.amber : '#3A3A3F', boxShadow: c.nuevos > 0 ? `0 0 10px ${D.amber}b3` : 'none' }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Sin atender</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: c.nuevos > 0 ? D.amber : '#5C5C61', fontFamily: MONO }}>{c.nuevos}</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Atendidos</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: GREEN, fontFamily: MONO }}>{c.atendidos}</div>
            </div>
          </div>
        </div>

        {/* Los mensajes ya NO se pierden aunque el CRM esté apagado: se guardan
            aquí. El aviso dice justo eso, para que nadie crea que hay que
            configurar Perfex antes de poder contestar. */}
        {data && !data.perfexEnabled ? (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 11, background: `color-mix(in srgb, ${D.amber} 7%, ${D.card})`, border: `1px solid color-mix(in srgb, ${D.amber} 30%, transparent)`, borderRadius: 12, padding: '13px 17px' }}>
            <i className="ph ph-warning" style={{ color: D.amber, fontSize: 16, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#D4D4D8', lineHeight: 1.55 }}>
              <strong style={{ color: '#FBFBFA' }}>Perfex CRM no está conectado.</strong> Los mensajes se guardan aquí y no se pierde ninguno,
              pero no están subiendo al CRM. Para conectarlo hay que configurar <span style={{ fontFamily: MONO, fontSize: 12 }}>PERFEX_URL</span> y{' '}
              <span style={{ fontFamily: MONO, fontSize: 12 }}>PERFEX_TOKEN</span> en la API; después podrás subir de golpe los que quedaron pendientes.
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <MessagesSearch initial={q} />
          <ContactTools perfexEnabled={data?.perfexEnabled ?? false} pendientes={c.sinSubir} />
        </div>

        {/* Filtros por estado */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map((f) => {
            const activo = estado === f.key;
            const n = f.key === 'nuevo' ? c.nuevos : f.key === 'atendido' ? c.atendidos : f.key === 'archivado' ? c.archivados : null;
            return (
              <Link
                key={f.key || 'todos'}
                href={link({ estado: f.key || undefined, page: undefined })}
                className="msg-tab"
                style={{
                  fontSize: 13, fontWeight: 700, textDecoration: 'none', borderRadius: 9, padding: '7px 14px',
                  color: activo ? '#0B0B0D' : '#8A8A8F',
                  background: activo ? D.amber : 'transparent',
                  border: `1px solid ${activo ? 'transparent' : D.inputBorder}`,
                }}
              >
                {f.label}{n !== null ? ` (${n})` : ''}
              </Link>
            );
          })}
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          {items.map((m) => (
            <article
              key={m.id}
              className="msg-card"
              style={{
                background: '#0F0F11',
                border: `1px solid ${m.state === 'nuevo' ? 'rgba(255,193,7,0.28)' : D.inputBorder}`,
                borderRadius: 14,
                padding: '16px 20px',
                transition: 'border-color .2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#FBFBFA' }}>{m.name}</span>
                    {m.state === 'nuevo' ? (
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', color: '#0B0B0D', background: D.amber, borderRadius: 5, padding: '2px 7px' }}>SIN ATENDER</span>
                    ) : null}
                    {m.state === 'archivado' ? (
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, borderRadius: 5, padding: '2px 7px' }}>ARCHIVADO</span>
                    ) : null}
                    {m.need ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#B4B4B9', border: `1px solid ${D.inputBorder}`, borderRadius: 5, padding: '2px 8px' }}>{m.need}</span>
                    ) : null}
                    {/* Sin subir al CRM: se dice, no se esconde. */}
                    {!m.crmPushed && data?.perfexEnabled ? (
                      <span title="Todavía no se subió al CRM" style={{ fontSize: 10.5, fontWeight: 700, color: D.amber }}>sin subir al CRM</span>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12.5 }}>
                    <a href={`mailto:${m.email}`} className="msg-link" style={{ color: '#B4B4B9', textDecoration: 'none' }}>{m.email}</a>
                    {m.phone ? (
                      <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="msg-link" style={{ color: '#B4B4B9', textDecoration: 'none' }}>{m.phone}</a>
                    ) : null}
                    {m.company ? <span style={{ color: '#7A7A7F' }}>{m.company}</span> : null}
                    {m.customerId ? (
                      <Link href={`/usuarios/${m.customerId}`} className="msg-link" style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textDecoration: 'none' }}>
                        YA ES CLIENTE →
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div style={{ fontFamily: MONO, fontSize: 11, color: '#5C5C61', whiteSpace: 'nowrap' }}>{fecha(m.createdAt)}</div>
              </div>

              <p style={{ margin: '13px 0 0', fontSize: 13.5, lineHeight: 1.62, color: '#D4D4D8', whiteSpace: 'pre-wrap' }}>{m.message}</p>

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11.5, color: '#5C5C61' }}>
                  {m.handledBy && m.handledAt ? `Atendido por ${m.handledBy} · ${fecha(m.handledAt)}` : ''}
                </div>
                <MessageState id={m.id} state={m.state} name={m.name} />
              </div>
            </article>
          ))}

          {items.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center', background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16 }}>
              <i className="ph ph-chat-centered-text" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>
                {q || estado ? 'Sin resultados' : 'Aún no hay mensajes'}
              </div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5, maxWidth: 460, marginInline: 'auto', lineHeight: 1.5 }}>
                {q || estado
                  ? 'Prueba con otro término o quita el filtro.'
                  : 'Aparecen cuando alguien escribe desde la página de Contacto del sitio.'}
              </div>
            </div>
          ) : null}
        </div>

        {pages > 1 ? (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 20px', background: '#131315', border: `1px solid ${D.inputBorder}`, borderRadius: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
              <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{data?.total ?? 0}</span> mensaje(s){q ? ` para “${q}”` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={link({ page: String(Math.max(1, page - 1)) })} className="msg-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page <= 1 ? 0.4 : 1, pointerEvents: page <= 1 ? 'none' : 'auto' }}>‹</Link>
              <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {page} / {pages}</span>
              <Link href={link({ page: String(Math.min(pages, page + 1)) })} className="msg-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page >= pages ? 0.4 : 1, pointerEvents: page >= pages ? 'none' : 'auto' }}>›</Link>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
