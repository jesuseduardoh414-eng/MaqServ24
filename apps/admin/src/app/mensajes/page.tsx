import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Chip, EmptyState, Note, PageHeader, Panel, Segmented, Stat, Stats, StatusText, Toolbar } from '@/components/ui';
import { MessagesSearch } from './MessagesSearch';
import { CRM_ACTIVO } from '@maqserv/config';
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
  exigirModulo(admin, 'comunidad');
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

  const pager = (href: string, off: boolean, icon: string, label: string) => (
    <Link
      href={href}
      className="adm-ibtn"
      aria-label={label}
      aria-disabled={off}
      tabIndex={off ? -1 : undefined}
      style={{ opacity: off ? 0.4 : 1, pointerEvents: off ? 'none' : 'auto' }}
    >
      <i className={`ph ${icon}`} aria-hidden />
    </Link>
  );

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <PageHeader
          eyebrow={['1 · Recibir', 'Comunicaciones']}
          title="Mensajes de contacto"
          subtitle="Lo que la gente escribe desde la página de Contacto del sitio. Contesta por correo o teléfono y marca el mensaje como atendido para que nadie lo conteste dos veces."
          actions={CRM_ACTIVO ? <ContactTools perfexEnabled={data?.perfexEnabled ?? false} pendientes={c.sinSubir} /> : null}
        />

        <Stats>
          {/* La cifra misma es el aviso: mensajes que nadie ha contestado. */}
          <Stat
            label="Sin atender"
            icon="ph-envelope-simple"
            tone={c.nuevos > 0 ? 'warn' : 'muted'}
            value={c.nuevos}
            valueTone={c.nuevos > 0 ? 'warn' : undefined}
          />
          <Stat label="Atendidos" icon="ph-check-circle" tone="ok" value={c.atendidos} />
        </Stats>

        {/* Los mensajes ya NO se pierden aunque el CRM esté apagado: se guardan
            aquí. El aviso dice justo eso, para que nadie crea que hay que
            configurar Perfex antes de poder contestar. */}
        {/* Sin CRM en el modelo, Mensajes es una bandeja de entrada: nada de Perfex. */}
        {CRM_ACTIVO && data && !data.perfexEnabled ? (
          <Note tone="warn" style={{ marginBottom: 20 }}>
            <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Perfex CRM no está conectado.</strong> Los mensajes se guardan aquí y no se pierde ninguno,
            pero no están subiendo al CRM. Para conectarlo hay que configurar <span className="adm-mono">PERFEX_URL</span> y{' '}
            <span className="adm-mono">PERFEX_TOKEN</span> en la API; después podrás subir de golpe los que quedaron pendientes.
          </Note>
        ) : null}

        {/* Filtros por estado + búsqueda */}
        <Toolbar end={`${data?.total ?? 0} de ${c.nuevos + c.atendidos + c.archivados}`}>
          <MessagesSearch initial={q} />
          <Segmented
            ariaLabel="Filtrar por estado"
            value={estado || 'todos'}
            items={FILTROS.map((f) => ({
              key: f.key || 'todos',
              label: f.label,
              count: f.key === 'nuevo' ? c.nuevos : f.key === 'atendido' ? c.atendidos : f.key === 'archivado' ? c.archivados : undefined,
              href: link({ estado: f.key || undefined, page: undefined }),
            }))}
          />
        </Toolbar>

        <Panel
          flush
          clip
          footer={pages > 1 ? (
            <>
              <span>
                <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{data?.total ?? 0}</span> mensaje(s){q ? ` para “${q}”` : ''}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pager(link({ page: String(Math.max(1, page - 1)) }), page <= 1, 'ph-caret-left', 'Página anterior')}
                <span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-text-2)', padding: '0 4px' }}>Página {page} / {pages}</span>
                {pager(link({ page: String(Math.min(pages, page + 1)) }), page >= pages, 'ph-caret-right', 'Página siguiente')}
              </span>
            </>
          ) : undefined}
        >
          {items.map((m) => (
            <article key={m.id} className="adm-trow" style={{ paddingTop: 16, paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="adm-cell-title">{m.name}</span>
                    {m.state === 'nuevo' ? <Chip tone="warn">Sin atender</Chip> : null}
                    {m.state === 'archivado' ? <Chip tone="muted">Archivado</Chip> : null}
                    {m.need ? <Chip>{m.need}</Chip> : null}
                    {/* Sin subir al CRM: se dice, no se esconde. */}
                    {CRM_ACTIVO && !m.crmPushed && data?.perfexEnabled ? (
                      <StatusText tone="warn" title="Todavía no se subió al CRM">sin subir al CRM</StatusText>
                    ) : null}
                  </div>

                  <div className="adm-meta" style={{ marginTop: 5 }}>
                    <a href={`mailto:${m.email}`} className="adm-link" style={{ color: 'var(--adm-text-2)' }}>{m.email}</a>
                    {m.phone ? (
                      <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="adm-link adm-mono" style={{ color: 'var(--adm-text-2)' }}>{m.phone}</a>
                    ) : null}
                    {m.company ? <span>{m.company}</span> : null}
                    {m.customerId ? (
                      <Link href={`/usuarios/${m.customerId}`} style={{ textDecoration: 'none' }}>
                        <Chip tone="ok">Ya es cliente →</Chip>
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="adm-num" style={{ fontSize: 12, color: 'var(--adm-faint)', whiteSpace: 'nowrap' }}>{fecha(m.createdAt)}</div>
              </div>

              <p style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--adm-text-2)', whiteSpace: 'pre-wrap' }}>{m.message}</p>

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--adm-faint)' }}>
                  {m.handledBy && m.handledAt ? `Atendido por ${m.handledBy} · ${fecha(m.handledAt)}` : ''}
                </div>
                <MessageState id={m.id} state={m.state} name={m.name} />
              </div>
            </article>
          ))}

          {items.length === 0 ? (
            <EmptyState
              icon="ph-chat-centered-text"
              title={q || estado ? 'Sin resultados' : 'Aún no hay mensajes'}
              sub={q || estado
                ? 'Prueba con otro término o quita el filtro.'
                : 'Aparecen cuando alguien escribe desde la página de Contacto del sitio.'}
            />
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
