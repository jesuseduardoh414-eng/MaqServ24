'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ESTADOS_OPERACION, ESTADO_SOLICITUD_PROVEEDOR, centroDeMunicipio, coordenadasDe, esLineaServicio, presentacionEstado, radioDeCobertura } from '@maqserv/config';
import { colorVivo } from '@/components/modo';
import { AdminSelect } from '@/components/AdminSelect';
import { AdminDatePicker } from '@/components/AdminFecha';
import { Modal } from '@/components/Modal';
import {
  Btn, btnClass, Chip, EmptyState, FormField, IconBtn, Note, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Switch, Toolbar,
  type Tone,
} from '@/components/ui';
import { D } from '@/components/design-tokens';
import { DocumentAlerts } from './DocumentAlerts';
import { SolicitudesProveedor } from './SolicitudesProveedor';
import { ProviderHistory } from './ProviderHistory';
import { MapaCobertura, type PuntoMapa } from './MapaCobertura';
import { LINEAS_MAPA, MapaRed } from './MapaRed';
import { InvitacionesPendientes, InvitarAliado } from './InvitarAliado';
import { QueOfrece, categoriasDelTipo, faltaEnOferta, tipoDeCategorias, type TipoOferta } from './QueOfrece';
import { DescargarExcelProveedores } from './ExcelProveedores';
import { waDe } from './wa';
import { avisar, confirmar } from '@/components/Dialogos';
import { mostrarResultado } from '@maqserv/ui';

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
  docsStatus: 'al-dia' | 'por-vencer' | 'vencido' | 'incompleto' | 'sin-documentos';
  verified: boolean;
  /** Los papeles obligatorios que no tiene vigentes ('fiscal', 'seguro'): sin ellos no hay sello. */
  faltan?: string[];
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
  /** La ficha del tipo a la que pertenece (null = sin clasificar). */
  tipo?: string | null;
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

/*
 * Cómo se lee la disponibilidad de un equipo: ESTADOS_DISPONIBILIDAD
 * (@maqserv/config), con los mismos nombres y colores que Disponibilidad y la
 * Agenda. Antes aquí "reservado" era azul y en Disponibilidad ámbar.
 */

interface DocRow {
  id: number;
  kind: string;
  name: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  /** Foto del papel que subió el aliado (null si lo registró la oficina sin foto). */
  fileUrl?: string | null;
  /** Ya se renovó: queda en el expediente pero no cuenta para el sello. */
  reemplazado?: boolean;
}

/**
 * Lo que le falta para el sello, en corto. Desde 2026-10-27 el sello sale solo
 * de los papeles (constancia fiscal y póliza vigentes): ya no hay niveles que
 * subir a mano, solo la marca de "preferente".
 */
const FALTA_CORTO: Record<string, string> = { fiscal: 'constancia fiscal', seguro: 'póliza de seguro' };
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

/** Aliado | Papeles | Preferente | Expediente. */
const GRID = 'minmax(0,1fr) 170px 140px 120px';

/** Las pestañas del expediente (2026-10-27): antes eran ocho secciones una debajo de otra. */
type Pestana = 'datos' | 'equipos' | 'papeles' | 'cumple';

/** "Maquinaria, Transporte": sus líneas en corto (los nombres del mapa); lo demás, con su nombre. */
const serviciosCortos = (p: ProviderRow) => {
  const xs = LINEAS_MAPA.filter((l) => p.categories.includes(l.slug)).map((l) => l.nombre);
  // Lo que no es línea de servicio va con su nombre: «Grúas (nueva)» si la propuso él.
  p.categories.forEach((c, i) => { if (!esLineaServicio(c)) xs.push(p.categoryLabels?.[i] ?? c); });
  return xs.join(', ');
};

const ETIQUETA_DOCS: Record<ProviderRow['docsStatus'], { texto: string; tono: Tone }> = {
  'al-dia': { texto: 'Al día', tono: 'ok' },
  'por-vencer': { texto: 'Por vencer', tono: 'warn' },
  vencido: { texto: 'Vencido', tono: 'bad' },
  incompleto: { texto: 'Faltan papeles', tono: 'warn' },
  'sin-documentos': { texto: 'Sin papeles', tono: 'muted' },
};

/** "Falta: constancia fiscal y póliza de seguro" (vacío si ya los tiene). */
const textoFalta = (p: ProviderRow) => {
  const xs = (p.faltan ?? []).map((k) => FALTA_CORTO[k] ?? k);
  return xs.length ? `Falta: ${xs.join(' y ')}` : '';
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

export function ProvidersManager({ initial, abrir, enfocarCorreo = false }: {
  initial: ProviderRow[];
  /** Abrir de entrada el expediente de este aliado (?ver=). */
  abrir?: number;
  /** …y llevar al campo de su correo (?dato=correo). */
  enfocarCorreo?: boolean;
}) {
  const [todos, setProvs] = useState(initial);
  // En vivo (2026-10-26): al llegar un aviso la campana pide la página otra vez;
  // la lista toma lo nuevo del servidor (lo que se escribe vive aparte y no se pierde).
  useEffect(() => { setProvs(initial); }, [initial]);
  // Las solicitudes del sitio (status 2) van aparte: todavía no son de la red.
  const provs = useMemo(() => todos.filter((p) => p.status !== ESTADO_SOLICITUD_PROVEEDOR), [todos]);
  const solicitudes = useMemo(() => todos.filter((p) => p.status === ESTADO_SOLICITUD_PROVEEDOR), [todos]);
  const [query, setQuery] = useState('');
  const [creando, setCreando] = useState(false);
  /** Mandarle su invitación al darlo de alta (solo si la ficha trae correo). */
  const [invitar, setInvitar] = useState(true);
  const [expediente, setExpediente] = useState<ProviderRow | null>(null);
  /** Con qué pestaña abre el expediente: "1 por revisar" lleva a Equipos; un aviso de papeles, a Papeles. */
  const [pestanaInicial, setPestanaInicial] = useState<Pestana>('datos');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);
  /** Sube con cada invitación mandada: la lista de "sin respuesta" se vuelve a pedir. */
  const [versionInv, setVersionInv] = useState(0);

  const [form, setForm] = useState({
    name: '', contactName: '', phone: '', email: '',
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
    setForm({ name: '', contactName: '', phone: '', email: '', address: '', city: '', state: 'Nuevo León', coverage: '', categories: [], responseMinutes: '' });
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

  /**
   * PREFERENTE (2026-10-27): la única marca a mano. Antes eran cuatro niveles
   * y el sello dependía de subirlo a "validado"; ahora el sello sale solo de
   * los papeles y esto solo pone primero a los que tú prefieres.
   */
  async function cambiarPreferente(p: ProviderRow) {
    const es = p.level === 'preferente';
    const r = await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: es ? 'registrado' : 'preferente' }),
    });
    mostrarResultado(
      !r.ok ? 'No se pudo cambiar. Inténtalo de nuevo.' : es ? `«${p.name}» ya no es preferente.` : `«${p.name}» es preferente: sale primero cuando buscas aliado para una solicitud.`,
      r.ok ? 'ok' : 'bad',
    );
    recargar();
  }

  async function abrirExpediente(p: ProviderRow, pestana: Pestana = 'datos') {
    setPestanaInicial(pestana);
    setExpediente(p);
    const r = await fetch(`/api/admin/providers/${p.id}/documents`);
    setDocs(r.ok ? await r.json() : []);
  }

  // Llegar con ?ver= abre su expediente una sola vez.
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (abierto || !abrir) return;
    const p = todos.find((x) => x.id === abrir);
    if (!p) return;
    setAbierto(true);
    void abrirExpediente(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir, todos, abierto]);

  async function agregarDoc(kind: string, nombre: string, vence: string) {
    if (!expediente) return;
    await fetch(`/api/admin/providers/${expediente.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name: nombre || null, expiresAt: vence || null }),
    });
    await recargarDocs(expediente.id);
  }

  async function borrarDoc(id: number) {
    await fetch(`/api/admin/providers/documents/${id}`, { method: 'DELETE' });
    if (expediente) await recargarDocs(expediente.id);
  }

  /** Tras agregar o quitar un papel: su lista y su sello, sin salirse de la pestaña. */
  async function recargarDocs(id: number) {
    const [rd, rp] = await Promise.all([fetch(`/api/admin/providers/${id}/documents`), fetch('/api/admin/providers')]);
    if (rd.ok) setDocs(await rd.json());
    if (rp.ok) {
      const nuevos = (await rp.json()) as ProviderRow[];
      setProvs(nuevos);
      setExpediente(nuevos.find((x) => x.id === id) ?? null);
    }
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
        .pv-falta { margin-top: 3px; font-size: 12px; line-height: 1.4; color: var(--adm-muted); }
        /* En móvil cada aliado pasa a bloque: nombre y datos arriba; papeles,
           preferente y expediente en una línea debajo. */
        @media (max-width: 900px) {
          .pv-thead { display: none !important; }
          .pv-row { display: flex; flex-wrap: wrap; gap: 10px 14px; }
          .pv-row > .pv-c-name { flex: 1 1 100%; }
          .pv-row > .pv-c-act { margin-left: auto; }
          .pv-m-label { display: inline; margin-right: 6px; font-size: 12.5px; color: var(--adm-faint); }
        }
      `}</style>

      <PageHeader
        eyebrow={['Red y oferta', 'Proveedores']}
        title="Red de aliados"
        subtitle={
          <>
            Tus aliados, dónde están y hasta dónde llegan. Para sumar a alguien, invítalo: él llena sus datos y te llega como solicitud.
            El sello de verificado sale solo cuando su constancia fiscal y su póliza están vigentes.
          </>
        }
        actions={
          <>
            <DescargarExcelProveedores aliados={todos} />
            <Btn icon="ph-plus" onClick={() => setCreando(true)}>Darlo de alta yo</Btn>
            <Btn variant="primary" icon="ph-paper-plane-tilt" onClick={() => setInvitando(true)}>Invitar aliado</Btn>
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
        hay un hueco geografico, y de que tamano. Desde 2026-10-27 con nombre,
        color por servicio y filtro (ver MapaRed).
      */}
      <MapaRed
        aliados={provs}
        onElegir={(id) => {
          const prov = provs.find((x) => x.id === id);
          if (prov) void abrirExpediente(prov);
        }}
      />

      <SolicitudesProveedor solicitudes={solicitudes} onCambio={(m) => { setMsg(m); void recargar(); }} />

      <InvitacionesPendientes version={versionInv} />
      <InvitarAliado abierto={invitando} onCerrar={() => setInvitando(false)} onEnviada={() => setVersionInv((v) => v + 1)} />

      {/*
        Los contadores de arriba dicen CUANTOS. Esto dice que papel, de quien y
        para cuando — lo unico con lo que se puede levantar el telefono.
      */}
      <DocumentAlerts
        onIr={(id) => {
          const prov = provs.find((x) => x.id === id);
          if (prov) void abrirExpediente(prov, 'papeles');
        }}
      />

      {msg ? <Note style={{ marginBottom: 16 }}>{msg}</Note> : null}

      {/* Alta en modal (2026-09-25): antes el formulario empujaba la lista hacia abajo. */}
      <Modal
        abierto={creando}
        titulo="Darlo de alta yo"
        subtitulo="Para cuando ya tienes todos sus datos. Si no, mejor «Invitar aliado» y que él los llene. Con correo, al darlo de alta le llega su enlace al portal."
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
            <input className="adm-input" data-campo="nombre" maxLength={190} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </FormField>
          <FormField label="Teléfono">
            <input className="adm-input" type="tel" inputMode="tel" maxLength={20} placeholder="81 1234 5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <FormField label="Correo">
            <input className="adm-input" type="email" maxLength={190} placeholder="nombre@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <FormField label="Respuesta promedio (minutos)">
            <input className="adm-input adm-num" type="number" min={0} max={10080} step={1} value={form.responseMinutes} onChange={(e) => setForm({ ...form, responseMinutes: e.target.value })} />
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
          <div>Aliado</div><div>Papeles</div><div>Preferente</div><div />
        </div>

        {filtrados.length === 0 ? (
          provs.length === 0
            ? <EmptyState icon="ph-handshake" title="Todavía no hay aliados dados de alta" />
            : <EmptyState icon="ph-handshake" title="No se encontraron aliados" sub="Ajusta la búsqueda." />
        ) : null}

        {filtrados.map((p) => {
          const d = ETIQUETA_DOCS[p.docsStatus];
          const activos = (p.equipment ?? []).filter((e) => !e.pending).length;
          // LIMPIO (2026-10-28): dos líneas por aliado. Contacto, teléfono, meses
          // en la red y la lista de máquinas viven en su expediente.
          const datos = conPuntos([
            p.city,
            p.coverage.length ? `llega a ${p.coverage.length} municipio${p.coverage.length === 1 ? '' : 's'}` : 'sin municipios',
            serviciosCortos(p) || 'sin servicios',
            `${activos} equipo${activos === 1 ? '' : 's'}`,
          ]);
          return (
            // Dado de baja: sigue en la lista, pero apagado.
            <div key={p.id} className="adm-trow pv-row" style={p.status === 1 ? undefined : { opacity: 0.55 }}>
              <div className="pv-c-name" style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="adm-cell-title">{p.name}</span>
                  <Chip tone={p.verified ? 'ok' : 'muted'} title={p.verified ? 'Constancia fiscal y póliza vigentes' : textoFalta(p) || 'Tiene un papel vencido'}>
                    {p.verified ? 'Con sello' : 'Sin sello'}
                  </Chip>
                  {p.pendingCount ? (
                    <button
                      type="button"
                      className="adm-chip t-warn"
                      onClick={() => void abrirExpediente(p, 'equipos')}
                      title="Ofreció algo que no está en tu lista: se decide en Inventario"
                      style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {p.pendingCount} nuevo{p.pendingCount === 1 ? '' : 's'}
                    </button>
                  ) : null}
                </div>
                <div className="adm-cell-sub" style={{ lineHeight: 1.6 }}>{datos}</div>
              </div>
              <div className="pv-c-docs" title={textoFalta(p) || undefined}>
                <span className="pv-m-label">Papeles:</span>
                <StatusText tone={d.tono}>{d.texto}</StatusText>
              </div>
              <div className="pv-c-level">
                <Switch
                  on={p.level === 'preferente'}
                  onClick={() => void cambiarPreferente(p)}
                  label="Preferente"
                  title="Los preferentes salen primero cuando buscas aliado para una solicitud"
                />
              </div>
              <div className="pv-c-act">
                <Btn size="sm" onClick={() => void abrirExpediente(p)}>Expediente</Btn>
              </div>
            </div>
          );
        })}
      </Panel>

      {expediente ? (
        <ExpedienteModal
          p={expediente}
          docs={docs}
          pestanaInicial={pestanaInicial}
          enfocarCorreo={enfocarCorreo && expediente.id === abrir}
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
  p, docs, pestanaInicial = 'datos', enfocarCorreo = false, onCerrar, onAgregar, onBorrar, onRevisado, onEliminar,
}: {
  p: ProviderRow;
  docs: DocRow[];
  pestanaInicial?: Pestana;
  /** Abrir con el cursor en su correo (desde "Agregar su correo" de Pagos). */
  enfocarCorreo?: boolean;
  onCerrar: () => void;
  onAgregar: (kind: string, nombre: string, vence: string) => void;
  onBorrar: (id: number) => void;
  /** Tras un cambio (contacto, ubicación, qué ofrece): mensaje y recarga. */
  onRevisado: (texto: string) => void;
  /** Borra al aliado si no tiene historial; si lo tiene, lo da de baja. */
  onEliminar: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const pendientes = (p.equipment ?? []).filter((e) => e.pending);
  // Lo nuevo arriba: es lo único que está esperando algo.
  const equipos = [...pendientes, ...(p.equipment ?? []).filter((e) => !e.pending)];

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

  const vigentes = docs.filter((d) => !d.reemplazado).length;
  // En una línea, arriba: lo que más se pregunta de un aliado sin abrir nada.
  const resumen = conPuntos([
    p.verified ? <span style={{ color: 'var(--adm-ok)' }}>Con sello</span> : <span>Sin sello{textoFalta(p) ? ` · ${textoFalta(p).toLowerCase()}` : ''}</span>,
    p.level === 'preferente' ? 'Preferente' : null,
    p.status === 1 ? null : <span style={{ color: 'var(--adm-bad)' }}>Dado de baja</span>,
  ]);

  return (
    // El modal del panel (2026-10-08): antes era un overlay propio; este cierra
    // también con Esc y deja la X y el título como en los demás módulos.
    <Modal abierto titulo={`Expediente · ${p.name}`} subtitulo={resumen} onCerrar={onCerrar} ancho={720}>
      {/* PESTAÑAS (2026-10-27): antes eran ocho secciones una debajo de otra y
          lo más básico (contacto y hasta dónde llega) quedaba hasta abajo. Se
          quedan pegadas arriba mientras se baja. */}
      <style>{`
        .pv-tabs { position: sticky; top: -22px; z-index: 3; background: ${D.card}; margin: -22px -22px 20px; padding: 14px 22px; border-bottom: 1px solid var(--adm-border); }
        .pv-tab > section:first-child { border-top: 0 !important; margin-top: 0 !important; padding-top: 0 !important; }
        .adm-trow.pv-eq { display: flex; align-items: center; gap: 12px; padding: 11px 16px; color: inherit; text-decoration: none; }
        .pv-eq:hover .adm-cell-title { color: var(--adm-accent); }
      `}</style>
      <div className="pv-tabs">
        <Segmented<Pestana>
          ariaLabel="Partes del expediente"
          value={pestana}
          onChange={setPestana}
          items={[
            { key: 'datos', label: 'Datos' },
            { key: 'equipos', label: pendientes.length ? `Equipos · ${pendientes.length} nuevo${pendientes.length === 1 ? '' : 's'}` : 'Equipos', count: pendientes.length ? undefined : equipos.length },
            { key: 'papeles', label: 'Papeles', count: vigentes },
            { key: 'cumple', label: 'Cómo cumple' },
          ]}
        />
      </div>

      {pestana === 'datos' ? (
        <div className="pv-tab">
          {/*
            DONDE ESTA Y HASTA DONDE LLEGA. Con esto la cobertura pasa de
            "escribio este municipio?" a "esta a menos de N kilometros?", que es
            la pregunta real y la unica que funciona fuera del area metropolitana.
          */}
          <ContactoAliado p={p} enfocarCorreo={enfocarCorreo} onCambio={onRevisado} />
          <UbicacionAliado p={p} onCambio={onRevisado} />
          {/*
            El acceso del aliado. Es lo que convierte la red de un directorio que
            alguien mantiene a mano en algo que se mantiene solo.
          */}
          <AccesoAliado p={p} />
          <EliminarOReactivar p={p} onEliminar={onEliminar} onRevisado={onRevisado} />
        </div>
      ) : null}

      {pestana === 'cumple' ? (
        <div className="pv-tab">
          {/*
            Los papeles dicen si esta en regla. El cumplimiento dice si CUMPLE,
            que es otra cosa: se puede tener todo vigente y no contestar nunca.
          */}
          <ProviderHistory providerId={p.id} />
        </div>
      ) : null}

      {pestana === 'equipos' ? (
        <div className="pv-tab">
          {/* ── Equipos (limpio, 2026-10-28) ── Una línea por máquina: qué es, de
              qué tipo y si está libre. Nada se publica: lo de un tipo cuenta
              solo y lo "Nuevo" se decide en Inventario, no aquí. */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h3 style={H3}>Equipos</h3>
              <a href={`/productos/nuevo?proveedor=${p.id}`} className={btnClass('secondary', 'sm')}>
                <i className="ph ph-plus" aria-hidden />Agregar equipo
              </a>
            </div>
            {editandoOferta ? (
              <div className="adm-card" style={{ padding: 16, margin: '10px 0 14px' }}>
                <QueOfrece tipo={tipoEdit} onTipo={setTipoEdit} categorias={catsEdit} onCategorias={setCatsEdit} />
                {errorOferta ? <div role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', marginTop: 10 }}>{errorOferta}</div> : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                  <Btn size="sm" variant="ghost" onClick={() => setEditandoOferta(false)}>Cancelar</Btn>
                  {/* Primario dentro de su formulario: solo existe mientras se edita. */}
                  <Btn size="sm" variant="primary" onClick={() => void guardarOferta()}>Guardar</Btn>
                </div>
              </div>
            ) : (
              // Sus servicios en una línea: deciden qué puede ofrecer desde su portal.
              <p style={{ ...DESC, margin: '0 0 14px' }}>
                Da: {serviciosCortos(p) || 'nada todavía'}
                {' · '}
                <button
                  type="button"
                  className="adm-link"
                  style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}
                  onClick={() => { setCatsEdit(p.categories); setTipoEdit(tipoDeCategorias(p.categories)); setErrorOferta(null); setEditandoOferta(true); }}
                >
                  cambiar
                </button>
              </p>
            )}

            {equipos.length === 0 ? (
              <p style={VACIO}>Todavía no tiene equipos. Los agrega él desde su portal, o tú con «Agregar equipo».</p>
            ) : (
              <Panel flush clip>
                {equipos.map((e) => {
                  const disp = presentacionEstado(e.availability);
                  const sub = [e.pending ? null : e.tipo, e.brand, e.location].filter(Boolean).join(' · ');
                  return (
                    <a key={e.id} href={`/productos/editar/${e.id}`} className="adm-trow pv-eq">
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="adm-cell-title" style={{ display: 'block' }}>{e.name}</span>
                        {sub ? <span className="adm-cell-sub" style={{ display: 'block' }}>{sub}</span> : null}
                      </span>
                      {e.pending ? (
                        <Chip tone="warn" title="No está en tu lista de tipos: se decide en Inventario">Nuevo</Chip>
                      ) : (
                        <StatusText color={colorVivo(disp)} title={disp.nota}>{disp.nombre}</StatusText>
                      )}
                    </a>
                  );
                })}
              </Panel>
            )}
            {pendientes.length ? (
              <p style={{ ...DESC, margin: '10px 0 0' }}>
                Lo <strong style={{ color: 'var(--adm-warn)', fontWeight: 600 }}>Nuevo</strong> no está en tu lista de tipos: se decide en{' '}
                <a href="/catalogo/servicios" className="adm-link">Inventario</a>. Mientras, no le llegan solicitudes de eso.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {pestana === 'papeles' ? (
        <div className="pv-tab">
          <section style={SECCION}>
            <h3 style={H3}>Papeles</h3>
            <p style={DESC}>
              El sello sale solo cuando su constancia fiscal y su póliza de seguro están vigentes. Si un papel no sirve, quítalo y el sello se va con él.
              {textoFalta(p) ? <> <strong style={{ color: 'var(--adm-warn)', fontWeight: 600 }}>{textoFalta(p)}.</strong></> : null}
            </p>

            {docs.length === 0 ? (
              <p style={VACIO}>Sin documentos cargados.</p>
            ) : (
              <Panel flush clip>
                {/* Los reemplazados al final y en gris: siguen ahí (con su foto),
                    pero ya no cuentan. Antes la constancia vieja seguía en rojo
                    junto a la renovada y parecía que nada había cambiado. */}
                {[...docs].sort((a, b) => Number(!!a.reemplazado) - Number(!!b.reemplazado)).map((d) => {
                  const vencido = !d.reemplazado && d.expiresAt !== null && d.expiresAt < hoy;
                  return (
                    <div key={d.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', opacity: d.reemplazado ? 0.6 : 1 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--adm-text)' }}>{d.name || TIPOS_DOC.find(([k]) => k === d.kind)?.[1] || d.kind}</div>
                        <div className="adm-num" style={{ fontSize: 12, color: vencido ? 'var(--adm-bad)' : 'var(--adm-muted)', marginTop: 2 }}>
                          {d.reemplazado
                            ? `Reemplazado por su renovación${d.expiresAt ? ` · vencía el ${d.expiresAt}` : ''}`
                            : d.expiresAt ? (vencido ? `Venció el ${d.expiresAt}` : `Vigente hasta ${d.expiresAt}`) : 'Sin vencimiento'}
                          {d.fileUrl ? '' : ' · sin foto'}
                        </div>
                      </div>
                      {/* La foto que subió el aliado: es lo que se revisa para saber si el
                          papel sirve. Abre en otra pestaña. */}
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
                  <AdminDatePicker value={vence} onChange={setVence} placeholder="No vence" />
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
        </div>
      ) : null}
    </Modal>
  );
}


/** Eliminar (altas duplicadas o por error; con historial solo se da de baja) o reactivar al dado de baja. */
function EliminarOReactivar({ p, onEliminar, onRevisado }: { p: ProviderRow; onEliminar: () => void; onRevisado: (texto: string) => void }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  return (
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
  );
}

/**
 * SU CONTACTO (2026-10-27). Antes el correo y el teléfono solo se ponían al
 * darlo de alta: un aliado sin correo no recibía recordatorios ni su enlace, y
 * no había dónde agregárselo. El cambio de correo queda en la bitácora del
 * panel (es a donde llega su enlace de acceso).
 */
function ContactoAliado({ p, enfocarCorreo, onCambio }: { p: ProviderRow; enfocarCorreo: boolean; onCambio: (texto: string) => void }) {
  const [contacto, setContacto] = useState(p.contactName ?? '');
  const [telefono, setTelefono] = useState(p.phone ?? '');
  const [correo, setCorreo] = useState(p.email ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campoCorreo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!enfocarCorreo) return;
    const t = setTimeout(() => { campoCorreo.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); campoCorreo.current?.focus({ preventScroll: true }); }, 250);
    return () => clearTimeout(t);
  }, [enfocarCorreo]);

  const cambios = contacto.trim() !== (p.contactName ?? '') || telefono.trim() !== (p.phone ?? '') || correo.trim() !== (p.email ?? '');

  async function guardar() {
    setOcupado(true); setMsg(null);
    const r = await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactName: contacto.trim() || null, phone: telefono.trim() || null, email: correo.trim() || null }),
    });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setMsg(d?.message && d.message !== 'Datos inválidos' ? d.message : 'Revisa el teléfono y el correo: alguno no es válido.'); return; }
    onCambio(`${p.name}: contacto guardado.${correo.trim() && !p.email ? ' Ya le llegan sus recordatorios y su enlace por correo.' : ''}`);
  }

  return (
    <section style={SECCION}>
      <h3 style={H3}>Su contacto</h3>
      <p style={DESC}>A este correo le llegan sus solicitudes, su enlace de acceso y los recordatorios de facturas y pagos. Sin correo, todo eso se le avisa por teléfono.</p>
      <div className="adm-form-grid">
        <FormField label="Nombre del contacto">
          <input className="adm-input" maxLength={190} value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Juan Pérez" />
        </FormField>
        <FormField label="Teléfono">
          <input className="adm-input" inputMode="tel" maxLength={40} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="81 1234 5678" />
        </FormField>
        <FormField label="Correo" style={{ gridColumn: '1 / -1' }}>
          <input ref={campoCorreo} className="adm-input" type="email" maxLength={190} value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@empresa.com" />
        </FormField>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn variant={cambios ? 'primary' : 'secondary'} icon="ph-floppy-disk" onClick={guardar} disabled={ocupado || !cambios}>
          {ocupado ? 'Guardando…' : 'Guardar contacto'}
        </Btn>
        {!p.email ? <StatusText tone="warn">Sin correo</StatusText> : null}
      </div>
      {msg ? <div style={{ ...AVISO, marginTop: 12 }}>{msg}</div> : null}
    </section>
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
        <MapaCobertura alto={240} tema="oscuro" puntos={puntosMapa} onMover={fijar} />
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
