'use client';

import Link from 'next/link';
import { Cotizador, type DatosEnvio, type ResultadoEnvio } from '@maqserv/ui';
import type { CatalogoCotizador } from '@maqserv/config';
import { useBranding } from '@/components/branding';
import { D } from '@/components/design-tokens';

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

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 0 40px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Link href="/cotizador" style={{ fontSize: 12.5, color: D.muted2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="ph ph-arrow-left" /> Cotizador
          </Link>
          <h1 style={{ margin: '8px 0 0', fontSize: 27, letterSpacing: '-0.025em', color: D.text }}>{titulo}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: D.muted2, maxWidth: '62ch' }}>{resumen}</p>
        </div>
        <Link
          href={`/cotizador/historial?kind=${catalogo.tipo}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${D.cardBorder}`, color: D.text, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
        >
          <i className="ph ph-clock-counter-clockwise" /> Historial
        </Link>
      </header>

      <Cotizador catalogo={catalogo} variante="panel" logo={logo} onEnviar={enviar} />
    </div>
  );
}
