'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, CornerDownLeft, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { ShPopover, ShPopoverContent, ShPopoverTrigger } from './popover';

/**
 * Combobox: escribir libremente O elegir de una lista.
 *
 * Sustituye al `<input list>` con `<datalist>`. Tres motivos, y el estético es
 * el menor:
 *
 *  - El `<datalist>` lo dibuja el SISTEMA OPERATIVO. Sobre un sitio oscuro
 *    abría una lista blanca de Windows, con su tipografía y sus bordes, y no
 *    hay CSS capaz de tocarla.
 *  - En varios navegadores la lista solo aparece al teclear, así que el campo
 *    parecía un texto libre cualquiera.
 *  - En móvil, media plataforma sencillamente lo ignora.
 *
 * Lo que se teclea se puede usar tal cual aunque no esté en el catálogo: la
 * cobertura cambia y el formulario no puede ser una cárcel.
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
  const filtradas = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  // Solo se ofrece "usar lo que escribí" cuando aporta algo: si el texto ya
  // coincide con una opción, sería la misma línea dos veces.
  const exacta = options.some((o) => o.toLowerCase() === q);
  const ofrecerLibre = textoLibre && q.length > 0 && !exacta;

  function elegir(v: string) {
    onChange(v);
    setConsulta('');
    setAbierto(false);
  }

  return (
    <ShPopover
      open={abierto}
      onOpenChange={(o) => {
        setAbierto(o);
        if (!o) setConsulta('');
      }}
    >
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
            'hover:border-[color-mix(in_srgb,var(--ui-accent)_55%,var(--ui-border))]',
            'focus-visible:border-[var(--ui-accent)] focus-visible:ring-1 focus-visible:ring-[var(--ui-accent)]',
            'data-[state=open]:border-[var(--ui-accent)]',
            value ? 'text-[var(--ui-text)]' : 'text-[var(--ui-muted)]',
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-[var(--ui-muted)] transition-transform duration-150',
              abierto && 'rotate-180',
            )}
          />
        </button>
      </ShPopoverTrigger>

      <ShPopoverContent
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        // Sin este tope el panel se iba más alto que la pantalla y Radix lo
        // volteaba hacia arriba, tapando los pasos del cotizador. Con la altura
        // disponible como límite, se queda abajo y encoge.
        style={{ maxHeight: 'min(320px, var(--radix-popover-content-available-height))' }}
        collisionPadding={12}
      >
        <CommandPrimitive shouldFilter={false} className="flex max-h-[inherit] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ui-border)] px-3">
            <Search className="size-4 shrink-0 text-[var(--ui-muted)]" />
            <CommandPrimitive.Input
              value={consulta}
              onValueChange={setConsulta}
              placeholder={buscar}
              className="h-10 w-full bg-transparent text-sm text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
              onKeyDown={(e) => {
                // Enter con texto libre y sin resultados: se usa lo escrito.
                if (e.key === 'Enter' && ofrecerLibre && filtradas.length === 0) {
                  e.preventDefault();
                  elegir(consulta.trim());
                }
              }}
            />
          </div>

          <CommandPrimitive.List
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5',
              // Barra de desplazamiento propia: la nativa de Windows es una
              // franja gris clara de 17 px que sobre el panel oscuro se veía
              // como un error de maquetación.
              '[scrollbar-width:thin] [scrollbar-color:var(--ui-border)_transparent]',
              '[&::-webkit-scrollbar]:w-1.5',
              '[&::-webkit-scrollbar-track]:bg-transparent',
              '[&::-webkit-scrollbar-thumb]:rounded-full',
              '[&::-webkit-scrollbar-thumb]:bg-[var(--ui-border)]',
            )}
          >
            {filtradas.length === 0 && !ofrecerLibre ? (
              <div className="px-3 py-8 text-center text-[13px] text-[var(--ui-muted)]">
                Sin coincidencias.
              </div>
            ) : null}

            {ofrecerLibre ? (
              <CommandPrimitive.Item
                value={`__libre__${consulta}`}
                onSelect={() => elegir(consulta.trim())}
                className={cn(
                  'mb-1 flex cursor-pointer select-none items-center gap-2 rounded-[calc(var(--ui-radius)-3px)]',
                  'border border-dashed border-[var(--ui-border)] px-3 py-2 text-sm outline-none',
                  'data-[selected=true]:border-[var(--ui-accent)] data-[selected=true]:bg-[var(--ui-accent-soft)]',
                )}
              >
                <CornerDownLeft className="size-3.5 shrink-0 text-[var(--ui-muted)]" />
                <span className="truncate">
                  <span className="text-[var(--ui-muted)]">Usar </span>
                  <span className="font-semibold text-[var(--ui-accent)]">{consulta.trim()}</span>
                </span>
              </CommandPrimitive.Item>
            ) : null}

            {filtradas.map((o) => (
              <CommandPrimitive.Item
                key={o}
                value={o}
                onSelect={() => elegir(o)}
                className={cn(
                  'flex cursor-pointer select-none items-center justify-between gap-2',
                  'rounded-[calc(var(--ui-radius)-3px)] px-3 py-2 text-sm outline-none transition-colors',
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
