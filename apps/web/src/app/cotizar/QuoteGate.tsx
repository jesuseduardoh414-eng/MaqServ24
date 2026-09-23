import Link from 'next/link';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { Icon } from '@/components/Icon';

/**
 * EL CANDADO DE COTIZAR (decisión del 2026-09-23).
 *
 * El visitante puede ver el catálogo, las líneas de servicio y los
 * cotizadores; para PEDIR una cotización necesita cuenta. Tres razones que
 * conviene dejar escritas:
 *
 *  1. El resto del camino ya la exigía: ver la cotización, aceptarla y seguir
 *     el servicio solo se puede desde Mi cuenta. Un invitado se quedaba con un
 *     folio que no podía abrir en ningún lado.
 *  2. Con cuenta no vuelve a capturar nombre, correo ni teléfono en cada
 *     solicitud: salen del perfil.
 *  3. La solicitud nace ligada a quien la pidió, y con eso el módulo de
 *     Clientes y los indicadores de repetición dejan de adivinar por correo.
 *
 * Se muestra ANTES del formulario y no al final, a propósito: pedir la cuenta
 * después de seis pasos de captura sería tirar lo escrito. Lo que sí se
 * conserva es lo que viene en la URL (el equipo o el servicio elegido) y el
 * carrito, que vive en el navegador; por eso `next` trae la URL completa.
 */
export function QuoteGate({ theme, next }: { theme: Theme; next: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  const boton: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15.5,
    padding: '15px 26px', borderRadius: 'var(--radius-button)', textDecoration: 'none',
    flex: '1 1 200px',
  };
  return (
    <section
      style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 4, padding: '34px 30px', maxWidth: 620, margin: '0 auto',
      }}
    >
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 700 }}>
        {t(theme, 'quote.gate.eyebrow')}
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '10px 0 12px', lineHeight: 1.1 }}>
        {t(theme, 'quote.gate.title')}
      </h2>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 15, lineHeight: 1.65 }}>
        {t(theme, 'quote.gate.body')}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href={`/registro${q}`} style={{ ...boton, background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
          {t(theme, 'quote.gate.register')}<Icon name="arrowRight" size={15} />
        </Link>
        <Link href={`/login${q}`} style={{ ...boton, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
          {t(theme, 'quote.gate.login')}
        </Link>
      </div>
      <p style={{ margin: '18px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {t(theme, 'quote.gate.hint')}<br />{t(theme, 'quote.gate.keep')}
      </p>
    </section>
  );
}
