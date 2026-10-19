'use client';

import { REGLAS_CONTRASENA, type ContextoContrasena } from '@maqserv/config';

/**
 * La lista de requisitos de la contraseña, palomeada en vivo. Mismas reglas que
 * exige la API (`@maqserv/config`): si todo está en verde, el servidor acepta.
 * Versión compacta para los formularios del panel: en dos columnas cuando el
 * campo es ancho (alta de administrador), en una en los angostos (popover).
 */
export function ReglasContrasena({
  password,
  marcar,
  ...ctx
}: {
  password: string;
  /** Tras un intento fallido: lo que falta se pinta en rojo con ✕, no en gris. */
  marcar?: boolean;
} & ContextoContrasena) {
  return (
    // Columnas de texto (no grid): se lee de arriba abajo y una regla de dos
    // renglones no deja un hueco en la columna de al lado.
    <ul aria-label="Requisitos de la contraseña" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, columns: '230px 2', columnGap: 16 }}>
      {REGLAS_CONTRASENA.map((r) => {
        const ok = r.ok(password, ctx);
        return (
          <li key={r.id} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.4, padding: '1.5px 0', breakInside: 'avoid', color: ok ? '#3fbf8f' : marcar ? 'var(--adm-bad)' : '#8A8A8F' }}>
            <span aria-hidden style={{ width: 12, flexShrink: 0, textAlign: 'center', fontWeight: 700 }}>{ok ? '✓' : marcar ? '✕' : '○'}</span>
            <span>{r.texto}<span className="sr-only">{ok ? ' — cumple' : ' — falta'}</span></span>
          </li>
        );
      })}
    </ul>
  );
}
