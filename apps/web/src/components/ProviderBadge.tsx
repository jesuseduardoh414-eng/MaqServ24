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

  // Tarjeta del sistema (radio 12, borde 1 px) con icono en recuadro y chip
  // en tipo oración: verde si está verificado; neutro si no, pero dicho.
  return (
    <div className="ms-panel" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span className={p.verified ? 'ms-ico' : 'ms-ico ms-ico-muted'} style={p.verified ? { color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' } : undefined}>
        <Icon name="shield" size={18} />
      </span>
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</strong>
          <span className={p.verified ? 'ms-chip ms-chip-ok' : 'ms-chip'}>
            {p.verified ? 'Proveedor verificado' : 'Proveedor sin verificar'}
          </span>
        </div>
        {senales.length > 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            {senales.join(' · ')}
          </div>
        ) : null}
        {/* Un expediente vencido es justo lo que el manual pide no disimular. */}
        {p.docsStatus === 'vencido' ? (
          <div style={{ fontSize: 13, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="warning" size={14} /> Documentación pendiente de renovar.
          </div>
        ) : null}
      </div>
    </div>
  );
}
