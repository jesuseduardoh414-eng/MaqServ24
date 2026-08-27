'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { DocumentAlerts } from './DocumentAlerts';
import { ProviderHistory } from './ProviderHistory';
import { MapaCobertura, type PuntoMapa } from './MapaCobertura';

export interface ProviderRow {
  id: number;
  name: string;
  slug: string;
  level: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  coverage: string[];
  categories: string[];
  responseMinutes: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  coverageRadiusKm: number | null;
  notes: string | null;
  status: number;
  docsStatus: 'al-dia' | 'por-vencer' | 'vencido' | 'sin-documentos';
  verified: boolean;
  monthsInNetwork: number | null;
  documentCount: number;
  productCount: number;
}

interface DocRow {
  id: number;
  kind: string;
  name: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
}

const C = {
  panel: '#141416', panel2: '#1b1e26', panel3: '#212530',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

/** Los cuatro niveles del documento, en orden de escalera. */
const NIVELES = ['registrado', 'validado', 'activo', 'preferente'] as const;
const TIPOS_DOC: Array<[string, string]> = [
  ['fiscal', 'Fiscal'],
  ['legal', 'Legal'],
  ['seguro', 'Seguro / póliza'],
  ['tecnico', 'Técnico'],
  ['seguridad', 'Seguridad'],
  ['otro', 'Otro'],
];

/** Las seis líneas de servicio del manual. */
const LINEAS: Array<[string, string]> = [
  ['maquinaria-pesada', 'Maquinaria pesada'],
  ['equipo-menor', 'Equipo menor'],
  ['plataformas-de-elevacion', 'Plataformas de elevación'],
  ['agua-en-pipas', 'Agua en pipas'],
  ['volteos', 'Volteos'],
  ['triturados', 'Triturados'],
];

const ETIQUETA_DOCS: Record<ProviderRow['docsStatus'], { texto: string; color: string }> = {
  'al-dia': { texto: 'Al día', color: C.ok },
  'por-vencer': { texto: 'Por vencer', color: C.warn },
  vencido: { texto: 'Vencido', color: C.bad },
  'sin-documentos': { texto: 'Sin documentos', color: C.dim },
};

const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '11px 13px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
};
const label: CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 6, display: 'block' };
const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 10,
  padding: '11px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};

const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 10,
  padding: '11px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};

/** Convierte "Apodaca, Escobedo , García" en tres municipios limpios. */
const aLista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function ProvidersManager({ initial }: { initial: ProviderRow[] }) {
  const [provs, setProvs] = useState(initial);
  const [query, setQuery] = useState('');
  const [creando, setCreando] = useState(false);
  const [expediente, setExpediente] = useState<ProviderRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', level: 'registrado', contactName: '', phone: '', email: '',
    city: '', coverage: '', categories: [] as string[], responseMinutes: '',
  });

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return provs;
    return provs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.city ?? '').toLowerCase().includes(q) ||
        p.coverage.some((m) => m.toLowerCase().includes(q)),
    );
  }, [provs, query]);

  async function recargar() {
    const r = await fetch('/api/admin/providers');
    if (r.ok) setProvs(await r.json());
  }

  async function crear() {
    if (form.name.trim().length < 2) { setMsg('El nombre es obligatorio'); return; }
    const r = await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        level: form.level,
        contactName: form.contactName || null,
        phone: form.phone || null,
        email: form.email || null,
        city: form.city || null,
        coverage: aLista(form.coverage),
        categories: form.categories,
        responseMinutes: form.responseMinutes ? Number(form.responseMinutes) : null,
      }),
    });
    if (!r.ok) { setMsg('No se pudo guardar'); return; }
    setCreando(false);
    setForm({ name: '', level: 'registrado', contactName: '', phone: '', email: '', city: '', coverage: '', categories: [], responseMinutes: '' });
    setMsg('Aliado dado de alta');
    recargar();
  }

  async function cambiarNivel(p: ProviderRow, level: string) {
    await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }),
    });
    recargar();
  }

  async function abrirExpediente(p: ProviderRow) {
    setExpediente(p);
    const r = await fetch(`/api/admin/providers/${p.id}/documents`);
    setDocs(r.ok ? await r.json() : []);
  }

  async function agregarDoc(kind: string, nombre: string, vence: string) {
    if (!expediente) return;
    await fetch(`/api/admin/providers/${expediente.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name: nombre || null, expiresAt: vence || null }),
    });
    abrirExpediente(expediente);
    recargar();
  }

  async function borrarDoc(id: number) {
    await fetch(`/api/admin/providers/documents/${id}`, { method: 'DELETE' });
    if (expediente) abrirExpediente(expediente);
    recargar();
  }

  const conSello = provs.filter((p) => p.verified).length;
  const conVencidos = provs.filter((p) => p.docsStatus === 'vencido').length;
  const porVencer = provs.filter((p) => p.docsStatus === 'por-vencer').length;

  return (
    <div style={{ fontFamily: 'inherit', color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 className="adm-page-title">Red de aliados</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 0' }}>
            Proveedores que aportan capacidad. El sello de verificado no se pone a mano:
            sale del nivel y de que sus documentos estén vigentes.
          </p>
        </div>
        <button type="button" style={boton} onClick={() => setCreando((v) => !v)}>
          {creando ? 'Cancelar' : '+ Nuevo aliado'}
        </button>
      </div>

      {/* Resumen: lo primero que importa es a quién se le vencieron los papeles. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        {[
          ['Aliados', provs.length, C.ink],
          ['Con sello', conSello, C.ok],
          ['Por vencer', porVencer, C.warn],
          ['Vencidos', conVencidos, conVencidos > 0 ? C.bad : C.dim],
        ].map(([t, n, col]) => (
          <div key={String(t)} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12.5, color: C.muted }}>{t}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: col as string }}>{n as number}</div>
          </div>
        ))}
      </div>

      {/*
        DONDE ESTA LA RED (documento institucional, 17).
        Un mapa contesta de un vistazo lo que una lista de municipios no: si
        hay un hueco geografico, y de que tamano.
      */}
      {provs.some((x) => x.lat != null && x.lng != null) ? (
        <div style={{ marginBottom: 22 }}>
          <MapaCobertura
            puntos={provs
              .filter((x) => x.lat != null && x.lng != null && x.status === 1)
              .map<PuntoMapa>((x) => ({
                id: x.id,
                nombre: x.name,
                lat: x.lat!,
                lng: x.lng!,
                radioKm: x.coverageRadiusKm,
                tipo: 'aliado',
                detalle: x.categories.join(', '),
              }))}
          />
          <div style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
            El circulo es hasta donde llega cada aliado. Los que no aparecen todavia no estan
            ubicados: abre su expediente y usa &quot;Ponerlo en el mapa&quot;.
          </div>
        </div>
      ) : null}

      {/*
        Los contadores de arriba dicen CUANTOS. Esto dice que papel, de quien y
        para cuando — lo unico con lo que se puede levantar el telefono.
      */}
      <DocumentAlerts
        colores={C}
        onIr={(id) => {
          const prov = provs.find((x) => x.id === id);
          if (prov) abrirExpediente(prov);
        }}
      />

      {msg ? (
        <div style={{ background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13.5 }}>
          {msg}
        </div>
      ) : null}

      {creando ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <div><span style={label}>Nombre del aliado *</span><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><span style={label}>Persona que responde</span><input style={input} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div><span style={label}>Teléfono</span><input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><span style={label}>Correo</span><input style={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><span style={label}>Ciudad base</span><input style={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div>
              <span style={label}>Nivel</span>
              <select style={input} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div><span style={label}>Respuesta promedio (minutos)</span><input style={input} type="number" value={form.responseMinutes} onChange={(e) => setForm({ ...form, responseMinutes: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={label}>Municipios que cubre — sepáralos con comas</span>
              <input style={input} placeholder="Apodaca, Escobedo, García" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <span style={label}>Qué servicios atiende</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LINEAS.map(([slug, nombre]) => {
                const on = form.categories.includes(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setForm({ ...form, categories: on ? form.categories.filter((c) => c !== slug) : [...form.categories, slug] })}
                    style={{
                      background: on ? C.accent : C.panel2, color: on ? C.accentInk : C.muted,
                      border: `1px solid ${on ? C.accent : C.line2}`, borderRadius: 999,
                      padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: on ? 700 : 500,
                    }}
                  >
                    {nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" style={{ ...boton, marginTop: 18 }} onClick={crear}>Dar de alta</button>
        </div>
      ) : null}

      <input style={{ ...input, maxWidth: 380, marginBottom: 16 }} placeholder="Buscar por nombre o municipio…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div style={{ display: 'grid', gap: 12 }}>
        {filtrados.length === 0 ? (
          <div style={{ color: C.muted, padding: 30, textAlign: 'center', border: `1px dashed ${C.line2}`, borderRadius: 14 }}>
            Todavía no hay aliados dados de alta.
          </div>
        ) : null}

        {filtrados.map((p) => {
          const d = ETIQUETA_DOCS[p.docsStatus];
          return (
            <div key={p.id} style={{ background: C.panel, border: `1px solid ${p.docsStatus === 'vencido' ? `color-mix(in srgb, ${C.bad} 40%, transparent)` : C.line}`, borderRadius: 14, padding: '16px 18px', opacity: p.status === 1 ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 16 }}>{p.name}</strong>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', padding: '3px 9px', borderRadius: 6,
                  color: p.verified ? C.ok : C.dim,
                  border: `1px solid color-mix(in srgb, ${p.verified ? C.ok : C.dim} 40%, transparent)`,
                  background: `color-mix(in srgb, ${p.verified ? C.ok : C.dim} 12%, transparent)`,
                }}>
                  {p.verified ? 'CON SELLO' : 'SIN SELLO'}
                </span>
                <span style={{ fontSize: 12.5, color: d.color }}>Documentos: {d.texto}</span>
                <select
                  value={p.level}
                  onChange={(e) => cambiarNivel(p, e.target.value)}
                  style={{ ...input, width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
                >
                  {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" onClick={() => abrirExpediente(p)} style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Expediente ({p.documentCount})
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
                {[
                  p.contactName,
                  p.phone,
                  p.coverage.length ? `Cubre: ${p.coverage.join(', ')}` : null,
                  p.responseMinutes !== null ? `Responde en ~${p.responseMinutes} min` : null,
                  p.monthsInNetwork !== null ? `${p.monthsInNetwork} meses en la red` : null,
                  `${p.productCount} equipo(s)`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          );
        })}
      </div>

      {expediente ? (
        <ExpedienteModal
          p={expediente}
          docs={docs}
          onCerrar={() => setExpediente(null)}
          onAgregar={agregarDoc}
          onBorrar={borrarDoc}
        />
      ) : null}
    </div>
  );
}

function ExpedienteModal({
  p, docs, onCerrar, onAgregar, onBorrar,
}: {
  p: ProviderRow;
  docs: DocRow[];
  onCerrar: () => void;
  onAgregar: (kind: string, nombre: string, vence: string) => void;
  onBorrar: (id: number) => void;
}) {
  const [kind, setKind] = useState('fiscal');
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState('');
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 90 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 16, padding: 24, width: 'min(640px, 100%)', maxHeight: '86vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Expediente · {p.name}</h2>
          <button type="button" onClick={onCerrar} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 18px', lineHeight: 1.6 }}>
          Un documento vencido le quita el sello al aliado aunque su nivel sea alto.
        </p>

        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {docs.length === 0 ? (
            <div style={{ color: C.dim, fontSize: 13.5 }}>Sin documentos cargados.</div>
          ) : null}
          {docs.map((d) => {
            const vencido = d.expiresAt !== null && d.expiresAt < hoy;
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.panel2, border: `1px solid ${vencido ? `color-mix(in srgb, ${C.bad} 45%, transparent)` : C.line}`, borderRadius: 10, padding: '11px 14px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{d.name || TIPOS_DOC.find(([k]) => k === d.kind)?.[1] || d.kind}</div>
                  <div style={{ fontSize: 12, color: vencido ? C.bad : C.muted, marginTop: 2 }}>
                    {d.expiresAt ? (vencido ? `Venció el ${d.expiresAt}` : `Vigente hasta ${d.expiresAt}`) : 'Sin vencimiento'}
                  </div>
                </div>
                <button type="button" onClick={() => onBorrar(d.id)} style={{ background: 'none', border: `1px solid ${C.line2}`, color: C.muted, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Quitar
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={label}>Tipo</span>
              <select style={input} value={kind} onChange={(e) => setKind(e.target.value)}>
                {TIPOS_DOC.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Vence el (opcional)</span>
              <input style={input} type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
            </div>
          </div>
          <div>
            <span style={label}>Nombre del documento</span>
            <input style={input} placeholder="Póliza de responsabilidad civil" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <button
            type="button"
            style={boton}
            onClick={() => { onAgregar(kind, nombre, vence); setNombre(''); setVence(''); }}
          >
            Agregar al expediente
          </button>
        </div>

        {/*
          El acceso del aliado. Es lo que convierte la red de un directorio que
          alguien mantiene a mano en algo que se mantiene solo.
        */}
        {/*
          DONDE ESTA Y HASTA DONDE LLEGA. Con esto la cobertura pasa de
          "escribio este municipio?" a "esta a menos de N kilometros?", que es
          la pregunta real y la unica que funciona fuera del area metropolitana.
        */}
        <UbicacionAliado p={p} />

        <AccesoAliado p={p} />

        {/*
          Los papeles dicen si esta en regla. El cumplimiento dice si CUMPLE,
          que es otra cosa: se puede tener todo vigente y no contestar nunca.
        */}
        <ProviderHistory providerId={p.id} colores={C} />
      </div>
    </div>
  );
}


/**
 * ENLACE DE ACCESO DEL ALIADO (documento institucional, seccion 20).
 *
 * El aliado no es un usuario de software: es el dueno de una rentadora que
 * contesta desde la cabina de una camioneta. Un enlace que abre directo lo
 * suyo se usa; una contrasena de un portal que abre dos veces al mes, no — y
 * entonces todo vuelve al telefono, que es lo que se quiere quitar.
 */
function AccesoAliado({ p }: { p: ProviderRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function mandar() {
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/providers/${p.id}/acceso`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setMsg(d?.message ?? 'No se pudo generar el enlace.'); return; }
    setUrl(d.url);
    setMsg(d.mensaje);
  }

  async function revocar() {
    if (!window.confirm('Los enlaces que ya le hayas mandado dejaran de servir. ¿Seguimos?')) return;
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/providers/${p.id}/revocar-acceso`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setUrl(null);
    setMsg(d?.mensaje ?? 'Listo.');
  }

  return (
    <section style={{ borderTop: `1px solid ${C.line}`, marginTop: 22, paddingTop: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: C.ink }}>Su acceso</h3>
      <p style={{ margin: '0 0 13px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        Un enlace que le abre lo suyo: contesta solicitudes, confirma si sus equipos siguen libres y
        revisa sus papeles. Sin contrasena, y sirve 30 dias.
      </p>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...boton, opacity: ocupado ? 0.6 : 1 }} onClick={mandar} disabled={ocupado}>
          {p.email ? 'Mandarle su enlace' : 'Generar enlace'}
        </button>
        <button type="button" style={{ ...botonSec, color: C.dim }} onClick={revocar} disabled={ocupado}>
          Revocar los anteriores
        </button>
      </div>

      {msg ? <div style={{ marginTop: 12, fontSize: 13, color: C.ink }}>{msg}</div> : null}

      {url ? (
        <div style={{ marginTop: 10 }}>
          {/*
            El enlace se ensena SIEMPRE, tambien cuando el correo salio bien:
            mientras el envio este apagado esta es la unica forma de darle
            acceso, y se le puede pasar por WhatsApp igual de bien.
          */}
          <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 5 }}>
            Tambien puedes copiarlo y mandarselo por WhatsApp:
          </div>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}
          />
        </div>
      ) : null}
    </section>
  );
}


/** Ubicacion del aliado y su radio de cobertura. */
function UbicacionAliado({ p }: { p: ProviderRow }) {
  const [dir, setDir] = useState(p.address ?? '');
  const [radio, setRadio] = useState(p.coverageRadiusKm ? String(p.coverageRadiusKm) : '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    setOcupado(true); setMsg(null);
    await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: dir,
        coverageRadiusKm: radio.trim() ? Number(radio) : null,
      }),
    });
    setOcupado(false);
    setMsg('Guardado.');
  }

  async function ubicar() {
    setOcupado(true); setMsg(null);
    // Se guarda ANTES de geocodificar: la direccion que el usuario acaba de
    // escribir es la que hay que buscar, no la que estaba en la base.
    await guardar();
    const r = await fetch(`/api/admin/providers/${p.id}/geocodificar`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setMsg(d?.mensaje ?? 'No se pudo ubicar.');
    if (d?.ok) setCoords({ lat: d.lat, lng: d.lng });
  }

  return (
    <section style={{ borderTop: `1px solid ${C.line}`, marginTop: 22, paddingTop: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: C.ink }}>Dónde está y hasta dónde llega</h3>
      <p style={{ margin: '0 0 13px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        Con esto dejamos de decidir la cobertura por el nombre del municipio. Los que ya tienen
        radio se comparan por distancia real a la obra.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={label}>Dirección de su base</span>
          <input style={input} value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Av. Industrias 200, Apodaca, N.L." />
        </div>
        <div>
          <span style={label}>Llega hasta (km)</span>
          <input style={input} type="number" min={1} value={radio} onChange={(e) => setRadio(e.target.value)} placeholder="40" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 13, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={{ ...boton, opacity: ocupado ? 0.6 : 1 }} onClick={ubicar} disabled={ocupado}>
          Ponerlo en el mapa
        </button>
        <button type="button" style={botonSec} onClick={guardar} disabled={ocupado}>Sólo guardar</button>
        {coords ? (
          <span style={{ fontSize: 12, color: C.ok }}>
            Ubicado en {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: C.dim }}>Sin ubicar</span>
        )}
      </div>

      {msg ? <div style={{ marginTop: 11, fontSize: 13, color: C.ink }}>{msg}</div> : null}

      {coords ? (
        <div style={{ marginTop: 13 }}>
          <MapaCobertura
            alto={220}
            puntos={[{ id: p.id, nombre: p.name, lat: coords.lat, lng: coords.lng, radioKm: p.coverageRadiusKm ?? (radio ? Number(radio) : null), tipo: 'aliado' }]}
          />
        </div>
      ) : null}
    </section>
  );
}
