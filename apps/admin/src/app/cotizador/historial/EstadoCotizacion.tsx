/**
 * El estado de una cotización emitida, SOLO DE LECTURA (2026-10-26).
 *
 * Antes era un selector libre y casi siempre solo cambiaba la etiqueta
 * ("Enviada" a mano no mandaba nada). Ahora lo pone el flujo: por revisar al
 * pedirla el cliente, borrador al guardarla en el panel, enviada al mandar el
 * precio, aceptada cuando el cliente acepta, cancelada al volver a cotizar, al
 * descartar su solicitud o cancelar su servicio. "Vencida" no es un estado
 * guardado: es una enviada cuya vigencia pasó sin respuesta.
 *
 * `solicitada` NO es un pendiente de esta pantalla (2026-10-08): ese trabajo
 * se atiende en Solicitudes; aquí solo se informa.
 */
export const ESTADOS_COTIZACION: Record<string, { texto: string; color: string }> = {
  solicitada: { texto: 'Por revisar', color: 'var(--adm-info)' },
  borrador: { texto: 'Borrador', color: 'var(--adm-muted)' },
  enviada: { texto: 'Enviada', color: 'var(--adm-warn)' },
  aceptada: { texto: 'Aceptada', color: 'var(--adm-ok)' },
  cancelada: { texto: 'Cancelada', color: 'var(--adm-bad)' },
};

const VENCIDA = { texto: 'Vencida', color: '#F97316' };

export function EstadoCotizacion({ estado, vencida }: { estado: string; vencida?: boolean }) {
  const e = vencida && estado === 'enviada' ? VENCIDA : ESTADOS_COTIZACION[estado] ?? { texto: estado, color: 'var(--adm-muted)' };
  return (
    <span
      title={vencida && estado === 'enviada' ? 'Se envió y su vigencia pasó sin respuesta del cliente' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 11px', borderRadius: 999,
        fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', color: e.color,
        background: `color-mix(in srgb, ${e.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${e.color} 38%, transparent)`,
      }}
    >
      <i aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: e.color }} />
      {e.texto}
    </span>
  );
}
