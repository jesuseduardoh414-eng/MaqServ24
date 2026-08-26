'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
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

export const C = {
  panel: '#141416', panel2: '#1b1e26', panel3: '#212530',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

export const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
};
export const label: CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 5, display: 'block' };
export const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 9,
  padding: '9px 15px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
export const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9,
  padding: '9px 15px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};

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
    <div style={{ color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 className="adm-page-title">Clientes y obras</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 0', maxWidth: 620, lineHeight: 1.6 }}>
            La empresa que contrata y los frentes que tiene abiertos. No es lo mismo que Cuentas:
            casi todas las solicitudes las hace alguien sin registrarse.
          </p>
        </div>
        <button type="button" style={boton} onClick={() => setCreando((v) => !v)}>
          {creando ? 'Cancelar' : '+ Nuevo cliente'}
        </button>
      </div>

      {creando ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <span style={label}>Nombre o razón social</span>
            <input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Constructora del Norte SA de CV" />
          </div>
          <button type="button" style={boton} onClick={crear}>Crear</button>
        </div>
      ) : null}

      {msg ? (
        <div style={{ background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13.5 }}>{msg}</div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        {[
          ['Clientes', initial.length, C.ink],
          ['Con obra registrada', conObra, conObra > 0 ? C.ok : C.dim],
          // Repetir es la señal de valor del documento: un cliente que vuelve
          // vale más que uno nuevo, y hasta ahora no se podía ni contar.
          ['Han vuelto', repetidos, repetidos > 0 ? C.accent : C.dim],
        ].map(([t, n, col]) => (
          <div key={String(t)} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12.5, color: C.muted }}>{t}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: col as string }}>{n as number}</div>
          </div>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, correo, RFC o giro…"
        style={{ ...input, maxWidth: 420, marginBottom: 18 }}
      />

      {filtrados.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: '52px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.muted }}>
            {initial.length === 0 ? 'Todavía no hay clientes' : 'Sin resultados'}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {filtrados.map((c) => (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14 }}>
            <button
              type="button"
              onClick={() => setAbierto(abierto === c.id ? null : c.id)}
              aria-expanded={abierto === c.id}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '15px 18px', cursor: 'pointer', fontFamily: 'inherit', color: C.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</span>
                  {c.hasAccount ? (
                    <span title="Tiene cuenta en el sitio" style={{ fontSize: 10.5, fontWeight: 700, color: C.accent }}>CON CUENTA</span>
                  ) : null}
                  {c.status === 0 ? <span style={{ fontSize: 10.5, color: C.dim }}>INACTIVO</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                  {c.sites} obra{c.sites === 1 ? '' : 's'} · {c.quotes} solicitud{c.quotes === 1 ? '' : 'es'}
                  {c.quoted > 0 ? ` · ${money(c.quoted)} cotizado` : ''}
                  {c.lastAt ? ` · última ${fecha(c.lastAt)}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: C.muted }}>{abierto === c.id ? 'Cerrar' : 'Ver obras'}</span>
            </button>

            {abierto === c.id ? <FichaCliente clientId={c.id} /> : null}
          </div>
        ))}
      </div>
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

  if (cargando) return <div style={{ padding: '0 18px 16px', fontSize: 13, color: C.dim }}>Cargando obras…</div>;
  if (!ficha) return <div style={{ padding: '0 18px 16px', fontSize: 13, color: C.bad }}>No se pudo cargar la ficha.</div>;

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: '16px 18px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: C.muted }}>
          {ficha.sites.length === 0 ? 'Sin obras registradas' : `${ficha.sites.length} obra(s)`}
        </span>
        <button type="button" style={botonSec} onClick={() => setNueva((v) => !v)}>
          {nueva ? 'Cancelar' : '+ Agregar obra'}
        </button>
      </div>

      {nueva ? (
        <SiteEditor clientId={clientId} onListo={() => { setNueva(false); recargar(); }} onCancelar={() => setNueva(false)} />
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {ficha.sites.map((o) => (
          <SiteEditor key={o.id} clientId={clientId} obra={o} onListo={recargar} />
        ))}
      </div>

      {ficha.unassigned.length > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
            {/* No se esconden: son historial del cliente y alguien tiene que
                poder moverlas a su obra cuando se sepa cuál era. */}
            Solicitudes sin obra ({ficha.unassigned.length}) — anteriores a las obras o sin dirección
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {ficha.unassigned.slice(0, 12).map((q) => (
              <div key={q.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: C.dim, minWidth: 112 }}>{q.quoteNumber}</span>
                <span style={{ color: C.muted }}>{q.category ?? 'sin línea'}</span>
                <span style={{ color: C.ink }}>{money(q.total)}</span>
                {ficha.sites.length > 0 ? (
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      await fetch(`/api/admin/clients/quotes/${q.id}/site`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ siteId: Number(e.target.value) }),
                      });
                      recargar();
                    }}
                    style={{ ...input, width: 'auto', padding: '4px 8px', fontSize: 12 }}
                  >
                    <option value="">Mover a una obra…</option>
                    {ficha.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
