'use client';

import { REGLAS_CONTRASENA, type ContextoContrasena } from '@maqserv/config';

const COLOR = ['var(--color-error)', 'var(--color-error)', 'var(--color-warning)', 'var(--color-primary)', 'var(--color-success)'];
const ETIQUETA = ['MUY DÉBIL', 'DÉBIL', 'REGULAR', 'CASI LISTA', 'SEGURA'];

/**
 * Medidor + lista que se palomea mientras se escribe. Las reglas son las de
 * `@maqserv/config` —las mismas que exige la API—, así que si todo está en
 * verde, el servidor la acepta.
 */
export function ReglasContrasena({ password, ...ctx }: { password: string } & ContextoContrasena) {
  const estado = REGLAS_CONTRASENA.map((r) => ({ ...r, cumple: r.ok(password, ctx) }));
  const cumplidas = estado.filter((r) => r.cumple).length;
  // 4 barras sobre 9 reglas: solo la última se enciende cuando cumple TODAS.
  const nivel = password.length === 0 ? 0 : cumplidas === estado.length ? 4 : Math.min(3, Math.floor((cumplidas / estado.length) * 4));

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
      {password.length > 0 ? (
        <div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < nivel ? COLOR[nivel] : 'var(--color-border)', transition: 'background .2s ease' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLOR[nivel], marginTop: 6, letterSpacing: '0.06em', fontWeight: 700 }}>{ETIQUETA[nivel]}</div>
        </div>
      ) : null}
      <ul aria-label="Requisitos de la contraseña" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {estado.map((r) => (
          <li key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.4, color: r.cumple ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            <span aria-hidden style={{ width: 14, flexShrink: 0, textAlign: 'center', fontWeight: 700 }}>{r.cumple ? '✓' : '○'}</span>
            <span>{r.texto}<span className="sr-only">{r.cumple ? ' — cumple' : ' — falta'}</span></span>
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Consejo: junta palabras que no tengan relación y agrégales números y símbolos (ej. <em>Nopal!Grúa-47Rio</em>). No uses la misma contraseña de otros sitios.
      </div>
    </div>
  );
}
