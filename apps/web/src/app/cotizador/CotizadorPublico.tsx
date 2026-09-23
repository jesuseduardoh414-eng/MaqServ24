'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cotizador, type BorradorCotizador, type DatosEnvio, type ResultadoEnvio } from '@maqserv/ui';
import type { CatalogoCotizador } from '@maqserv/config';

/**
 * El cotizador en el sitio público.
 *
 * Es el MISMO componente que usa el panel; lo que cambia es la variante (que
 * pide correo y teléfono, porque a un visitante no se le puede contestar de
 * otra forma) y a dónde va lo capturado: aquí nace como solicitud y espera a
 * que alguien la atienda desde el panel.
 *
 * SIN CUENTA NO SE ENVÍA (2026-09-23). Ver y usar el tabulador sigue abierto:
 * el visitante arma su requerimiento y, si el tabulador es público, ve el
 * costo. Lo que exige cuenta es ENVIAR. Como eso se sabe hasta el último paso,
 * no se le puede mandar a registrarse tirando lo que capturó: el borrador se
 * guarda en `sessionStorage` antes de salir y se restaura al volver.
 *
 * `sessionStorage` y no `localStorage` a propósito: es lo que estaba
 * capturando en ESTA visita. Una solicitud a medias de hace tres semanas no
 * debería reaparecer sola.
 */
const claveBorrador = (tipo: string) => `maqserv_cotizador_borrador_${tipo}`;

export function CotizadorPublico({
  catalogo,
  logo,
  inicial,
  sesion,
}: {
  catalogo: CatalogoCotizador;
  logo: string | null;
  inicial?: { cliente?: string; correo?: string; telefono?: string; municipio?: string };
  /** ¿Hay sesión? Lo resuelve la página en el servidor. */
  sesion: boolean;
}) {
  const router = useRouter();
  const clave = claveBorrador(catalogo.tipo);

  /**
   * El borrador se lee DESPUÉS de montar. En el servidor no hay
   * `sessionStorage`, así que el primer render sale sin borrador para todos y
   * la hidratación no se rompe; cuando hay uno, el `key` remonta el cotizador
   * ya con él. Solo pasa por aquí quien volvió de crear su cuenta.
   */
  const [borrador, setBorrador] = useState<BorradorCotizador | null>(null);
  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(clave);
      if (!crudo) return;
      const b = JSON.parse(crudo) as BorradorCotizador;
      if (b && Array.isArray(b.lineas) && b.ctx) setBorrador(b);
    } catch {
      /* borrador ilegible: se empieza de cero */
    }
  }, [clave]);

  const olvidarBorrador = () => {
    try { sessionStorage.removeItem(clave); } catch { /* ignora */ }
  };

  /** Guarda lo capturado y manda a crear la cuenta, con regreso a este cotizador. */
  function requiereCuenta(b: BorradorCotizador) {
    try { sessionStorage.setItem(clave, JSON.stringify(b)); } catch { /* sin storage: vuelve en blanco */ }
    router.push(`/registro?next=${encodeURIComponent(`/cotizador/${catalogo.tipo}`)}`);
  }

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
    if (res.status === 401) {
      throw new Error('Tu sesión terminó. Entra de nuevo y vuelve a enviar la solicitud.');
    }
    if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
    olvidarBorrador(); // ya es una solicitud con folio; no debe reaparecer
    return { folio: body.folio as string };
  }

  return (
    <Cotizador
      key={borrador ? 'restaurado' : 'nuevo'}
      catalogo={catalogo}
      variante="sitio"
      logo={logo}
      inicial={inicial}
      borrador={borrador}
      puedeEnviar={sesion}
      onRequiereCuenta={requiereCuenta}
      onEnviar={enviar}
    />
  );
}
