'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  claveDeProducto,
  Cotizador,
  lineasDeFicha,
  NumeroTexto,
  Tarjeta,
  unidadDeProducto,
  useCategorias,
  type DatosEnvio,
  type EmpresaCliente,
  type ProductoALaMedida,
  type ResultadoEnvio,
} from '@maqserv/ui';
import {
  catalogoDeCategorias,
  categoriaConPrecio,
  COTIZADORES_SITIO,
  cotizadorDelSitio,
  CUESTIONARIOS,
  notasDeCuestionario,
  renglonDeCuestionario,
  SERVICIO_A_MANO,
  type CatalogoCotizador,
  type PartidaCotizador,
  type Tabuladores,
} from '@maqserv/config';
import Link from '@/components/Enlace';
import { evento } from '@/lib/analitica';

export type { ProductoALaMedida };

/** La cantidad escrita, entera (las partidas van por pieza, tarima, viaje…). 0 si no hay. */
function cantidadDe(texto: string): number {
  const n = Math.round(Number(texto.replace(/,/g, '').trim()) || 0);
  return Math.min(100_000, Math.max(0, n));
}

/** Un renglón pedido a la medida: escrito a mano, con su categoría y sin precio (lo pone el panel). */
function partidaPorCotizar(d: { nombre: string; unidad: string; categoria: string; cantidad: number }): PartidaCotizador {
  return { tipo: 'servicio', id: SERVICIO_A_MANO, nombre: d.nombre.slice(0, 120), unidad: d.unidad.slice(0, 20), categoria: d.categoria, cantidad: d.cantidad, precio: 0 } as PartidaCotizador;
}

/** Lo que se pidió de una categoría sin precio: sus productos con cantidad, o un texto si no tiene productos. */
interface PedidoALaMedida {
  clave: string;
  /** `clave`: el producto o su presentación (`claveDeProducto`). */
  elegidos: Array<{ clave: string; nombre: string; unidad: string | null; cantidad: string }>;
  texto: string;
  /** Lo contestado en su cuestionario (venta de maquinaria, 2026-11-06), por pregunta. */
  respuestas: Record<string, string>;
}

/**
 * El cotizador en el sitio público.
 *
 * Es el MISMO componente que usa el panel; lo que cambia es la variante y a
 * dónde va lo capturado. Solo se llega aquí con cuenta (la página pinta el
 * candado si no la hay), y por eso la respuesta trae el enlace a Mi cuenta
 * para seguirla.
 *
 * UNA SOLA COTIZACIÓN CON TODO (2026-11-03, pedido del dueño: "que salga como
 * si fuera el cotizador, pero se agrega en una sola cotización"). Desde
 * «¿Necesitas otro servicio?» se suma cualquier categoría:
 *  - con precio, con su cotizador completo: las de maquinaria en el mismo
 *    tabulador y triturados con el suyo, que viaja junto (\`combinar\`);
 *  - sin precio todavía (carpeta, materiales, venta), con sus productos del
 *    catálogo en tarjetas y su cantidad: van en la misma solicitud con «precio
 *    por confirmar» y MAQSER24 los cotiza al responder.
 */
export function CotizadorPublico({
  tabuladores,
  cotizador,
  aLaMedida,
  logo,
  inicial,
  fichaId,
}: {
  /** Los dos tabuladores: aquí se enseña solo lo de las categorías elegidas. */
  tabuladores: Tabuladores;
  /** La clave del cotizador del sitio con el que se entró (agua, acarreos…). */
  cotizador: string;
  /** Las categorías sin nada con precio, con los productos de su catálogo. */
  aLaMedida: Record<string, ProductoALaMedida[]>;
  logo: string | null;
  inicial?: { cliente?: string; correo?: string; telefono?: string; municipio?: string };
  /** Se llegó desde "Cotizar" en una ficha del catálogo (2026-10-22): abre con ese tipo elegido. */
  fichaId?: number | null;
}) {
  // Las categorías con precio que se están cotizando: la de entrada y las que agregue.
  const categorias = useCategorias(tabuladores, [cotizador]);
  const { activas } = categorias;
  /**
   * Se entró por una categoría SIN precio de lista (2026-11-06, el dueño: "para
   * los clientes, solo escogen el material y después se cotiza"): abre ya con
   * sus productos para elegir, como lo que se agrega desde «¿Necesitas otro
   * servicio?». Antes era una pantalla «se cotiza a la medida» con un botón al
   * formulario.
   */
  const [medida, setMedida] = useState<PedidoALaMedida[]>(() =>
    categoriaConPrecio(tabuladores, cotizador) ? [] : [{ clave: cotizador, elegidos: [], texto: '', respuestas: {} }],
  );
  /**
   * El tabulador de esta cotización, contando lo pedido a la medida: así, si
   * va algo a la medida, la cotización es de maquinaria (donde viaja lo escrito
   * a mano) aunque se haya entrado por triturados. Lo que no tiene precio no
   * agrega nada que elegir.
   */
  const catalogo = useMemo(
    () => catalogoDeCategorias(tabuladores, [...activas, ...medida.map((m) => m.clave)]) as CatalogoCotizador,
    [tabuladores, activas, medida],
  );

  /** ¿Tiene algo con precio en su tabulador? Entonces se suma con su cotizador. */
  const conPrecio = (clave: string): boolean => categoriaConPrecio(tabuladores, clave);
  // Ya está en la cotización: con su cotizador, o a la medida (la de entrada sin precio puede quitarse y volver).
  const yaEsta = (clave: string) => (activas.includes(clave) && conPrecio(clave)) || medida.some((m) => m.clave === clave);
  const opciones = COTIZADORES_SITIO.filter((c) => !yaEsta(c.clave)).map((c) => ({
    clave: c.clave,
    titulo: c.titulo,
    icono: c.icono,
    resumen: conPrecio(c.clave) ? c.resumen : 'Precio por confirmar',
  }));
  const agregar = (clave: string) => {
    if (conPrecio(clave)) categorias.activar(clave);
    else setMedida((m) => (m.some((x) => x.clave === clave) ? m : [...m, { clave, elegidos: [], texto: '', respuestas: {} }]));
  };
  const cambiarMedida = (clave: string, cambio: (m: PedidoALaMedida) => PedidoALaMedida) =>
    setMedida((ms) => ms.map((m) => (m.clave === clave ? cambio(m) : m)));

  /**
   * LO PEDIDO A LA MEDIDA, COMO PARTIDAS (2026-11-06): cada cosa elegida con su
   * cantidad va como renglón «Por cotizar» (escrito a mano, con su categoría y
   * en $0). Así el documento la enseña, su solicitud se abre en su línea y el
   * panel le pone precio con el lápiz. Lo descrito con texto (venta, que no
   * tiene productos) va también como renglón, y completo en las notas.
   */
  const partidasExtra = useMemo<PartidaCotizador[]>(
    () =>
      medida.flatMap((m) => {
        const titulo = cotizadorDelSitio(m.clave)?.titulo ?? m.clave;
        const elegidos = m.elegidos
          .filter((e) => cantidadDe(e.cantidad) > 0)
          .map((e) => partidaPorCotizar({ nombre: e.nombre, unidad: unidadDeProducto(e.unidad), categoria: m.clave, cantidad: cantidadDe(e.cantidad) }));
        // Con cuestionario (venta de maquinaria, 2026-11-06): un renglón con lo que busca.
        if (CUESTIONARIOS[m.clave]) {
          const renglon = renglonDeCuestionario(m.clave, m.respuestas);
          return renglon ? [partidaPorCotizar({ nombre: renglon, unidad: 'equipo', categoria: m.clave, cantidad: 1 })] : [];
        }
        const texto = m.texto.trim();
        return texto ? [...elegidos, partidaPorCotizar({ nombre: `${titulo}: ${texto}`, unidad: 'servicio', categoria: m.clave, cantidad: 1 })] : elegidos;
      }),
    [medida],
  );
  const sinCantidad = medida.flatMap((m) => m.elegidos).find((e) => cantidadDe(e.cantidad) <= 0);
  // Lo obligatorio del cuestionario sin contestar.
  const sinContestar = medida
    .flatMap((m) => (CUESTIONARIOS[m.clave] ?? []).filter((p) => p.obligatoria && !(m.respuestas[p.clave] ?? '').trim()).map((p) => ({ m, p })))[0];
  const faltaExtra = sinCantidad
    ? `Escribe cuánto necesitas de ${sinCantidad.nombre}.`
    : sinContestar
      ? `${cotizadorDelSitio(sinContestar.m.clave)?.titulo ?? sinContestar.m.clave}: contesta «${sinContestar.p.etiqueta}».`
      : null;
  // En las notas: el texto completo de lo descrito a mano y el cuestionario pregunta por pregunta.
  const descritos = medida.filter((m) => m.texto.trim());
  const contestados = medida.filter((m) => CUESTIONARIOS[m.clave] && notasDeCuestionario(m.clave, m.respuestas));
  const notasExtra = [
    descritos.length
      ? `Pedido a la medida:\n${descritos.map((m) => `- ${cotizadorDelSitio(m.clave)?.titulo ?? m.clave}: ${m.texto.trim()}`).join('\n')}`
      : '',
    ...contestados.map((m) => `${cotizadorDelSitio(m.clave)?.titulo ?? m.clave} — lo que busca el cliente:\n${notasDeCuestionario(m.clave, m.respuestas)}`),
  ].filter(Boolean).join('\n\n');
  const todas = [...new Set([...activas, ...medida.map((m) => m.clave)])];

  // Una sola vez al montar: si el cliente quita la partida, no vuelve sola.
  const [lineasIniciales] = useState(() => (fichaId ? lineasDeFicha(catalogo, fichaId) : []));

  /**
   * Sus empresas con sus obras (2026-10-23): la tarjeta del cliente las ofrece
   * en un seleccionador. Se espera a tenerlas antes de pintar el cotizador para
   * que abra ya con su empresa elegida; si la consulta falla, abre sin ellas.
   */
  const [empresas, setEmpresas] = useState<EmpresaCliente[] | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/proxy/quotes/mis-obras')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setEmpresas(Array.isArray(d?.empresas) ? d.empresas : []); })
      .catch(() => { if (vivo) setEmpresas([]); });
    return () => { vivo = false; };
  }, []);

  async function enviar(datos: DatosEnvio): Promise<ResultadoEnvio> {
    const res = await fetch(`/api/proxy/quoter/request/${catalogo.tipo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: datos.contexto.cliente,
        obra: datos.contexto.obra,
        atencion: datos.contexto.atencion,
        municipio: datos.contexto.municipio,
        correo: datos.contexto.correo,
        telefono: datos.contexto.telefono,
        notas: datos.contexto.notas,
        clienteId: datos.contexto.clienteId,
        obraId: datos.contexto.obraId,
        direccion: datos.contexto.direccion,
        fecha: datos.contexto.fecha,
        ubicacion: datos.contexto.ubicacion,
        opciones: datos.opciones,
        partidas: datos.partidas,
      }),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      throw new Error('Tu sesión terminó. Entra de nuevo y vuelve a enviar tu solicitud.');
    }
    if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
    evento('cotizador_solicitado', { tipo: catalogo.tipo, cotizador: todas.join('+'), partidas: datos.partidas.length });
    return {
      folio: body.folio as string,
      enlace: typeof body.url === 'string' ? { href: body.url, label: 'Seguir mi solicitud en mi cuenta' } : undefined,
    };
  }

  if (empresas === null) return <p className="ms-desc" style={{ padding: '24px 0' }}>Cargando tus empresas y obras…</p>;
  // Abre con su primera empresa elegida y, si su cuenta no dice municipio, el de su primera obra que lo tenga.
  const primera = empresas[0];
  const municipio = inicial?.municipio || primera?.sites.find((o) => o.municipality)?.municipality || '';
  return (
    <Cotizador
      catalogo={catalogo}
      variante="sitio"
      // El título sale de lo que lleva; lo pedido a la medida también cuenta.
      categoriasExtra={medida.map((m) => m.clave)}
      masServicios={{ opciones, agregar }}
      // Cada una en su sección, en el orden en que se agregó.
      extras={Object.fromEntries(
        medida.map((m) => [
          m.clave,
          <CotizadorALaMedida
            key={m.clave}
            pedido={m}
            productos={aLaMedida[m.clave] ?? []}
            cambiar={(cambio) => cambiarMedida(m.clave, cambio)}
            quitar={() => setMedida((ms) => ms.filter((x) => x.clave !== m.clave))}
          />,
        ]),
      )}
      notasExtra={notasExtra}
      partidasExtra={partidasExtra}
      faltaExtra={faltaExtra}
      despues={<OtroServicio activas={todas} />}
      logo={logo}
      inicial={{ ...inicial, municipio, ...(primera ? { clienteId: primera.id, cliente: primera.name } : {}) }}
      lineasIniciales={lineasIniciales}
      empresas={empresas}
      onEnviar={enviar}
    />
  );
}

/** Qué escribir cuando la categoría no tiene productos en el catálogo (venta de maquinaria, hoy). */
const EJEMPLO_MEDIDA: Record<string, string> = {
  'venta-de-maquinaria': 'Qué equipo buscas, para qué uso y tu presupuesto aproximado',
};

/**
 * UNA CATEGORÍA SIN PRECIO TODAVÍA, COMO COTIZADOR (2026-11-03): sus productos
 * del catálogo en tarjetas; tocar uno lo elige y pide su cantidad. Sin
 * productos, un espacio para describir lo que necesita. Su precio lo confirma
 * MAQSER24 al responder; en cuanto su ficha tenga precio, la categoría pasa
 * sola al cotizador con precio.
 */
function CotizadorALaMedida({ pedido, productos, cambiar, quitar }: {
  pedido: PedidoALaMedida;
  productos: ProductoALaMedida[];
  cambiar: (cambio: (m: PedidoALaMedida) => PedidoALaMedida) => void;
  quitar: () => void;
}) {
  const c = cotizadorDelSitio(pedido.clave);
  const titulo = c?.titulo ?? pedido.clave;
  // Por su clave: cada presentación de un mismo producto se elige aparte (el block, 2026-11-06).
  const alternar = (p: ProductoALaMedida) =>
    cambiar((m) => (m.elegidos.some((e) => e.clave === claveDeProducto(p))
      ? { ...m, elegidos: m.elegidos.filter((e) => e.clave !== claveDeProducto(p)) }
      : { ...m, elegidos: [...m.elegidos, { clave: claveDeProducto(p), nombre: p.nombre, unidad: p.unidad, cantidad: '' }] }));
  /**
   * EL CUESTIONARIO (venta de maquinaria, 2026-11-06): el cliente contesta qué
   * equipo busca, marca, modelo, año y características; el encargado le
   * responde con el costo.
   */
  const preguntas = CUESTIONARIOS[pedido.clave];
  if (preguntas) {
    return (
      <div className="cz-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h2 className="cz-card-h">{titulo}</h2>
          <button type="button" className="cz-rm" aria-label={`Quitar ${titulo}`} title="Quitar" onClick={quitar}>✕</button>
        </div>
        <p className="cz-card-s">Cuéntanos qué equipo buscas: te respondemos con el costo en tu cotización.</p>
        <div className="cz-row">
          {preguntas.map((p) => {
            const id = `czq-${pedido.clave}-${p.clave}`;
            const valor = pedido.respuestas[p.clave] ?? '';
            const poner = (v: string) => cambiar((m) => ({ ...m, respuestas: { ...m.respuestas, [p.clave]: v.slice(0, p.max) } }));
            return (
              <div key={p.clave} className={`cz-field${p.largo ? ' full' : ''}`}>
                <label className="cz-lbl" htmlFor={id}>
                  {p.etiqueta}
                  {p.obligatoria ? <span className="req"> *</span> : null}
                </label>
                {p.largo ? (
                  <textarea id={id} className="cz-textarea" maxLength={p.max} placeholder={p.ejemplo} value={valor} onChange={(e) => poner(e.target.value)} />
                ) : (
                  <input id={id} className="cz-input" maxLength={p.max} placeholder={p.ejemplo} value={valor} onChange={(e) => poner(e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="cz-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <h2 className="cz-card-h">{titulo}</h2>
        <button type="button" className="cz-rm" aria-label={`Quitar ${titulo}`} title="Quitar" onClick={quitar}>✕</button>
      </div>
      <p className="cz-card-s">Todavía no tiene precio de lista en línea: elige qué necesitas y cuánto; el precio te lo confirmamos con la cotización.</p>
      {productos.length ? (
        <div className="cz-cards">
          {productos.map((p) => (
            <Tarjeta
              key={claveDeProducto(p)}
              icono={c?.icono ?? 'material'}
              titulo={p.nombre}
              nota={`por ${unidadDeProducto(p.unidad)} · precio por confirmar`}
              n={pedido.elegidos.some((e) => e.clave === claveDeProducto(p)) ? 1 : 0}
              onClick={() => alternar(p)}
            />
          ))}
        </div>
      ) : (
        <textarea
          className="cz-textarea"
          maxLength={250}
          aria-label={`Qué necesitas de ${titulo.toLowerCase()}`}
          placeholder={EJEMPLO_MEDIDA[pedido.clave] ?? 'Qué necesitas y cuánto'}
          value={pedido.texto}
          onChange={(e) => cambiar((m) => ({ ...m, texto: e.target.value }))}
        />
      )}
      {pedido.elegidos.length ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {pedido.elegidos.map((e) => (
            <div key={e.clave} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 160px', gap: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{e.nombre}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Entero (2026-11-06): va como partida por pieza, tarima o viaje. */}
                <NumeroTexto
                  ariaLabel={`Cuánto de ${e.nombre}`}
                  placeholder="Cantidad"
                  valor={e.cantidad}
                  onChange={(v) => cambiar((m) => ({ ...m, elegidos: m.elegidos.map((x) => (x.clave === e.clave ? { ...x, cantidad: v } : x)) }))}
                />
                <span className="cz-help" style={{ whiteSpace: 'nowrap' }}>{unidadDeProducto(e.unidad)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * DESPUÉS DE ENVIAR, OTRA VEZ LA PREGUNTA (2026-11-03): «¿Necesitas cotizar
 * otro servicio?» con los cotizadores que no entraron en esta solicitud.
 */
function OtroServicio({ activas }: { activas: string[] }) {
  const resto = COTIZADORES_SITIO.filter((c) => !activas.includes(c.clave));
  if (!resto.length) return null;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <b style={{ fontSize: 15 }}>¿Necesitas cotizar otro servicio?</b>
      <div className="cz-done-acts">
        {resto.map((c) => (
          <Link key={c.clave} href={`/cotizador/${c.clave}`} className="ms-btn ms-btn-sec">{c.titulo}</Link>
        ))}
      </div>
    </div>
  );
}
