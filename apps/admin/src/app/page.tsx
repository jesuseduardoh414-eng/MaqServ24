import { redirect } from 'next/navigation';
import Link from 'next/link';
import { puedeVer, type ModuloAdmin } from '@maqserv/config';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';

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
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const BLUE = '#5b9dff';
const RED = '#e5484d';
const AMBER = '#f0b14f';
const FAINT = '#5C5C61';
const SOFT = '#8A8A8F';
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const tinte = (c: string, pct = 12) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

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
const COLOR_NIVEL: Record<Nivel, string> = { urgente: RED, pendiente: D.accent, aviso: BLUE };

interface Etapa {
  paso: string;
  titulo: string;
  href: string;
  valor: string;
  etiqueta: string;
  /** Color de la cifra y de la franja: rojo si hay algo trabado. */
  color: string;
  lineas: Array<{ texto: string; n: string; color?: string }>;
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
        valor: String(f.recibir.sinResponder), etiqueta: 'solicitudes por cotizar',
        color: f.recibir.sinResponder > 0 ? D.accent : SOFT,
        lineas: [
          { texto: 'Cotizadas, esperando al cliente', n: String(f.recibir.esperandoCliente) },
          { texto: 'Mensajes sin atender', n: String(f.recibir.mensajes), color: f.recibir.mensajes > 0 ? AMBER : undefined },
          { texto: 'Solicitudes este mes', n: String(d.mes.solicitudes) },
        ],
      });
    }
    if (puede('servicios')) {
      etapas.push({
        paso: '2', titulo: 'Cotizar y asignar', href: '/servicios',
        valor: String(f.asignar.porAsignar), etiqueta: 'servicios por asignar',
        color: f.asignar.propuestasViejas > 0 ? RED : f.asignar.porAsignar > 0 ? D.accent : SOFT,
        lineas: [
          { texto: 'Ofrecidos, esperando al aliado', n: String(f.asignar.propuestas) },
          { texto: 'Sin respuesta en más de 24 h', n: String(f.asignar.propuestasViejas), color: f.asignar.propuestasViejas > 0 ? RED : undefined },
        ],
      });
      etapas.push({
        paso: '3', titulo: 'Ejecutar', href: '/servicios',
        valor: String(f.ejecutar.enCurso), etiqueta: 'servicios con aliado, en marcha',
        color: f.ejecutar.incidencias > 0 ? RED : f.ejecutar.enCurso > 0 ? GREEN : SOFT,
        lineas: [
          { texto: 'En traslado', n: String(f.ejecutar.enTraslado) },
          { texto: 'En obra', n: String(f.ejecutar.enSitio) },
          { texto: 'Incidencias abiertas', n: String(f.ejecutar.incidencias), color: f.ejecutar.incidencias > 0 ? RED : undefined },
        ],
      });
    }
    if (puede('indicadores')) {
      const delta = d.mes.solicitudes - d.mes.solicitudesAnterior;
      etapas.push({
        paso: '4', titulo: 'Cobrar y medir', href: '/indicadores',
        valor: money(f.medir.valorMes), etiqueta: 'aceptado este mes',
        color: f.medir.valorMes > 0 ? GREEN : SOFT,
        lineas: [
          { texto: 'Servicios cerrados este mes', n: String(f.medir.cerradosMes) },
          { texto: 'Conversión del mes', n: f.medir.conversionMes === null ? '—' : `${f.medir.conversionMes}%` },
          { texto: 'Solicitudes vs. mes pasado', n: `${delta > 0 ? '+' : ''}${delta}`, color: delta > 0 ? GREEN : delta < 0 ? AMBER : undefined },
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
  const TONO: Record<string, string> = { atiende: AMBER, bien: GREEN, mal: RED, neutro: BLUE };

  const verDerecha = (puede('agenda') || puede('proveedores') || puede('catalogo')) && Boolean(d);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" />
        <style>{`
          .in-card{ background:${D.card}; border:1px solid ${D.inputBorder}; border-radius:16px; }
          .in-h2{ margin:0; font-size:12px; letter-spacing:1px; font-weight:700; color:#7A7A7F; text-transform:uppercase; }
          .in-sec-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:12px; }
          .in-more{ font-size:12.5px; font-weight:600; color:${SOFT}; text-decoration:none; }
          .in-more:hover{ color:${D.accent}; }
          .in-btn{ display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:700; border-radius:10px; padding:10px 15px; text-decoration:none; transition:filter .15s, background .15s, border-color .15s; white-space:nowrap; }
          .in-btn-sec{ background:rgba(255,255,255,0.03); color:#D4D4D8; border:1px solid ${D.inputBorder}; }
          .in-btn-sec:hover{ background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.16); }
          .in-flow{ display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; }
          .in-stage{ position:relative; overflow:hidden; padding:18px 20px 16px; display:flex; flex-direction:column; text-decoration:none; color:inherit; transition:border-color .15s, background .15s; }
          .in-stage:hover{ border-color:rgba(255,255,255,0.16); background:#17171a; }
          .in-stage-bar{ position:absolute; top:0; left:0; right:0; height:3px; }
          .in-step{ width:22px; height:22px; border-radius:6px; display:grid; place-items:center; font:700 11px ${MONO}; background:rgba(255,255,255,0.06); color:#B4B4B9; }
          .in-line{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12.5px; color:${SOFT}; padding:6px 0; border-top:1px solid ${D.cardBorder}; }
          .in-line b{ font:600 12.5px ${MONO}; color:#D4D4D8; }
          .in-grid{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,360px); gap:18px; align-items:start; margin-top:28px; }
          /* minmax(0,…): sin esto, un texto largo en una sola línea (los nombres de
             prueba) ensanchaba la columna y la página se salía por la derecha. */
          .in-col{ display:grid; grid-template-columns:minmax(0,1fr); gap:18px; min-width:0; }
          .in-col > section{ min-width:0; }
          .in-task{ display:flex; align-items:center; gap:14px; padding:13px 18px; text-decoration:none; color:inherit; border-top:1px solid ${D.cardBorder}; transition:background .15s; }
          .in-task:first-child{ border-top:0; }
          .in-task:hover{ background:rgba(255,255,255,0.025); }
          .in-task:hover .in-arrow{ color:${D.accent}; transform:translateX(2px); }
          .in-arrow{ color:#4C4C51; transition:color .15s, transform .15s; }
          .in-ico{ width:38px; height:38px; border-radius:10px; display:grid; place-items:center; flex-shrink:0; font-size:18px; }
          .in-row{ display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) auto; gap:14px; align-items:center; padding:12px 18px; border-top:1px solid ${D.cardBorder}; text-decoration:none; color:inherit; transition:background .15s; }
          .in-row:hover{ background:rgba(255,255,255,0.025); }
          .in-chip{ display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; border-radius:20px; padding:4px 9px; white-space:nowrap; }
          .in-ellip{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .in-day{ font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#7A7A7F; padding:12px 18px 4px; }
          .in-ev{ display:flex; gap:12px; padding:9px 18px 11px; }
          .in-bar{ height:7px; border-radius:4px; background:rgba(255,255,255,0.06); overflow:hidden; }
          .in-stat{ display:grid; gap:2px; }
          .in-stat b{ font:700 22px ${MONO}; letter-spacing:-.5px; }
          .in-stat span{ font-size:11.5px; color:${SOFT}; }
          @media (max-width: 1280px){ .in-grid{ grid-template-columns:minmax(0,1fr); } }
          @media (max-width: 640px){ .in-row{ grid-template-columns:minmax(0,1fr) auto; } .in-row .in-hide-sm{ display:none; } }
          @media (prefers-reduced-motion: reduce){ .in-arrow,.in-stage,.in-task{ transition:none; } }
        `}</style>

        {/* ── Encabezado ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `600 11.5px ${MONO}`, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#7A7A7F' }}>
              {fecha}{admin.rolNombre ? ` · ${admin.rolNombre}` : ''}
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>
              {saludo()}, {admin.name.split(' ')[0]}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: urgentes > 0 ? '#F2B8B5' : SOFT }}>{resumen}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {puede('cotizador') ? (
              <>
                <Link href="/cotizador/maquinaria" className="in-btn in-btn-sec"><i className="ph ph-tractor" aria-hidden /> Cotizar maquinaria</Link>
                <Link href="/cotizador/triturados" className="in-btn in-btn-sec"><i className="ph ph-mountains" aria-hidden /> Cotizar triturados</Link>
              </>
            ) : null}
          </div>
        </div>

        {!d ? (
          <div className="in-card" style={{ marginTop: 24, padding: 22, fontSize: 13.5, color: SOFT }}>
            No se pudo cargar el resumen. Recarga la página; si sigue igual, la API no está respondiendo.
          </div>
        ) : null}

        {/* ── 1. El flujo ──────────────────────────────────────────── */}
        {etapas.length > 0 ? (
          <section style={{ marginTop: 26 }}>
            <div className="in-sec-head">
              <h2 className="in-h2">El flujo ahora</h2>
              <span style={{ fontSize: 12, color: FAINT }}>Recibir → Cotizar → Ejecutar → Cobrar</span>
            </div>
            <div className="in-flow">
              {etapas.map((e) => (
                <Link key={e.paso} href={e.href} className="in-card in-stage">
                  <span className="in-stage-bar" style={{ background: e.color === SOFT ? 'rgba(255,255,255,0.06)' : e.color }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span className="in-step">{e.paso}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC' }}>{e.titulo}</span>
                    <i className="ph ph-arrow-right in-arrow" aria-hidden style={{ marginLeft: 'auto', fontSize: 14 }} />
                  </div>
                  <div style={{ font: `700 34px ${MONO}`, letterSpacing: '-1px', color: e.color, marginTop: 14, lineHeight: 1 }}>{e.valor}</div>
                  <div style={{ fontSize: 12.5, color: SOFT, marginTop: 6, marginBottom: 12 }}>{e.etiqueta}</div>
                  <div style={{ marginTop: 'auto' }}>
                    {e.lineas.map((l) => (
                      <div key={l.texto} className="in-line">
                        <span>{l.texto}</span>
                        <b style={l.color ? { color: l.color } : undefined}>{l.n}</b>
                      </div>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="in-grid" style={verDerecha ? undefined : { gridTemplateColumns: '1fr' }}>
          {/* ── Columna principal ──────────────────────────────────── */}
          <div className="in-col">
            {/* 2. Por atender */}
            <section>
              <div className="in-sec-head">
                <h2 className="in-h2">Por atender</h2>
                {pendientes.length > 0 ? <span style={{ fontSize: 12, color: FAINT }}>Primero lo urgente</span> : null}
              </div>
              {pendientes.length === 0 ? (
                <div className="in-card" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 20 }}>
                  <span className="in-ico" style={{ background: tinte(GREEN), color: GREEN }}><i className="ph-bold ph-check" aria-hidden /></span>
                  <span style={{ fontSize: 13.5, color: '#B4B4B9' }}>Todo al día. Aquí aparece lo que necesite una decisión.</span>
                </div>
              ) : (
                <div className="in-card" style={{ overflow: 'hidden' }}>
                  {pendientes.map((t) => {
                    const c = COLOR_NIVEL[t.nivel];
                    return (
                      <Link key={t.label} href={t.href} className="in-task">
                        <span className="in-ico" style={{ background: tinte(c, 13), color: c }}><i className={`ph ${t.icon}`} aria-hidden /></span>
                        <span style={{ font: `700 22px ${MONO}`, color: c, minWidth: 34, letterSpacing: '-.5px' }}>{t.n}</span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#EDEDEC' }}>
                            {t.label}
                            {t.nivel === 'urgente' ? <span className="in-chip" style={{ background: tinte(RED, 14), color: RED, padding: '2px 7px', fontSize: 10 }}>URGENTE</span> : null}
                          </span>
                          <span className="in-ellip" style={{ display: 'block', fontSize: 12, color: SOFT, marginTop: 2 }}>{t.sub}</span>
                        </span>
                        <i className="ph ph-arrow-right in-arrow" aria-hidden style={{ fontSize: 15 }} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 5a. Últimas solicitudes */}
            {puede('cotizaciones') && d ? (
              <section>
                <div className="in-sec-head">
                  <h2 className="in-h2">Últimas solicitudes</h2>
                  <Link href="/cotizaciones" className="in-more">Ver la bandeja →</Link>
                </div>
                <div className="in-card" style={{ overflow: 'hidden' }}>
                  {d.recientes.length === 0 ? (
                    <p style={{ margin: 0, padding: 20, fontSize: 13, color: SOFT }}>Todavía no llega ninguna solicitud.</p>
                  ) : d.recientes.map((r, i) => {
                    const c = TONO[r.tono];
                    return (
                      <Link key={r.id} href="/cotizaciones" className="in-row" style={i === 0 ? { borderTop: 0 } : undefined}>
                        <span style={{ minWidth: 0 }}>
                          <span className="in-ellip" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#EDEDEC' }}>{r.cliente}</span>
                          <span className="in-ellip" style={{ display: 'block', fontSize: 11.5, color: FAINT, marginTop: 3 }}>
                            <span style={{ fontFamily: MONO }}>{r.folio}</span>{r.categoria ? ` · ${r.categoria}` : ''}
                          </span>
                        </span>
                        <span className="in-hide-sm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0 }}>
                          <span className="in-chip" style={{ background: tinte(c), color: c, border: `1px solid ${tinte(c, 26)}` }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />{r.estado}
                          </span>
                          <span style={{ fontSize: 11, color: FAINT }}>{hace(r.fecha)}</span>
                        </span>
                        <span style={{ font: `600 13.5px ${MONO}`, color: '#FBFBFA', textAlign: 'right' }}>{money(r.total)}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>

          {/* ── Columna lateral ────────────────────────────────────── */}
          {verDerecha ? (
            <div className="in-col">
              {/* 3. Próximos 7 días */}
              {puede('agenda') && d ? (
                <section>
                  <div className="in-sec-head">
                    <h2 className="in-h2">Próximos 7 días</h2>
                    <Link href="/agenda" className="in-more">Agenda →</Link>
                  </div>
                  <div className="in-card" style={{ overflow: 'hidden', paddingBottom: 6 }}>
                    {porDia.size === 0 ? (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 18 }}>
                        <span className="in-ico" style={{ background: 'rgba(255,255,255,0.04)', color: SOFT }}><i className="ph ph-calendar-blank" aria-hidden /></span>
                        <span style={{ fontSize: 13, color: SOFT }}>Sin llegadas comprometidas esta semana.</span>
                      </div>
                    ) : [...porDia.entries()].map(([k, items]) => (
                      <div key={k}>
                        <div className="in-day" style={k === hoyKey ? { color: D.accent } : undefined}>{etiquetaDia(k, items[0].fecha)}</div>
                        {items.map((p) => (
                          <div key={p.id} className="in-ev">
                            <span style={{ width: 3, borderRadius: 3, background: k === hoyKey ? D.accent : 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span className="in-ellip" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#EDEDEC' }}>
                                {p.obra ?? p.categoria ?? p.folio}{p.municipio ? <span style={{ color: FAINT, fontWeight: 500 }}> · {p.municipio}</span> : null}
                              </span>
                              <span className="in-ellip" style={{ display: 'block', fontSize: 11.5, color: SOFT, marginTop: 2 }}>{p.cliente} · {p.aliado}</span>
                            </span>
                            <span className="in-chip" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', color: '#B4B4B9' }}>{p.estado}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* 4. Red y oferta */}
              {(puede('proveedores') || puede('catalogo')) && d ? (
                <section>
                  <div className="in-sec-head">
                    <h2 className="in-h2">Red y oferta</h2>
                    <Link href={puede('proveedores') ? '/proveedores' : '/catalogo/servicios'} className="in-more">Ver red →</Link>
                  </div>
                  <div className="in-card" style={{ padding: 18, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                      <div className="in-stat"><b style={{ color: '#FBFBFA' }}>{d.red.aliados}</b><span>Aliados activos</span></div>
                      <div className="in-stat"><b style={{ color: '#FBFBFA' }}>{d.red.fichas}</b><span>Fichas publicadas</span></div>
                      <div className="in-stat"><b style={{ color: d.red.ofertas > 0 ? D.accent : '#4C4C51' }}>{d.red.ofertas}</b><span>Por revisar</span></div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SOFT, marginBottom: 7 }}>
                        <span>Disponibilidad confirmada</span>
                        <span style={{ fontFamily: MONO, color: confirmadaPct >= 70 ? GREEN : confirmadaPct >= 40 ? AMBER : RED, fontWeight: 700 }}>{confirmadaPct}%</span>
                      </div>
                      <div className="in-bar" role="img" aria-label={`${confirmadaPct}% de las fichas con disponibilidad confirmada`}>
                        <div style={{ width: `${confirmadaPct}%`, height: '100%', background: confirmadaPct >= 70 ? GREEN : confirmadaPct >= 40 ? AMBER : RED }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 7 }}>
                        {d.red.fichasConfirmadas} de {d.red.fichas} confirmadas en los últimos {d.red.diasFrescura} días
                      </div>
                    </div>
                    {d.red.papelesVencidos + d.red.papelesPorVencer > 0 ? (
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: SOFT, borderTop: `1px solid ${D.cardBorder}`, paddingTop: 12 }}>
                        <span><b style={{ fontFamily: MONO, color: d.red.papelesVencidos > 0 ? RED : '#4C4C51' }}>{d.red.papelesVencidos}</b> con papeles vencidos</span>
                        <span><b style={{ fontFamily: MONO, color: d.red.papelesPorVencer > 0 ? AMBER : '#4C4C51' }}>{d.red.papelesPorVencer}</b> por vencer</span>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

            </div>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
