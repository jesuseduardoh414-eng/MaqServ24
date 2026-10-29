'use client';

import { useEffect, useState } from 'react';
import { Cotizador, lineasDeFicha, type DatosEnvio, type EmpresaCliente, type ResultadoEnvio } from '@maqserv/ui';
import type { CatalogoCotizador } from '@maqserv/config';
import { evento } from '@/lib/analitica';

/**
 * El cotizador en el sitio público.
 *
 * Es el MISMO componente que usa el panel; lo que cambia es la variante (que
 * pide correo y teléfono, porque a un visitante no se le puede contestar de
 * otra forma) y a dónde va lo capturado.
 *
 * Lo que sale de aquí es una SOLICITUD DE COTIZACIÓN sin precios (2026-10-23:
 * el sitio nunca los enseña). Llega al panel con su precio estimado; MAQSER24
 * lo revisa y se lo manda al cliente, que la acepta desde su cuenta. Solo se
 * llega aquí con cuenta (la página pinta el candado si no la hay), y por eso
 * la respuesta trae el enlace a Mi cuenta para seguirla.
 */
export function CotizadorPublico({
  catalogo,
  logo,
  inicial,
  fichaId,
}: {
  catalogo: CatalogoCotizador;
  logo: string | null;
  inicial?: { cliente?: string; correo?: string; telefono?: string; municipio?: string };
  /** Se llegó desde "Cotizar" en una ficha del catálogo (2026-10-22): abre con ese tipo elegido. */
  fichaId?: number | null;
}) {
  // Una sola vez al montar: si el cliente quita la partida, no vuelve sola.
  const [lineasIniciales] = useState(() => (fichaId ? lineasDeFicha(catalogo, fichaId) : []));

  /**
   * Sus empresas con sus obras (2026-10-23): el paso 1 las ofrece en un
   * seleccionador. Se espera a tenerlas antes de pintar el cotizador para que
   * abra ya con su empresa elegida; si la consulta falla, abre sin ellas y
   * pide escribir empresa y obra nueva.
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
    evento('cotizador_solicitado', { tipo: catalogo.tipo, partidas: datos.partidas.length });
    return {
      folio: body.folio as string,
      enlace: typeof body.url === 'string' ? { href: body.url, label: 'Seguir mi solicitud en mi cuenta' } : undefined,
    };
  }

  if (empresas === null) return <p className="ms-desc" style={{ padding: '24px 0' }}>Cargando tus empresas y obras…</p>;
  // Abre con su primera empresa elegida; la obra la elige él.
  const primera = empresas[0];
  return (
    <Cotizador
      catalogo={catalogo}
      variante="sitio"
      logo={logo}
      inicial={{ ...inicial, ...(primera ? { clienteId: primera.id, cliente: primera.name } : {}) }}
      lineasIniciales={lineasIniciales}
      empresas={empresas}
      onEnviar={enviar}
    />
  );
}
