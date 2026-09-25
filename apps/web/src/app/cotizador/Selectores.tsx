'use client';

import { forwardRef, useMemo, useState } from 'react';
import { ShPopover, ShPopoverTrigger, ShPopoverContent } from '@maqserv/ui';

/**
 * CALENDARIO Y RELOJ PARA EL COTIZADOR (2026-09-25).
 *
 * Los `<input type="date">` y `type="time"` nativos obligaban a teclear
 * dd/mm/aaaa y una hora con a. m./p. m.; en el tema oscuro además se veían
 * como cajas vacías. Aquí se toca el campo y aparece el calendario del mes
 * (o la lista de horas), se elige y se cierra. Sin dependencias nuevas: el
 * popover ya lo usaba el cotizador.
 *
 * Fechas en ISO local (YYYY-MM-DD) y horas HH:MM, que es lo que la API espera.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const desdeIso = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

export function textoFecha(isoFecha: string): string {
  const d = desdeIso(isoFecha);
  if (!d) return 'Elige la fecha';
  // Corto a propósito ("Jue 15 oct 2026"): el largo no cabía en el campo y se cortaba con puntos.
  const t = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/[.,]/g, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function textoHora(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return 'Elige la hora';
  const h = Number(m[1]);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${sufijo}${h === 12 ? ' (mediodía)' : ''}`;
}

const IconoCalendario = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const IconoReloj = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
  </svg>
);

/**
 * El botón que abre el popover. Va con `forwardRef` y reenvía el resto de las
 * props a propósito: Radix (`asChild`) le inyecta el onClick, el ref y los
 * atributos aria; sin reenviarlos el popover nunca se abría.
 */
const Disparador = forwardRef<HTMLButtonElement, { texto: string; icono: React.ReactNode; vacio?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function Disparador({ texto, icono, vacio, style, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', textAlign: 'left', color: vacio ? 'var(--color-text-muted)' : 'var(--color-text)' }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texto}</span>
        <span style={{ color: 'var(--color-primary)', display: 'flex', flexShrink: 0 }}>{icono}</span>
      </button>
    );
  },
);

export function SelectorFecha({ value, min, onChange, style }: { value: string; min?: string; onChange: (isoFecha: string) => void; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const elegida = desdeIso(value) ?? new Date();
  const [vista, setVista] = useState({ y: elegida.getFullYear(), m: elegida.getMonth() });
  const hoy = new Date();
  const hoyIso = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const minIso = min ?? hoyIso;

  const celdas = useMemo(() => {
    const primero = new Date(vista.y, vista.m, 1);
    // Lunes = 0 … domingo = 6.
    const offset = (primero.getDay() + 6) % 7;
    const dias = new Date(vista.y, vista.m + 1, 0).getDate();
    const out: Array<number | null> = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= dias; d += 1) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [vista]);

  const mover = (delta: number) => setVista((v) => {
    const d = new Date(v.y, v.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <ShPopover open={open} onOpenChange={setOpen}>
      <ShPopoverTrigger asChild>
        <Disparador texto={textoFecha(value)} icono={<IconoCalendario />} style={style} vacio={!value} />
      </ShPopoverTrigger>
      <ShPopoverContent style={{ padding: 14, width: 308 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" style={btnMes}>‹</button>
          <strong style={{ fontSize: 14, textTransform: 'capitalize' }}>{MESES[vista.m]} {vista.y}</strong>
          <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" style={btnMes}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DIAS.map((d) => <span key={d} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center', padding: '4px 0' }}>{d}</span>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {celdas.map((d, i) => {
            if (d === null) return <span key={`v${i}`} />;
            const v = iso(vista.y, vista.m, d);
            const deshabilitado = v < minIso;
            const on = v === value;
            const esHoy = v === hoyIso;
            return (
              <button
                key={v}
                type="button"
                disabled={deshabilitado}
                onClick={() => { onChange(v); setOpen(false); }}
                style={{
                  height: 36, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', cursor: deshabilitado ? 'default' : 'pointer',
                  border: `1px solid ${on ? 'var(--color-primary)' : esHoy ? 'var(--color-border)' : 'transparent'}`,
                  background: on ? 'var(--color-primary)' : 'transparent',
                  color: on ? 'var(--color-primary-fg)' : deshabilitado ? 'color-mix(in srgb, var(--color-text-muted) 45%, transparent)' : 'var(--color-text)',
                  fontWeight: on || esHoy ? 700 : 500,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </ShPopoverContent>
    </ShPopover>
  );
}

export function SelectorHora({ value, onChange, desde = 6, hasta = 20, style }: { value: string; onChange: (hhmm: string) => void; desde?: number; hasta?: number; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const horas = useMemo(() => {
    const out: string[] = [];
    for (let h = desde; h <= hasta; h += 1) {
      out.push(`${String(h).padStart(2, '0')}:00`);
      if (h < hasta) out.push(`${String(h).padStart(2, '0')}:30`);
    }
    return out;
  }, [desde, hasta]);
  return (
    <ShPopover open={open} onOpenChange={setOpen}>
      <ShPopoverTrigger asChild>
        <Disparador texto={textoHora(value)} icono={<IconoReloj />} style={style} vacio={!value} />
      </ShPopoverTrigger>
      <ShPopoverContent style={{ padding: 10, width: 300 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
          {horas.map((h) => {
            const on = h === value;
            return (
              <button
                key={h}
                type="button"
                onClick={() => { onChange(h); setOpen(false); }}
                style={{
                  height: 36, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: on ? 'var(--color-primary)' : 'transparent',
                  color: on ? 'var(--color-primary-fg)' : 'var(--color-text)', fontWeight: on ? 700 : 500,
                }}
              >
                {textoHora(h).replace(' (mediodía)', '')}
              </button>
            );
          })}
        </div>
      </ShPopoverContent>
    </ShPopover>
  );
}

const btnMes: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 18, lineHeight: 1 };
