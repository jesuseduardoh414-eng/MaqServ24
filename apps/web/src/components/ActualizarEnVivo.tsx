'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * LA PANTALLA SE PONE AL DÍA SOLA (2026-10-26): cuenta del cliente, portal del
 * aliado y página del operador.
 *
 * "Se deben actualizar en tiempo real." Pregunta cada pocos segundos a la API
 * la hora del último guardado en el sistema (`GET /cambios`, ver
 * common/cambios.ts en la API) y, si avanzó, vuelve a pedir los datos de la
 * página (`router.refresh()`): el aliado ve la oferta nueva, el cliente ve su
 * cotización respondida, sin recargar. Consulta periódica y no conexión
 * abierta, igual que la campana del panel: cPanel no garantiza las conexiones
 * largas.
 *
 * Si se está escribiendo en un campo espera a que se salga de él, para no
 * tocar un formulario a medias.
 */

const VISIBLE_MS = 5_000;
const OCULTA_MS = 20_000;

function escribiendo(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type);
}

export function ActualizarEnVivo() {
  const router = useRouter();

  useEffect(() => {
    let visto: number | null = null;
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    let esperando: (() => void) | null = null;

    const refrescar = () => {
      if (!escribiendo()) {
        router.refresh();
        return;
      }
      if (esperando) return;
      const alSalir = () => {
        // El foco ya pasó a donde va: si es otro campo, se sigue esperando.
        setTimeout(() => {
          if (!vivo || escribiendo() || esperando !== alSalir) return;
          document.removeEventListener('focusout', alSalir);
          esperando = null;
          router.refresh();
        }, 0);
      };
      esperando = alSalir;
      document.addEventListener('focusout', alSalir);
    };

    const consultar = async () => {
      try {
        const r = await fetch('/api/proxy/cambios', { cache: 'no-store' });
        if (!r.ok) return;
        const d = (await r.json()) as { cambio?: number };
        if (!vivo || typeof d.cambio !== 'number') return;
        // Solo si AVANZÓ: la primera vuelta solo lo anota.
        if (visto !== null && d.cambio > visto) refrescar();
        visto = Math.max(visto ?? 0, d.cambio);
      } catch { /* sin red: se reintenta en la siguiente vuelta */ }
    };

    const vuelta = () => {
      t = setTimeout(async () => { await consultar(); if (vivo) vuelta(); }, document.visibilityState === 'visible' ? VISIBLE_MS : OCULTA_MS);
    };
    void consultar();
    vuelta();
    const alVolver = () => { if (document.visibilityState === 'visible') void consultar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearTimeout(t);
      document.removeEventListener('visibilitychange', alVolver);
      if (esperando) document.removeEventListener('focusout', esperando);
    };
  }, [router]);

  return null;
}
