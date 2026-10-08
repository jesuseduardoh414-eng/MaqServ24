import Link from 'next/link';
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

/**
 * KIT DEL PANEL (2026-10-08). Envuelve las clases `.adm-*` de globals.css
 * (bloque "KIT DEL PANEL") para que cada módulo use la misma cabecera, las
 * mismas métricas, los mismos botones y las mismas tablas.
 *
 * Módulo SIN 'use client' y sin hooks a propósito: lo usan tanto las páginas
 * de servidor (Clientes, Mensajes…) como los *Manager de cliente.
 */

export type Tone = 'accent' | 'ok' | 'warn' | 'bad' | 'info' | 'muted';
const tc = (t?: Tone) => (t ? ` t-${t}` : '');
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/* ── Encabezado de página ─────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  count,
  subtitle,
  actions,
}: {
  /** Línea pequeña en versalitas sobre el título. Un arreglo se pinta como migas: `[['Catálogo', '/categorias'], 'Categorías']`. */
  eyebrow?: ReactNode | Array<string | [string, string]>;
  title: ReactNode;
  /** Total junto al título, en gris: "Productos 19". */
  count?: number | string;
  subtitle?: ReactNode;
  /** Botones a la derecha. La acción principal va al final. */
  actions?: ReactNode;
}) {
  const ceja = Array.isArray(eyebrow)
    ? eyebrow.map((m, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 ? <span className="adm-eyebrow-sep">/</span> : null}
          {Array.isArray(m) ? <Link href={m[1]}>{m[0]}</Link> : <span>{m}</span>}
        </span>
      ))
    : eyebrow;
  return (
    <header className="adm-head">
      <div className="adm-head-main">
        {ceja ? <div className="adm-eyebrow">{ceja}</div> : null}
        <h1 className="adm-title">
          {title}
          {count !== undefined ? <span className="adm-title-count">{count}</span> : null}
        </h1>
        {subtitle ? <p className="adm-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="adm-head-actions">{actions}</div> : null}
    </header>
  );
}

/* ── Métricas en texto plano ──────────────────────────────────────────── */

/** Fila de métricas separadas por una línea fina. Sin tarjetas. */
export function Stats({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="adm-stats" style={style}>{children}</div>;
}

export function Stat({
  label,
  value,
  icon,
  tone,
  hint,
  hintTone,
  valueTone,
  href,
  title,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Clase de Phosphor, p. ej. "ph-package". */
  icon?: string;
  /** Color del icono. La cifra se queda neutra salvo `valueTone`. */
  tone?: Tone;
  /** Contexto junto a la cifra: "de 14 abiertas", "+2 vencidas". */
  hint?: ReactNode;
  hintTone?: Tone;
  /** Solo cuando la cifra misma es la alerta (p. ej. "Vencidos 3" en rojo). */
  valueTone?: Tone;
  href?: string;
  title?: string;
}) {
  const body = (
    <>
      <div className="adm-stat-label">
        {icon ? <i className={`ph ${icon}${tc(tone)}`} aria-hidden /> : null}
        <span className="adm-ellipsis">{label}</span>
      </div>
      <div className="adm-stat-line">
        <span className={`adm-stat-value${tc(valueTone)}`}>{value}</span>
        {hint !== undefined && hint !== null && hint !== '' ? <span className={`adm-stat-hint${tc(hintTone)}`}>{hint}</span> : null}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="adm-stat" title={title}>{body}</Link>
  ) : (
    <div className="adm-stat" title={title}>{body}</div>
  );
}

/* ── Paneles ──────────────────────────────────────────────────────────── */

/**
 * Caja para una lista, tabla o formulario. Con `title` lleva cabecera
 * ("Mis tareas · Ver todas →"). `flush` quita el padding del cuerpo (tablas
 * y listas pegadas al borde); `clip` recorta las esquinas de las filas.
 */
export function Panel({
  title,
  icon,
  desc,
  action,
  children,
  flush,
  clip,
  footer,
  className,
  style,
  id,
}: {
  title?: ReactNode;
  icon?: string;
  desc?: ReactNode;
  /** A la derecha de la cabecera: un enlace "Ver todas →" o un botón chico. */
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  clip?: boolean;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <section id={id} className={cx('adm-panel', clip && 'is-clip', className)} style={style}>
      {title ? (
        <div className="adm-panel-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="adm-panel-title">
              {icon ? <i className={`ph ${icon}`} aria-hidden /> : null}
              {title}
            </h2>
            {desc ? <p className="adm-panel-desc">{desc}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {flush ? children : <div className="adm-panel-body">{children}</div>}
      {footer ? <div className="adm-panel-foot">{footer}</div> : null}
    </section>
  );
}

/** Enlace de cabecera de panel: "Ver todas →". */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="adm-panel-link">
      {children} <i className="ph ph-arrow-right" aria-hidden />
    </Link>
  );
}

/** Título de sección fuera de un panel, con algo opcional a la derecha. */
export function SectionHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="adm-section-head">
      <h2 className="adm-h2">{title}</h2>
      {aside ? <div style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{aside}</div> : null}
    </div>
  );
}

/** Rótulo de grupo dentro de una lista: "VENCIDAS 2". */
export function GroupLabel({ children, count, tone }: { children: ReactNode; count?: number; tone?: Tone }) {
  return (
    <div className={`adm-group-label${tc(tone)}`} style={tone ? { color: 'var(--tone)' } : undefined}>
      {children}
      {count !== undefined ? <span className="adm-num">{count}</span> : null}
    </div>
  );
}

/* ── Barra de herramientas ────────────────────────────────────────────── */

export function Toolbar({ children, end, style }: { children: ReactNode; end?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="adm-toolbar" style={style}>
      {children}
      {end !== undefined && end !== null ? <div className="adm-toolbar-end">{end}</div> : null}
    </div>
  );
}

/** Campo de búsqueda con lupa. Recibe las props de un <input>. */
export function SearchBox({ style, ...props }: InputHTMLAttributes<HTMLInputElement> & { style?: CSSProperties }) {
  return (
    <div className="adm-search" style={style}>
      <i className="ph ph-magnifying-glass" aria-hidden />
      <input type="search" {...props} />
    </div>
  );
}

export interface SegItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
  /** Con `href` el filtro navega (páginas de servidor); sin él llama a `onChange`. */
  href?: string;
}

/** Filtros segmentados: "Todas · Activas · Inactivas". */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: ReadonlyArray<SegItem<K>>;
  value: K;
  onChange?: (k: K) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="adm-seg" role="tablist" aria-label={ariaLabel}>
      {items.map((it) => {
        const on = it.key === value;
        const inner = (
          <>
            {it.label}
            {it.count !== undefined ? <span className="adm-seg-count">{it.count}</span> : null}
          </>
        );
        return it.href ? (
          <Link key={it.key} href={it.href} role="tab" aria-selected={on} className={cx('adm-seg-item', on && 'is-active')}>
            {inner}
          </Link>
        ) : (
          <button key={it.key} type="button" role="tab" aria-selected={on} className={cx('adm-seg-item', on && 'is-active')} onClick={() => onChange?.(it.key)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/* ── Botones ──────────────────────────────────────────────────────────── */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

export function btnClass(variant: BtnVariant = 'secondary', size: BtnSize = 'md', extra?: string) {
  return cx('adm-btn', `adm-btn-${variant}`, size !== 'md' && `adm-btn-${size}`, extra);
}

/**
 * Botón del panel. Con `href` se pinta como enlace (misma apariencia).
 * `icon` es una clase de Phosphor ("ph-plus"); va antes del texto.
 */
export function Btn({
  variant = 'secondary',
  size = 'md',
  icon,
  href,
  children,
  className,
  target,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: string;
  href?: string;
  target?: string;
}) {
  const cls = btnClass(variant, size, className);
  const ico = icon ? <i className={`ph${variant === 'primary' ? '-bold' : ''} ${icon}`} aria-hidden /> : null;
  if (href) {
    return (
      <Link href={href} className={cls} target={target} style={rest.style} title={rest.title} aria-label={rest['aria-label']}>
        {ico}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {ico}
      {children}
    </button>
  );
}

/** Botón cuadrado de icono (editar, borrar…). `label` es obligatorio: es el nombre accesible. */
export function IconBtn({
  icon,
  label,
  danger,
  plain,
  href,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; danger?: boolean; plain?: boolean; href?: string }) {
  const cls = cx('adm-ibtn', danger && 'is-danger', plain && 'is-plain', className);
  if (href) {
    return (
      <Link href={href} className={cls} title={label} aria-label={label}>
        <i className={`ph ${icon}`} aria-hidden />
      </Link>
    );
  }
  return (
    <button type="button" className={cls} title={label} aria-label={label} {...rest}>
      <i className={`ph ${icon}`} aria-hidden />
    </button>
  );
}

/* ── Estados ──────────────────────────────────────────────────────────── */

/** Etiqueta con fondo suave: "Alta", "Urgente", "Verificado". */
export function Chip({ tone, children, title, style }: { tone?: Tone; children: ReactNode; title?: string; style?: CSSProperties }) {
  return <span className={`adm-chip${tc(tone)}`} title={title} style={style}>{children}</span>;
}

/** Estado en texto plano con punto de color: "● Activa". */
export function StatusText({ tone, children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`adm-status${tc(tone)}`} title={title}>{children}</span>;
}

/** Interruptor. `label` va a la derecha y también es el nombre accesible. */
export function Switch({
  on,
  onClick,
  label,
  disabled,
  title,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  label?: ReactNode;
  disabled?: boolean;
  title?: string;
  /** Nombre accesible cuando no hay `label` visible (si falta, se usa `title`). */
  ariaLabel?: string;
}) {
  if (label === undefined) {
    return <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel ?? title} className="adm-switch" onClick={onClick} disabled={disabled} title={title} />;
  }
  return (
    <button type="button" role="switch" aria-checked={on} className="adm-switch-wrap" onClick={onClick} disabled={disabled} title={title}>
      <span className="adm-switch" data-on={on} aria-hidden />
      <span>{label}</span>
    </button>
  );
}

/* ── Vacío, avisos, miniaturas ────────────────────────────────────────── */

export function EmptyState({ icon = 'ph-tray', title, sub, children }: { icon?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <i className={`ph ${icon}`} aria-hidden />
      <div className="adm-empty-title">{title}</div>
      {sub ? <div className="adm-empty-sub">{sub}</div> : null}
      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </div>
  );
}

/** Aviso en línea. Sin `tone` es neutro. */
export function Note({ tone, icon, children, style }: { tone?: Tone; icon?: string; children: ReactNode; style?: CSSProperties }) {
  const ico = icon ?? (tone === 'bad' ? 'ph-warning-circle' : tone === 'warn' ? 'ph-warning' : tone === 'ok' ? 'ph-check-circle' : 'ph-info');
  return (
    <div className={`adm-note${tc(tone)}`} style={style}>
      <i className={`ph ${ico}`} aria-hidden />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Thumb({ src, icon = 'ph-image', size = 40, alt = '' }: { src?: string | null; icon?: string; size?: number; alt?: string }) {
  return (
    <span className="adm-thumb" style={size !== 40 ? { width: size, height: size } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} /> : <i className={`ph ${icon}`} aria-hidden />}
    </span>
  );
}

/** Barra de progreso fina. `pct` de 0 a 100. */
export function Bar({ pct, tone, width, label }: { pct: number; tone?: Tone; width?: number | string; label?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className={`adm-bar${tc(tone)}`} style={width !== undefined ? { width } : undefined} role={label ? 'img' : undefined} aria-label={label}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

/** Aviso flotante abajo al centro. `kind` decide icono y color. */
export function Toast({ kind = 'ok', children }: { kind?: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const ico = kind === 'ok' ? 'ph-check-circle' : kind === 'info' ? 'ph-info' : 'ph-warning-circle';
  return (
    <div className={`adm-toast t-${kind}`} role="status">
      <i className={`ph-bold ${ico}`} aria-hidden />
      {children}
    </div>
  );
}

/** Etiqueta + control + ayuda. */
export function FormField({ label, help, children, style }: { label: ReactNode; help?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <label className="adm-field" style={style}>
      <span className="adm-label">{label}</span>
      {children}
      {help ? <span className="adm-help">{help}</span> : null}
    </label>
  );
}
