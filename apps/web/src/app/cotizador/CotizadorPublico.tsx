'use client';

import { Cotizador, type DatosEnvio, type ResultadoEnvio } from '@maqserv/ui';
import type { CatalogoCotizador } from '@maqserv/config';

/**
 * El cotizador en el sitio público.
 *
 * Es el MISMO componente que usa el panel; lo que cambia es la variante (que
 * pide correo y teléfono, porque a un visitante no se le puede contestar de
 * otra forma) y a dónde va lo capturado: aquí nace como solicitud y espera a
 * que alguien la atienda desde el panel.
 */
export function CotizadorPublico({
  catalogo,
  logo,
  inicial,
}: {
  catalogo: CatalogoCotizador;
  logo: string | null;
  inicial?: { cliente?: string; correo?: string; telefono?: string; municipio?: string };
}) {
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
        opciones: datos.opciones,
        partidas: datos.partidas,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
    return { folio: body.folio as string };
  }

  return <Cotizador catalogo={catalogo} variante="sitio" logo={logo} inicial={inicial} onEnviar={enviar} />;
}
