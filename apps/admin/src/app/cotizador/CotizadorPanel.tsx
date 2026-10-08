'use client';

import { Btn, PageHeader } from '@/components/ui';
import { Cotizador, type DatosEnvio, type ResultadoEnvio } from '@maqserv/ui';
import type { CatalogoCotizador } from '@maqserv/config';
import { useBranding } from '@/components/branding';

/**
 * El cotizador dentro del panel.
 *
 * La pantalla completa vive en `@maqserv/ui` y la comparten el panel y el sitio
 * público; lo único que cambia aquí es a dónde se manda lo capturado y el
 * encabezado. Si un día el flujo se toca, se toca una vez.
 */
export function CotizadorPanel({
  catalogo,
  titulo,
  resumen,
}: {
  catalogo: CatalogoCotizador;
  titulo: string;
  resumen: string;
}) {
  const branding = useBranding();
  // El documento se imprime sobre papel BLANCO: hace falta el logo para fondo
  // claro, no el del sidebar oscuro.
  const logo = branding.logoLight || branding.logoAlt || null;

  async function enviar(datos: DatosEnvio): Promise<ResultadoEnvio> {
    const res = await fetch(`/api/admin/quoter/quotes/${catalogo.tipo}`, {
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
    if (!res.ok) throw new Error(body?.message ?? 'No se pudo guardar la cotización.');
    return { folio: body.folio as string, id: body.id as number };
  }

  // Sin el contenedor de 1180px que traía: el encabezado queda alineado con el
  // de los demás módulos y la pantalla compartida toma el ancho del panel.
  return (
    <div>
      <PageHeader
        eyebrow={['2 · Cotizar', ['Cotizador', '/cotizador']]}
        title={titulo}
        subtitle={resumen}
        actions={
          <Btn href={`/cotizador/historial?kind=${catalogo.tipo}`} icon="ph-clock-counter-clockwise">
            Historial
          </Btn>
        }
      />

      <Cotizador catalogo={catalogo} variante="panel" logo={logo} onEnviar={enviar} />
    </div>
  );
}
