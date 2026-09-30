'use client';

import { REGLAS_CONTRASENA, type ContextoContrasena } from '@maqserv/config';

/**
 * La lista de requisitos de la contraseña, palomeada en vivo. Mismas reglas que
 * exige la API (`@maqserv/config`): si todo está en verde, el servidor acepta.
 * Versión compacta para los formularios del panel.
 */
export function ReglasContrasena({ password, ...ctx }: { password: string } & ContextoContrasena) {
  return (
    <ul aria-label="Requisitos de la contraseña" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 3 }}>
      {REGLAS_CONTRASENA.map((r) => {
        const ok = r.ok(password, ctx);
        return (
          <li key={r.id} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.4, color: ok ? '#3fbf8f' : '#8A8A8F' }}>
            <span aria-hidden style={{ width: 12, flexShrink: 0, textAlign: 'center', fontWeight: 700 }}>{ok ? '✓' : '○'}</span>
            <span>{r.texto}<span className="sr-only">{ok ? ' — cumple' : ' — falta'}</span></span>
          </li>
        );
      })}
    </ul>
  );
}
