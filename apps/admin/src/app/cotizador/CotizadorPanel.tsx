'use client';

import { Btn, Note, PageHeader } from '@/components/ui';
import { Cotizador, type DatosEnvio, type ResultadoEnvio } from '@maqserv/ui';
import type { CatalogoCotizador } from '@maqserv/config';
import { useBranding } from '@/components/branding';

/** Una solicitud del formulario "Cotizar" que se va a cotizar con el tabulador (2026-10-15). */
export interface SolicitudACotizar {
  id: number;
  quoteNumber: string;
  /** El documento que ya tenía: el nuevo lo reemplaza. */
  folioActual: string | null;
  inicial: { cliente: string; obra: string; atencion: string; municipio: string; correo: string; telefono: string; notas: string };
  pide: string | null;
  detalle: Array<[string, string]>;
  comentarios: string | null;
}

const humano = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');

/**
 * El cotizador dentro del panel.
 *
 * La pantalla completa vive en `@maqserv/ui` y la comparten el panel y el sitio
 * público; lo único que cambia aquí es a dónde se manda lo capturado y el
 * encabezado. Si un día el flujo se toca, se toca una vez.
 *
 * Con `solicitud` cotiza una solicitud del sitio: abre ya llenado con sus
 * datos, enseña lo que pidió el cliente y al guardar el documento queda ligado
 * a ella (sus importes son los que se le responden).
 */
export function CotizadorPanel({
  catalogo,
  titulo,
  resumen,
  solicitud,
  solicitudFallida,
}: {
  catalogo: CatalogoCotizador;
  titulo: string;
  resumen: string;
  solicitud?: SolicitudACotizar | null;
  /** Se pidió cotizar una solicitud que ya no admite precio nuevo (aceptada, descartada o inexistente). */
  solicitudFallida?: boolean;
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
        ...(solicitud ? { solicitudId: solicitud.id } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message ?? 'No se pudo guardar la cotización.');
    return {
      folio: body.folio as string,
      id: body.id as number,
      // Lo que sigue es responderle al cliente con este documento.
      ...(solicitud
        ? { enlace: { href: `/cotizaciones?ver=${solicitud.id}`, label: `Volver a ${solicitud.quoteNumber} para responder` } }
        // Con su correo, lo que sigue es mandársela (2026-10-22): un clic al documento con el botón.
        : datos.contexto.correo?.trim()
          ? { enlace: { href: `/cotizador/historial/${body.id}`, label: 'Revisar y enviar al cliente' } }
          : {}),
    };
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

      {solicitudFallida ? (
        <Note tone="warn" icon="ph-warning" style={{ marginBottom: 16 }}>
          Esa solicitud ya no se puede cotizar aquí: el cliente ya la aceptó, está descartada o ya trae su documento. Lo que guardes ahora queda como cotización suelta.
        </Note>
      ) : null}

      {solicitud ? (
        <Note tone="info" icon="ph-tray" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div>
              Cotizando la solicitud <strong className="adm-mono">{solicitud.quoteNumber}</strong>
              {solicitud.pide ? <> · pidió <strong>{solicitud.pide}</strong></> : null}. Los datos de la obra ya vienen llenos; elige equipo y tiempo
              con el tabulador. Al guardar, el documento queda ligado a la solicitud y sus importes son los que se le responden.
            </div>
            {solicitud.folioActual ? (
              <div style={{ color: 'var(--adm-warn)' }}>Ya tenía el documento {solicitud.folioActual}: el nuevo lo reemplaza y la solicitud vuelve a «Por cotizar».</div>
            ) : null}
            {solicitud.detalle.length || solicitud.comentarios ? (
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--adm-text-2)' }}>Lo que escribió el cliente</summary>
                {/* El formulario ya guarda en el comentario las respuestas con su
                    pregunta ("Tipo de equipo: …"): con él basta, sin repetirlas sueltas. */}
                {solicitud.comentarios ? (
                  <div style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{solicitud.comentarios}</div>
                ) : (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 2 }}>
                    {solicitud.detalle.map(([k, v]) => <li key={k}><span style={{ color: 'var(--adm-muted)' }}>{humano(k)}:</span> {v}</li>)}
                  </ul>
                )}
              </details>
            ) : null}
          </div>
        </Note>
      ) : null}

      <Cotizador
        // Con otra solicitud el cotizador arranca de cero, no con lo capturado de la anterior.
        key={solicitud?.id ?? 'suelta'}
        catalogo={catalogo}
        variante="panel"
        logo={logo}
        inicial={solicitud?.inicial}
        onEnviar={enviar}
      />
    </div>
  );
}
