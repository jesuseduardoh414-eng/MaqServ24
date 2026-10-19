'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import { useRouter } from 'next/navigation';
import { Btn, Chip, EmptyState, FormField, Note, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, Switch, Toolbar } from '@/components/ui';
import { SiteEditor, type Obra } from './SiteEditor';

/**
 * CLIENTES Y OBRAS.
 *
 * Antes, una constructora con tres frentes abiertos eran tres direcciones sin
 * parentesco. La lista responde primero lo que se pregunta al abrirla —quién
 * es y cuánto pesa— y la ficha responde lo que se pregunta después: qué se le
 * ha mandado a cada obra.
 */

export interface ClienteRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  industry: string | null;
  status: number;
  hasAccount: boolean;
  /** "web": se registró o pidió desde el sitio. "panel": alta aquí o sólo cotizado por teléfono. */
  origin: 'web' | 'panel';
  sites: number;
  quotes: number;
  quoted: number;
  lastAt: string | null;
}

const GRID = 'minmax(0,2fr) 80px 104px 130px 120px 112px';

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Los datos de la empresa: los mismos en el alta y al editar. */
interface DatosForm { name: string; email: string; phone: string; rfc: string; industry: string; notes: string; status: number }

const VACIO: DatosForm = { name: '', email: '', phone: '', rfc: '', industry: '', notes: '', status: 1 };

type Filtro = 'todos' | 'piden' | 'sin';
type FiltroOrigen = 'todos' | 'web' | 'panel';

/** La etiqueta de origen de cada fila: una sola, que ya dice si tiene cuenta. */
function ChipOrigen({ c }: { c: Pick<ClienteRow, 'origin' | 'hasAccount'> }) {
  if (c.origin === 'panel') return <Chip tone="muted" title="Lo dieron de alta en el panel o se le cotizó por teléfono">Panel</Chip>;
  return c.hasAccount
    ? <Chip tone="accent" title="Se registró en el sitio">Web · con cuenta</Chip>
    : <Chip tone="info" title="Pidió desde el sitio sin registrarse">Web</Chip>;
}

export function ClientsManager({ initial }: { initial: ClienteRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [origen, setOrigen] = useState<FiltroOrigen>('todos');
  const [abierto, setAbierto] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);

  // Dos filtros que se combinan (2026-10-15): si ya pidió, y de dónde vino.
  // Los conteos de cada uno respetan lo elegido en el otro.
  const pasaPedido = (c: ClienteRow, f: Filtro) => f === 'todos' || (f === 'piden' ? c.quotes > 0 : c.quotes === 0);
  const pasaOrigen = (c: ClienteRow, o: FiltroOrigen) => o === 'todos' || c.origin === o;
  const cuenta = (f: Filtro, o: FiltroOrigen) => initial.filter((c) => pasaPedido(c, f) && pasaOrigen(c, o)).length;

  const filtrados = useMemo(() => {
    const base = initial.filter((c) => pasaPedido(c, filtro) && pasaOrigen(c, origen));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) =>
      [c.name, c.email, c.rfc, c.industry, c.phone].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, filtro, origen, query]);

  const deWeb = initial.filter((c) => c.origin === 'web').length;
  const conCuenta = initial.filter((c) => c.hasAccount).length;
  const conObra = initial.filter((c) => c.sites > 0).length;
  const repetidos = initial.filter((c) => c.quotes > 1).length;

  return (
    <div>
      <style>{`
        .cli-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        button.cli-row {
          width: 100%; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--adm-border);
          color: inherit; font: inherit; cursor: pointer;
        }
        .cli-item + .cli-item { border-top: 1px solid var(--adm-border); }
        .cli-row .cli-meta-m { display: none; }
        /* En móvil la fila se apila: nombre arriba, las cifras en una línea debajo. */
        @media (max-width: 900px) {
          .cli-thead { display: none !important; }
          .cli-row { display: flex; flex-wrap: wrap; gap: 6px 14px; }
          .cli-row > .cli-c-name { flex: 1 1 calc(100% - 110px); }
          .cli-row > .cli-c-num { display: none; }
          .cli-row > .cli-c-toggle { margin-left: auto; }
          .cli-row .cli-meta-m { display: flex; }
        }
      `}</style>

      <PageHeader
        eyebrow={['1 · Recibir', 'Clientes']}
        title="Clientes y obras"
        subtitle="Todos tus clientes. «Web»: se registró o pidió desde el sitio. «Panel»: lo diste de alta aquí o se le cotizó por teléfono."
        actions={<Btn variant="primary" icon="ph-plus" onClick={() => setCreando(true)}>Nuevo cliente</Btn>}
      />

      <EditarCliente
        abierto={creando}
        onCerrar={() => setCreando(false)}
        onListo={() => { setCreando(false); router.refresh(); }}
      />

      <Stats>
        <Stat label="Clientes" icon="ph-buildings" value={initial.length} />
        <Stat
          label="Del sitio web"
          icon="ph-globe"
          tone={deWeb > 0 ? 'accent' : 'muted'}
          value={deWeb}
          hint={`${conCuenta} con cuenta · ${initial.length - deWeb} del panel`}
        />
        <Stat
          label="Con obra registrada"
          icon="ph-map-pin"
          tone={conObra > 0 ? 'ok' : 'muted'}
          value={conObra}
          hint={`de ${initial.length}`}
        />
        {/* Repetir es la señal de valor del documento: un cliente que vuelve
            vale más que uno nuevo, y hasta ahora no se podía ni contar. */}
        <Stat
          label="Han vuelto"
          icon="ph-arrow-counter-clockwise"
          tone={repetidos > 0 ? 'accent' : 'muted'}
          value={repetidos}
          hint="más de una solicitud"
        />
      </Stats>

      <Toolbar end={`${filtrados.length} de ${initial.length}`}>
        <SearchBox
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, correo, teléfono, RFC…"
          aria-label="Buscar cliente"
          style={{ maxWidth: 420 }}
        />
        <Segmented<FiltroOrigen>
          value={origen}
          onChange={setOrigen}
          ariaLabel="Filtrar por origen"
          items={[
            { key: 'todos', label: 'Web y panel', count: cuenta(filtro, 'todos') },
            { key: 'web', label: 'Del sitio web', count: cuenta(filtro, 'web') },
            { key: 'panel', label: 'Del panel', count: cuenta(filtro, 'panel') },
          ]}
        />
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          ariaLabel="Filtrar por solicitudes"
          items={[
            { key: 'todos', label: 'Todos', count: cuenta('todos', origen) },
            { key: 'piden', label: 'Han pedido', count: cuenta('piden', origen) },
            { key: 'sin', label: 'Aún sin pedir', count: cuenta('sin', origen) },
          ]}
        />
      </Toolbar>

      <Panel flush clip>
        <div className="adm-thead cli-row cli-thead">
          <div>Cliente</div>
          <div className="cli-c-num">Obras</div>
          <div className="cli-c-num">Solicitudes</div>
          <div className="cli-c-num">Cotizado</div>
          <div className="cli-c-num">Última</div>
          <div />
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon="ph-buildings"
            title={initial.length === 0 ? 'Todavía no hay clientes' : 'Sin resultados'}
            sub={initial.length === 0 ? undefined : 'Ajusta la búsqueda o el filtro.'}
          />
        ) : filtrados.map((c) => {
          const open = abierto === c.id;
          return (
            <div key={c.id} className="cli-item">
              <button
                type="button"
                className="adm-trow cli-row"
                onClick={() => setAbierto(open ? null : c.id)}
                aria-expanded={open}
              >
                <span className="cli-c-name" style={{ minWidth: 0, display: 'block' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="adm-cell-title">{c.name}</span>
                    <ChipOrigen c={c} />
                    {c.status === 0 ? <Chip tone="muted">Inactivo</Chip> : null}
                  </span>
                  {/* Solo en móvil: las columnas de cifras se esconden y su
                      contenido baja a esta línea. */}
                  <span className="adm-meta cli-meta-m">
                    <span className="adm-num">{c.sites} obra{c.sites === 1 ? '' : 's'}</span>
                    <span className="adm-num">{c.quotes} solicitud{c.quotes === 1 ? '' : 'es'}</span>
                    {c.quoted > 0 ? <span className="adm-num">{money(c.quoted)} cotizado</span> : null}
                    {c.lastAt ? <span>última {fecha(c.lastAt)}</span> : null}
                  </span>
                </span>
                <span className="cli-c-num adm-num" style={{ fontSize: 13.5, color: c.sites === 0 ? 'var(--adm-faint)' : 'var(--adm-text)' }}>{c.sites}</span>
                <span className="cli-c-num adm-num" style={{ fontSize: 13.5, color: c.quotes === 0 ? 'var(--adm-faint)' : 'var(--adm-text)' }}>{c.quotes}</span>
                <span className="cli-c-num adm-num" style={{ fontSize: 13.5, color: c.quoted > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>{c.quoted > 0 ? money(c.quoted) : '—'}</span>
                <span className="cli-c-num" style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{fecha(c.lastAt)}</span>
                <span className="cli-c-toggle" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, fontSize: 12.5, color: 'var(--adm-text-2)' }}>
                  {open ? 'Cerrar' : 'Ficha y obras'}
                  <i className={`ph ${open ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />
                </span>
              </button>

              {open ? <FichaCliente clientId={c.id} /> : null}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

interface Ficha {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  industry: string | null;
  notes: string | null;
  status: number;
  account: { name: string; email: string; createdAt: string | null } | null;
  origin: 'web' | 'panel';
  sites: Obra[];
  unassigned: Array<{ id: number; quoteNumber: string; category: string | null; total: number; serviceLabel: string | null; createdAt: string | null }>;
}

/**
 * La ficha se pide al abrir, no con la lista: traer las obras y el historial de
 * trescientos clientes para pintar una lista que sólo enseña el nombre sería
 * pagar por dato que nadie mira.
 */
function FichaCliente({ clientId }: { clientId: number }) {
  const router = useRouter();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fetch(`/api/admin/clients/${clientId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setFicha(d); })
      .catch(() => { if (vivo) setFicha(null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [clientId]);

  async function recargar() {
    const r = await fetch(`/api/admin/clients/${clientId}`);
    if (r.ok) setFicha(await r.json());
    router.refresh();
  }

  // La ficha se abre debajo de su fila, dentro del mismo panel: un fondo un
  // punto más claro la separa de la lista sin otra caja alrededor.
  const zona = { padding: '16px 20px 20px', background: 'rgba(255,255,255,0.015)' };

  if (cargando) return <div style={{ ...zona, fontSize: 13, color: 'var(--adm-muted)' }}>Cargando obras…</div>;
  if (!ficha) return <div style={zona}><Note tone="bad">No se pudo cargar la ficha.</Note></div>;

  // Los datos de la empresa, en una línea cada uno; sólo los que hay.
  const datos: Array<[string, string]> = [
    ['Correo', ficha.email],
    ['Teléfono', ficha.phone],
    ['RFC', ficha.rfc],
    ['Giro', ficha.industry],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  return (
    <div style={zona}>
      <EditarCliente
        abierto={editando}
        cliente={ficha}
        onCerrar={() => setEditando(false)}
        onListo={() => { setEditando(false); recargar(); }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--adm-border)' }}>
        <div style={{ display: 'grid', gap: 6, minWidth: 0, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap' }}>
            {datos.length === 0 ? <span style={{ color: 'var(--adm-faint)' }}>Sin correo, teléfono ni RFC capturados.</span> : datos.map(([k, v]) => (
              <span key={k}><span style={{ color: 'var(--adm-faint)' }}>{k} </span><span className={k === 'Giro' ? undefined : 'adm-mono'} style={{ color: 'var(--adm-text)' }}>{v}</span></span>
            ))}
          </div>
          {/* Quién entra al sitio por este cliente: lo que contesta "¿y éste de dónde salió?". */}
          {ficha.account ? (
            <div style={{ color: 'var(--adm-muted)' }}>
              <i className="ph ph-user-circle" aria-hidden style={{ marginRight: 6 }} />
              Cuenta del sitio: <span style={{ color: 'var(--adm-text)' }}>{ficha.account.name}</span> · <span className="adm-mono">{ficha.account.email}</span>
              {ficha.account.createdAt ? ` · se registró el ${fecha(ficha.account.createdAt)}` : ''}
            </div>
          ) : (
            <div style={{ color: 'var(--adm-faint)' }}>
              {ficha.origin === 'web'
                ? 'Sin cuenta en el sitio: pidió desde la web sin registrarse.'
                : 'Del panel: lo dieron de alta aquí o se le cotizó por teléfono. No tiene cuenta en el sitio.'}
            </div>
          )}
          {ficha.notes ? <div style={{ color: 'var(--adm-muted)', whiteSpace: 'pre-wrap' }}>{ficha.notes}</div> : null}
        </div>
        <Btn size="sm" icon="ph-pencil-simple" onClick={() => setEditando(true)}>Editar datos</Btn>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
          {ficha.sites.length === 0 ? 'Sin obras registradas' : `${ficha.sites.length} obra(s)`}
        </span>
        <Btn size="sm" icon="ph-plus" onClick={() => setNueva(true)}>Agregar obra</Btn>
      </div>

      {/* Alta de obra en modal (2026-09-25). */}
      <Modal abierto={nueva} titulo="Nueva obra" subtitulo="Dirección, contacto en sitio y lo que la obra exige para dejar entrar." onCerrar={() => setNueva(false)} ancho={820}>
        <SiteEditor clientId={clientId} onListo={() => { setNueva(false); recargar(); }} onCancelar={() => setNueva(false)} />
      </Modal>

      <div style={{ display: 'grid', gap: 10 }}>
        {ficha.sites.map((o) => (
          <SiteEditor key={o.id} clientId={clientId} obra={o} onListo={recargar} />
        ))}
      </div>

      {ficha.unassigned.length > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--adm-border)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', marginBottom: 8 }}>
            {/* No se esconden: son historial del cliente y alguien tiene que
                poder moverlas a su obra cuando se sepa cuál era. */}
            Solicitudes sin obra (<span className="adm-num">{ficha.unassigned.length}</span>) — anteriores a las obras o sin dirección
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {ficha.unassigned.slice(0, 12).map((q) => (
              <div key={q.id} style={{ display: 'flex', gap: 12, fontSize: 13, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="adm-mono" style={{ color: 'var(--adm-faint)', minWidth: 112 }}>{q.quoteNumber}</span>
                <span style={{ color: 'var(--adm-muted)' }}>{q.category ?? 'sin línea'}</span>
                <span className="adm-num" style={{ color: 'var(--adm-text)' }}>{money(q.total)}</span>
                {ficha.sites.length > 0 ? (
                  <AdminSelect
                    size="sm"
                    className="w-auto min-w-[170px]"
                    ariaLabel="Mover a una obra"
                    value=""
                    onChange={async (v) => {
                      if (!v) return;
                      await fetch(`/api/admin/clients/quotes/${q.id}/site`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ siteId: Number(v) }),
                      });
                      recargar();
                    }}
                    options={[{ value: '', label: 'Mover a una obra…' }, ...ficha.sites.map((s) => ({ value: String(s.id), label: s.name }))]}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Alta y edición de los datos del cliente (2026-10-15). Antes el alta sólo
 * pedía el nombre y no había forma de corregir nada después; ahora que cada
 * cuenta del sitio llega como cliente con el nombre de la PERSONA, renombrarlo
 * a su empresa es lo primero que alguien va a querer hacer.
 */
function EditarCliente({ abierto, cliente, onCerrar, onListo }: {
  abierto: boolean;
  /** Sin cliente = alta. */
  cliente?: Ficha;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [f, setF] = useState<DatosForm>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre, parte de lo guardado.
  useEffect(() => {
    if (!abierto) return;
    setError(null);
    setF(cliente ? {
      name: cliente.name, email: cliente.email ?? '', phone: cliente.phone ?? '', rfc: cliente.rfc ?? '',
      industry: cliente.industry ?? '', notes: cliente.notes ?? '', status: cliente.status,
    } : VACIO);
  }, [abierto, cliente]);

  const set = (k: keyof DatosForm, v: string | number) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    if (f.name.trim().length < 2) { setError('Escribe el nombre o la razón social.'); return; }
    setGuardando(true);
    setError(null);
    const r = await fetch(cliente ? `/api/admin/clients/${cliente.id}` : '/api/admin/clients', {
      method: cliente ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, rfc: f.rfc.trim().toUpperCase() }),
    }).catch(() => null);
    setGuardando(false);
    if (!r?.ok) {
      const b = await r?.json().catch(() => null);
      setError(b?.message ?? 'No se pudo guardar.');
      return;
    }
    onListo();
  }

  return (
    <Modal
      abierto={abierto}
      titulo={cliente ? 'Datos del cliente' : 'Nuevo cliente'}
      subtitulo={cliente ? 'La empresa que contrata. Sus obras se editan en su ficha.' : 'La empresa que contrata. Sus obras se agregan después desde su ficha.'}
      onCerrar={onCerrar}
      ancho={640}
      pie={<>
        <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
        <Btn variant="primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : cliente ? 'Guardar' : 'Crear cliente'}</Btn>
      </>}
    >
      <div className="adm-form-grid">
        <FormField
          label="Nombre o razón social *"
          help={cliente?.account && cliente.name === cliente.account.name ? 'Es el nombre de la persona que se registró. Si sabes su empresa, ponla aquí.' : undefined}
          style={{ gridColumn: '1 / -1' }}
        >
          <input className="adm-input" maxLength={190} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Constructora del Norte SA de CV" autoFocus />
        </FormField>
        <FormField label="Correo">
          <input className="adm-input" type="email" maxLength={190} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="compras@constructora.mx" />
        </FormField>
        <FormField label="Teléfono">
          <input className="adm-input" type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="81 8000 0000" />
        </FormField>
        <FormField label="RFC">
          <input className="adm-input adm-mono" maxLength={13} value={f.rfc} onChange={(e) => set('rfc', e.target.value)} placeholder="CNO120315AB1" />
        </FormField>
        <FormField label="Giro">
          <input className="adm-input" maxLength={120} value={f.industry} onChange={(e) => set('industry', e.target.value)} placeholder="Construcción, minería, industrial…" />
        </FormField>
        <FormField label="Notas" style={{ gridColumn: '1 / -1' }}>
          <textarea className="adm-input" rows={3} maxLength={4000} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Paga a 30 días, pide factura con orden de compra…" />
        </FormField>
        {cliente ? (
          <div style={{ gridColumn: '1 / -1' }}>
            {/* Inactivo no borra nada: deja de contarse y baja al final de la lista. */}
            <Switch on={f.status === 1} onClick={() => set('status', f.status === 1 ? 0 : 1)} label={f.status === 1 ? 'Activo' : 'Inactivo · baja al final de la lista'} />
          </div>
        ) : null}
      </div>
      {error ? <Note tone="bad" style={{ marginTop: 14 }}>{error}</Note> : null}
    </Modal>
  );
}
