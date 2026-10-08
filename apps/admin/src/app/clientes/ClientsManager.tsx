'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import { useRouter } from 'next/navigation';
import { Btn, Chip, EmptyState, FormField, Note, PageHeader, Panel, SearchBox, Stat, Stats, Toolbar } from '@/components/ui';
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
  sites: number;
  quotes: number;
  quoted: number;
  lastAt: string | null;
}

const GRID = 'minmax(0,2fr) 80px 104px 130px 120px 112px';

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function ClientsManager({ initial }: { initial: ClienteRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((c) =>
      [c.name, c.email, c.rfc, c.industry].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, query]);

  const conObra = initial.filter((c) => c.sites > 0).length;
  const repetidos = initial.filter((c) => c.quotes > 1).length;

  async function crear() {
    if (nombre.trim().length < 2) return;
    const r = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre.trim() }),
    });
    if (!r.ok) { setMsg('No se pudo crear el cliente.'); return; }
    setNombre(''); setCreando(false); setMsg(null);
    router.refresh();
  }

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
        subtitle="La empresa que contrata y los frentes que tiene abiertos. No es lo mismo que Cuentas: casi todas las solicitudes las hace alguien sin registrarse."
        actions={<Btn variant="primary" icon="ph-plus" onClick={() => setCreando(true)}>Nuevo cliente</Btn>}
      />

      <Modal
        abierto={creando}
        titulo="Nuevo cliente"
        subtitulo="La empresa que contrata. Sus obras se agregan después desde su ficha."
        onCerrar={() => setCreando(false)}
        ancho={560}
        pie={<>
          <Btn variant="ghost" onClick={() => setCreando(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={crear}>Crear cliente</Btn>
        </>}
      >
        <FormField label="Nombre o razón social">
          <input className="adm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Constructora del Norte SA de CV" autoFocus />
        </FormField>
      </Modal>

      {msg ? <Note tone="bad" style={{ marginBottom: 16 }}>{msg}</Note> : null}

      <Stats>
        <Stat label="Clientes" icon="ph-buildings" value={initial.length} />
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
          placeholder="Buscar por nombre, correo, RFC o giro…"
          aria-label="Buscar cliente"
          style={{ maxWidth: 420 }}
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
            sub={initial.length === 0 ? undefined : 'Ajusta la búsqueda.'}
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
                    {c.hasAccount ? <Chip tone="accent" title="Tiene cuenta en el sitio">Con cuenta</Chip> : null}
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
                  {open ? 'Cerrar' : 'Ver obras'}
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

  return (
    <div style={zona}>
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
