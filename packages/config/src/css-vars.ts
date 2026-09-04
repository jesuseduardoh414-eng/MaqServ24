import type { Palette, ThemeTokens } from './schema';

/**
 * Convierte los tokens del tema en variables CSS.
 * El frontend inyecta esto en <style> durante el SSR: cambiar un token
 * en la BD cambia la UI sin recompilar (DoD de la Fase 0).
 */

function paletteVars(p: Palette): string {
  return [
    `--color-primary:${p.primary}`,
    `--color-primary-fg:${p.primaryFg}`,
    `--color-secondary:${p.secondary}`,
    `--color-accent:${p.accent}`,
    `--color-bg:${p.background}`,
    `--color-surface:${p.surface}`,
    `--color-text:${p.text}`,
    `--color-text-muted:${p.textMuted}`,
    `--color-border:${p.border}`,
    `--color-success:${p.success}`,
    `--color-warning:${p.warning}`,
    `--color-error:${p.error}`,
  ].join(';');
}

function scaleVars(t: ThemeTokens): string {
  const { baseSizePx, scaleRatio, fontSans, fontHeading, fontDisplay } = t.typography;
  const step = (n: number) => `${(baseSizePx * Math.pow(scaleRatio, n)).toFixed(2)}px`;
  return [
    `--font-sans:'${fontSans}',system-ui,sans-serif`,
    `--font-heading:'${fontHeading}',system-ui,sans-serif`,
    // Fallback sans-serif: el `cursive` era un resto del display de SEGAshop —
    // si Google Fonts no carga, el wordmark y los títulos caían a una cursiva.
    `--font-display:'${fontDisplay ?? fontHeading}',system-ui,sans-serif`,
    `--text-sm:${step(-1)}`,
    `--text-base:${baseSizePx}px`,
    `--text-lg:${step(1)}`,
    `--text-xl:${step(2)}`,
    `--text-2xl:${step(3)}`,
    `--text-3xl:${step(4)}`,
    `--radius-sm:${t.shape.radiusSm}`,
    `--radius-md:${t.shape.radiusMd}`,
    `--radius-lg:${t.shape.radiusLg}`,
    `--radius-button:${t.shape.buttonRadius}`,
  ].join(';');
}

/**
 * CSS completo del tema: claro por defecto, oscuro vía media query
 * y overrides explícitos con data-theme (el toggle del usuario gana).
 */
export function themeToCss(tokens: ThemeTokens): string {
  const light = paletteVars(tokens.colors.light);
  const dark = paletteVars(tokens.colors.dark);
  const scale = scaleVars(tokens);
  return [
    `:root{${light};${scale}}`,
    `@media (prefers-color-scheme: dark){:root{${dark}}}`,
    `:root[data-theme="light"]{${light}}`,
    `:root[data-theme="dark"]{${dark}}`,
  ].join('\n');
}
