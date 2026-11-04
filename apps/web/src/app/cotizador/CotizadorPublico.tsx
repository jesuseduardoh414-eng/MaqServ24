'use client';

import { useEffect, useState } from 'react';
import {
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
  categoriaConPrecio,
  COTIZADORES_SITIO,
  cotizadorDelSitio,
  type CatalogoCotizador,
  type Tabuladores,
} from '@maqserv/config';
import Link from '@/components/Enlace';
import { evento } from '@/lib/analitica';

export type { ProductoALaMedida };

/** Lo que se pidió de una categoría sin precio: sus productos con cantidad, o un texto si no tiene productos. */
interface PedidoALaMedida {
  clave: string;
  elegidos: Array<{ id: number; nombre: string; unidad: string | null; cantidad: string }>;
  texto: string;
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
  // La página no pinta el cotizador sin el tabulador de la categoría de entrada.
  const catalogo = categorias.catalogo as CatalogoCotizador;
  const [medida, setMedida] = useState<PedidoALaMedida[]>([]);

  /** ¿Tiene algo con precio en su tabulador? Entonces se suma con su cotizador. */
  const conPrecio = (clave: string): boolean => categoriaConPrecio(tabuladores, clave);
  const opciones = COTIZADORES_SITIO.filter((c) => !activas.includes(c.clave) && !medida.some((m) => m.clave === c.clave)).map((c) => ({
    clave: c.clave,
    titulo: c.titulo,
    icono: c.icono,
    resumen: conPrecio(c.clave) ? c.resumen : 'Precio por confirmar',
  }));
  const agregar = (clave: string) => {
    if (conPrecio(clave)) categorias.activar(clave);
    else setMedida((m) => (m.some((x) => x.clave === clave) ? m : [...m, { clave, elegidos: [], texto: '' }]));
  };
  const cambiarMedida = (clave: string, cambio: (m: PedidoALaMedida) => PedidoALaMedida) =>
    setMedida((ms) => ms.map((m) => (m.clave === clave ? cambio(m) : m)));

  // Lo que va a la medida, en las notas del documento y de la solicitud.
  const notasExtra = medida.length
    ? `Por cotizar a la medida (precio por confirmar):\n${medida
        .map((m) => {
          const detalle = [...m.elegidos.map((e) => `${e.nombre} · ${e.cantidad.trim() || '¿cuánto?'} ${unidadDeProducto(e.unidad)}`), m.texto.trim()].filter(Boolean).join('; ');
          return `- ${cotizadorDelSitio(m.clave)?.titulo ?? m.clave}: ${detalle || 'sin detalle'}`;
        })
        .join('\n')}`
    : '';
  const todas = [...activas, ...medida.map((m) => m.clave)];

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
  const alternar = (p: ProductoALaMedida) =>
    cambiar((m) => (m.elegidos.some((e) => e.id === p.id)
      ? { ...m, elegidos: m.elegidos.filter((e) => e.id !== p.id) }
      : { ...m, elegidos: [...m.elegidos, { id: p.id, nombre: p.nombre, unidad: p.unidad, cantidad: '' }] }));
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
              key={p.id}
              icono={c?.icono ?? 'material'}
              titulo={p.nombre}
              nota={`por ${unidadDeProducto(p.unidad)} · precio por confirmar`}
              n={pedido.elegidos.some((e) => e.id === p.id) ? 1 : 0}
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
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 160px', gap: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{e.nombre}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumeroTexto
                  decimal
                  ariaLabel={`Cuánto de ${e.nombre}`}
                  placeholder="Cantidad"
                  valor={e.cantidad}
                  onChange={(v) => cambiar((m) => ({ ...m, elegidos: m.elegidos.map((x) => (x.id === e.id ? { ...x, cantidad: v } : x)) }))}
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
