'use client';

import { mostrarResultado } from '@maqserv/ui';

/**
 * EL TRATO CON CLIENTES Y ALIADOS, del lado del panel (2026-11-09).
 *
 * Los nombres y la forma de cada renglón, y `anotarSolo`, que usan los botones
 * que ya llamaban o abrían WhatsApp: al apretarlos, el panel anota solo
 * "Se abrió WhatsApp con…" en la solicitud, el cliente o el aliado, sin que
 * nadie tenga que acordarse. La lógica y dónde se guarda: apps/api/src/admin/trato.ts.
 */

export type Canal = 'llamada' | 'whatsapp' | 'correo' | 'visita';
export type Resultado = 'no_contesto' | 'confirmar' | 'confirmado';
export type ConQuien = 'cliente' | 'aliado';

/** A qué pertenece: la solicitud, el cliente, el aliado o el documento del cotizador. */
export interface ObjetivoTrato {
  solicitud?: number;
  cliente?: number;
  aliado?: number;
  documento?: number;
}

export interface RenglonTrato {
  id: string;
  tipo: 'contacto' | 'correo';
  cuando: string;
  canal: Canal;
  con: ConQuien;
  a: string | null;
  quien: string | null;
  auto: boolean;
  nota: string | null;
  res: Resultado | null;
  recordar: string | null;
  hecho: boolean;
  editable: boolean;
  solicitudId: number | null;
  folio: string | null;
  asunto?: string;
  estado?: string;
  correoId?: number;
}

export const CANAL: Record<Canal, { label: string; icon: string; solo: string }> = {
  llamada: { label: 'Llamada', icon: 'ph-phone', solo: 'Se le marcó' },
  whatsapp: { label: 'WhatsApp', icon: 'ph-whatsapp-logo', solo: 'Se abrió WhatsApp' },
  correo: { label: 'Correo', icon: 'ph-envelope-simple', solo: 'Se abrió el correo' },
  visita: { label: 'En persona', icon: 'ph-handshake', solo: 'En persona' },
};

export const RESULTADO: Record<Resultado, string> = {
  no_contesto: 'No contestó',
  confirmar: 'Quedó de confirmar',
  confirmado: 'Confirmado',
};

/** El día siguiente en Monterrey, brincando el domingo (en obra se trabaja el sábado). */
export function siguienteDiaHabil(): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const hoyMty = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());

/**
 * Anota solo, al apretar un botón que llama o abre WhatsApp. No espera ni
 * estorba: si no se puede (sin permiso, sin conexión), el botón hace lo suyo
 * igual. Va por `trato/solo`, que el aviso de "Listo" no observa; con `avisar`
 * dice en una línea que quedó anotado, para las pantallas donde el trato no
 * está a la vista (Servicios, el documento, la obra).
 */
export async function anotarSolo(
  datos: ObjetivoTrato & { con: ConQuien; canal: Canal; a?: string | null; nota?: string | null },
  opciones: { avisar?: boolean } = {},
): Promise<RenglonTrato | null> {
  try {
    const r = await fetch('/api/admin/trato/solo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      // La pestaña de WhatsApp o la llamada pueden llevarse la atención: que el aviso llegue igual.
      keepalive: true,
    });
    if (!r.ok) return null;
    const b = (await r.json().catch(() => null)) as { renglon?: RenglonTrato } | null;
    if (opciones.avisar && b?.renglon) {
      mostrarResultado(`Quedó anotado en el trato${b.renglon.a ? ` con ${b.renglon.a}` : ''}.`, 'info');
    }
    return b?.renglon ?? null;
  } catch {
    return null;
  }
}
