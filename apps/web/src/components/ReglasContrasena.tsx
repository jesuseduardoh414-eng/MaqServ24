'use client';

import { REGLAS_CONTRASENA, type ContextoContrasena } from '@maqserv/config';
import { Icon } from '@/components/Icon';

const COLOR = ['var(--color-error)', 'var(--color-error)', 'var(--color-warning)', 'var(--color-primary)', 'var(--color-success)'];
// Tipo oración (estándar 2026-09-30): nada de etiquetas en mayúsculas espaciadas.
const ETIQUETA = ['Muy débil', 'Débil', 'Regular', 'Casi lista', 'Segura'];

/**
 * Medidor + lista que se palomea mientras se escribe. Las reglas son las de
 * `@maqserv/config` —las mismas que exige la API—, así que si todo está en
 * verde, el servidor la acepta.
 */
export function ReglasContrasena({
  password,
  compacta,
  ...ctx
}: {
  password: string;
  /**
   * Para el registro (2026-10-15): antes de escribir, una sola línea; al
   * escribir, el medidor y SOLO lo que falta, que se va yendo. Las nueve reglas
   * a la vista empujaban el botón fuera de la pantalla.
   */
  compacta?: boolean;
} & ContextoContrasena) {
  const estado = REGLAS_CONTRASENA.map((r) => ({ ...r, cumple: r.ok(password, ctx) }));
  const cumplidas = estado.filter((r) => r.cumple).length;
  // 4 barras sobre 9 reglas: solo la última se enciende cuando cumple TODAS.
  const nivel = password.length === 0 ? 0 : cumplidas === estado.length ? 4 : Math.min(3, Math.floor((cumplidas / estado.length) * 4));

  if (compacta) {
    if (password.length === 0) {
      return <p className="ms-hint">Usa 10 caracteres o más, con mayúscula, minúscula, número y símbolo.</p>;
    }
    const faltan = estado.filter((r) => !r.cumple);
    return (
      <div style={{ display: 'grid', gap: 8 }} aria-live="polite">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < nivel ? COLOR[nivel] : 'var(--color-border)', transition: 'background .2s ease' }} />
            ))}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: COLOR[nivel], whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {faltan.length === 0 ? <Icon name="check" size={13} /> : null}
            {ETIQUETA[nivel]}
          </span>
        </div>
        {faltan.length > 0 ? (
          <ul aria-label="Le falta a la contraseña" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
            {faltan.map((r) => (
              <li key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-text-muted)' }}>
                <span aria-hidden style={{ width: 12, height: 17, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                  <Icon name="dot" size={12} />
                </span>
                {r.texto}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
      {password.length > 0 ? (
        <div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < nivel ? COLOR[nivel] : 'var(--color-border)', transition: 'background .2s ease' }} />
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: COLOR[nivel], marginTop: 6, fontWeight: 600 }}>{ETIQUETA[nivel]}</div>
        </div>
      ) : null}
      <ul aria-label="Requisitos de la contraseña" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {estado.map((r) => (
          <li key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.4, color: r.cumple ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            <span aria-hidden style={{ width: 14, height: 17, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
              <Icon name={r.cumple ? 'check' : 'dot'} size={r.cumple ? 13 : 14} />
            </span>
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
