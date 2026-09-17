'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Desplegable (shadcn/ui sobre Radix Select), en lugar del `<select>` nativo.
 *
 * El nativo lo pinta el SISTEMA OPERATIVO, no la página: sobre un sitio oscuro
 * abría una lista blanca de Windows con su propia tipografía y sus propios
 * bordes, y no hay CSS que lo cambie. Este se dibuja con el tema, se navega con
 * el teclado igual y marca la opción elegida con una palomita.
 *
 * Los menús van en un PORTAL colgado de <body>: por eso los colores salen de
 * `--ui-*`, que cada app declara en `:root`, y no de variables locales del
 * componente que ahí ya no existirían.
 */
const ShSelect = SelectPrimitive.Root;
const ShSelectGroup = SelectPrimitive.Group;
const ShSelectValue = SelectPrimitive.Value;

const ShSelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-11 w-full items-center justify-between gap-2 rounded-[var(--ui-radius)] px-3.5 text-sm',
      'border border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-text)]',
      'outline-none transition-colors data-[placeholder]:text-[var(--ui-muted)]',
      'focus-visible:border-[var(--ui-accent)] focus-visible:ring-1 focus-visible:ring-[var(--ui-accent)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      '[&>span]:truncate [&>span]:text-left',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-[var(--ui-muted)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
ShSelectTrigger.displayName = 'ShSelectTrigger';

const ShSelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      // Se acota a lo que de verdad cabe en pantalla: sin esto el menú se salía
      // por abajo y Radix lo volteaba hacia arriba, tapando el formulario.
      style={{ maxHeight: 'min(320px, var(--radix-select-content-available-height))' }}
      collisionPadding={12}
      className={cn(
        'relative z-[120] min-w-[8rem] overflow-hidden rounded-[var(--ui-radius)] p-1.5',
        'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)]',
        'shadow-[0_18px_48px_-12px_rgba(0,0,0,.6)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        // El menú nunca es más estrecho que su disparador: si no, una zona de
        // 60 caracteres abría una lista de 8 y el texto se cortaba.
        position === 'popper' && 'w-[var(--radix-select-trigger-width)] translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-[var(--ui-muted)]">
        <ChevronUp className="size-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport
        className={cn(
          'p-0',
          // Barra propia: la nativa de Windows es una franja gris clara de
          // 17 px que sobre el panel oscuro parece un error de maquetación.
          '[scrollbar-width:thin] [scrollbar-color:var(--ui-border)_transparent]',
          '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--ui-border)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-[var(--ui-muted)]">
        <ChevronDown className="size-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
ShSelectContent.displayName = 'ShSelectContent';

const ShSelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-[calc(var(--ui-radius)-3px)]',
      'py-2 pl-3 pr-8 text-sm outline-none transition-colors',
      'focus:bg-[var(--ui-accent-soft)] focus:text-[var(--ui-text)]',
      'data-[state=checked]:text-[var(--ui-accent)] data-[state=checked]:font-semibold',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2.5 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
ShSelectItem.displayName = 'ShSelectItem';

const ShSelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ui-muted)]', className)}
    {...props}
  />
));
ShSelectLabel.displayName = 'ShSelectLabel';

export {
  ShSelect,
  ShSelectGroup,
  ShSelectValue,
  ShSelectTrigger,
  ShSelectContent,
  ShSelectItem,
  ShSelectLabel,
};
