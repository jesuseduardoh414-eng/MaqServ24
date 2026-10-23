import type { Palette, ThemeTokens } from './schema';
import { cssEstados } from './estados-disponibilidad';

/**
 * Convierte los tokens del tema en variables CSS.
 * El frontend inyecta esto en <style> durante el SSR: cambiar un token
 * en la BD cambia la UI sin recompilar (DoD de la Fase 0).
 */

/** Un color es un hex; cualquier otra cosa no llega al <style> (ver `fuente` más abajo). */
const hex = (v: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : 'transparent');

function paletteVars(p: Palette): string {
  return [
    `--color-primary:${hex(p.primary)}`,
    `--color-primary-fg:${hex(p.primaryFg)}`,
    `--color-secondary:${hex(p.secondary)}`,
    `--color-accent:${hex(p.accent)}`,
    `--color-bg:${hex(p.background)}`,
    `--color-surface:${hex(p.surface)}`,
    `--color-text:${hex(p.text)}`,
    `--color-text-muted:${hex(p.textMuted)}`,
    `--color-border:${hex(p.border)}`,
    `--color-success:${hex(p.success)}`,
    `--color-warning:${hex(p.warning)}`,
    `--color-error:${hex(p.error)}`,
  ].join(';');
}

/**
 * Este CSS va dentro de un <style> del sitio Y del panel. Un valor como
 * `4px}</style><script>…` cerraba la etiqueta y metía código con la sesión de
 * quien abriera la página (auditoría 2026-10-23). Se filtra AQUÍ, al pintar,
 * para cubrir también los temas ya guardados: una fuente es letras, números,
 * espacios y guiones; un radio, una medida.
 */
const fuente = (v: string | undefined) => (v ?? '').replace(/[^A-Za-z0-9 \-]/g, '').trim() || 'system-ui';
const medida = (v: string | undefined) => (v ?? '').replace(/[^0-9A-Za-z.%\s-]/g, '').trim() || '0';

function scaleVars(t: ThemeTokens): string {
  const { baseSizePx, scaleRatio } = t.typography;
  const fontSans = fuente(t.typography.fontSans);
  const fontHeading = fuente(t.typography.fontHeading);
  const fontDisplay = t.typography.fontDisplay ? fuente(t.typography.fontDisplay) : undefined;
  const step = (n: number) => `${(Number(baseSizePx) * Math.pow(Number(scaleRatio), n)).toFixed(2)}px`;
  return [
    `--font-sans:'${fontSans}',system-ui,sans-serif`,
    `--font-heading:'${fontHeading}',system-ui,sans-serif`,
    // Fallback sans-serif: el `cursive` era un resto del display de SEGAshop —
    // si Google Fonts no carga, el wordmark y los títulos caían a una cursiva.
    `--font-display:'${fontDisplay ?? fontHeading}',system-ui,sans-serif`,
    `--text-sm:${step(-1)}`,
    `--text-base:${Number(baseSizePx)}px`,
    `--text-lg:${step(1)}`,
    `--text-xl:${step(2)}`,
    `--text-2xl:${step(3)}`,
    `--text-3xl:${step(4)}`,
    `--radius-sm:${medida(t.shape.radiusSm)}`,
    `--radius-md:${medida(t.shape.radiusMd)}`,
    `--radius-lg:${medida(t.shape.radiusLg)}`,
    `--radius-button:${medida(t.shape.buttonRadius)}`,
  ].join(';');
}

/**
 * CSS completo del tema: claro por defecto, oscuro vía media query
 * y overrides explícitos con data-theme (el toggle del usuario gana).
 */
export function themeToCss(tokens: ThemeTokens): string {
  // Con la paleta van los colores de los estados de disponibilidad
  // (`--estado-reservado`…), en su tono para fondo claro u oscuro.
  const light = `${paletteVars(tokens.colors.light)};${cssEstados('claro')}`;
  const dark = `${paletteVars(tokens.colors.dark)};${cssEstados('oscuro')}`;
  const scale = scaleVars(tokens);
  return [
    `:root{${light};${scale}}`,
    `@media (prefers-color-scheme: dark){:root{${dark}}}`,
    `:root[data-theme="light"]{${light}}`,
    `:root[data-theme="dark"]{${dark}}`,
  ].join('\n');
}
