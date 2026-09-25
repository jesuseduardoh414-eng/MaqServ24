'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AuthUser } from '@maqserv/types';
import { atributosDe, requestFormFor, UNIDADES } from '@maqserv/config';
import { Icon } from '@/components/Icon';
import { formatPrice } from '@/lib/format';
import { evento } from '@/lib/analitica';
import { VistaDocumento, type DatosDocumento } from '@maqserv/ui';
import { RequirementFields, CLAVES_UBICACION, CLAVES_FECHA } from '../cotizar/RequirementFields';
import { SitePicker, type ObraCliente } from '../cotizar/SitePicker';
import { Stepper } from '../cotizar/Stepper';
import { SelectorFecha, SelectorHora } from './Selectores';

/**
 * COTIZADOR GUIADO POR MÁQUINA (decisión del cliente, 2026-09-25).
 *
 * "Que los clientes vayan escogiendo lo que ocupan, y dependiendo de sus
 * requisitos se les vayan recomendando máquinas, y al final él escoja una."
 *
 * Seis pasos: qué necesitas → requisitos → dónde → cuándo → elige la máquina →
 * confirma. Las máquinas que salen en "elige" son reales, del catálogo: de la
 * línea y tipo pedidos, que alcanzan los requisitos, cuyo aliado cubre la zona,
 * libres esas fechas y en horario, con precio y traslado desde su patio. El
 * cliente elige una y la solicitud le llega al dueño de ESA máquina.
 *
 * El cliente ve dónde está la máquina y a cuántos km, no de quién es.
 */

interface Linea { slug: string; name: string; description: string | null }
interface Tipo { nombre: string; origen: 'tabulador' | 'catalogo'; maquinas: number }
interface Unidad { clave: string; singular: string; plural: string }
interface Maquina {
  id: number; slug: string; name: string; brand: string | null; image: string | null;
  specs: Array<{ label: string; valor: string }>; ubicacion: string | null; km: number | null;
  horario: string | null; confirmada: boolean; preferida: boolean; renta: boolean;
  precioUnitario: number | null; unidad: string; unidadesCobradas: number; equipos: number;
  subtotal: number | null; flete: number | null; fleteTexto: string; iva: number; total: number | null;
  notaMinimo: string | null; porque: string[];
}
interface Resultado {
  zona: string | null; fecha: string; fin: string; unidad: string; unidades: number;
  maquinas: Maquina[];
  descartadas: { noSirven: number; noLlegan: number; ocupadas: number; fueraDeHorario: number };
  horariosDescartados?: string[];
  tipoNoEncontrado: boolean;
}

/** Lo que se manda a recomendar/solicitar por cada máquina. */
interface EntradaGuiada {
  linea: string;
  tipo: string | null;
  requisitos: Record<string, string>;
  obra: { siteId?: number; direccion: string | null; municipio: string | null };
  fecha: string;
  hora: string | null;
  unidad: string;
  unidades: number;
  equipos: number;
  productoId: number | null;
}
/** Una máquina ya elegida para esta cotización. */
interface Partida { maquina: Maquina; entrada: EntradaGuiada; clave: string }

const PASOS = [
  { clave: 'que', titulo: 'Qué necesitas' },
  { clave: 'requisitos', titulo: 'Requisitos' },
  { clave: 'donde', titulo: 'Dónde' },
  { clave: 'cuando', titulo: 'Cuándo' },
  { clave: 'elige', titulo: 'Elige la máquina' },
  { clave: 'confirmar', titulo: 'Confirmación' },
];

const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

export function CotizadorGuiado({
  user,
  lineas,
  inicial,
  logo,
}: {
  user: AuthUser;
  lineas: Linea[];
  inicial: { linea?: string | null; producto?: { id: number; name: string; slug: string; categorySlug: string | null; atributos?: Record<string, string>; horario?: { dias: number[]; desde: string; hasta: string } | null } | null };
  /** Logo para fondo claro: el documento se imprime en blanco. */
  logo: string | null;
}) {
  const [paso, setPaso] = useState(inicial.producto ? 1 : 0);
  const [error, setError] = useState<string | null>(null);

  // 1 · Qué necesitas
  const [linea, setLinea] = useState(inicial.producto?.categorySlug ?? inicial.linea ?? '');
  const [tipo, setTipo] = useState(inicial.producto?.name ?? '');
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [unidadesLinea, setUnidadesLinea] = useState<Unidad[]>([]);
  // La máquina con la que entró (desde su ficha) es la preferida SOLO para el
  // primer servicio; al agregar otro se busca libremente.
  const [preferido, setPreferido] = useState<number | null>(inicial.producto?.id ?? null);
  const form = useMemo(() => requestFormFor(linea), [linea]);

  useEffect(() => {
    if (!linea) return;
    let vivo = true;
    fetch(`/api/proxy/maquinas/tipos?linea=${encodeURIComponent(linea)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d) return;
        setTipos(Array.isArray(d.tipos) ? d.tipos : []);
        const us: Unidad[] = Array.isArray(d.unidades) ? d.unidades : [];
        setUnidadesLinea(us);
        setUnidad((u) => (us.some((x) => x.clave === u) ? u : us[0]?.clave ?? 'dia'));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [linea]);

  // 2 · Requisitos
  /**
   * Lo que YA sabemos por la máquina elegida no se vuelve a preguntar
   * (2026-09-25): capacidad, implementos, altura… van prellenados desde su
   * ficha y fuera del formulario. Operador y combustible tampoco se preguntan:
   * los define quien ofrece la máquina, y el cliente los ve en la ficha y en
   * la cotización.
   */
  const conocidos = useMemo(() => {
    if (!preferido || inicial.producto?.id !== preferido) return {} as Record<string, string>;
    const a = inicial.producto?.atributos ?? {};
    return Object.fromEntries(Object.entries(a).filter(([, v]) => v && String(v).trim())) as Record<string, string>;
  }, [inicial.producto, preferido]);
  const ocultas = useMemo(
    () => [...CLAVES_UBICACION, ...CLAVES_FECHA, 'tipo_equipo', 'operador', 'combustible', ...Object.keys(conocidos)],
    [conocidos],
  );
  const [reqs, setReqs] = useState<Record<string, string>>(() => ({ ...conocidos }));

  // 3 · Dónde
  const [obra, setObra] = useState<ObraCliente | null>(null);
  const [direccion, setDireccion] = useState(user.address ?? '');
  const [municipio, setMunicipio] = useState(user.city ?? '');

  /**
   * Con la máquina elegida desde su ficha, el calendario y el reloj solo
   * ofrecen lo que ella atiende (2026-09-25): antes se podía elegir un domingo
   * o las 7 p. m. y la búsqueda la descartaba sin que se entendiera por qué.
   */
  const horarioMaquina = preferido && inicial.producto?.id === preferido ? inicial.producto?.horario ?? null : null;
  const horaDesde = horarioMaquina ? Number(horarioMaquina.desde.slice(0, 2)) : 6;
  const horaHasta = horarioMaquina ? Number(horarioMaquina.hasta.slice(0, 2)) : 20;

  // 4 · Cuándo
  const [fecha, setFecha] = useState(manana());
  const [hora, setHora] = useState('08:00');
  const [unidad, setUnidad] = useState('dia');
  const [unidades, setUnidades] = useState(1);
  const [equipos, setEquipos] = useState(1);
  // Si mañana o las 8:00 no caen en su horario, se proponen el primer día y la primera hora que sí.
  useEffect(() => {
    if (!horarioMaquina) return;
    const d = new Date(`${fecha}T12:00:00`);
    for (let i = 0; i < 7 && !horarioMaquina.dias.includes(d.getDay()); i += 1) d.setDate(d.getDate() + 1);
    const ok = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (ok !== fecha) setFecha(ok);
    if (hora < horarioMaquina.desde || hora > horarioMaquina.hasta) setHora(horarioMaquina.desde);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarioMaquina]);

  // 5 · Elige
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [elegida, setElegida] = useState<Maquina | null>(null);
  /**
   * LA COTIZACIÓN PUEDE LLEVAR VARIOS SERVICIOS (2026-09-25), como en el
   * cotizador original: excavadora + pipa en el mismo documento. Cada máquina
   * elegida se guarda con lo que se pidió de ella; en la confirmación se
   * pueden quitar o agregar otra (vuelve al paso 1 con la obra ya puesta).
   */
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const totalPartidas = partidas.reduce((s, p) => s + (p.maquina.total ?? 0), 0);

  // 6 · Confirmar
  const [cliente, setCliente] = useState(user.name ?? '');
  const [telefono, setTelefono] = useState(user.phone ?? '');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  /**
   * LA COTIZACIÓN COMO DOCUMENTO, ANTES DE SOLICITAR (2026-09-25). Igual que
   * en el cotizador original: el cliente ve el documento tal como se imprime
   * (empresa, partida, traslado, condiciones) y luego solicita. Lo arma el
   * servidor con la misma cuenta que usará al solicitar; solo falta el folio.
   */
  const [vista, setVista] = useState<Omit<DatosDocumento, 'logo'> | null>(null);
  const [vistaCargando, setVistaCargando] = useState(false);
  async function cargarVista(lista?: Partida[]) {
    const l = lista ?? partidas;
    if (l.length === 0) return;
    setVistaCargando(true);
    try {
      const r = await fetch('/api/proxy/maquinas/documento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoSolicitud(l)),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.calc) setVista(d as Omit<DatosDocumento, 'logo'>);
    } finally {
      setVistaCargando(false);
    }
  }
  const [listo, setListo] = useState<{
    quoteNumber: string; url: string; total: number; documentUrl?: string | null; folio?: string | null;
    solicitudes?: Array<{ quoteNumber: string; url: string; name: string }>;
  } | null>(null);

  const u = UNIDADES[unidad];
  const entrada = (): EntradaGuiada => ({
    linea,
    tipo: tipo.trim() || null,
    requisitos: { ...reqs, ...(tipo.trim() ? { tipo_equipo: tipo.trim() } : {}) },
    obra: obra
      ? { siteId: obra.id, direccion: obra.address, municipio: obra.municipality }
      : { direccion: direccion.trim() || null, municipio: municipio.trim() || null },
    fecha,
    hora: hora || null,
    unidad,
    unidades,
    equipos,
    productoId: preferido,
  });
  const cuerpoSolicitud = (lista: Partida[]) => ({
    partidas: lista.map((p) => ({ ...p.entrada, productoId: p.maquina.id })),
    notas: notas.trim(),
    cliente: cliente.trim(),
    telefono: telefono.trim(),
  });

  /** Otro servicio en la misma cotización: vuelve al paso 1 con la obra y las fechas ya puestas. */
  function agregarOtro() {
    setElegida(null); setResultado(null); setTipo(''); setReqs({}); setPreferido(null); setError(null);
    setPaso(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function quitarPartida(clave: string) {
    const lista = partidas.filter((p) => p.clave !== clave);
    setPartidas(lista);
    if (lista.length) void cargarVista(lista); else setVista(null);
  }

  function falta(): string | null {
    if (paso === 0 && !linea) return 'Elige qué línea de servicio necesitas.';
    if (paso === 1 && form) {
      const oblig = form.fields.filter((f) => f.required && !ocultas.includes(f.key));
      const vacio = oblig.find((f) => !(reqs[f.key] ?? '').trim());
      if (vacio) return `Falta: ${vacio.label}.`;
    }
    if (paso === 2 && !obra && !direccion.trim() && !municipio.trim()) return 'Dinos dónde es la obra: al menos el municipio.';
    if (paso === 3 && !fecha) return 'Elige la fecha.';
    if (paso === 3 && unidades <= 0) return 'Indica cuánto tiempo o cuántas unidades.';
    if (paso === 4 && !elegida) return 'Elige una máquina para continuar.';
    return null;
  }

  async function buscar() {
    setBuscando(true); setError(null); setResultado(null); setElegida(null);
    try {
      const r = await fetch('/api/proxy/maquinas/recomendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entrada()) });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setError(d?.message ?? 'No pudimos buscar máquinas. Intenta otra vez.'); return; }
      setResultado(d as Resultado);
      evento('cotizador_recomendaciones', { linea, maquinas: (d as Resultado).maquinas.length });
    } finally {
      setBuscando(false);
    }
  }

  function avanzar() {
    const f = falta();
    if (f) { setError(f); return; }
    setError(null);
    const siguiente = paso + 1;
    setPaso(siguiente);
    if (siguiente === 4) void buscar();
    if (siguiente === 5 && elegida) {
      // La máquina elegida entra a la cotización (sin duplicarla si vuelve atrás y sigue).
      const e = entrada();
      const yaEsta = partidas.some((p) => p.maquina.id === elegida.id && p.entrada.fecha === e.fecha);
      const lista = yaEsta ? partidas : [...partidas, { maquina: elegida, entrada: e, clave: `${elegida.id}-${Date.now()}` }];
      setPartidas(lista);
      void cargarVista(lista);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function solicitar() {
    if (partidas.length === 0) { setError('Agrega al menos un servicio.'); return; }
    setEnviando(true); setError(null);
    try {
      const r = await fetch('/api/proxy/maquinas/solicitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoSolicitud(partidas)),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setError(d?.message ?? 'No se pudo enviar la solicitud.'); return; }
      setListo(d);
      evento('cotizador_solicitud', { linea, total: Number(d?.total ?? 0) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 999, background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)', flexShrink: 0 }}>
            <Icon name="check" size={22} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, letterSpacing: '-0.02em' }}>Cotización enviada</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Tu cotización <strong style={{ color: 'var(--color-text)' }}>{listo.folio ?? listo.quoteNumber}</strong> es por {formatPrice(listo.total)}.
              {(listo.solicitudes?.length ?? 1) > 1
                ? ` Incluye ${listo.solicitudes!.length} servicios; cada uno lo confirma su aliado y te avisamos por correo y en tu cuenta.`
                : ' La máquina quedó apartada y estamos confirmando con el aliado. Te avisamos por correo y en tu cuenta en cuanto acepte.'}
            </p>
            {(listo.solicitudes?.length ?? 0) > 1 ? (
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.7 }}>
                {listo.solicitudes!.map((s) => (
                  <li key={s.quoteNumber}><Link href={s.url} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{s.quoteNumber}</Link> · {s.name}</li>
                ))}
              </ul>
            ) : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {listo.documentUrl ? <Link href={listo.documentUrl} style={btn}>Ver documento de la cotización <Icon name="arrowRight" size={14} /></Link> : null}
              <Link href={listo.url} style={listo.documentUrl ? btnSec : btn}>Ver mi solicitud <Icon name="arrowRight" size={14} /></Link>
              <Link href="/cotizador" style={btnSec}>Cotizar otra cosa</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Stepper pasos={PASOS} actual={paso} onIr={(i) => { setError(null); setPaso(i); }} />

      {/* ── 1 · Qué necesitas ── */}
      {paso === 0 ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={card}>
            <h2 style={leyenda}>¿Qué línea de servicio necesitas?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
              {lineas.map((l) => {
                const on = linea === l.slug;
                return (
                  <button key={l.slug} type="button" onClick={() => { setLinea(l.slug); setTipo(''); setReqs({}); }} aria-pressed={on} style={opcion(on)}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{l.name}</span>
                    {l.description ? <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>{l.description}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          {linea ? (
            <div style={card}>
              <h2 style={leyenda}>¿Qué tipo de {lineaNombre(lineas, linea)}?</h2>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Elige uno o escríbelo. Si no lo tienes claro, déjalo vacío y te enseñamos todo lo de la línea.
              </p>
              {tipos.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {tipos.map((t) => {
                    const on = tipo.trim().toLowerCase() === t.nombre.toLowerCase();
                    return (
                      <button key={t.nombre} type="button" onClick={() => setTipo(on ? '' : t.nombre)} aria-pressed={on} style={{ ...chip, borderColor: on ? 'var(--color-primary)' : 'var(--color-border)', background: on ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}>
                        {t.nombre}
                        {t.maquinas > 0 ? <span style={{ color: 'var(--color-text-muted)', marginLeft: 6, fontSize: 11.5 }}>{t.maquinas}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Excavadora 20 t, pipa de agua 10 mil litros, grava ¾…" style={campo} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── 2 · Requisitos ── */}
      {paso === 1 ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {Object.keys(conocidos).length ? (
            <div style={card}>
              <h2 style={leyenda}>Ya lo sabemos por la máquina que elegiste</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {atributosDe(linea).filter((a) => conocidos[a.clave]).map((a) => (
                  <span key={a.clave} style={{ ...chip, cursor: 'default' }}>
                    {a.label}: {conocidos[a.clave]}{a.unidad && !/[a-z]/i.test(conocidos[a.clave]) ? ` ${a.unidad}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {form ? (
            <RequirementFields
              form={form}
              values={reqs}
              onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
              except={ocultas}
              estilos={{ campo, etiqueta: etiquetaReq, tarjeta: card, leyenda }}
              titulo={inicial.producto ? 'Sobre tu obra' : `Lo que la obra necesita${tipo ? ` · ${tipo}` : ''}`}
              intro={inicial.producto ? 'Lo que el aliado necesita saber para llegar y trabajar. Llena lo que sepas.' : 'Con esto solo te proponemos máquinas que alcanzan lo que pides. Llena lo que sepas.'}
            />
          ) : !Object.keys(conocidos).length ? (
            <div style={card}><p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Esta línea no tiene preguntas extra. Sigue al siguiente paso.</p></div>
          ) : null}
        </div>
      ) : null}

      {/* ── 3 · Dónde ── */}
      {paso === 2 ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <SitePicker onElegir={setObra} estilos={{ tarjeta: card, leyenda }} />
          {!obra ? (
            <div style={card}>
              <h2 style={leyenda}>¿Dónde es la obra?</h2>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Con la ubicación calculamos qué máquinas te quedan cerca y el traslado desde su patio.
              </p>
              <div className="cg-two" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={etiquetaReq}>Calle y referencia</span>
                  <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. Industrial 120, Parque Milenio" style={campo} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={etiquetaReq}>Municipio <span style={{ color: 'var(--color-primary)' }}>*</span></span>
                  <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Apodaca" style={campo} />
                </label>
              </div>
            </div>
          ) : (
            <div style={card}>
              <p style={{ margin: 0, fontSize: 14 }}>Obra: <strong>{obra.name}</strong>{obra.address ? ` · ${obra.address}` : ''}{obra.municipality ? `, ${obra.municipality}` : ''}</p>
            </div>
          )}
        </div>
      ) : null}

      {/* ── 4 · Cuándo ── */}
      {paso === 3 ? (
        <div style={card}>
          <h2 style={leyenda}>¿Cuándo y por cuánto tiempo?</h2>
          <div className="cg-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={etiquetaReq}>Fecha</span>
              <SelectorFecha value={fecha} onChange={setFecha} style={campo} dias={horarioMaquina?.dias ?? null} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={etiquetaReq}>Hora</span>
              <SelectorHora value={hora} onChange={setHora} style={campo} desde={horaDesde} hasta={horaHasta} />
              {horarioMaquina ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Esta máquina atiende en ese horario.</span> : null}
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiquetaReq}>Cuántas máquinas</span>
              <input type="number" min={1} max={20} value={equipos} onChange={(e) => setEquipos(Math.max(1, Number(e.target.value) || 1))} style={campo} />
            </label>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
            <span style={etiquetaReq}>¿Cuánto?</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="number" min={0.5} step={u?.decimales ? 0.5 : 1} value={unidades} onChange={(e) => setUnidades(Math.max(0.5, Number(e.target.value) || 1))} style={{ ...campo, width: 110 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {unidadesLinea.map((x) => {
                  const on = unidad === x.clave;
                  return (
                    <button key={x.clave} type="button" onClick={() => setUnidad(x.clave)} aria-pressed={on} style={{ ...chip, borderColor: on ? 'var(--color-primary)' : 'var(--color-border)', background: on ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}>
                      {unidades === 1 ? x.singular : x.plural}
                    </button>
                  );
                })}
              </div>
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              Ejemplo: 3 días de excavadora, 2 viajes de pipa, 15 toneladas de grava.
            </span>
          </div>
        </div>
      ) : null}

      {/* ── 5 · Elige la máquina ── */}
      {paso === 4 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {buscando ? (
            <div style={card}><p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Buscando máquinas cerca de tu obra, libres el {fecha}…</p></div>
          ) : resultado ? (
            <>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {resultado.maquinas.length
                  ? `${resultado.maquinas.length} ${resultado.maquinas.length === 1 ? 'máquina cumple' : 'máquinas cumplen'} con lo que pides${resultado.zona ? ` en ${resultado.zona}` : ''} para el ${resultado.fecha}. Van de la más conveniente a la menos.`
                  : 'No encontramos una máquina que cumpla con todo.'}
                {resultado.tipoNoEncontrado ? ` No hay "${tipo}" publicada: te enseñamos lo demás de la línea.` : ''}
              </p>
              {resultado.maquinas.map((m) => (
                <TarjetaMaquina key={m.id} m={m} elegida={elegida?.id === m.id} onElegir={() => { setElegida(m); setError(null); }} />
              ))}
              {resultado.maquinas.length === 0 || Object.values(resultado.descartadas).some(Boolean) ? (
                <div style={{ ...card, background: 'transparent' }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    {descartadasTexto(resultado.descartadas)}
                    {resultado.horariosDescartados?.length ? ` Atiende ${resultado.horariosDescartados.join(' o ')}: cambia la fecha u hora en el paso anterior.` : ''}
                    {' '}¿Necesitas otra cosa?{' '}
                    <Link href={`/cotizar?servicio=${encodeURIComponent(linea)}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Mándanos tu requerimiento</Link> y un asesor lo arma contigo.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── 6 · Confirmar ── */}
      {paso === 5 && partidas.length > 0 ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Los servicios de esta cotización: se puede quitar uno o agregar otro. */}
          <div style={card}>
            <h2 style={leyenda}>Servicios en esta cotización</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {partidas.map((p) => {
                const u = UNIDADES[p.maquina.unidad];
                return (
                  <div key={p.clave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    {p.maquina.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.maquina.image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                    ) : null}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 14.5 }}>{p.maquina.name}</strong>
                      <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                        {p.entrada.fecha}{p.entrada.hora ? ` ${p.entrada.hora}` : ''} · {p.maquina.unidadesCobradas} {u ? (p.maquina.unidadesCobradas === 1 ? u.singular : u.plural) : p.maquina.unidad}{p.maquina.equipos > 1 ? ` × ${p.maquina.equipos}` : ''}
                      </div>
                    </div>
                    <strong style={{ whiteSpace: 'nowrap' }}>{p.maquina.total !== null ? formatPrice(p.maquina.total) : '—'}</strong>
                    <button type="button" onClick={() => quitarPartida(p.clave)} aria-label="Quitar servicio" style={{ ...btnSec, padding: '8px 10px', fontSize: 13 }}>Quitar</button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={agregarOtro} style={{ ...btnSec, marginTop: 12, width: '100%' }}>+ Agregar otro servicio a esta cotización</button>
          </div>
          <div style={card}>
            <h2 style={leyenda}>Datos de contacto</h2>
            <div className="cg-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={etiquetaReq}>A nombre de</span>
                <input value={cliente} onChange={(e) => setCliente(e.target.value)} onBlur={() => void cargarVista()} style={campo} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={etiquetaReq}>Teléfono</span>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="81 1234 5678" style={campo} />
              </label>
            </div>
            <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <span style={etiquetaReq}>Notas para el aliado (opcional)</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} onBlur={() => void cargarVista()} rows={3} placeholder="Acceso a la obra, contacto en sitio, horario de descarga…" style={{ ...campo, resize: 'vertical' }} />
            </label>
            <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Al solicitar, el precio y el traslado quedan congelados y la máquina se aparta para esas fechas. El aliado confirma y te avisamos.
            </p>
          </div>

          {/* La cotización tal como se imprime. El folio se asigna al solicitar. */}
          <div style={card}>
            <h2 style={leyenda}>Así queda tu cotización</h2>
            {vista ? (
              <VistaDocumento datos={{ ...vista, logo }} />
            ) : (
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 14 }}>
                {vistaCargando ? 'Armando el documento…' : 'No pudimos armar el documento. Puedes solicitar de todos modos: lo recibes en tu cuenta.'}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" style={{ color: 'var(--color-error)', margin: '14px 0 0', fontSize: 14 }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        {paso > 0 ? <button type="button" onClick={() => { setError(null); setPaso((p) => p - 1); }} style={btnSec}>Atrás</button> : null}
        {paso < 5 ? (
          <button type="button" onClick={avanzar} style={{ ...btn, flex: 1 }} disabled={paso === 4 && buscando}>
            {paso === 3 ? 'Ver máquinas disponibles' : paso === 4 ? 'Continuar con esta máquina' : 'Continuar'} <Icon name="arrowRight" size={14} />
          </button>
        ) : (
          <button type="button" onClick={() => void solicitar()} disabled={enviando} style={{ ...btn, flex: 1, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Enviando…' : `Solicitar ${partidas.length > 1 ? `${partidas.length} servicios ` : ''}por ${formatPrice(totalPartidas)}`}
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 720px) { .cg-two, .cg-three { grid-template-columns: 1fr !important; } .cg-maq { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function TarjetaMaquina({ m, elegida, onElegir, resumen }: { m: Maquina; elegida: boolean; onElegir: () => void; resumen?: boolean }) {
  const u = UNIDADES[m.unidad];
  const unidadTxt = u ? (m.unidadesCobradas === 1 ? u.singular : u.plural) : m.unidad;
  return (
    <div style={{ ...card, borderColor: elegida ? 'var(--color-primary)' : 'var(--color-border)', padding: 0, overflow: 'hidden' }}>
      <div className="cg-maq" style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 0 }}>
        <div style={{ background: 'var(--color-bg)', minHeight: 150 }}>
          {m.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : null}
        </div>
        <div style={{ padding: '16px 18px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 19, letterSpacing: '-0.02em' }}>{m.name}</h3>
            {m.brand ? <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{m.brand}</span> : null}
            {m.preferida ? <span style={{ ...chip, padding: '2px 8px', fontSize: 11, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>La que elegiste</span> : null}
          </div>
          {m.specs.length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {m.specs.slice(0, 4).map((s) => (
                <span key={s.label} style={{ ...chip, padding: '3px 9px', fontSize: 11.5, cursor: 'default' }}>{s.label}: {s.valor}</span>
              ))}
            </div>
          ) : null}
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3, fontSize: 13, color: 'var(--color-text-muted)' }}>
            {m.ubicacion ? <li>📍 {m.ubicacion}{m.km !== null ? ` · a ${m.km} km` : ''}</li> : null}
            {m.porque.filter((p) => !p.startsWith('A ')).map((p) => <li key={p}>✓ {p}</li>)}
            {m.notaMinimo ? <li style={{ color: 'var(--color-warning)' }}>{m.notaMinimo}</li> : null}
          </ul>
        </div>
        <div style={{ padding: '16px 18px', borderLeft: '1px solid var(--color-border)', minWidth: 210, display: 'grid', alignContent: 'space-between', gap: 10 }}>
          {m.total !== null && m.precioUnitario !== null && m.subtotal !== null ? (
            <div style={{ fontSize: 13, display: 'grid', gap: 3 }}>
              <div style={{ color: 'var(--color-text-muted)' }}>{formatPrice(m.precioUnitario)} / {u?.singular ?? m.unidad} × {m.unidadesCobradas} {unidadTxt}{m.equipos > 1 ? ` × ${m.equipos}` : ''}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Renta</span><span>{formatPrice(m.subtotal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Traslado</span><span>{m.flete !== null ? formatPrice(m.flete) : m.fleteTexto}</span></div>
              {m.iva > 0 ? <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IVA</span><span>{formatPrice(m.iva)}</span></div> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: DISPLAY, fontSize: 20, marginTop: 4 }}><span>Total</span><span>{formatPrice(m.total)}</span></div>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Precio por confirmar: te cotizamos a la medida.</div>
          )}
          {resumen ? null : m.total !== null ? (
            <button type="button" onClick={onElegir} style={elegida ? btn : btnSec}>{elegida ? <><Icon name="check" size={14} /> Elegida</> : 'Elegir esta'}</button>
          ) : (
            <Link href={`/cotizar?producto=${m.slug}`} style={btnSec}>Pedir a la medida</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function descartadasTexto(d: Resultado['descartadas']): string {
  const partes: string[] = [];
  if (d.noLlegan) partes.push(`${d.noLlegan} no ${d.noLlegan === 1 ? 'llega' : 'llegan'} a tu zona`);
  if (d.ocupadas) partes.push(`${d.ocupadas} ${d.ocupadas === 1 ? 'está apartada' : 'están apartadas'} esas fechas`);
  if (d.fueraDeHorario) partes.push(`${d.fueraDeHorario} no ${d.fueraDeHorario === 1 ? 'atiende' : 'atienden'} a esa hora`);
  if (d.noSirven) partes.push(`${d.noSirven} no ${d.noSirven === 1 ? 'alcanza' : 'alcanzan'} lo que pides`);
  return partes.length ? `Se descartaron: ${partes.join(', ')}.` : '';
}

const lineaNombre = (ls: Linea[], slug: string) => (ls.find((l) => l.slug === slug)?.name ?? '').toLowerCase();

const DISPLAY = 'var(--font-display)';
const card: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg, 14px)', padding: '22px 24px' };
const leyenda: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 16px' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md, 10px)' };
const etiquetaReq: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 };
const btn: React.CSSProperties = { border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', borderRadius: 'var(--radius-button, 10px)', padding: '13px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' };
const btnSec: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontWeight: 600 };
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 999, padding: '7px 13px', fontSize: 13, color: 'var(--color-text)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' };
const opcion = (on: boolean): React.CSSProperties => ({ textAlign: 'left', border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, background: on ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit' });
