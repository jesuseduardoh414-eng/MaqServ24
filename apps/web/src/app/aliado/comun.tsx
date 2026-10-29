'use client';

import Link from 'next/link';
import { mostrarResultado } from '@maqserv/ui';
import { Icon, type IconName } from '@/components/Icon';
import type { Pago, Pedido } from './tipos';

/**
 * PIEZAS Y AYUDAS QUE COMPARTEN LAS PANTALLAS DEL PORTAL (2026-10-27).
 *
 * Salió de PortalAliado.tsx al partirlo en vistas. Aquí solo va lo que usan
 * dos o más pantallas: formatos de dinero y fecha, los catálogos de estados,
 * la llamada a la API con su aviso, y las piezas chicas (chip, insignia,
 * título de sección, barra, dato, estado vacío).
 */

export const API = '/api/proxy';

/** Tono del chip: verde ok, ámbar advierte, rojo vencido, azul dato; '' neutro. */
export type Tono = 'ok' | 'warn' | 'bad' | 'info' | '';

export const VERDE = 'var(--color-success)';
export const AMBAR = 'var(--color-warning)';
export const ROJO = 'var(--color-error)';
export const AZUL = 'var(--color-primary)';
export const GRIS = 'var(--color-text-muted)';

// ───────────────────────── formatos ─────────────────────────

export const dinero = (n: number | null | undefined) =>
  n ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : null;

export const pagoTexto = (p: Pago | null | undefined) => (p && p.monto > 0 ? `${dinero(p.monto)}${p.masIva ? ' + IVA' : ''}` : null);

/** Minutos desde `iso` (0 si no hay fecha). */
export const minutosDesde = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0;

export function hace(iso: string | null | undefined): string {
  if (!iso) return '';
  const min = minutosDesde(iso);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

export const fechaHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

/** "lunes 27 de octubre". */
export const fechaLarga = (d: Date) => d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

/** Mañana a las 8:00, en el formato de un input datetime-local. */
export function mananaOcho(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`;
}

/** Hoy en Monterrey, AAAA-MM-DD. */
export const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
/** "28 oct" a partir de AAAA-MM-DD. */
export const diaCorto = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'A';

// ───────────────────────── catálogos ─────────────────────────

/**
 * El siguiente paso que el aliado reporta, según dónde va el servicio
 * (2026-09-25). Un botón a la vez: en obra no hay tiempo para menús.
 */
export const SIGUIENTE: Record<string, { estado: string; texto: string; ayuda: string } | undefined> = {
  asignado: { estado: 'en_traslado', texto: 'Ya salió la unidad', ayuda: 'Al tocarlo, el cliente recibe "tu unidad va en camino".' },
  en_traslado: { estado: 'en_sitio', texto: 'Ya llegué a la obra', ayuda: 'Queda registrada la hora real de llegada.' },
  en_sitio: { estado: 'en_curso', texto: 'Empecé el trabajo', ayuda: 'Desde aquí corre el servicio o la renta.' },
  en_curso: { estado: 'terminado', texto: 'Terminé el trabajo', ayuda: 'MAQSER24 registra horas o viajes y cierra el servicio.' },
};

/** Icono de cada paso de avance (solo presentación). */
export const ICONO_AVANCE: Record<string, IconName> = {
  en_traslado: 'truck',
  en_sitio: 'mapPin',
  en_curso: 'clock',
  terminado: 'check',
};

/*
 * Colores de ESTADOS_DISPONIBILIDAD (@maqserv/config, inyectados por el tema
 * como `--estado-<clave>`): los mismos que ve MAQSER24 en su panel. Para el
 * aliado, "limitada" sigue leyéndose "Disponible" (y en verde). "Sin unidades"
 * no es un estado de disponibilidad: conserva el rojo de alerta.
 */
export const ESTADO_EQUIPO: Record<string, { label: string; tono?: Tono; color?: string }> = {
  disponible: { label: 'Disponible', color: 'var(--estado-disponible)' },
  limitada: { label: 'Disponible', color: 'var(--estado-disponible)' },
  'por-confirmar': { label: 'Por confirmar', color: 'var(--estado-por-confirmar)' },
  reservado: { label: 'Reservado', color: 'var(--estado-reservado)' },
  'en-traslado': { label: 'En traslado', color: 'var(--estado-en-traslado)' },
  'en-servicio': { label: 'En servicio', color: 'var(--estado-en-servicio)' },
  mantenimiento: { label: 'Mantenimiento', color: 'var(--estado-mantenimiento)' },
  inactivo: { label: 'Inactivo', color: 'var(--estado-inactivo)' },
  agotado: { label: 'Sin unidades', tono: 'bad' },
};

export const ESTADO_DOCS: Record<string, { label: string; tono: Tono; color: string }> = {
  'al-dia': { label: 'Al día', tono: 'ok', color: VERDE },
  'por-vencer': { label: 'Por vencer', tono: 'warn', color: AMBAR },
  vencido: { label: 'Vencido', tono: 'bad', color: ROJO },
  incompleto: { label: 'Faltan papeles', tono: 'warn', color: AMBAR },
  'sin-documentos': { label: 'Sin papeles', tono: 'bad', color: ROJO },
};

export const estadoDocs = (estado: string) => ESTADO_DOCS[estado] ?? { label: estado, tono: 'warn' as Tono, color: AMBAR };

// ───────────────────────── API ─────────────────────────

// Al aviso flotante (ResultadosHost): el letrero de arriba quedaba fuera de
// la vista cuando la acción estaba más abajo en la página.
export const avisar = (texto: string, ok = true) => mostrarResultado(texto, ok ? 'ok' : 'bad');

/**
 * Una llamada al proxy con el aviso de error ya resuelto. La credencial del
 * aliado vive en una cookie httpOnly que el proxy adjunta; este código nunca
 * la ve.
 */
export async function llamar(url: string, body?: unknown, method: 'PATCH' | 'POST' | 'DELETE' | 'PUT' = 'PATCH'): Promise<boolean> {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!r?.ok) {
    const j = await r?.json().catch(() => null);
    avisar(j?.message ?? 'No se pudo guardar. Intenta otra vez.', false);
    return false;
  }
  return true;
}

// ───────────────────────── piezas ─────────────────────────

/** `color` (valor CSS) para estados con color propio; gana sobre `tono`. */
export function Chip({ children, tono = '', color }: { children: React.ReactNode; tono?: Tono; color?: string }) {
  const estilo = color
    ? { color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }
    : undefined;
  return <span className={`ms-chip ms-chip-dot${tono ? ` ms-chip-${tono}` : ''}`} style={estilo}>{children}</span>;
}

/** Contador redondo para el menú y las pestañas ("Solicitudes 3"). */
export function Insignia({ n, tono = 'info' }: { n: number; tono?: 'info' | 'warn' | 'bad' | 'muted' }) {
  if (!n) return null;
  return <span className="al-insignia" data-tono={tono}>{n}</span>;
}

/** Encabezado de pantalla: título, descripción y acción opcional. */
export function Encabezado({ titulo, desc, accion }: { titulo: React.ReactNode; desc?: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <header className="ms-head al-vh">
      <div className="ms-head-txt">
        <h1 className="ms-title">{titulo}</h1>
        {desc ? <p className="ms-desc">{desc}</p> : null}
      </div>
      {accion ? <div>{accion}</div> : null}
    </header>
  );
}

/** Encabezado de sección dentro de una pantalla: título en tipo oración, descripción y acción opcional. */
export function Titulo({ children, desc, extra, chip }: { children: React.ReactNode; desc?: React.ReactNode; extra?: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <div className="ms-sec-head">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="ms-h2">{children}</h2>
          {chip}
        </div>
        {desc ? <p className="ms-h2-desc">{desc}</p> : null}
      </div>
      {extra}
    </div>
  );
}

export function Barra({ valor, color = AZUL }: { valor: number; color?: string }) {
  return (
    <div className="al-barra">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%`, background: color }} />
    </div>
  );
}

export function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="al-dato-l">{label}</div>
      <div className="al-dato-v">{valor || '—'}</div>
    </div>
  );
}

/**
 * Lo que pide el cliente, ordenado con las preguntas de su línea: lo que el
 * documento dice que cada proveedor necesita para decidir (fechas y equipo;
 * viajes, destino y frecuencia; cantidad, destino y ventana de entrega).
 */
export function LoQuePide({ pedido }: { pedido?: Pedido }) {
  if (!pedido?.length) return null;
  return (
    <div className="al-pide">
      <span className="al-dato-l">Lo que pide</span>
      <dl>
        {pedido.map((p) => (
          <div key={p.label}><dt>{p.label}</dt><dd>{p.valor}</dd></div>
        ))}
      </dl>
    </div>
  );
}

/**
 * El documento de la cotización tal como lo recibió el cliente (2026-10-19):
 * folio, partidas, condiciones y firma, para verlo o guardarlo en PDF.
 */
export function VerDocumento({ assignmentId, folio }: { assignmentId: number; folio?: string }) {
  return (
    // Puede partirse en dos renglones (2026-10-28): con el folio no cabía en 360 px y la página se deslizaba de lado.
    <Link href={`/aliado/cotizacion/${assignmentId}`} className="ms-btn ms-btn-sec ms-btn-sm" style={{ marginTop: 12, whiteSpace: 'normal', height: 'auto', minHeight: 36, textAlign: 'left', maxWidth: '100%' }}>
      <Icon name="article" size={15} />Ver documento de la cotización{folio ? ` ${folio}` : ''}
    </Link>
  );
}

/** Estado vacío de una lista: dice qué es y qué hacer para llenarla. */
export function Vacio({
  icono,
  titulo,
  texto,
  accion,
  tono,
}: {
  icono: IconName;
  titulo: string;
  texto: React.ReactNode;
  accion?: { texto: string; onClick: () => void; icono?: IconName };
  tono?: 'ok' | 'muted';
}) {
  return (
    <div className="ms-empty al-vacio">
      <span className={`ms-ico${tono ? ` ms-ico-${tono}` : ''}`} aria-hidden><Icon name={icono} size={19} /></span>
      <p className="ms-h3" style={{ marginTop: 10 }}>{titulo}</p>
      <p className="ms-empty-p">{texto}</p>
      {accion ? (
        <div className="ms-empty-acts">
          <button type="button" className="ms-btn" onClick={accion.onClick}>
            {accion.icono ? <Icon name={accion.icono} size={16} /> : null}{accion.texto}
          </button>
        </div>
      ) : null}
    </div>
  );
}
