'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '@maqserv/ui';
import { Icon, type IconName } from '@/components/Icon';

/**
 * EL PANEL DEL ALIADO (rediseño 2026-09-24).
 *
 * Pensado para un teléfono a media obra: lo que espera respuesta va arriba y
 * en grande. El rediseño agrega lo que el aliado preguntaba por teléfono y
 * la API ya sabía: cuánto paga cada trabajo, en qué va lo que trae, qué le
 * falta para recibir trabajo, y su historial.
 *
 * DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Rechazar PIDE motivo; aceptar pide CUÁNDO LLEGA. El "no" sin motivo no
 *    sirve para nada, y el "sí" sin fecha no deja medir su puntualidad.
 *    Antes ambos iban por `window.prompt`; ahora son formularios en la tarjeta.
 *
 * 2. Se le enseña su propio historial. Si el sistema lo ordena con esos
 *    números, tiene derecho a verlos, y es la única forma de discutirlos.
 *
 * 3. "Para recibir trabajo" es una lista de lo que falta, no una calificación:
 *    papeles, sello, equipos y confirmación. Un aliado nuevo llega sin nada y
 *    tiene que saber qué hacer primero.
 */

export interface DatosPortal {
  aliado: {
    id: number;
    name: string;
    contactName: string | null;
    level: string;
    verified: boolean;
    docsStatus: string;
    coverage: string[];
    categories: string[];
    categoryLabels?: string[];
    joinedAt?: string | null;
    monthsInNetwork: number | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    address: string | null;
    responseMinutes: number | null;
  };
  porContestar: Array<{
    assignmentId: number;
    quoteNumber: string;
    category: string | null;
    address: string | null;
    site: string | null;
    detail: string | null;
    requirements: string[];
    offeredAt: string;
    total?: number | null;
  }>;
  enCurso: Array<{
    quoteNumber: string;
    category: string | null;
    state: string | null;
    stateLabel?: string;
    progress?: number;
    committedAt?: string | null;
    total?: number | null;
    site: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    requirements: string[];
  }>;
  equipos: Array<{
    id: number;
    name: string;
    state: string;
    location: string | null;
    diasSinConfirmar: number | null;
    confirmacion: string;
  }>;
  documentos: {
    estado: string;
    avisos: Array<{ documentId: number; kind: string; name: string | null; expiresAt: string; texto: string; urgencia: string }>;
    diasAviso: number;
    lista: Array<{ id: number; kind: string; kindLabel: string; name: string | null; expiresAt: string | null }>;
    tipos: Array<{ clave: string; label: string }>;
  };
  recientes?: Array<{
    quoteNumber: string;
    category: string | null;
    site: string | null;
    answer: string;
    reason: string | null;
    respondedAt: string | null;
    stateLabel: string;
    progress: number;
    total: number | null;
  }>;
  cumplimiento: {
    resumen: string;
    ofrecidos: number;
    aceptados: number;
    completados: number;
    cancelados: number;
    minutosRespuestaReal: number | null;
    minutosRespuestaDeclarado: number | null;
    confiable: boolean;
  };
}

/** Cómo contactar a MAQSER24 desde el portal (sale de Diseño → Contacto). */
export interface ContactoMaqser {
  phone: string | null;
  email: string | null;
  hours: string | null;
}

// ───────────────────────── estilos ─────────────────────────

const card: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg, 14px)',
  background: 'var(--color-surface)',
  padding: '18px 20px',
};
const btn: React.CSSProperties = {
  border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-fg)',
  borderRadius: 'var(--radius-button, 10px)', padding: '12px 20px', fontWeight: 700, fontSize: 15,
  cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
const btnSec: React.CSSProperties = {
  ...btn, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontWeight: 600,
};
/** 16px o más: por debajo de eso, iOS hace zoom al enfocar el campo. */
const campo: React.CSSProperties = {
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
  borderRadius: 'var(--radius-md, 10px)', padding: '11px 13px', fontSize: 16, fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
};
const etiqueta: React.CSSProperties = { fontSize: 13, color: 'var(--color-text-muted)' };
const muted: React.CSSProperties = { color: 'var(--color-text-muted)' };

const VERDE = 'var(--color-success)';
const AMBAR = 'var(--color-warning)';
const ROJO = 'var(--color-error)';
const AZUL = 'var(--color-primary)';

const dinero = (n: number | null | undefined) =>
  n ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : null;

function hace(iso: string | null | undefined): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

const fechaHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

/** Mañana a las 8:00, en el formato de un input datetime-local. */
function mananaOcho(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`;
}

const ESTADO_EQUIPO: Record<string, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: VERDE },
  limitada: { label: 'Disponible', color: VERDE },
  'por-confirmar': { label: 'Por confirmar', color: AMBAR },
  reservado: { label: 'Reservado', color: AZUL },
  'en-traslado': { label: 'En traslado', color: AZUL },
  'en-servicio': { label: 'En servicio', color: AZUL },
  mantenimiento: { label: 'Mantenimiento', color: AMBAR },
  inactivo: { label: 'Inactivo', color: ROJO },
  agotado: { label: 'Sin unidades', color: ROJO },
};

const ESTADO_DOCS: Record<string, { label: string; color: string }> = {
  'al-dia': { label: 'Al día', color: VERDE },
  'por-vencer': { label: 'Por vencer', color: AMBAR },
  vencido: { label: 'Vencido', color: ROJO },
  'sin-documentos': { label: 'Sin papeles', color: ROJO },
};

// ───────────────────────── piezas ─────────────────────────

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, borderRadius: 999, padding: '3px 10px',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {children}
    </span>
  );
}

function Titulo({ icono, children, extra }: { icono: IconName; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 12px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 17, fontWeight: 700, margin: 0 }}>
        <span style={{ color: AZUL, display: 'flex' }}><Icon name={icono} size={17} /></span>
        {children}
      </h2>
      {extra}
    </div>
  );
}

function Barra({ valor, color = AZUL }: { valor: number; color?: string }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'color-mix(in srgb, var(--color-text) 10%, transparent)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase', ...muted }}>{label}</div>
      <div style={{ fontSize: 14.5, marginTop: 3, wordBreak: 'break-word' }}>{valor || '—'}</div>
    </div>
  );
}

// ───────────────────────── portal ─────────────────────────

/**
 * No recibe token. La credencial del aliado vive en una cookie httpOnly que el
 * proxy adjunta; el JavaScript de esta pantalla nunca la ve.
 */
export function PortalAliado({ datos, contacto }: { datos: DatosPortal; contacto?: ContactoMaqser }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);
  const [editando, setEditando] = useState(false);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tipoDoc, setTipoDoc] = useState(datos.documentos.tipos[0]?.clave ?? '');
  /** Tarjeta abierta para aceptar (pide llegada) o rechazar (pide motivo). */
  const [respondiendo, setRespondiendo] = useState<{ id: number; modo: 'aceptar' | 'rechazar' } | null>(null);
  const [llegada, setLlegada] = useState(mananaOcho());
  const [motivo, setMotivo] = useState('');

  const { aliado, porContestar, enCurso, equipos, documentos, cumplimiento } = datos;
  const recientes = datos.recientes ?? [];
  const lineas = aliado.categoryLabels?.length ? aliado.categoryLabels : aliado.categories;
  const API = '/api/proxy';

  const avisar = (texto: string, ok = true) => setMsg({ texto, ok });

  async function llamar(url: string, body?: unknown) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      avisar(j?.message ?? 'No se pudo guardar. Intenta otra vez.', false);
      return false;
    }
    return true;
  }

  async function contestar(assignmentId: number, estado: 'aceptado' | 'rechazado') {
    if (estado === 'rechazado' && !motivo.trim()) {
      avisar('Cuéntanos por qué no puedes: nos sirve para no volver a ofrecerte lo mismo.', false);
      return;
    }
    setOcupado(assignmentId); setMsg(null);
    const ok = await llamar(`${API}/aliado/solicitudes/${assignmentId}`, {
      estado,
      ...(estado === 'rechazado' ? { motivo: motivo.trim() } : {}),
      ...(estado === 'aceptado' && llegada ? { llegada: new Date(llegada).toISOString() } : {}),
    });
    setOcupado(null);
    if (ok) {
      setRespondiendo(null); setMotivo(''); setLlegada(mananaOcho());
      avisar(estado === 'aceptado' ? 'Listo, quedó tuyo. Te mandamos los datos de la obra por correo.' : 'Gracias por avisarnos.');
      router.refresh();
    }
  }

  async function confirmar(productId: number) {
    setOcupado(productId); setMsg(null);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/confirmar`);
    setOcupado(null);
    if (ok) { avisar('Confirmado. Gracias.'); router.refresh(); }
  }

  async function moverEquipo(productId: number, actual: string | null) {
    const donde = window.prompt('¿Dónde está ahora?', actual ?? '');
    if (donde === null) return;
    setOcupado(productId); setMsg(null);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/ubicacion`, { location: donde });
    setOcupado(null);
    if (ok) { avisar('Ubicación actualizada.'); router.refresh(); }
  }

  async function guardarDatos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGuardando(true); setMsg(null);
    const ok = await llamar(`${API}/aliado/perfil`, {
      contactName: String(fd.get('contactName') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      email: String(fd.get('email') ?? ''),
      city: String(fd.get('city') ?? ''),
      address: String(fd.get('address') ?? ''),
      coverage: String(fd.get('coverage') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    setGuardando(false);
    if (ok) { avisar('Listo, tus datos quedaron actualizados.'); setEditando(false); router.refresh(); }
  }

  /** Va por FormData por la foto; el Content-Type NO se fija a mano (boundary). */
  async function subirDocumento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('kind', tipoDoc);
    setGuardando(true); setMsg(null);
    const r = await fetch(`${API}/aliado/documentos`, { method: 'POST', body: fd });
    setGuardando(false);
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      avisar(j?.message ?? 'No se pudo subir. Intenta otra vez.', false);
      return;
    }
    const d = await r.json();
    avisar(d?.estadoDocumentos === 'al-dia' ? 'Recibido. Tu expediente quedó al día.' : 'Recibido. Todavía tienes papeles por renovar.');
    setSubiendoDoc(false);
    form.reset();
    router.refresh();
  }

  // ── Para recibir trabajo: qué le falta, en orden ──
  const equiposConfirmados = equipos.filter((e) => e.diasSinConfirmar !== null && e.diasSinConfirmar <= 14).length;
  const pasos: Array<{ hecho: boolean; texto: string; ayuda: string }> = [
    { hecho: Boolean(aliado.phone && aliado.email && aliado.coverage.length), texto: 'Tus datos y tu cobertura', ayuda: 'Teléfono, correo y los municipios a los que llegas.' },
    { hecho: documentos.lista.length > 0, texto: 'Entregar tus papeles', ayuda: 'Póliza de seguro, constancia fiscal y DC-3 de tus operadores.' },
    { hecho: aliado.verified, texto: 'Sello de verificado', ayuda: 'Lo da MAQSER24 al revisar tus papeles vigentes.' },
    { hecho: equipos.length > 0, texto: 'Equipos asignados', ayuda: 'MAQSER24 registra tus máquinas a tu nombre.' },
    { hecho: equipos.length > 0 && equiposConfirmados === equipos.length, texto: 'Disponibilidad confirmada', ayuda: 'Toca "Sigue libre" en cada equipo al menos cada 14 días.' },
  ];
  const listos = pasos.filter((p) => p.hecho).length;
  const docs = ESTADO_DOCS[documentos.estado] ?? { label: documentos.estado, color: AMBAR };
  const iniciales = aliado.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  const kpis: Array<{ n: number | string; label: string; color: string; icono: IconName; ancla: string }> = [
    { n: porContestar.length, label: 'Por contestar', color: porContestar.length ? AZUL : 'var(--color-text-muted)', icono: 'bell', ancla: '#solicitudes' },
    { n: enCurso.length, label: 'En curso', color: enCurso.length ? VERDE : 'var(--color-text-muted)', icono: 'truck', ancla: '#en-curso' },
    { n: equipos.length, label: 'Equipos', color: 'var(--color-text)', icono: 'box', ancla: '#equipos' },
    { n: docs.label, label: 'Papeles', color: docs.color, icono: 'shield', ancla: '#papeles' },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px clamp(14px, 2.5vw, 24px) 56px' }}>
      {/* Escritorio: dos columnas, lo accionable a la izquierda (solicitudes,
          lo que trae, equipos) y la consulta a la derecha (papeles, cómo va,
          sus datos). En tableta y teléfono, una sola columna en ese orden. */}
      <style>{`
        .pa-kpis{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .pa-dos{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .pa-cols{ display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:22px; align-items:start; }
        .pa-side .pa-dos{ grid-template-columns:1fr; }
        .pa-kpi:hover{ border-color: var(--color-primary) !important; }
        @media (max-width: 980px){
          .pa-cols{ grid-template-columns:1fr; }
        }
        @media (max-width: 720px){
          .pa-kpis{ grid-template-columns:repeat(2,minmax(0,1fr)); }
          .pa-dos{ grid-template-columns:1fr; }
        }
      `}</style>

      {/* ── Encabezado ── */}
      <header style={{ ...card, padding: '22px 22px', marginBottom: 16, background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)), var(--color-surface) 60%)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, display: 'grid', placeItems: 'center', background: AZUL, color: 'var(--color-primary-fg)', fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
            {iniciales || 'A'}
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', ...muted }}>Panel de aliado · MAQSER24</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px, 5vw, 32px)', margin: '4px 0 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {aliado.name}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {aliado.verified ? <Chip color={VERDE}>Verificado</Chip> : <Chip color={AMBAR}>Sin sello</Chip>}
              <Chip color={AZUL}>Nivel {aliado.level}</Chip>
              {aliado.monthsInNetwork !== null ? (
                <Chip color="var(--color-text-muted)">
                  {aliado.monthsInNetwork === 0 ? 'Nuevo en la red' : `${aliado.monthsInNetwork} ${aliado.monthsInNetwork === 1 ? 'mes' : 'meses'} en la red`}
                </Chip>
              ) : null}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 16, fontSize: 13.5, ...muted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="mapPin" size={14} />{aliado.coverage.length ? aliado.coverage.join(', ') : 'Sin zonas registradas'}
          </span>
          {lineas.length ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="grid" size={14} />{lineas.join(' · ')}</span>
          ) : null}
        </div>
      </header>

      {msg ? (
        <div role="status" style={{ ...card, marginBottom: 16, borderColor: msg.ok ? VERDE : ROJO, fontSize: 14.5, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: msg.ok ? VERDE : ROJO, display: 'flex', marginTop: 1 }}><Icon name={msg.ok ? 'check' : 'warning'} size={16} /></span>
          {msg.texto}
        </div>
      ) : null}

      {/* ── Resumen ── */}
      <nav className="pa-kpis" style={{ marginBottom: 22 }} aria-label="Resumen">
        {kpis.map((k) => (
          <a key={k.label} href={k.ancla} className="pa-kpi" style={{ ...card, padding: '14px 16px', textDecoration: 'none', color: 'inherit', transition: 'border-color .15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...muted, fontSize: 12.5 }}>
              {k.label}<Icon name={k.icono} size={15} />
            </div>
            <div style={{ fontSize: typeof k.n === 'number' ? 28 : 18, fontWeight: 800, marginTop: 6, color: k.color, lineHeight: 1.1 }}>{k.n}</div>
          </a>
        ))}
      </nav>

      <div className="pa-cols">
      <div className="pa-main">

      {/* ── Para recibir trabajo ── */}
      {listos < pasos.length ? (
        <section style={{ ...card, marginBottom: 26 }}>
          <Titulo icono="check" extra={<span style={{ fontSize: 13, ...muted }}>{listos} de {pasos.length}</span>}>
            Para empezar a recibir trabajo
          </Titulo>
          <Barra valor={listos / pasos.length} color={VERDE} />
          <ol style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 10 }}>
            {pasos.map((p) => (
              <li key={p.texto} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', marginTop: 1,
                    background: p.hecho ? VERDE : 'transparent', color: 'var(--color-bg)',
                    border: p.hecho ? 'none' : '1.5px solid var(--color-border)',
                  }}
                >
                  {p.hecho ? <Icon name="check" size={13} /> : null}
                </span>
                <span>
                  <span style={{ fontSize: 14.5, fontWeight: 600, ...(p.hecho ? { textDecoration: 'line-through', ...muted } : {}) }}>{p.texto}</span>
                  {!p.hecho ? <span style={{ display: 'block', fontSize: 13, ...muted, marginTop: 2 }}>{p.ayuda}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ── Solicitudes por contestar ── */}
      <section id="solicitudes" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
        <Titulo icono="bell">
          {porContestar.length > 0
            ? `${porContestar.length} solicitud${porContestar.length === 1 ? '' : 'es'} esperando tu respuesta`
            : 'Solicitudes de trabajo'}
        </Titulo>

        {porContestar.length === 0 ? (
          <div style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: AZUL, flexShrink: 0 }}>
              <Icon name="bell" size={19} />
            </span>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>
              <strong>Nada pendiente por ahora.</strong>
              <span style={{ display: 'block', ...muted }}>Cuando un cliente pida uno de tus equipos, aparece aquí y te avisamos por correo al instante.</span>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 14 }}>
          {porContestar.map((s) => {
            const abierta = respondiendo?.id === s.assignmentId ? respondiendo.modo : null;
            return (
              <article key={s.assignmentId} style={{ ...card, borderColor: AZUL, boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-primary) 25%, transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip color={AZUL}>Nueva</Chip>
                      <span style={{ fontSize: 12.5, ...muted }}>{hace(s.offeredAt)} · Folio {s.quoteNumber}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>{s.category ?? 'Servicio'}</div>
                  </div>
                  {dinero(s.total) ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase', ...muted }}>Importe</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{dinero(s.total)}</div>
                    </div>
                  ) : null}
                </div>

                <div className="pa-dos" style={{ marginTop: 14 }}>
                  <Dato label="Obra" valor={s.site} />
                  <Dato label="Dirección" valor={s.address ?? 'Por confirmar'} />
                </div>

                {s.detail ? (
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--color-bg)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {s.detail}
                  </div>
                ) : null}

                {s.requirements.length > 0 ? (
                  <div style={{ marginTop: 12, padding: '10px 12px', border: `1px solid color-mix(in srgb, ${AMBAR} 40%, transparent)`, borderRadius: 10, fontSize: 13.5, display: 'flex', gap: 8 }}>
                    <span style={{ color: AMBAR, display: 'flex', marginTop: 1 }}><Icon name="warning" size={15} /></span>
                    <span><strong>Esta obra exige:</strong> {s.requirements.join(' · ')}</span>
                  </div>
                ) : null}

                {abierta === 'aceptar' ? (
                  <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={etiqueta}>¿Cuándo llegas a la obra?</span>
                      <input type="datetime-local" value={llegada} onChange={(e) => setLlegada(e.target.value)} style={campo} />
                    </label>
                    <p style={{ margin: 0, fontSize: 12.5, ...muted }}>Es tu compromiso con el cliente y contra él medimos tu puntualidad.</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...btn, flex: '1 1 160px', opacity: ocupado === s.assignmentId ? 0.6 : 1 }} disabled={ocupado === s.assignmentId} onClick={() => contestar(s.assignmentId, 'aceptado')}>
                        <Icon name="check" size={16} />Confirmar que lo tomo
                      </button>
                      <button type="button" style={{ ...btnSec, flex: '0 1 auto' }} onClick={() => setRespondiendo(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : abierta === 'rechazar' ? (
                  <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={etiqueta}>¿Por qué no puedes tomarlo?</span>
                      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="La máquina está en otra obra, no llego a esa zona…" style={{ ...campo, resize: 'vertical' }} />
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...btn, flex: '1 1 160px', background: 'var(--color-text)', color: 'var(--color-bg)', opacity: ocupado === s.assignmentId ? 0.6 : 1 }} disabled={ocupado === s.assignmentId} onClick={() => contestar(s.assignmentId, 'rechazado')}>
                        Enviar respuesta
                      </button>
                      <button type="button" style={{ ...btnSec, flex: '0 1 auto' }} onClick={() => setRespondiendo(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    <button type="button" style={{ ...btn, flex: '1 1 150px' }} onClick={() => { setRespondiendo({ id: s.assignmentId, modo: 'aceptar' }); setMsg(null); }}>
                      <Icon name="check" size={16} />Sí puedo
                    </button>
                    <button type="button" style={{ ...btnSec, flex: '1 1 150px' }} onClick={() => { setRespondiendo({ id: s.assignmentId, modo: 'rechazar' }); setMotivo(''); setMsg(null); }}>
                      No puedo
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── En curso ── */}
      {enCurso.length > 0 ? (
        <section id="en-curso" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
          <Titulo icono="truck">Lo que traes ahora</Titulo>
          <div style={{ display: 'grid', gap: 12 }}>
            {enCurso.map((s) => (
              <article key={s.quoteNumber} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{s.site ?? s.category ?? 'Servicio'}</div>
                    <div style={{ fontSize: 12.5, ...muted, marginTop: 2 }}>
                      {s.category ?? ''}{s.category ? ' · ' : ''}Folio {s.quoteNumber}{dinero(s.total) ? ` · ${dinero(s.total)}` : ''}
                    </div>
                  </div>
                  <Chip color={AZUL}>{s.stateLabel ?? 'Asignado'}</Chip>
                </div>
                <div style={{ marginTop: 12 }}><Barra valor={s.progress ?? 0} /></div>
                <div className="pa-dos" style={{ marginTop: 14 }}>
                  <Dato label="Llegada comprometida" valor={fechaHora(s.committedAt)} />
                  <Dato label="Dirección" valor={s.address} />
                  <Dato label="Quién te recibe" valor={s.contactName} />
                  <Dato
                    label="Teléfono en obra"
                    valor={s.contactPhone ? <a href={`tel:${s.contactPhone}`} style={{ color: AZUL }}>{s.contactPhone}</a> : null}
                  />
                </div>
                {s.requirements.length > 0 ? (
                  <div style={{ marginTop: 12, fontSize: 13, color: AMBAR, display: 'flex', gap: 6 }}>
                    <Icon name="warning" size={14} />Exige: {s.requirements.join(' · ')}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Equipos ── */}
      <section id="equipos" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
        <Titulo icono="box">Tus equipos</Titulo>
        {equipos.length === 0 ? (
          <div style={{ ...card, fontSize: 14, lineHeight: 1.6, ...muted }}>
            Todavía no hay máquinas registradas a tu nombre. MAQSER24 las da de alta con los datos que nos
            compartas; en cuanto estén, aparecen aquí para que confirmes si siguen libres.
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, ...muted, lineHeight: 1.6 }}>
              Si confirmas seguido, te llegan más solicitudes: solo proponemos lo que sabemos que está libre.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {equipos.map((e) => {
                const viejo = e.diasSinConfirmar === null || e.diasSinConfirmar > 14;
                const est = ESTADO_EQUIPO[e.state] ?? { label: e.state, color: AMBAR };
                return (
                  <div key={e.id} style={{ ...card, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{e.name}</span>
                          <Chip color={est.color}>{est.label}</Chip>
                        </div>
                        <div style={{ fontSize: 12.5, marginTop: 5, display: 'flex', gap: 14, flexWrap: 'wrap', color: viejo ? AMBAR : 'var(--color-text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={13} />{e.confirmacion}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text-muted)' }}><Icon name="mapPin" size={13} />{e.location || 'Sin ubicación'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" style={{ ...btnSec, padding: '9px 14px', fontSize: 13.5 }} onClick={() => moverEquipo(e.id, e.location)} disabled={ocupado === e.id}>
                          Dónde está
                        </button>
                        <button type="button" style={{ ...btn, padding: '9px 14px', fontSize: 13.5, opacity: ocupado === e.id ? 0.6 : 1 }} onClick={() => confirmar(e.id)} disabled={ocupado === e.id}>
                          Sigue libre
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Cómo vas + historial ── */}
      <section style={{ marginBottom: 28 }}>
        <Titulo icono="star">Cómo vas con nosotros</Titulo>
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{cumplimiento.resumen}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginTop: 16 }}>
            {([
              ['Te ofrecimos', cumplimiento.ofrecidos, 'var(--color-text)'],
              ['Aceptaste', cumplimiento.aceptados, AZUL],
              ['Completaste', cumplimiento.completados, VERDE],
              ['Cancelaste', cumplimiento.cancelados, cumplimiento.cancelados ? ROJO : 'var(--color-text)'],
            ] as const).map(([t, n, c]) => (
              <div key={t} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-bg)' }}>
                <div style={{ fontSize: 12, ...muted }}>{t}</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2, color: c }}>{n}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13, ...muted, lineHeight: 1.6 }}>
            {cumplimiento.minutosRespuestaReal !== null
              ? `Contestas en ~${cumplimiento.minutosRespuestaReal} min${cumplimiento.minutosRespuestaDeclarado !== null ? ` (tenemos anotado ${cumplimiento.minutosRespuestaDeclarado})` : ''}. `
              : ''}
            Entre más rápido contestes y más puntual llegues, más arriba apareces cuando buscamos a quién ofrecerle.
          </p>
        </div>

        {recientes.length > 0 ? (
          <div style={{ ...card, marginTop: 12, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', ...muted }}>Tus últimos trabajos</div>
            {recientes.map((r) => {
              const acepto = r.answer === 'aceptado';
              return (
                <div key={`${r.quoteNumber}-${r.respondedAt}`} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', padding: '12px 20px', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.site ?? r.category ?? 'Servicio'}</div>
                    <div style={{ fontSize: 12.5, ...muted }}>
                      Folio {r.quoteNumber}{r.respondedAt ? ` · ${hace(r.respondedAt)}` : ''}{!acepto && r.reason ? ` · “${r.reason}”` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {acepto && dinero(r.total) ? <span style={{ fontSize: 13.5, fontWeight: 700 }}>{dinero(r.total)}</span> : null}
                    <Chip color={acepto ? (r.stateLabel === 'Cerrado' ? VERDE : AZUL) : 'var(--color-text-muted)'}>
                      {acepto ? r.stateLabel : r.answer === 'retirado' ? 'Te retiraste' : 'No lo tomaste'}
                    </Chip>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      </div>

      <aside className="pa-side">

      {/* ── Papeles ── */}
      <section id="papeles" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
        <Titulo icono="shield" extra={<Chip color={docs.color}>{docs.label}</Chip>}>Tus papeles</Titulo>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, ...muted, lineHeight: 1.6 }}>
          Con tus papeles vigentes obtienes el sello de verificado y sales primero en las propuestas. Si uno
          vence, pierdes el sello; sube el renovado aquí y vuelve solo.
        </p>

        {documentos.avisos.length > 0 ? (
          <div style={{ ...card, display: 'grid', gap: 8, marginBottom: 12, borderColor: AMBAR }}>
            {documentos.avisos.map((d) => (
              <div key={d.documentId} style={{ fontSize: 13.5, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip color={d.urgencia === 'vencido' ? ROJO : AMBAR}>{d.texto}</Chip>
                <span>{d.name || d.kind}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ ...card, display: 'grid', gap: 0, padding: 0, overflow: 'hidden' }}>
          {documentos.lista.length === 0 ? (
            <div style={{ padding: '16px 20px', fontSize: 14, ...muted, lineHeight: 1.6 }}>
              Todavía no tienes papeles entregados. Empieza por la <strong style={{ color: 'var(--color-text)' }}>póliza de seguro</strong> y la{' '}
              <strong style={{ color: 'var(--color-text)' }}>constancia de situación fiscal</strong>.
            </div>
          ) : (
            documentos.lista.map((d, i) => {
              const vencido = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59`) < new Date() : false;
              return (
                <div key={d.id} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', padding: '13px 20px', borderTop: i ? '1px solid var(--color-border)' : 'none' }}>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: vencido ? ROJO : VERDE, display: 'flex' }}><Icon name={vencido ? 'warning' : 'check'} size={15} /></span>
                    <span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{d.kindLabel}</span>
                      {d.name && d.name !== d.kindLabel ? <span style={{ display: 'block', fontSize: 12.5, ...muted }}>{d.name}</span> : null}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: vencido ? ROJO : 'var(--color-text-muted)' }}>
                    {d.expiresAt ? `${vencido ? 'Venció' : 'Vence'} ${d.expiresAt}` : 'Sin vencimiento'}
                  </span>
                </div>
              );
            })
          )}

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)' }}>
            {!subiendoDoc ? (
              <button type="button" style={{ ...btnSec, width: '100%' }} onClick={() => setSubiendoDoc(true)}>
                Subir o renovar un papel
              </button>
            ) : (
              <form onSubmit={subirDocumento} style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={etiqueta}>¿Qué papel es?</span>
                  <ShSelect value={tipoDoc} onValueChange={setTipoDoc}>
                    <ShSelectTrigger aria-label="Tipo de papel"><ShSelectValue /></ShSelectTrigger>
                    <ShSelectContent>
                      {documentos.tipos.map((t) => <ShSelectItem key={t.clave} value={t.clave}>{t.label}</ShSelectItem>)}
                    </ShSelectContent>
                  </ShSelect>
                </label>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={etiqueta}>¿Hasta cuándo vale? Si no vence, déjalo vacío.</span>
                  <input type="date" name="expiresAt" style={campo} />
                </label>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={etiqueta}>Foto del documento</span>
                  {/* Foto y no archivo: en obra se le toma foto a la póliza. */}
                  <input type="file" name="file" accept="image/*" style={campo} />
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="submit" style={{ ...btn, opacity: guardando ? 0.6 : 1 }} disabled={guardando}>
                    {guardando ? 'Subiendo…' : 'Subir'}
                  </button>
                  <button type="button" style={btnSec} onClick={() => setSubiendoDoc(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Datos + contacto ── */}
      <div className="pa-dos" style={{ alignItems: 'start', gap: 28 }}>
        <section>
          <Titulo icono="user">Tus datos</Titulo>
          <div style={card}>
            {!editando ? (
              <>
                <div style={{ display: 'grid', gap: 12 }}>
                  <Dato label="Contacto" valor={aliado.contactName} />
                  <Dato label="Teléfono" valor={aliado.phone} />
                  <Dato label="Correo" valor={aliado.email} />
                  <Dato label="Ciudad" valor={aliado.city} />
                  <Dato label="Zonas que cubres" valor={aliado.coverage.join(', ')} />
                </div>
                <button type="button" style={{ ...btnSec, marginTop: 16, width: '100%' }} onClick={() => setEditando(true)}>
                  Corregir mis datos
                </button>
              </>
            ) : (
              <form onSubmit={guardarDatos} style={{ display: 'grid', gap: 12 }}>
                {([
                  ['contactName', 'Nombre de quien contesta', aliado.contactName, 'text'],
                  ['phone', 'Teléfono', aliado.phone, 'tel'],
                  ['email', 'Correo', aliado.email, 'email'],
                  ['city', 'Ciudad', aliado.city, 'text'],
                  ['address', 'Dirección de tu base', aliado.address, 'text'],
                ] as const).map(([name, label, valor, tipo]) => (
                  <label key={name} style={{ display: 'grid', gap: 5 }}>
                    <span style={etiqueta}>{label}</span>
                    <input name={name} type={tipo} defaultValue={valor ?? ''} style={campo} />
                  </label>
                ))}
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={etiqueta}>Zonas que cubres, separadas por coma</span>
                  <input name="coverage" defaultValue={aliado.coverage.join(', ')} placeholder="Apodaca, Escobedo, García" style={campo} />
                </label>
                <p style={{ margin: 0, fontSize: 12.5, ...muted, lineHeight: 1.55 }}>
                  Para cambiar las líneas de servicio que atiendes, escríbenos: eso lo revisamos con tu expediente.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="submit" style={{ ...btn, opacity: guardando ? 0.6 : 1 }} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" style={btnSec} onClick={() => setEditando(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section>
          <Titulo icono="chat">¿Dudas? Estamos para ayudarte</Titulo>
          <div style={{ ...card, display: 'grid', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, ...muted }}>
              Para registrar un equipo nuevo, cambiar tus líneas de servicio o aclarar una solicitud, contacta a MAQSER24.
            </p>
            {contacto?.phone ? (
              <a href={`tel:${contacto.phone.replace(/\s+/g, '')}`} style={{ ...btn, textDecoration: 'none' }}>
                <Icon name="phone" size={16} />{contacto.phone}
              </a>
            ) : null}
            {contacto?.email ? (
              <a href={`mailto:${contacto.email}`} style={{ ...btnSec, textDecoration: 'none' }}>
                <Icon name="mail" size={16} />{contacto.email}
              </a>
            ) : null}
            {contacto?.hours ? (
              <div style={{ fontSize: 13, ...muted, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="clock" size={14} />{contacto.hours}</div>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, ...muted, lineHeight: 1.55 }}>
              Este enlace es personal: no lo compartas. Quien lo tenga entra como tú.
            </p>
          </div>
        </section>
      </div>

      </aside>
      </div>
    </div>
  );
}
