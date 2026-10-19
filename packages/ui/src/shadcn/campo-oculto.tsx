'use client';

/**
 * El valor de un control de Radix (fecha, hora, desplegable) para FormData y
 * para la validación del navegador. Transparente y no `type="hidden"`: un
 * hidden no participa en `required`/`checkValidity`, y este sí, con su globo
 * de aviso encima del control. `data-campo="libre"`: el filtro de campos no
 * le aplica reglas de tipo.
 */
export function CampoOculto({ name, value, required }: { name?: string; value: string; required?: boolean }) {
  if (!name) return null;
  return (
    <input
      name={name}
      value={value}
      required={required}
      readOnly
      tabIndex={-1}
      aria-hidden
      data-campo="libre"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }}
    />
  );
}
