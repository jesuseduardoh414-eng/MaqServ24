/**
 * Paleta y fuentes del cromo del admin. Los grises son literales a propósito
 * (el panel es oscuro siempre), pero el ACENTO no: sigue al tema activo.
 *
 * Antes el acento era el ámbar de SEGAshop escrito como literal y repetido en
 * decenas de archivos, así que al pasar el sitio a MAQSER24 el panel se quedó
 * amarillo aunque la web ya fuera azul. Ahora apunta a
 * `var(--color-primary)`, que el layout inyecta desde la BD: cambiar el color
 * de marca en Diseño mueve también el panel, sin tocar código.
 *
 * Se puede usar una variable CSS aquí porque todos estos valores acaban en
 * estilos inline, y el navegador resuelve `var()` igual dentro de `style`.
 *
 * Módulo SIN 'use client' a propósito: `editor-kit` sí lo es, y un componente de
 * servidor no puede leer los valores que exporta un módulo de cliente. Al vivir
 * aquí, la paleta la pueden usar los dos lados. `editor-kit` la reexporta para
 * no romper a quien ya la importaba de ahí.
 */
export const D = {
  card: '#141416',
  cardBorder: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.03)',
  inputBorder: 'rgba(255,255,255,0.08)',
  /** Acento del panel. El nombre se queda por compatibilidad: lo usan 41 archivos. */
  amber: 'var(--color-primary)',
  /** Texto sobre el acento. */
  amberInk: 'var(--color-primary-fg)',
  /** Alias con nombre honesto para el código nuevo. */
  accent: 'var(--color-primary)',
  accentInk: 'var(--color-primary-fg)',
  /** Velo del acento al 12–14 %, para fondos de chip e icono. */
  accentSoft: 'color-mix(in srgb, var(--color-primary) 13%, transparent)',
  /**
   * Colores de ESTADO. Van aparte del acento a propósito: "pendiente", "bajo
   * stock" o "guardado" no son la marca, son información. Antes usaban el ámbar
   * de marca por coincidencia —el acento era ámbar— y al volverse azul habrían
   * perdido el significado. El manual asigna ámbar a "advierte" y verde a
   * "disponible" (12 / COLOR FUNCIONAL).
   */
  warn: 'var(--color-warning)',
  ok: 'var(--color-success)',
  bad: 'var(--color-error)',
  text: '#f5f5f4',
  muted: '#6b6b72',
  muted2: '#71717a',
  previewBg: '#0e0e12',
  tabsBg: '#101012',
};

export const FONT = "'Manrope', system-ui, sans-serif";

/** Colores sugeridos en los selectores de Diseño: el azul de marca va primero. */
export const PRESETS = ['#008CFF', '#0066CC', '#22C55E', '#F59E0B', '#F87171', '#ffffff', '#A9B0B7'];
