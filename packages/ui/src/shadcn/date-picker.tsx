'use client';

import * as React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { ShPopover, ShPopoverContent, ShPopoverTrigger } from './popover';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from './select';
import { CampoOculto } from './campo-oculto';

/**
 * FECHA Y HORA (shadcn/ui sobre Radix), en lugar de `<input type="date|time">`.
 *
 * El nativo abre el calendario del NAVEGADOR: blanco o gris según el sistema,
 * con su tipografía y sus flechas, encima de un panel oscuro; igual que pasaba
 * con el `<select>` (ver select.tsx). Estos se dibujan con el tema (`--ui-*`),
 * se manejan con el teclado y hablan el mismo idioma que el input nativo:
 *
 *   - fecha: 'AAAA-MM-DD' ('' = sin fecha) · hora: 'HH:MM' · ambas: 'AAAA-MM-DDTHH:MM'
 *   - `value` + `onChange` (controlado) o `defaultValue` + `name` (FormData).
 *   - Con `name`, el valor viaja en un input propio, transparente y no
 *     `type="hidden"`, para que `required` lo valide el navegador.
 *
 * Calendario propio y no react-day-picker: con Popover (ya en el paquete) y una
 * rejilla de 6 × 7 alcanza, sin otra dependencia. Los nombres de mes van
 * escritos aquí y no con Intl, para que servidor y navegador pinten lo mismo.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');
const aTexto = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function deTexto(s?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function sumarMeses(d: Date, n: number) {
  const ult = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), ult));
}
const mismoDia = (a: Date | null, b: Date | null) => !!a && !!b && aTexto(a) === aTexto(b);
/** "15 oct 2026": corto y sin ambigüedad (15/10 vs 10/15). */
const textoFecha = (s: string) => {
  const d = deTexto(s);
  return d ? `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}` : '';
};

/** Disparador con la forma de ShSelectTrigger: mismo alto, borde y foco. */
const DISPARADOR = cn(
  'flex h-11 w-full items-center gap-2 rounded-[var(--ui-radius)] px-3.5 text-sm text-left',
  'border border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-text)] transition-colors',
  'focus-visible:outline-none focus-visible:border-[var(--ui-accent)] data-[state=open]:border-[var(--ui-accent)]',
  'aria-[invalid=true]:border-[var(--ui-danger)] disabled:cursor-not-allowed disabled:opacity-50',
);

/* ── Fecha ─────────────────────────────────────────────────────────────── */

export interface ShDatePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  /** 'AAAA-MM-DD' inclusive. */
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Clases del disparador (cada app ajusta alto y radio, como en AdminSelect). */
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

export function ShDatePicker({
  value,
  defaultValue,
  onChange,
  name,
  id,
  min,
  max,
  placeholder = 'Elegir fecha',
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: ShDatePickerProps) {
  const controlado = value !== undefined;
  const [interno, setInterno] = React.useState(defaultValue ?? '');
  const actual = controlado ? (value as string) : interno;
  const elegida = deTexto(actual);
  const minD = deTexto(min);
  const maxD = deTexto(max);
  const fuera = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);

  const [abierto, setAbierto] = React.useState(false);
  // El día con el foco del teclado; su mes es el que se ve.
  const [foco, setFoco] = React.useState<Date>(() => elegida ?? new Date());
  const rejilla = React.useRef<HTMLDivElement>(null);

  function abrir(v: boolean) {
    if (v) {
      const hoy = new Date();
      setFoco(elegida ?? (minD && hoy < minD ? minD : maxD && hoy > maxD ? maxD : hoy));
    }
    setAbierto(v);
  }
  // Al moverse con el teclado (o abrir), el foco sigue al día.
  React.useEffect(() => {
    if (!abierto) return;
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-dia="${aTexto(foco)}"]`)?.focus();
  }, [foco, abierto]);

  function fijar(t: string) {
    if (!controlado) setInterno(t);
    onChange?.(t);
  }
  function elegir(d: Date) {
    if (fuera(d)) return;
    fijar(aTexto(d));
    setAbierto(false);
  }

  function alTeclear(e: React.KeyboardEvent) {
    const paso: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let nuevo: Date | null = null;
    if (e.key in paso) nuevo = sumarDias(foco, paso[e.key]);
    else if (e.key === 'PageUp') nuevo = sumarMeses(foco, e.shiftKey ? -12 : -1);
    else if (e.key === 'PageDown') nuevo = sumarMeses(foco, e.shiftKey ? 12 : 1);
    else if (e.key === 'Home') nuevo = sumarDias(foco, -foco.getDay());
    else if (e.key === 'End') nuevo = sumarDias(foco, 6 - foco.getDay());
    if (nuevo) { e.preventDefault(); setFoco(nuevo); }
  }

  const primero = new Date(foco.getFullYear(), foco.getMonth(), 1);
  const inicio = sumarDias(primero, -primero.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const hoy = new Date();

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <CampoOculto name={name} value={actual} required={required} />
      <ShPopover open={abierto} onOpenChange={abrir}>
        <ShPopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel ? `${ariaLabel}${elegida ? `: ${textoFecha(actual)}` : ''}` : undefined}
            aria-invalid={ariaInvalid || undefined}
            className={cn(DISPARADOR, className)}
          >
            <CalendarDays className="size-4 shrink-0 text-[var(--ui-muted)]" aria-hidden />
            <span className={cn('flex-1 truncate', !elegida && 'text-[var(--ui-muted)]')}>{elegida ? textoFecha(actual) : placeholder}</span>
          </button>
        </ShPopoverTrigger>
        <ShPopoverContent
          align="start"
          className="w-auto p-3"
          // El foco va al día (elegido u hoy), no a la flecha del mes. Aquí y no
          // en un efecto: es el momento en que el contenido ya está montado.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            rejilla.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setFoco(sumarMeses(foco, -1))} aria-label="Mes anterior"
              className="grid size-8 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-accent-soft)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]">
              <ChevronLeft className="size-4" />
            </button>
            {/* Mayúscula solo al mes: `capitalize` dejaba "Octubre De 2026". */}
            <span className="text-sm font-semibold text-[var(--ui-text)]" aria-live="polite">
              {MESES[foco.getMonth()].charAt(0).toUpperCase() + MESES[foco.getMonth()].slice(1)} de {foco.getFullYear()}
            </span>
            <button type="button" onClick={() => setFoco(sumarMeses(foco, 1))} aria-label="Mes siguiente"
              className="grid size-8 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-accent-soft)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div role="grid" aria-label={`${MESES[foco.getMonth()]} de ${foco.getFullYear()}`} ref={rejilla} onKeyDown={alTeclear} className="grid grid-cols-7 gap-0.5">
            {DIAS.map((d) => (
              <span key={d} role="columnheader" className="grid h-8 place-items-center text-xs font-medium text-[var(--ui-muted)]">{d}</span>
            ))}
            {dias.map((d) => {
              const t = aTexto(d);
              const delMes = d.getMonth() === foco.getMonth();
              const sel = mismoDia(d, elegida);
              const esHoy = mismoDia(d, hoy);
              const bloqueado = fuera(d);
              return (
                <button
                  key={t}
                  type="button"
                  role="gridcell"
                  data-dia={t}
                  tabIndex={mismoDia(d, foco) ? 0 : -1}
                  aria-selected={sel}
                  aria-disabled={bloqueado || undefined}
                  aria-label={`${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}${esHoy ? ', hoy' : ''}`}
                  onClick={() => elegir(d)}
                  onFocus={() => { if (!mismoDia(d, foco)) setFoco(d); }}
                  className={cn(
                    'grid size-9 place-items-center rounded-md text-sm tabular-nums transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]',
                    delMes ? 'text-[var(--ui-text)]' : 'text-[var(--ui-muted)] opacity-55',
                    !sel && !bloqueado && 'hover:bg-[var(--ui-accent-soft)]',
                    esHoy && !sel && 'font-semibold text-[var(--ui-accent)] shadow-[inset_0_0_0_1px_var(--ui-accent)]',
                    sel && 'bg-[var(--ui-accent)] font-semibold text-[var(--ui-accent-fg)]',
                    bloqueado && 'cursor-not-allowed opacity-25 line-through',
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[var(--ui-border)] pt-2">
            {!required && actual ? (
              <button type="button" onClick={() => { fijar(''); setAbierto(false); }}
                className="rounded-md px-2 py-1 text-[13px] font-medium text-[var(--ui-muted)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]">
                Borrar
              </button>
            ) : <span />}
            <button type="button" onClick={() => elegir(new Date())} disabled={fuera(new Date())}
              className="rounded-md px-2 py-1 text-[13px] font-semibold text-[var(--ui-accent)] hover:bg-[var(--ui-accent-soft)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]">
              Hoy
            </button>
          </div>
        </ShPopoverContent>
      </ShPopover>
    </div>
  );
}

/* ── Hora ──────────────────────────────────────────────────────────────── */

const aMinutos = (h: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(h); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const deMinutos = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export interface ShTimePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  /** Cada cuántos minutos hay opción (30 por defecto). */
  step?: number;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Hora en una lista (el Select de shadcn): en una obra se habla de "a las 7:30",
 * no de las 7:37, y la lista se recorre con el teclado o tecleando la hora.
 * Si el valor guardado no cae en un paso (07:45 con pasos de 30), se agrega.
 */
export function ShTimePicker({
  value,
  defaultValue,
  onChange,
  name,
  id,
  step = 30,
  min = '00:00',
  max = '23:59',
  placeholder = 'Hora',
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
}: ShTimePickerProps) {
  const controlado = value !== undefined;
  const [interno, setInterno] = React.useState(defaultValue ?? '');
  const actual = controlado ? (value as string) : interno;

  const opciones = React.useMemo(() => {
    const lista: string[] = [];
    for (let m = aMinutos(min); m <= aMinutos(max); m += step) lista.push(deMinutos(m));
    if (actual && !lista.includes(actual) && !Number.isNaN(aMinutos(actual))) {
      lista.push(actual.slice(0, 5));
      lista.sort((a, b) => aMinutos(a) - aMinutos(b));
    }
    return lista;
  }, [min, max, step, actual]);

  function cambiar(v: string) {
    if (!controlado) setInterno(v);
    onChange?.(v);
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <CampoOculto name={name} value={actual} required={required} />
      <ShSelect value={actual ? actual.slice(0, 5) : ''} onValueChange={cambiar} disabled={disabled}>
        <ShSelectTrigger id={id} aria-label={ariaLabel} className={className}>
          <span className="flex min-w-0 items-center gap-2">
            <Clock className="size-4 shrink-0 text-[var(--ui-muted)]" aria-hidden />
            <ShSelectValue placeholder={placeholder} />
          </span>
        </ShSelectTrigger>
        <ShSelectContent>
          {opciones.map((h) => (
            <ShSelectItem key={h} value={h} className="tabular-nums">{h}</ShSelectItem>
          ))}
        </ShSelectContent>
      </ShSelect>
    </div>
  );
}

/* ── Fecha y hora ──────────────────────────────────────────────────────── */

/** Lo de `<input type="datetime-local">`: 'AAAA-MM-DDTHH:MM'. */
export function ShDateTimePicker({
  value,
  onChange,
  min,
  step = 15,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  /** 'AAAA-MM-DD' o 'AAAA-MM-DDTHH:MM' (solo cuenta la fecha). */
  min?: string;
  step?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [fecha = '', hora = ''] = (value ?? '').split('T');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 8 }}>
      <ShDatePicker
        value={fecha}
        min={min?.slice(0, 10)}
        required
        disabled={disabled}
        className={className}
        aria-label={ariaLabel ? `${ariaLabel}, fecha` : 'Fecha'}
        onChange={(f) => onChange(f ? `${f}T${hora || '08:00'}` : '')}
      />
      <ShTimePicker
        value={hora.slice(0, 5)}
        step={step}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel ? `${ariaLabel}, hora` : 'Hora'}
        onChange={(h) => onChange(`${fecha || aTexto(new Date())}T${h}`)}
      />
    </div>
  );
}
