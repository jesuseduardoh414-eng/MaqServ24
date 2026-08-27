import type { ProviderBadge as Aliado } from '@maqserv/types';
import { Icon } from '@/components/Icon';

/**
 * Sello de proveedor (22 / PROVEEDORES Y CONFIANZA).
 *
 * "La confianza se expresa con datos, no con medallas decorativas." Por eso el
 * sello no dice solo "verificado": muestra la cobertura, el tiempo de respuesta
 * y los meses en la red, que son las señales que el manual enumera.
 *
 * Y cuando el aliado NO está verificado no se esconde: se dice. El manual pide
 * mostrar únicamente lo que se validó de verdad, y callar equivale a insinuar
 * que sí está validado.
 *
 * `tamano="lista"` va en la tarjeta del catálogo (una línea) y `"ficha"` en el
 * detalle, donde sí hay espacio para las señales.
 */
export function ProviderTrust({ p, tamano = 'lista' }: { p: Aliado; tamano?: 'lista' | 'ficha' }) {
  const color = p.verified ? 'var(--color-success)' : 'var(--color-text-muted)';

  if (tamano === 'lista') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11.5,
          color: 'var(--color-text-muted)',
          minWidth: 0,
        }}
      >
        <span aria-hidden style={{ color, flexShrink: 0, fontWeight: 700, display: 'flex' }}>
          <Icon name={p.verified ? 'check' : 'dot'} size={12} />
        </span>
        <span
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={p.verified ? `${p.name} · proveedor verificado` : p.name}
        >
          {p.name}
        </span>
      </div>
    );
  }

  const senales = [
    p.coverage.length > 0 ? `Cobertura: ${p.coverage.slice(0, 3).join(', ')}` : null,
    p.responseMinutes !== null ? `Respuesta promedio ${p.responseMinutes} min` : null,
    p.monthsInNetwork !== null ? `${p.monthsInNetwork} meses en la red` : null,
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        padding: '14px 16px',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color,
            border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            borderRadius: 'var(--radius-sm)',
            padding: '3px 8px',
          }}
        >
          {p.verified ? 'PROVEEDOR VERIFICADO' : 'PROVEEDOR SIN VERIFICAR'}
        </span>
        <strong style={{ fontSize: 15 }}>{p.name}</strong>
      </div>
      {senales.length > 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          {senales.join(' · ')}
        </div>
      ) : null}
      {/* Un expediente vencido es justo lo que el manual pide no disimular. */}
      {p.docsStatus === 'vencido' ? (
        <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>
          Documentación pendiente de renovar.
        </div>
      ) : null}
    </div>
  );
}
