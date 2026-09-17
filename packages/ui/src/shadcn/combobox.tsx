'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { ShPopover, ShPopoverContent, ShPopoverTrigger } from './popover';

/**
 * Combobox: escribir libremente O elegir de una lista.
 *
 * Sustituye al `<input list>` con `<datalist>`, que es el que se veía mal.
 * Tres motivos, y el estético es el menor:
 *
 *  - El `<datalist>` lo dibuja el SISTEMA OPERATIVO. Sobre un sitio oscuro
 *    abría una lista blanca de Windows, con su tipografía y sus bordes, y no
 *    hay CSS capaz de tocarla.
 *  - No hay forma de saber si hay sugerencias hasta que se escribe algo: en
 *    varios navegadores la lista solo aparece al teclear, así que el campo
 *    parecía un texto libre cualquiera.
 *  - En móvil, media plataforma sencillamente lo ignora.
 *
 * Aquí la lista se ve completa al abrir, se filtra al escribir, se navega con
 * el teclado y —clave para "municipio"— lo que se teclea se puede usar tal
 * cual aunque no esté en el catálogo: la cobertura cambia y el formulario no
 * puede ser una cárcel.
 */
export function ShCombobox({
  value,
  onChange,
  options,
  placeholder = 'Selecciona…',
  buscar = 'Buscar…',
  textoLibre = true,
  id,
  className,
  'aria-describedby': describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  buscar?: string;
  /** Permite guardar lo tecleado aunque no esté en la lista. */
  textoLibre?: boolean;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [consulta, setConsulta] = React.useState('');

  const q = consulta.trim().toLowerCase();
  const filtradas = q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options;
  // Solo se ofrece "usar lo que escribí" cuando de verdad aporta algo: si el
  // texto ya coincide con una opción, sería la misma línea dos veces.
  const exacta = options.some((o) => o.toLowerCase() === q);
  const ofrecerLibre = textoLibre && q.length > 0 && !exacta;

  function elegir(v: string) {
    onChange(v);
    setConsulta('');
    setAbierto(false);
  }

  return (
    <ShPopover open={abierto} onOpenChange={setAbierto}>
      <ShPopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-describedby={describedBy}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-[var(--ui-radius)] px-3.5 text-sm',
            'border border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-left outline-none transition-colors',
            'focus-visible:border-[var(--ui-accent)] focus-visible:ring-1 focus-visible:ring-[var(--ui-accent)]',
            value ? 'text-[var(--ui-text)]' : 'text-[var(--ui-muted)]',
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-[var(--ui-muted)]" />
        </button>
      </ShPopoverTrigger>

      <ShPopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <CommandPrimitive shouldFilter={false} className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--ui-border)] px-3">
            <Search className="size-4 shrink-0 text-[var(--ui-muted)]" />
            <CommandPrimitive.Input
              value={consulta}
              onValueChange={setConsulta}
              placeholder={buscar}
              className={cn(
                'h-11 w-full bg-transparent text-sm text-[var(--ui-text)] outline-none',
                'placeholder:text-[var(--ui-muted)]',
              )}
              onKeyDown={(e) => {
                // Enter con texto libre y sin resultados: se usa lo escrito.
                if (e.key === 'Enter' && ofrecerLibre && filtradas.length === 0) {
                  e.preventDefault();
                  elegir(consulta.trim());
                }
              }}
            />
          </div>

          <CommandPrimitive.List className="max-h-60 overflow-y-auto p-1">
            {filtradas.length === 0 && !ofrecerLibre ? (
              <div className="px-3 py-6 text-center text-[13px] text-[var(--ui-muted)]">
                Sin coincidencias.
              </div>
            ) : null}

            {ofrecerLibre ? (
              <CommandPrimitive.Item
                value={`__libre__${consulta}`}
                onSelect={() => elegir(consulta.trim())}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-[calc(var(--ui-radius)-4px)]',
                  'px-3 py-2 text-sm outline-none',
                  'data-[selected=true]:bg-[var(--ui-accent-soft)]',
                )}
              >
                <span className="text-[var(--ui-muted)]">Usar</span>
                <span className="font-semibold text-[var(--ui-accent)]">“{consulta.trim()}”</span>
              </CommandPrimitive.Item>
            ) : null}

            {filtradas.map((o) => (
              <CommandPrimitive.Item
                key={o}
                value={o}
                onSelect={() => elegir(o)}
                className={cn(
                  'flex cursor-pointer select-none items-center justify-between gap-2',
                  'rounded-[calc(var(--ui-radius)-4px)] px-3 py-2 text-sm outline-none',
                  'data-[selected=true]:bg-[var(--ui-accent-soft)]',
                  o === value ? 'font-semibold text-[var(--ui-accent)]' : 'text-[var(--ui-text)]',
                )}
              >
                <span className="truncate">{o}</span>
                {o === value ? <Check className="size-4 shrink-0" /> : null}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </ShPopoverContent>
    </ShPopover>
  );
}
