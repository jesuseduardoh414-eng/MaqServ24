'use client';

import { useEffect, useState } from 'react';
import { ESTADOS_DISPONIBILIDAD, type EstadoDisponibilidad, type PresentacionEstado } from '@maqserv/config';

/**
 * EL MODO DEL PANEL EN EL CÓDIGO (2026-10-28, paquete C de la auditoría).
 *
 * Casi todo cambia solo con CSS (los tokens --adm-*). Lo que NO pasa por CSS
 * —los colores que se le dan a un mapa de Leaflet, que los pinta como
 * atributos de SVG— necesita saber en qué modo está el panel. Esto sigue el
 * atributo `data-theme` de <html> que pone Mi cuenta, también si cambia con
 * la pantalla abierta.
 */
export function useModoClaro(): boolean {
  const [claro, setClaro] = useState(false);
  useEffect(() => {
    const leer = () => setClaro(document.documentElement.getAttribute('data-theme') === 'light');
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return claro;
}

/**
 * El color de un estado de disponibilidad que cambia con el modo: la variable
 * `--estado-<clave>` que inyecta el tema (tono claro u oscuro). Antes el panel
 * usaba siempre el tono oscuro y en modo claro no se leía ("1 en servicio" a 1.9:1).
 */
export function colorVivo(p: PresentacionEstado): string {
  const clave = (Object.keys(ESTADOS_DISPONIBILIDAD) as EstadoDisponibilidad[]).find((k) => ESTADOS_DISPONIBILIDAD[k].color.oscuro === p.color.oscuro);
  return clave ? `var(--estado-${clave}, ${p.color.oscuro})` : p.color.oscuro;
}
