import { redirect } from 'next/navigation';
import Link from 'next/link';
import { puedeVer, type ModuloAdmin } from '@maqserv/config';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Bar, Btn, Chip, EmptyState, GroupLabel, Note, PageHeader, Panel, PanelLink, StatusText, type Tone } from '@/components/ui';

/**
 * INICIO DEL PANEL (rediseño, 2026-10-08).
 *
 * Antes eran dos tarjetas y una lista corta; no decía en qué iba la operación.
 * Ahora responde, en este orden, lo que pregunta quien abre el panel:
 *
 *  1. ¿En qué va el flujo? Las cuatro etapas del menú (Recibir, Cotizar y
 *     asignar, Ejecutar, Cobrar y medir) con su número y lo que está trabado.
 *  2. ¿Qué tengo que hacer? "Por atender", ordenado por urgencia.
 *  3. ¿Qué viene? Llegadas comprometidas de los próximos 7 días.
 *  4. ¿Cómo está la red? Aliados, fichas y qué tan fresca es la disponibilidad.
 *  5. ¿Qué llegó? Las últimas solicitudes.
 *
 * Sin "Actividad reciente" ni "Nueva ficha" (2026-10-08): la actividad ya la
 * da la campana y repetirla aquí era ruido; dar de alta fichas es de Inventario.
 *
 * Diseño formal (2026-10-08, tarde): el flujo dejó de ser cuatro tarjetas con
 * una cifra enorme; son columnas de texto separadas por una línea, y "Por
 * atender" es una lista agrupada por urgencia dentro de un solo panel.
 *
 * Cada bloque se enseña solo si el rol tiene su módulo: Marca no ve servicios,
 * Red de Aliados no ve solicitudes. Los datos salen de `admin/inicio`.
 */

interface Inicio {
  flujo: {
    recibir: { sinResponder: number; esperandoCliente: number; mensajes: number };
    asignar: { porAsignar: number; propuestas: number; propuestasViejas: number };
    ejecutar: { enCurso: number; enTraslado: number; enSitio: number; terminados: number; incidencias: number };
    medir: { cerradosMes: number; valorMes: number; conversionMes: number | null };
  };
  mes: { solicitudes: number; solicitudesAnterior: number; aceptadas: number; cerrados: number };
  red: { aliados: number; fichas: number; fichasConfirmadas: number; ofertas: number; papelesVencidos: number; papelesPorVencer: number; diasFrescura: number };
  sitio: { resenas: number; preguntas: number };
  proximos: Array<{ id: number; fecha: string; folio: string; obra: string | null; municipio: string | null; cliente: string; categoria: string | null; aliado: string; estado: string }>;
  recientes: Array<{ id: number; folio: string; cliente: string; categoria: string | null; estado: string; tono: 'atiende' | 'bien' | 'mal' | 'neutro'; fecha: string | null; total: number }>;
}

const TZ = 'America/Monterrey';
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

/** "hace 5 min", "hace 3 h", "hace 2 d"; más allá, la fecha. */
function hace(iso: string | null): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));
}

/** Día calendario en Monterrey, para agrupar sin que el servidor en UTC mueva la fecha. */
const diaDe = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

type Nivel = 'urgente' | 'pendiente' | 'aviso';
interface Pendiente { n: number; nivel: Nivel; label: string; sub: string; href: string; icon: string; modulo: ModuloAdmin }
const TONO_NIVEL: Record<Nivel, Tone> = { urgente: 'bad', pendiente: 'accent', aviso: 'info' };
const TITULO_NIVEL: Record<Nivel, string> = { urgente: 'Urgente', pendiente: 'Pendiente', aviso: 'Para revisar' };

interface Etapa {
  paso: string;
  titulo: string;
  href: string;
  valor: string;
  etiqueta: string;
  /** Tono del número de paso; `bad` también pinta la cifra (algo está trabado). */
  tono: Tone;
  lineas: Array<{ texto: string; n: string; tono?: Tone }>;
}

export default async function AdminHome() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const d = await adminFetch<Inicio>('/admin/inicio');

  // Mismo criterio que `exigirModulo`: los permisos vigentes si llegaron, si no la tabla del código.
  const puede = (m: ModuloAdmin) => (admin.modulos.length ? admin.modulos.includes(m) : puedeVer(admin.rol, m));

  const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date());

  // ── 1. El flujo ────────────────────────────────────────────────────────
  const etapas: Etapa[] = [];
  if (d) {
    const f = d.flujo;
    if (puede('cotizaciones') || puede('cotizador') || puede('comunidad')) {
      etapas.push({
        paso: '1', titulo: 'Recibir', href: puede('cotizaciones') ? '/cotizaciones' : '/mensajes',
        valor: String(f.recibir.sinResponder), etiqueta: 'por cotizar',
        tono: f.recibir.sinResponder > 0 ? 'accent' : 'muted',
        lineas: [
          { texto: 'Cotizadas, esperando al cliente', n: String(f.recibir.esperandoCliente) },
          { texto: 'Mensajes sin atender', n: String(f.recibir.mensajes), tono: f.recibir.mensajes > 0 ? 'warn' : undefined },
          { texto: 'Solicitudes este mes', n: String(d.mes.solicitudes) },
        ],
      });
    }
    if (puede('servicios')) {
      etapas.push({
        paso: '2', titulo: 'Cotizar y asignar', href: '/servicios',
        valor: String(f.asignar.porAsignar), etiqueta: 'por asignar',
        tono: f.asignar.propuestasViejas > 0 ? 'bad' : f.asignar.porAsignar > 0 ? 'accent' : 'muted',
        lineas: [
          { texto: 'Ofrecidos, esperando al aliado', n: String(f.asignar.propuestas) },
          { texto: 'Sin respuesta en más de 24 h', n: String(f.asignar.propuestasViejas), tono: f.asignar.propuestasViejas > 0 ? 'bad' : undefined },
        ],
      });
      etapas.push({
        paso: '3', titulo: 'Ejecutar', href: '/servicios',
        valor: String(f.ejecutar.enCurso), etiqueta: 'en marcha con aliado',
        tono: f.ejecutar.incidencias > 0 ? 'bad' : f.ejecutar.enCurso > 0 ? 'ok' : 'muted',
        lineas: [
          { texto: 'En traslado', n: String(f.ejecutar.enTraslado) },
          { texto: 'En obra', n: String(f.ejecutar.enSitio) },
          { texto: 'Incidencias abiertas', n: String(f.ejecutar.incidencias), tono: f.ejecutar.incidencias > 0 ? 'bad' : undefined },
        ],
      });
    }
    if (puede('indicadores')) {
      const delta = d.mes.solicitudes - d.mes.solicitudesAnterior;
      etapas.push({
        paso: '4', titulo: 'Cobrar y medir', href: '/indicadores',
        valor: money(f.medir.valorMes), etiqueta: 'aceptado este mes',
        tono: f.medir.valorMes > 0 ? 'ok' : 'muted',
        lineas: [
          { texto: 'Servicios cerrados este mes', n: String(f.medir.cerradosMes) },
          { texto: 'Conversión del mes', n: f.medir.conversionMes === null ? '—' : `${f.medir.conversionMes}%` },
          { texto: 'Solicitudes vs. mes pasado', n: `${delta > 0 ? '+' : ''}${delta}`, tono: delta > 0 ? 'ok' : delta < 0 ? 'warn' : undefined },
        ],
      });
    }
  }

  // ── 2. Por atender ─────────────────────────────────────────────────────
  const pendientes: Pendiente[] = d
    ? ([
      { n: d.flujo.ejecutar.incidencias, nivel: 'urgente', label: 'Incidencias abiertas', sub: 'Servicios con un problema en obra', href: '/servicios', icon: 'ph-warning-octagon', modulo: 'servicios' },
      { n: d.flujo.asignar.propuestasViejas, nivel: 'urgente', label: 'Aliados sin contestar', sub: 'Ofrecidos hace más de 24 h; el cliente ya aceptó', href: '/servicios', icon: 'ph-hourglass-high', modulo: 'servicios' },
      { n: d.red.papelesVencidos, nivel: 'urgente', label: 'Aliados con papeles vencidos', sub: 'Perdieron el sello de verificado', href: '/proveedores', icon: 'ph-warning-circle', modulo: 'proveedores' },
      { n: d.flujo.recibir.sinResponder, nivel: 'pendiente', label: 'Solicitudes por cotizar', sub: 'Llegaron sin precio; el cliente espera respuesta', href: '/cotizaciones', icon: 'ph-tray', modulo: 'cotizaciones' },
      { n: d.flujo.asignar.porAsignar, nivel: 'pendiente', label: 'Servicios por asignar', sub: 'El cliente aceptó; falta el aliado', href: '/servicios', icon: 'ph-user-switch', modulo: 'servicios' },
      { n: d.flujo.ejecutar.terminados, nivel: 'pendiente', label: 'Terminados sin cerrar', sub: 'Falta registrar cantidades y cierre', href: '/servicios', icon: 'ph-flag-checkered', modulo: 'servicios' },
      { n: d.flujo.recibir.mensajes, nivel: 'pendiente', label: 'Mensajes sin atender', sub: 'Escribieron por la página de Contacto', href: '/mensajes', icon: 'ph-chat-centered-text', modulo: 'comunidad' },
      { n: d.red.ofertas, nivel: 'pendiente', label: 'Equipos por revisar', sub: 'Los ofrecieron aliados desde su portal', href: '/proveedores', icon: 'ph-package', modulo: 'proveedores' },
      { n: d.red.papelesPorVencer, nivel: 'aviso', label: 'Papeles por vencer', sub: 'Dentro de los próximos 30 días', href: '/proveedores', icon: 'ph-clock-countdown', modulo: 'proveedores' },
      { n: d.red.fichas - d.red.fichasConfirmadas, nivel: 'aviso', label: 'Disponibilidad por confirmar', sub: `Fichas sin confirmar en ${d.red.diasFrescura} días`, href: '/disponibilidad', icon: 'ph-calendar-x', modulo: 'disponibilidad' },
      { n: d.sitio.resenas, nivel: 'aviso', label: 'Reseñas por moderar', sub: 'Esperan aprobación para publicarse', href: '/resenas', icon: 'ph-star', modulo: 'comunidad' },
      { n: d.sitio.preguntas, nivel: 'aviso', label: 'Preguntas sin responder', sub: 'Las hizo el público en el sitio', href: '/preguntas', icon: 'ph-chats-circle', modulo: 'comunidad' },
    ] satisfies Pendiente[]).filter((p) => p.n > 0 && puede(p.modulo))
    : [];
  const urgentes = pendientes.filter((p) => p.nivel === 'urgente').length;
  const resumen = pendientes.length === 0
    ? 'Todo al día: no hay nada pendiente por atender.'
    : urgentes > 0
      ? `${urgentes} ${urgentes === 1 ? 'asunto urgente' : 'asuntos urgentes'} y ${pendientes.length - urgentes} pendientes más.`
      : `Tienes ${pendientes.length} ${pendientes.length === 1 ? 'pendiente' : 'pendientes'} por atender.`;
  const niveles = (['urgente', 'pendiente', 'aviso'] as const)
    .map((nivel) => ({ nivel, items: pendientes.filter((p) => p.nivel === nivel) }))
    .filter((g) => g.items.length > 0);

  // ── 3. Próximos 7 días, agrupados por día ──────────────────────────────
  const hoyKey = diaDe(new Date());
  const mananaKey = diaDe(new Date(Date.now() + 86400000));
  const porDia = new Map<string, Inicio['proximos']>();
  for (const p of d?.proximos ?? []) {
    const k = diaDe(new Date(p.fecha));
    porDia.set(k, [...(porDia.get(k) ?? []), p]);
  }
  const etiquetaDia = (k: string, iso: string) =>
    k === hoyKey ? 'Hoy' : k === mananaKey ? 'Mañana'
      : new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));

  const confirmadaPct = d && d.red.fichas > 0 ? Math.round((d.red.fichasConfirmadas / d.red.fichas) * 100) : 0;
  const tonoConfirmada: Tone = confirmadaPct >= 70 ? 'ok' : confirmadaPct >= 40 ? 'warn' : 'bad';
  const TONO: Record<Inicio['recientes'][number]['tono'], Tone> = { atiende: 'warn', bien: 'ok', mal: 'bad', neutro: 'info' };

  const verDerecha = (puede('agenda') || puede('proveedores') || puede('catalogo')) && Boolean(d);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <style>{`
        /* El flujo: columnas de texto separadas por una línea, sin tarjetas. */
        .in-flow { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); margin-bottom: 34px; }
        .in-stage { min-width: 0; padding: 0 24px; border-left: 1px solid var(--adm-border-strong); color: inherit; text-decoration: none; }
        .in-stage:first-child { padding-left: 0; border-left: 0; }
        .in-stage-top { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--adm-text-2); }
        .in-stage:hover .in-stage-top { color: var(--adm-text); }
        .in-stage:hover .in-arrow { color: var(--adm-text); transform: translateX(2px); }
        .in-step { width: 18px; height: 18px; border-radius: 5px; display: grid; place-items: center; font-size: 11px; font-weight: 600; color: var(--tone); background: color-mix(in srgb, var(--tone) 15%, transparent); }
        .in-step.t-muted { color: var(--adm-muted); background: rgba(255,255,255,0.06); }
        .in-arrow { margin-left: auto; font-size: 13px; color: var(--adm-faint); transition: color .15s ease, transform .15s ease; }
        .in-lines { margin: 12px 0 0; padding: 0; display: grid; gap: 5px; }
        .in-lines div { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--adm-muted); }
        .in-lines dd { margin: 0; font-weight: 600; color: var(--adm-text-2); font-variant-numeric: tabular-nums; }
        .in-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 380px); gap: 20px; align-items: start; }
        /* minmax(0,…): sin esto, un texto largo en una sola línea (los nombres de
           prueba) ensanchaba la columna y la página se salía por la derecha. */
        .in-col > .adm-panel + .adm-panel { margin-top: 0; }
        .in-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; min-width: 0; }
        .in-task { display: flex; align-items: center; gap: 14px; padding: 11px 20px; color: inherit; text-decoration: none; transition: background .12s ease; }
        .in-task:hover { background: rgba(255,255,255,0.02); }
        .in-task:hover .in-arrow { color: var(--adm-text); }
        .in-task > i.ph:first-child { font-size: 19px; flex-shrink: 0; color: var(--tone); }
        .in-row { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto; gap: 14px; align-items: center; color: inherit; text-decoration: none; }
        .in-ev { display: flex; gap: 12px; padding: 8px 20px 10px; }
        .in-ev-bar { width: 2px; border-radius: 2px; background: var(--adm-border-strong); flex-shrink: 0; }
        .in-red { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .in-red > div { padding: 0 14px; border-left: 1px solid var(--adm-border); }
        .in-red > div:first-child { padding-left: 0; border-left: 0; }
        .in-red b { display: block; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        .in-red span { display: block; margin-top: 2px; font-size: 12px; line-height: 1.4; color: var(--adm-muted); }
        @media (max-width: 1280px) { .in-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 900px) {
          .in-flow { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 0; }
          .in-stage { padding: 0 18px; }
          .in-stage:nth-child(odd) { padding-left: 0; border-left: 0; }
        }
        @media (max-width: 640px) {
          .in-flow { grid-template-columns: minmax(0, 1fr); }
          .in-stage { padding: 0; border-left: 0; }
          .in-row { grid-template-columns: minmax(0, 1fr) auto; } .in-row .in-hide-sm { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .in-arrow, .in-task { transition: none; } }
      `}</style>

      {/* ── Encabezado ───────────────────────────────────────────── */}
      <PageHeader
        eyebrow={`${fecha}${admin.rolNombre ? ` · ${admin.rolNombre}` : ''}`}
        title={`${saludo()}, ${admin.name.split(' ')[0]}`}
        subtitle={<span style={urgentes > 0 ? { color: 'var(--adm-bad)' } : undefined}>{resumen}</span>}
        actions={puede('cotizador') ? (
          <>
            <Btn href="/cotizador/maquinaria" icon="ph-tractor">Cotizar maquinaria</Btn>
            <Btn href="/cotizador/triturados" icon="ph-mountains">Cotizar triturados</Btn>
          </>
        ) : null}
      />

      {!d ? (
        <Note tone="bad" style={{ marginBottom: 24 }}>
          No se pudo cargar el resumen. Recarga la página; si sigue igual, la API no está respondiendo.
        </Note>
      ) : null}

      {/* ── 1. El flujo ──────────────────────────────────────────── */}
      {etapas.length > 0 ? (
        <section className="in-flow" aria-label="El flujo ahora: Recibir, Cotizar, Ejecutar, Cobrar">
          {etapas.map((e) => (
            <Link key={e.paso} href={e.href} className="in-stage">
              <div className="in-stage-top">
                <span className={`in-step t-${e.tono}`}>{e.paso}</span>
                {e.titulo}
                <i className="ph ph-arrow-right in-arrow" aria-hidden />
              </div>
              <div className="adm-stat-line">
                <span className={`adm-stat-value${e.tono === 'bad' ? ' t-bad' : ''}`}>{e.valor}</span>
                <span className="adm-stat-hint">{e.etiqueta}</span>
              </div>
              <dl className="in-lines">
                {e.lineas.map((l) => (
                  <div key={l.texto}>
                    <dt>{l.texto}</dt>
                    <dd className={l.tono ? `adm-tone t-${l.tono}` : undefined}>{l.n}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </section>
      ) : null}

      <div className="in-grid" style={verDerecha ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {/* ── Columna principal ──────────────────────────────────── */}
        <div className="in-col">
          {/* 2. Por atender */}
          <Panel title="Por atender" icon="ph-list-checks" flush clip action={pendientes.length > 0 ? <span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Primero lo urgente</span> : undefined}>
            {pendientes.length === 0 ? (
              <EmptyState icon="ph-check-circle" title="Todo al día" sub="Aquí aparece lo que necesite una decisión." />
            ) : (
              <div style={{ paddingBottom: 8 }}>
                {niveles.map((g) => (
                  <div key={g.nivel}>
                    <GroupLabel tone={TONO_NIVEL[g.nivel]} count={g.items.length}>{TITULO_NIVEL[g.nivel]}</GroupLabel>
                    {g.items.map((t) => (
                      <Link key={t.label} href={t.href} className={`in-task t-${TONO_NIVEL[t.nivel]}`}>
                        <i className={`ph ${t.icon}`} aria-hidden />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span className="adm-cell-title" style={{ display: 'block' }}>{t.label}</span>
                          <span className="adm-cell-sub adm-ellipsis" style={{ display: 'block' }}>{t.sub}</span>
                        </span>
                        <span className="adm-num" style={{ fontSize: 15, fontWeight: 600, color: t.nivel === 'urgente' ? 'var(--adm-bad)' : 'var(--adm-text)' }}>{t.n}</span>
                        <i className="ph ph-arrow-right in-arrow" aria-hidden style={{ marginLeft: 0 }} />
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* 5. Últimas solicitudes */}
          {puede('cotizaciones') && d ? (
            <Panel title="Últimas solicitudes" icon="ph-tray" flush clip action={<PanelLink href="/cotizaciones">Ver la bandeja</PanelLink>}>
              {d.recientes.length === 0 ? (
                <EmptyState icon="ph-tray" title="Todavía no llega ninguna solicitud" />
              ) : d.recientes.map((r) => (
                <Link key={r.id} href="/cotizaciones" className="adm-trow in-row">
                  <span style={{ minWidth: 0 }}>
                    <span className="adm-cell-title adm-ellipsis" style={{ display: 'block' }}>{r.cliente}</span>
                    <span className="adm-cell-sub adm-ellipsis" style={{ display: 'block' }}>
                      <span className="adm-mono">{r.folio}</span>{r.categoria ? ` · ${r.categoria}` : ''}
                    </span>
                  </span>
                  <span className="in-hide-sm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0 }}>
                    <StatusText tone={TONO[r.tono]}>{r.estado}</StatusText>
                    <span style={{ fontSize: 12, color: 'var(--adm-faint)' }}>{hace(r.fecha)}</span>
                  </span>
                  <span className="adm-num" style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{money(r.total)}</span>
                </Link>
              ))}
            </Panel>
          ) : null}
        </div>

        {/* ── Columna lateral ────────────────────────────────────── */}
        {verDerecha ? (
          <div className="in-col">
            {/* 3. Próximos 7 días */}
            {puede('agenda') && d ? (
              <Panel title="Próximos 7 días" icon="ph-calendar-blank" flush clip action={<PanelLink href="/agenda">Agenda</PanelLink>}>
                {porDia.size === 0 ? (
                  <p style={{ margin: 0, padding: '28px 20px', textAlign: 'center', fontSize: 13.5, color: 'var(--adm-muted)' }}>
                    Sin llegadas comprometidas esta semana.
                  </p>
                ) : (
                  <div style={{ paddingBottom: 8 }}>
                    {[...porDia.entries()].map(([k, items]) => (
                      <div key={k}>
                        <GroupLabel tone={k === hoyKey ? 'accent' : undefined}>{etiquetaDia(k, items[0].fecha)}</GroupLabel>
                        {items.map((p) => (
                          <div key={p.id} className="in-ev">
                            <span className="in-ev-bar" style={k === hoyKey ? { background: 'var(--adm-accent)' } : undefined} />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span className="adm-ellipsis" style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>
                                {p.obra ?? p.categoria ?? p.folio}{p.municipio ? <span style={{ color: 'var(--adm-faint)', fontWeight: 400 }}> · {p.municipio}</span> : null}
                              </span>
                              <span className="adm-cell-sub adm-ellipsis" style={{ display: 'block' }}>{p.cliente} · {p.aliado}</span>
                            </span>
                            <Chip>{p.estado}</Chip>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ) : null}

            {/* 4. Red y oferta */}
            {(puede('proveedores') || puede('catalogo')) && d ? (
              <Panel title="Red y oferta" icon="ph-handshake" action={<PanelLink href={puede('proveedores') ? '/proveedores' : '/catalogo/servicios'}>Ver red</PanelLink>}>
                <div style={{ display: 'grid', gap: 18 }}>
                  <div className="in-red">
                    <div><b>{d.red.aliados}</b><span>Aliados activos</span></div>
                    <div><b>{d.red.fichas}</b><span>Fichas publicadas</span></div>
                    <div><b style={d.red.ofertas > 0 ? { color: 'var(--adm-accent)' } : { color: 'var(--adm-faint)' }}>{d.red.ofertas}</b><span>Por revisar</span></div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--adm-text-2)', marginBottom: 8 }}>
                      <span>Disponibilidad confirmada</span>
                      <span className={`adm-num adm-tone t-${tonoConfirmada}`} style={{ fontWeight: 600 }}>{confirmadaPct}%</span>
                    </div>
                    <Bar pct={confirmadaPct} tone={tonoConfirmada} label={`${confirmadaPct}% de las fichas con disponibilidad confirmada`} />
                    <div style={{ fontSize: 12, color: 'var(--adm-faint)', marginTop: 8 }}>
                      {d.red.fichasConfirmadas} de {d.red.fichas} confirmadas en los últimos {d.red.diasFrescura} días
                    </div>
                  </div>
                  {d.red.papelesVencidos + d.red.papelesPorVencer > 0 ? (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--adm-muted)', borderTop: '1px solid var(--adm-border)', paddingTop: 14 }}>
                      <span><b className={`adm-num${d.red.papelesVencidos > 0 ? ' adm-tone t-bad' : ''}`}>{d.red.papelesVencidos}</b> con papeles vencidos</span>
                      <span><b className={`adm-num${d.red.papelesPorVencer > 0 ? ' adm-tone t-warn' : ''}`}>{d.red.papelesPorVencer}</b> por vencer</span>
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
