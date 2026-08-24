import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';

const MONO = "'Inter', system-ui, sans-serif";

/**
 * Layout de las vistas de auth (login/registro/recuperar): barra superior mínima
 * + card centrada sobre fondo de cuadrícula. Colores por tokens del tema.
 */
export function AuthShell({ brand, initialView, redirectTo }: { brand: string; initialView: 'login' | 'register'; redirectTo?: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-sans)', color: 'var(--color-text)', minHeight: '100vh',
        background: 'var(--color-bg)',
        backgroundImage:
          'repeating-linear-gradient(0deg, color-mix(in srgb, var(--color-text) 3.5%, transparent) 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-text) 3.5%, transparent) 0 1px, transparent 1px 34px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 40px', flexWrap: 'wrap', gap: 12 }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.04em', color: 'var(--color-text)', textDecoration: 'none' }}>{brand}</Link>
        <Link href="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', color: 'var(--color-text-muted)', textDecoration: 'none' }}>← VOLVER AL INICIO</Link>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 56px' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <AuthCard initialView={initialView} redirectTo={redirectTo} />
          <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', letterSpacing: '0.06em', margin: '24px 0 0' }}>🔒 CONEXIÓN SEGURA · TUS DATOS ESTÁN PROTEGIDOS</p>
        </div>
      </div>
    </div>
  );
}
