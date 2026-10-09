'use client';

import { Fragment, useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ESTADOS_OPERACION, ESTADO_SOLICITUD_PROVEEDOR, centroDeMunicipio, coordenadasDe, esLineaServicio, radioDeCobertura } from '@maqserv/config';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import {
  Btn, btnClass, Chip, EmptyState, FormField, IconBtn, Note, PageHeader, Panel, SearchBox, Stat, Stats, StatusText, Thumb, Toolbar,
  type Tone,
} from '@/components/ui';
import { DocumentAlerts } from './DocumentAlerts';
import { SolicitudesProveedor } from './SolicitudesProveedor';
import { ProviderHistory } from './ProviderHistory';
import { MapaCobertura, type PuntoMapa } from './MapaCobertura';
import { QueOfrece, categoriasDelTipo, faltaEnOferta, tipoDeCategorias, type TipoOferta } from './QueOfrece';
import { CostosReferencia, DescargarExcelProveedores } from './CostosReferencia';
import { avisar, confirmar } from '@/components/Dialogos';

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
  /** Equipos que ofreció desde su portal y esperan revisión. */
  pendingCount?: number;
  /** Nombres legibles de sus líneas de servicio. */
  categoryLabels?: string[];
  /** Lo que ofrece: sus máquinas del catálogo. */
  equipment?: EquipoRow[];
}

interface EquipoRow {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  /** Slug de su línea: decide qué renglones del cotizador se le ofrecen. */
  categorySlug?: string | null;
  rental: boolean;
  specs: Array<{ label: string; valor: string }>;
  image: string | null;
  availability: string;
  location: string | null;
  confirmedAt: string | null;
  /** Lo ofreció el aliado desde su portal y espera revisión. */
  pending?: boolean;
}

/** Un renglón del tabulador de un cotizador (ver `renglonesDe`). */
interface Renglon {
  tipo: string;
  id: string;
  nombre: string;
  linea: string;
  productos: number[];
}

/** Cómo se lee la disponibilidad de un equipo en una línea. */
const DISP: Record<string, { texto: string; tono: Tone }> = {
  disponible: { texto: 'Disponible', tono: 'ok' },
  limitada: { texto: 'Disponible', tono: 'ok' },
  'por-confirmar': { texto: 'Por confirmar', tono: 'warn' },
  reservado: { texto: 'Reservado', tono: 'info' },
  'en-traslado': { texto: 'En traslado', tono: 'info' },
  'en-servicio': { texto: 'En servicio', tono: 'info' },
  mantenimiento: { texto: 'Mantenimiento', tono: 'warn' },
  inactivo: { texto: 'Inactivo', tono: 'bad' },
};

interface DocRow {
  id: number;
  kind: string;
  name: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  /** Foto del papel que subió el aliado (null si lo registró la oficina sin foto). */
  fileUrl?: string | null;
}

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

/* Piezas de texto del expediente: cada bloque es una sección separada por una
   línea fina, no una caja dentro de otra caja. */
const SECCION: CSSProperties = { borderTop: '1px solid var(--adm-border)', marginTop: 24, paddingTop: 20 };
const H3: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--adm-text)' };
const DESC: CSSProperties = { margin: '4px 0 14px', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.6 };
const VACIO: CSSProperties = { margin: 0, fontSize: 13, color: 'var(--adm-faint)', lineHeight: 1.6 };
const AVISO: CSSProperties = { fontSize: 13, color: 'var(--adm-text-2)', lineHeight: 1.5 };

/** Aliado | Documentos | Nivel | Expediente. */
const GRID = 'minmax(0,1fr) 128px 150px 132px';

/**
 * Lo que ofrece, separado: servicios (las líneas) y productos (cualquier otra
 * categoría). `categoryLabels` viene en el mismo orden que `categories`.
 */
function ChipsOferta({ p }: { p: ProviderRow }) {
  const pares = p.categories.map((slug, i) => ({ slug, nombre: p.categoryLabels?.[i] ?? slug }));
  const servicios = pares.filter((x) => esLineaServicio(x.slug));
  const productos = pares.filter((x) => !esLineaServicio(x.slug));
  if (pares.length === 0) return <span style={{ fontSize: 12.5, color: 'var(--adm-bad)' }}>Sin servicios ni productos marcados</span>;
  const grupo = (titulo: string, xs: typeof pares) =>
    xs.length ? (
      <>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--adm-faint)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{titulo}</span>
        {xs.map((x) => <Chip key={x.slug}>{x.nombre}</Chip>)}
      </>
    ) : null;
  return <>{grupo('Servicios', servicios)}{grupo('Productos', productos)}</>;
}

const ETIQUETA_DOCS: Record<ProviderRow['docsStatus'], { texto: string; tono: Tone }> = {
  'al-dia': { texto: 'Al día', tono: 'ok' },
  'por-vencer': { texto: 'Por vencer', tono: 'warn' },
  vencido: { texto: 'Vencido', tono: 'bad' },
  'sin-documentos': { texto: 'Sin documentos', tono: 'muted' },
};

/** Convierte "Apodaca, Escobedo , García" en tres municipios limpios. */
const aLista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

/**
 * HASTA DÓNDE LLEGA, MIENTRAS SE ESCRIBE (2026-10-09). Los km ya no se
 * capturan: salen de su municipio y de los que cubre, con la misma cuenta que
 * hace la API al guardar (`radioDeCobertura`). Aquí se mide desde el centro
 * de su municipio; al guardar, desde su dirección exacta, así que la cifra
 * final puede moverse unos km.
 */
function KmCalculados({ municipio, estado, cobertura }: { municipio: string; estado: string; cobertura: string }) {
  const lista = aLista(cobertura);
  const base = municipio.trim() ? centroDeMunicipio(municipio, estado) : null;
  const r = base && lista.length ? radioDeCobertura(base, lista, estado) : null;
  let texto: ReactNode;
  if (!municipio.trim()) texto = 'Escribe su municipio y los que cubre: con eso se calcula hasta cuántos km llega.';
  else if (!base) texto = `No reconozco «${municipio.trim()}» como municipio. Al guardar se buscará con su dirección.`;
  else if (!lista.length) texto = 'Agrega los municipios que cubre para calcular hasta cuántos km llega.';
  else if (r?.km) texto = <>Llega hasta <b className="adm-num" style={{ color: 'var(--adm-text)' }}>~{r.km} km</b> de su base · el más lejano es {r.masLejano}.</>;
  else texto = 'Ninguno de esos municipios está en la lista conocida: se buscarán al guardar.';
  return (
    <div className="adm-help" style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5 }}>
      <i className="ph ph-ruler" aria-hidden style={{ fontSize: 15, marginTop: 1 }} />
      <span>
        {texto}
        {r?.sinUbicar.length ? <> No reconozco: {r.sinUbicar.join(', ')} (se buscarán al guardar).</> : null}
      </span>
    </div>
  );
}

/** Une datos sueltos con " · " (los vacíos no dejan separadores colgando). */
function conPuntos(xs: Array<ReactNode | null | false | undefined>) {
  return xs.filter(Boolean).map((x, i) => (
    <Fragment key={i}>
      {i > 0 ? <span style={{ color: 'var(--adm-faint)' }}> · </span> : null}
      {x}
    </Fragment>
  ));
}

export function ProvidersManager({ initial }: { initial: ProviderRow[] }) {
  const [todos, setProvs] = useState(initial);
  // Las solicitudes del sitio (status 2) van aparte: todavía no son de la red.
  const provs = useMemo(() => todos.filter((p) => p.status !== ESTADO_SOLICITUD_PROVEEDOR), [todos]);
  const solicitudes = useMemo(() => todos.filter((p) => p.status === ESTADO_SOLICITUD_PROVEEDOR), [todos]);
  const [query, setQuery] = useState('');
  const [creando, setCreando] = useState(false);
  /** Mandarle su invitación al darlo de alta (solo si la ficha trae correo). */
  const [invitar, setInvitar] = useState(true);
  const [expediente, setExpediente] = useState<ProviderRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', level: 'registrado', contactName: '', phone: '', email: '',
    address: '', city: '', state: 'Nuevo León', coverage: '', categories: [] as string[], responseMinutes: '',
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

  // Un clic = un alta (2026-09-25): el botón se bloquea mientras se guarda.
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  /** Servicios, productos o ambos: decide qué podrá ofrecer desde su portal. */
  const [tipoOferta, setTipoOferta] = useState<TipoOferta>('servicios');
  async function crear() {
    if (guardando) return;
    if (form.name.trim().length < 2) { setErrorAlta('El nombre es obligatorio'); return; }
    const falta = faltaEnOferta(form.categories, tipoOferta);
    if (falta) { setErrorAlta(falta); return; }
    setGuardando(true); setErrorAlta(null);
    const r = await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        level: form.level,
        contactName: form.contactName || null,
        phone: form.phone || null,
        email: form.email || null,
        // Con dirección y municipio la API lo ubica y le calcula sus km.
        address: form.address.trim() || null,
        city: form.city || null,
        state: form.state || null,
        coverage: aLista(form.coverage),
        categories: categoriasDelTipo(form.categories, tipoOferta),
        responseMinutes: form.responseMinutes ? Number(form.responseMinutes) : null,
        // La invitación sale con el alta si hay correo (ver la API).
        enviarAcceso: invitar,
      }),
    });
    const d = await r.json().catch(() => null);
    setGuardando(false);
    if (!r.ok) { setErrorAlta(typeof d?.message === 'string' ? d.message : 'No se pudo guardar'); return; }
    const conCorreo = Boolean(form.email);
    setCreando(false);
    setForm({ name: '', level: 'registrado', contactName: '', phone: '', email: '', address: '', city: '', state: 'Nuevo León', coverage: '', categories: [], responseMinutes: '' });
    setInvitar(true);
    setTipoOferta('servicios');
    const invitacion = d?.acceso
      ? d.acceso.mensaje
      : conCorreo
        ? 'Sin invitación: mándale su enlace desde su expediente cuando quieras.'
        : 'No tiene correo: agrégaselo para mandarle su enlace.';
    setMsg(['Aliado dado de alta.', invitacion, d?.ubicacion?.mensaje].filter(Boolean).join(' '));
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
    <div>
      <style>{`
        .pv-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        .pv-c-act { display: flex; justify-content: flex-end; }
        .pv-m-label { display: none; }
        /* En móvil cada aliado pasa a bloque: nombre y datos arriba; documentos,
           nivel y expediente en una línea debajo. */
        @media (max-width: 900px) {
          .pv-thead { display: none !important; }
          .pv-row { display: flex; flex-wrap: wrap; gap: 10px 14px; }
          .pv-row > .pv-c-name { flex: 1 1 100%; }
          .pv-row > .pv-c-level { width: 150px; }
          .pv-row > .pv-c-act { margin-left: auto; }
          .pv-m-label { display: inline; margin-right: 6px; font-size: 12.5px; color: var(--adm-faint); }
        }
      `}</style>

      <PageHeader
        eyebrow={['Red y oferta', 'Proveedores']}
        title="Red de aliados"
        subtitle={
          <>
            Proveedores que aportan capacidad: su expediente, papeles, cobertura y lo que te cobran (antes el CRM).
            El sello de verificado no se pone a mano: sale del nivel y de que sus documentos estén vigentes.
          </>
        }
        actions={
          <>
            <DescargarExcelProveedores />
            <Btn variant="primary" icon="ph-plus" onClick={() => setCreando(true)}>Nuevo aliado</Btn>
          </>
        }
      />

      {/* Resumen: lo primero que importa es a quién se le vencieron los papeles. */}
      <Stats>
        <Stat label="Aliados" icon="ph-handshake" tone="accent" value={provs.length} />
        <Stat label="Con sello" icon="ph-seal-check" tone="ok" value={conSello} hint={`de ${provs.length}`} />
        <Stat label="Por vencer" icon="ph-clock-countdown" tone={porVencer > 0 ? 'warn' : 'muted'} value={porVencer} />
        <Stat
          label="Vencidos"
          icon="ph-warning-circle"
          tone={conVencidos > 0 ? 'bad' : 'muted'}
          valueTone={conVencidos > 0 ? 'bad' : undefined}
          value={conVencidos}
          hint={conVencidos > 0 ? 'pierden el sello' : undefined}
        />
      </Stats>

      {/*
        DONDE ESTA LA RED (documento institucional, 17).
        Un mapa contesta de un vistazo lo que una lista de municipios no: si
        hay un hueco geografico, y de que tamano.
      */}
      {provs.some((x) => x.lat != null && x.lng != null) ? (
        <div style={{ marginBottom: 28 }}>
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
                detalle: (x.categoryLabels ?? x.categories).join(', '),
              }))}
          />
          <p className="adm-help" style={{ margin: '8px 0 0' }}>
            El círculo es hasta donde llega cada aliado, calculado con los municipios que cubre.
            Los que no aparecen no tienen dirección ni municipio: complétalos en su expediente.
          </p>
        </div>
      ) : null}

      {/*
        Los contadores de arriba dicen CUANTOS. Esto dice que papel, de quien y
        para cuando — lo unico con lo que se puede levantar el telefono.
      */}
      <SolicitudesProveedor solicitudes={solicitudes} onCambio={(m) => { setMsg(m); void recargar(); }} />

      <DocumentAlerts
        onIr={(id) => {
          const prov = provs.find((x) => x.id === id);
          if (prov) abrirExpediente(prov);
        }}
      />

      {msg ? <Note style={{ marginBottom: 16 }}>{msg}</Note> : null}

      {/* Alta en modal (2026-09-25): antes el formulario empujaba la lista hacia abajo. */}
      <Modal
        abierto={creando}
        titulo="Nuevo aliado"
        subtitulo="Con correo, al darlo de alta le llega su invitación al portal."
        onCerrar={() => { setCreando(false); setErrorAlta(null); }}
        ancho={860}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setCreando(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={crear} disabled={guardando}>{guardando ? 'Dando de alta…' : 'Dar de alta'}</Btn>
          </>
        }
      >
        {errorAlta ? <div role="alert" style={{ marginBottom: 16 }}><Note tone="bad">{errorAlta}</Note></div> : null}
        <div className="adm-form-grid">
          <FormField label="Nombre del aliado *">
            <input className="adm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Persona que responde">
            <input className="adm-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </FormField>
          <FormField label="Teléfono">
            <input className="adm-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <FormField label="Correo">
            <input className="adm-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          {/* Los AdminSelect no van dentro de <label>: es un botón de Radix y el
              clic en la etiqueta lo abriría dos veces. */}
          <div className="adm-field">
            <span className="adm-label">Nivel</span>
            <AdminSelect ariaLabel="Nivel" value={form.level} onChange={(v) => setForm({ ...form, level: v })} options={NIVELES.map((n) => ({ value: n, label: n }))} />
          </div>
          <FormField label="Respuesta promedio (minutos)">
            <input className="adm-input adm-num" type="number" value={form.responseMinutes} onChange={(e) => setForm({ ...form, responseMinutes: e.target.value })} />
          </FormField>
        </div>

        {/* Dónde está y hasta dónde llega (2026-10-09): una sola vez, aquí. Los km
            ya no se escriben: se calculan de su base y los municipios que cubre. */}
        <hr className="adm-divider" />
        <div className="adm-form-grid">
          <FormField label="Dirección de su base" help="Calle, número y colonia. Con ella queda en el mapa." style={{ gridColumn: '1 / -1' }}>
            <input className="adm-input" placeholder="Av. Miguel Alemán 1500, Col. Industrial" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>
          <FormField label="Municipio">
            <input className="adm-input" placeholder="Apodaca" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </FormField>
          <div className="adm-field">
            <span className="adm-label">Estado</span>
            <AdminSelect ariaLabel="Estado" value={form.state} onChange={(v) => setForm({ ...form, state: v })} options={ESTADOS_OPERACION.map((e) => ({ value: e, label: e }))} />
          </div>
          <FormField label="Municipios que cubre" help="Sepáralos con comas." style={{ gridColumn: '1 / -1' }}>
            <input className="adm-input" placeholder="Apodaca, Escobedo, García" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
          </FormField>
          <div style={{ gridColumn: '1 / -1', marginTop: -4 }}>
            <KmCalculados municipio={form.city} estado={form.state} cobertura={form.coverage} />
          </div>
        </div>

        <hr className="adm-divider" />

        <QueOfrece tipo={tipoOferta} onTipo={setTipoOferta} categorias={form.categories} onCategorias={(c) => setForm({ ...form, categories: c })} />

        {/* Con correo, el alta manda su enlace: es su invitación y por donde
            sube sus papeles. Se desmarca solo para registrar un prospecto. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 20, fontSize: 13, color: 'var(--adm-text-2)', opacity: form.email ? 1 : 0.5, cursor: form.email ? 'pointer' : 'default' }}>
          <input
            type="checkbox"
            checked={invitar && Boolean(form.email)}
            disabled={!form.email}
            onChange={(e) => setInvitar(e.target.checked)}
            style={{ width: 15, height: 15, margin: 0, accentColor: 'var(--adm-accent)' }}
          />
          Mandarle su invitación por correo al darlo de alta
        </label>
      </Modal>

      <Toolbar end={`${filtrados.length} de ${provs.length}`}>
        <SearchBox value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o municipio…" aria-label="Buscar aliado por nombre o municipio" />
      </Toolbar>

      <Panel flush clip>
        <div className="adm-thead pv-row pv-thead">
          <div>Aliado</div><div>Documentos</div><div>Nivel</div><div />
        </div>

        {filtrados.length === 0 ? (
          provs.length === 0
            ? <EmptyState icon="ph-handshake" title="Todavía no hay aliados dados de alta" />
            : <EmptyState icon="ph-handshake" title="No se encontraron aliados" sub="Ajusta la búsqueda." />
        ) : null}

        {filtrados.map((p) => {
          const d = ETIQUETA_DOCS[p.docsStatus];
          const publicados = (p.equipment ?? []).filter((e) => !e.pending);
          const datos = conPuntos([
            p.contactName,
            p.phone ? <span className="adm-mono">{p.phone}</span> : null,
            p.coverage.length ? `Cubre: ${p.coverage.join(', ')}` : null,
            p.responseMinutes !== null ? `Responde en ~${p.responseMinutes} min` : null,
            p.monthsInNetwork !== null ? `${p.monthsInNetwork} meses en la red` : null,
          ]);
          return (
            // Dado de baja: sigue en la lista, pero apagado.
            <div key={p.id} className="adm-trow pv-row" style={p.status === 1 ? undefined : { opacity: 0.55 }}>
              <div className="pv-c-name" style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="adm-cell-title">{p.name}</span>
                  <Chip tone={p.verified ? 'ok' : 'muted'}>{p.verified ? 'Con sello' : 'Sin sello'}</Chip>
                  {p.pendingCount ? (
                    <button
                      type="button"
                      className="adm-chip t-warn"
                      onClick={() => abrirExpediente(p)}
                      title="Abrir su expediente para revisarlo"
                      style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {p.pendingCount} por revisar
                    </button>
                  ) : null}
                </div>
                {datos.length ? <div className="adm-cell-sub" style={{ lineHeight: 1.6 }}>{datos}</div> : null}

                {/* Qué ofrece, a la vista: líneas y máquinas (tipo y marca). */}
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <ChipsOferta p={p} />
                </div>
                <div className="adm-cell-sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
                  {publicados.length > 0 ? (
                    <>
                      <span style={{ color: 'var(--adm-text-2)', fontWeight: 600 }}>{publicados.length} equipo{publicados.length === 1 ? '' : 's'}:</span>{' '}
                      {publicados.slice(0, 4).map((e) => `${e.name}${e.brand ? ` (${e.brand})` : ''}`).join(' · ')}
                      {publicados.length > 4 ? ` · y ${publicados.length - 4} más` : ''}
                    </>
                  ) : (
                    'Sin equipos publicados.'
                  )}
                </div>
              </div>
              <div className="pv-c-docs">
                <span className="pv-m-label">Documentos:</span>
                <StatusText tone={d.tono}>{d.texto}</StatusText>
              </div>
              <div className="pv-c-level">
                <AdminSelect
                  size="sm"
                  ariaLabel={`Nivel de ${p.name}`}
                  value={p.level}
                  onChange={(v) => cambiarNivel(p, v)}
                  options={NIVELES.map((n) => ({ value: n, label: n }))}
                />
              </div>
              <div className="pv-c-act">
                <Btn size="sm" onClick={() => abrirExpediente(p)}>{`Expediente (${p.documentCount})`}</Btn>
              </div>
            </div>
          );
        })}
      </Panel>

      {expediente ? (
        <ExpedienteModal
          p={expediente}
          docs={docs}
          onCerrar={() => setExpediente(null)}
          onAgregar={agregarDoc}
          onBorrar={borrarDoc}
          onEliminar={async () => {
            const r = await fetch(`/api/admin/providers/${expediente.id}`, { method: 'DELETE' });
            const d = await r.json().catch(() => null);
            if (!r.ok) { await avisar({ titulo: 'No se pudo eliminar', mensaje: 'Inténtalo de nuevo. Si sigue igual, la API no está respondiendo.', peligro: true }); return; }
            setMsg(d?.eliminado ? `«${expediente.name}» se eliminó.` : `«${expediente.name}» tiene historial: se dio de baja en vez de borrarlo.`);
            setExpediente(null);
            await recargar();
          }}
          onRevisado={async (texto) => {
            setMsg(texto);
            const r = await fetch('/api/admin/providers');
            if (r.ok) {
              const nuevos = (await r.json()) as ProviderRow[];
              setProvs(nuevos);
              setExpediente(nuevos.find((x) => x.id === expediente.id) ?? null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ExpedienteModal({
  p, docs, onCerrar, onAgregar, onBorrar, onRevisado, onEliminar,
}: {
  p: ProviderRow;
  docs: DocRow[];
  onCerrar: () => void;
  onAgregar: (kind: string, nombre: string, vence: string) => void;
  onBorrar: (id: number) => void;
  /** Tras publicar o rechazar: mensaje y recarga. */
  onRevisado: (texto: string) => void;
  /** Borra al aliado si no tiene historial; si lo tiene, lo da de baja. */
  onEliminar: () => void;
}) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const pendientes = (p.equipment ?? []).filter((e) => e.pending);
  const publicados = (p.equipment ?? []).filter((e) => !e.pending);

  // Ya no se liga a renglones del tabulador: el cotizador guiado recomienda
  // las máquinas publicadas. Se conserva vacío por compatibilidad con la API.
  const cuentaComo: Record<number, string> = {};

  async function revisar(e: EquipoRow, accion: 'publicar' | 'rechazar') {
    if (accion === 'rechazar' && motivo.trim().length < 4) return;
    setOcupado(e.id);
    const elegido = cuentaComo[e.id];
    const renglon = elegido ? { tipo: elegido.split(':')[0], id: elegido.split(':').slice(1).join(':') } : null;
    const r = await fetch(`/api/admin/providers/equipos/${e.id}/${accion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accion === 'rechazar' ? { motivo: motivo.trim() } : { renglon }),
    });
    setOcupado(null);
    const d = await r.json().catch(() => null);
    if (!r.ok) { await avisar({ titulo: 'No se pudo completar', mensaje: d?.message ?? 'Inténtalo de nuevo.', peligro: true }); return; }
    setRechazando(null); setMotivo('');
    onRevisado(accion === 'publicar'
      ? `"${e.name}" quedó publicado y ya aparece en el sitio. Le avisamos al aliado.`
      : `"${e.name}" no se publicó. Le mandamos el motivo al aliado.`);
  }
  // Qué ofrece (servicios, productos o ambos): se puede cambiar después del alta.
  const [editandoOferta, setEditandoOferta] = useState(false);
  const [tipoEdit, setTipoEdit] = useState<TipoOferta>('servicios');
  const [catsEdit, setCatsEdit] = useState<string[]>([]);
  const [errorOferta, setErrorOferta] = useState<string | null>(null);
  async function guardarOferta() {
    const falta = faltaEnOferta(catsEdit, tipoEdit);
    if (falta) { setErrorOferta(falta); return; }
    const r = await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: categoriasDelTipo(catsEdit, tipoEdit) }),
    });
    if (!r.ok) { setErrorOferta('No se pudo guardar.'); return; }
    setEditandoOferta(false);
    onRevisado(`Listo: «${p.name}» ya puede ofrecer lo que marcaste desde su portal.`);
  }
  const [kind, setKind] = useState('fiscal');
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState('');
  const hoy = new Date().toISOString().slice(0, 10);

  /** Tipo · marca · renta o venta · dónde está. */
  const metaEquipo = (e: EquipoRow) =>
    [e.category, e.brand ? `Marca ${e.brand}` : 'Sin marca', e.rental ? 'Renta' : 'Venta', e.location].filter(Boolean).join(' · ');

  return (
    // El modal del panel (2026-10-08): antes era un overlay propio; este cierra
    // también con Esc y deja la X y el título como en los demás módulos.
    <Modal abierto titulo={`Expediente · ${p.name}`} onCerrar={onCerrar} ancho={680}>
      {/* ── Qué ofrece ── Sus máquinas del catálogo con lo que las define:
          tipo, marca, ficha técnica y si están libres. Se agregan y editan
          en el catálogo, ya ligadas a este aliado. */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 style={H3}>Qué ofrece</h3>
          <a href={`/productos/nuevo?proveedor=${p.id}`} className={btnClass('secondary', 'sm')}>
            <i className="ph ph-plus" aria-hidden />Agregar servicio o producto
          </a>
        </div>
        {editandoOferta ? (
          <div className="adm-card" style={{ padding: 16, marginBottom: 14 }}>
            <QueOfrece tipo={tipoEdit} onTipo={setTipoEdit} categorias={catsEdit} onCategorias={setCatsEdit} />
            {errorOferta ? <div role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', marginTop: 10 }}>{errorOferta}</div> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <Btn size="sm" variant="ghost" onClick={() => setEditandoOferta(false)}>Cancelar</Btn>
              {/* Primario dentro de su formulario: solo existe mientras se edita. */}
              <Btn size="sm" variant="primary" onClick={() => void guardarOferta()}>Guardar</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <ChipsOferta p={p} />
            <button
              type="button"
              className="adm-panel-link"
              style={{ marginLeft: 6 }}
              onClick={() => { setCatsEdit(p.categories); setTipoEdit(tipoDeCategorias(p.categories)); setErrorOferta(null); setEditandoOferta(true); }}
            >
              <i className="ph ph-pencil-simple" aria-hidden />Cambiar qué ofrece
            </button>
          </div>
        )}

        {/* Lo que mandó desde su portal: cada uno trae su propio formulario de
            rechazo y tres acciones, por eso va como tarjeta y no como fila. */}
        {pendientes.length > 0 ? (
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: 'var(--adm-warn)' }}>Por revisar ({pendientes.length})</span>
              {' · lo ofreció desde su portal. Revísalo, corrígelo si hace falta y publícalo.'}
            </div>
            {pendientes.map((e) => (
              <div key={e.id} className="adm-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {e.image ? <Thumb src={e.image} size={56} /> : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="adm-cell-title">{e.name}</span>
                      <Chip tone="warn">Por revisar</Chip>
                    </div>
                    <div className="adm-cell-sub">{metaEquipo(e)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--adm-text-2)', marginTop: 4, lineHeight: 1.5 }}>
                      {e.specs.length ? e.specs.map((x) => `${x.label}: ${x.valor}`).join(' · ') : 'Sin ficha técnica'}
                    </div>
                  </div>
                </div>
                {rechazando === e.id ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <textarea
                      className="adm-textarea"
                      value={motivo}
                      onChange={(ev) => setMotivo(ev.target.value)}
                      rows={2}
                      placeholder="Qué le falta o por qué no se publica (le llega por correo)"
                      aria-label="Motivo del rechazo"
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Btn size="sm" variant="ghost" onClick={() => { setRechazando(null); setMotivo(''); }}>Cancelar</Btn>
                      <Btn size="sm" variant="danger" disabled={ocupado === e.id || motivo.trim().length < 4} onClick={() => void revisar(e, 'rechazar')}>
                        Rechazar y avisarle
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Precio único (2026-09-28): el servicio se cotiza con el tabulador y MAQSER24 asigna. */}
                    <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>
                      {esLineaServicio(e.categorySlug)
                        ? <>Al publicarlo queda en el catálogo de {e.category ?? 'su línea'}. Se cotiza con el <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>tabulador único</strong> (Cotizador → Tarifas) y, cuando llegue una solicitud, podrás asignársela a este aliado desde Servicios.</>
                        : <>Al publicarlo aparece en la tienda como producto. Si no le pusiste precio al cliente, se calcula con lo que cobra el aliado más el margen.</>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <a href={`/productos/editar/${e.id}`} className={btnClass('secondary', 'sm')}>Revisar y corregir</a>
                      <Btn size="sm" icon="ph-check" disabled={ocupado === e.id} onClick={() => void revisar(e, 'publicar')}>Publicar</Btn>
                      <Btn size="sm" variant="danger" onClick={() => setRechazando(e.id)}>Rechazar</Btn>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {publicados.length === 0 ? (
          <p style={VACIO}>
            Todavía no tiene servicios ni productos. Con «Agregar servicio o producto» creas la ficha (tipo, marca, capacidad,
            fotos) ya a su nombre. Si la máquina ya existe en el catálogo, ábrela y en «De quién es el equipo» elígelo a él.
          </p>
        ) : (
          <Panel flush clip>
            {publicados.map((e) => {
              const disp = DISP[e.availability] ?? { texto: e.availability, tono: 'muted' as const };
              return (
                <div key={e.id} className="adm-trow" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px' }}>
                  <Thumb src={e.image} size={48} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="adm-cell-title">{e.name}</span>
                      <StatusText tone={disp.tono}>{disp.texto}</StatusText>
                    </div>
                    <div className="adm-cell-sub">{metaEquipo(e)}</div>
                    {e.specs.length > 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--adm-text-2)', marginTop: 4, lineHeight: 1.5 }}>
                        {e.specs.map((s) => `${s.label}: ${s.valor}`).join(' · ')}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--adm-warn)', marginTop: 4 }}>Ficha técnica vacía: agrega capacidad, modelo e implementos.</div>
                    )}
                  </div>
                  <IconBtn icon="ph-pencil-simple" label="Editar" href={`/productos/editar/${e.id}`} />
                </div>
              );
            })}
          </Panel>
        )}
      </section>

      {/* Lo que te cobra por máquina: era la pantalla del CRM (2026-10-08). */}
      <CostosReferencia providerId={p.id} />

      <section style={SECCION}>
        <h3 style={H3}>Papeles</h3>
        <p style={DESC}>Un documento vencido le quita el sello al aliado aunque su nivel sea alto.</p>

        {docs.length === 0 ? (
          <p style={VACIO}>Sin documentos cargados.</p>
        ) : (
          <Panel flush clip>
            {docs.map((d) => {
              const vencido = d.expiresAt !== null && d.expiresAt < hoy;
              return (
                <div key={d.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--adm-text)' }}>{d.name || TIPOS_DOC.find(([k]) => k === d.kind)?.[1] || d.kind}</div>
                    <div className="adm-num" style={{ fontSize: 12, color: vencido ? 'var(--adm-bad)' : 'var(--adm-muted)', marginTop: 2 }}>
                      {d.expiresAt ? (vencido ? `Venció el ${d.expiresAt}` : `Vigente hasta ${d.expiresAt}`) : 'Sin vencimiento'}
                      {d.fileUrl ? '' : ' · sin foto'}
                    </div>
                  </div>
                  {/* La foto que subió el aliado: es lo que se revisa antes de
                      subirlo a "validado". Abre en otra pestaña. */}
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className={btnClass('secondary', 'sm')}>
                      <i className="ph ph-image" aria-hidden />Ver foto
                    </a>
                  ) : null}
                  <IconBtn icon="ph-trash" label="Quitar" danger onClick={() => onBorrar(d.id)} />
                </div>
              );
            })}
          </Panel>
        )}

        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div className="adm-form-grid">
            <div className="adm-field">
              <span className="adm-label">Tipo</span>
              <AdminSelect ariaLabel="Tipo de documento" value={kind} onChange={setKind} options={TIPOS_DOC.map(([k, n]) => ({ value: k, label: n }))} />
            </div>
            <FormField label="Vence el (opcional)">
              <input className="adm-input" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Nombre del documento">
            <input className="adm-input" placeholder="Póliza de responsabilidad civil" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </FormField>
          <div>
            <Btn icon="ph-plus" onClick={() => { onAgregar(kind, nombre, vence); setNombre(''); setVence(''); }}>
              Agregar al expediente
            </Btn>
          </div>
        </div>
      </section>

      {/*
        El acceso del aliado. Es lo que convierte la red de un directorio que
        alguien mantiene a mano en algo que se mantiene solo.
      */}
      {/*
        DONDE ESTA Y HASTA DONDE LLEGA. Con esto la cobertura pasa de
        "escribio este municipio?" a "esta a menos de N kilometros?", que es
        la pregunta real y la unica que funciona fuera del area metropolitana.
      */}
      <UbicacionAliado p={p} onCambio={onRevisado} />

      <AccesoAliado p={p} />

      {/*
        Los papeles dicen si esta en regla. El cumplimiento dice si CUMPLE,
        que es otra cosa: se puede tener todo vigente y no contestar nunca.
      */}
      <ProviderHistory providerId={p.id} />

      {/* Eliminar: para altas duplicadas o por error. Con historial solo se da de baja. */}
      <div style={{ ...SECCION, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5, maxWidth: 420 }}>
          {p.status === 1
            ? 'Si se dio de alta por error o está duplicado, elimínalo. Si ya tiene servicios, equipos o papeles, se da de baja en vez de borrarse.'
            : 'Este aliado está dado de baja: no se le ofrecen servicios y su enlace no abre. Reactívalo para que vuelva a trabajar con MAQSER24.'}
        </span>
        {p.status === 1 ? (
          <Btn
            size="sm"
            variant="danger"
            icon="ph-trash"
            onClick={async () => {
              if (await confirmar({
                titulo: `¿Eliminar a «${p.name}»?`,
                mensaje: 'Si no tiene historial se borra por completo. Si ya tiene servicios, equipos o papeles, se da de baja en vez de borrarse.',
                confirmar: 'Eliminar aliado',
                peligro: true,
              })) onEliminar();
            }}
          >
            Eliminar aliado
          </Btn>
        ) : (
          // Reactivar (2026-10-05): antes un aliado dado de baja no tenía regreso.
          // Su enlace anterior sigue revocado; hay que mandarle uno nuevo.
          <Btn
            size="sm"
            icon="ph-arrow-counter-clockwise"
            disabled={ocupado === -1}
            onClick={async () => {
              if (!(await confirmar({ titulo: `¿Reactivar a «${p.name}»?`, mensaje: 'Volverá a recibir ofertas. Después mándale su enlace de acceso.', confirmar: 'Reactivar' }))) return;
              setOcupado(-1);
              const r = await fetch(`/api/admin/providers/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 1 }) });
              setOcupado(null);
              onRevisado(r.ok ? `«${p.name}» está activo otra vez. Mándale su enlace de acceso.` : 'No se pudo reactivar. Inténtalo de nuevo.');
            }}
          >
            {ocupado === -1 ? 'Reactivando…' : 'Reactivar aliado'}
          </Btn>
        )}
      </div>
    </Modal>
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
    if (!(await confirmar({ titulo: '¿Revocar su acceso?', mensaje: 'Los enlaces que ya le hayas mandado dejarán de servir. Para que vuelva a entrar hay que mandarle uno nuevo.', confirmar: 'Revocar', peligro: true }))) return;
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/providers/${p.id}/revocar-acceso`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setUrl(null);
    setMsg(d?.mensaje ?? 'Listo.');
  }

  return (
    <section style={SECCION}>
      <h3 style={H3}>Su acceso</h3>
      <p style={DESC}>
        Un enlace que le abre lo suyo: contesta solicitudes, confirma si sus equipos siguen libres y
        revisa sus papeles. Sin contraseña, y sirve 30 días.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn icon={p.email ? 'ph-paper-plane-tilt' : 'ph-link'} onClick={mandar} disabled={ocupado}>
          {p.email ? 'Mandarle su enlace' : 'Generar enlace'}
        </Btn>
        <Btn variant="ghost" onClick={revocar} disabled={ocupado}>
          Revocar los anteriores
        </Btn>
      </div>

      {msg ? <div style={{ ...AVISO, marginTop: 12 }}>{msg}</div> : null}

      {url ? (
        <div style={{ marginTop: 12 }}>
          {/*
            El enlace se ensena SIEMPRE, tambien cuando el correo salio bien:
            mientras el envio este apagado esta es la unica forma de darle
            acceso, y se le puede pasar por WhatsApp igual de bien.
          */}
          <div className="adm-help" style={{ marginBottom: 6 }}>
            También puedes copiarlo y mandárselo por WhatsApp:
          </div>
          <input
            readOnly
            className="adm-input adm-mono"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Enlace de acceso del aliado"
            style={{ fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Btn
              size="sm"
              icon="ph-copy"
              onClick={() => { void navigator.clipboard?.writeText(url).then(() => setMsg('Enlace copiado.')); }}
            >
              Copiar enlace
            </Btn>
            {waDe(p.phone) ? (
              <a
                href={`https://wa.me/${waDe(p.phone)}?text=${encodeURIComponent(
                  `Hola${p.contactName ? ` ${p.contactName}` : ''}, este es tu acceso al portal de aliados de MAQSER24. Ahí contestas solicitudes y revisas tus equipos y documentos. Sirve 30 días: ${url}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnClass('secondary', 'sm')}
              >
                <i className="ph ph-whatsapp-logo" aria-hidden />Mandar por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Teléfono del aliado → número para wa.me (52 + 10 dígitos). Acepta "81 1234
 * 5678", "+52 81…" y "+52 1 81…" (el "1" de celular viejo ya no se usa y
 * wa.me no lo quiere). Null si no parece un número mexicano.
 */
function waDe(tel: string | null): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 13 && d.startsWith('521')) return `52${d.slice(3)}`;
  return null;
}


/**
 * Dónde está y hasta dónde llega. Desde 2026-10-09 los km no se escriben: la
 * API los calcula de su base y su lista de municipios cada vez que cambia una
 * de las dos (y cuando se mueve el punto en el mapa).
 */
function UbicacionAliado({ p, onCambio }: { p: ProviderRow; onCambio: (texto: string) => void }) {
  const [dir, setDir] = useState(p.address ?? '');
  const [municipio, setMunicipio] = useState(p.city ?? '');
  const [estado, setEstado] = useState(p.state ?? 'Nuevo León');
  const [cobertura, setCobertura] = useState(p.coverage.join(', '));
  const [radio, setRadio] = useState<number | null>(p.coverageRadiusKm);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /** Lo que devuelve la API al ubicar: punto y km nuevos. */
  function aplicar(u: { lat?: number | null; lng?: number | null; radioKm?: number | null } | null | undefined) {
    if (!u) return;
    if (u.lat != null && u.lng != null) setCoords({ lat: u.lat, lng: u.lng });
    if (u.radioKm !== undefined) setRadio(u.radioKm ?? null);
  }

  async function guardar() {
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: dir, city: municipio, state: estado, coverage: aLista(cobertura) }),
    });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setMsg('No se pudo guardar. Inténtalo de nuevo.'); return; }
    aplicar(d?.ubicacion);
    const texto = d?.ubicacion?.mensaje || 'Guardado.';
    setMsg(texto);
    onCambio(`${p.name}: ${texto}`);
  }

  /** Volver a buscar su base con la dirección guardada (p. ej. si quedó en el centro del municipio). */
  async function ubicar() {
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/providers/${p.id}/geocodificar`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    setMsg(d?.mensaje ?? 'No se pudo ubicar.');
    if (d?.ok) aplicar(d);
  }

  // A mano (2026-09-25): clic/arrastre en el mapa o coordenadas pegadas. La API
  // recalcula los km desde el punto nuevo.
  const fijar = useCallback(async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    const r = await fetch(`/api/admin/providers/${p.id}/geocodificar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng }),
    });
    const d = await r.json().catch(() => null);
    if (d?.ok) setRadio(d.radioKm ?? null);
    setMsg(d?.ok ? d.mensaje : 'No se pudo guardar el punto.');
  }, [p.id]);
  const [pegado, setPegado] = useState('');
  function usarPegado() {
    const c = coordenadasDe(pegado);
    if (!c) { setMsg('No reconocí coordenadas. En Google Maps: clic derecho sobre el lugar y toca los números (ej. 25.78662, -100.18123), o copia el enlace del lugar.'); return; }
    setPegado('');
    void fijar(c.lat, c.lng);
  }
  const puntosMapa = useMemo<PuntoMapa[]>(
    () => (coords ? [{ id: p.id, nombre: p.name, lat: coords.lat, lng: coords.lng, radioKm: radio, tipo: 'aliado' }] : []),
    [coords, p.id, p.name, radio],
  );
  const cambios =
    dir.trim() !== (p.address ?? '').trim() ||
    municipio.trim() !== (p.city ?? '').trim() ||
    estado !== (p.state ?? 'Nuevo León') ||
    aLista(cobertura).join(',') !== p.coverage.join(',');

  return (
    <section style={SECCION}>
      <h3 style={H3}>Dónde está y hasta dónde llega</h3>
      <p style={DESC}>
        Con su dirección queda en el mapa, y los km que cubre se calculan solos: de su base al más
        lejano de sus municipios. Una obra en uno de sus municipios siempre cuenta como cubierta.
      </p>

      <div className="adm-form-grid">
        <FormField label="Dirección de su base" help="Calle, número y colonia." style={{ gridColumn: '1 / -1' }}>
          <input className="adm-input" value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Av. Miguel Alemán 1500, Col. Industrial" />
        </FormField>
        <FormField label="Municipio">
          <input className="adm-input" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Apodaca" />
        </FormField>
        <div className="adm-field">
          <span className="adm-label">Estado</span>
          <AdminSelect ariaLabel="Estado" value={estado} onChange={setEstado} options={ESTADOS_OPERACION.map((e) => ({ value: e, label: e }))} />
        </div>
        <FormField label="Municipios que cubre" help="Sepáralos con comas." style={{ gridColumn: '1 / -1' }}>
          <input className="adm-input" value={cobertura} onChange={(e) => setCobertura(e.target.value)} placeholder="Apodaca, Escobedo, García" />
        </FormField>
        {cambios ? (
          <div style={{ gridColumn: '1 / -1', marginTop: -4 }}>
            <KmCalculados municipio={municipio} estado={estado} cobertura={cobertura} />
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn variant={cambios ? 'primary' : 'secondary'} icon="ph-floppy-disk" onClick={guardar} disabled={ocupado || !cambios}>
          {ocupado ? 'Guardando…' : 'Guardar'}
        </Btn>
        <Btn variant="ghost" icon="ph-map-pin" onClick={ubicar} disabled={ocupado || cambios} title={cambios ? 'Guarda primero los cambios' : undefined}>
          Volver a ubicar con la dirección
        </Btn>
        <span style={{ marginLeft: 4, display: 'inline-flex', gap: 14, flexWrap: 'wrap' }}>
          {coords ? <StatusText tone="ok">Ubicado</StatusText> : <StatusText tone="muted">Sin ubicar</StatusText>}
          <span style={{ fontSize: 13, color: 'var(--adm-text-2)' }}>
            {radio ? <>Llega hasta <b className="adm-num">~{radio} km</b></> : 'Sin km calculados'}
          </span>
        </span>
      </div>

      {msg ? <div style={{ ...AVISO, marginTop: 12 }}>{msg}</div> : null}

      <div style={{ marginTop: 14 }}>
        <MapaCobertura alto={240} puntos={puntosMapa} onMover={fijar} />
        <p className="adm-help" style={{ margin: '6px 0 0' }}>
          {coords ? 'Arrastra el punto o da clic en el mapa para corregir su lugar exacto; los km se recalculan solos.' : 'Da clic en el mapa para marcar su base.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input
          className="adm-input"
          style={{ flex: '1 1 260px', width: 'auto', minWidth: 0 }}
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usarPegado(); } }}
          placeholder="O pega coordenadas o el enlace de Google Maps"
          aria-label="Coordenadas o enlace de Google Maps"
        />
        <Btn onClick={usarPegado} disabled={!pegado.trim()}>Usar</Btn>
      </div>
    </section>
  );
}
