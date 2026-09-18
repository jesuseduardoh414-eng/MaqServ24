'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../lib/utils';

/** Campo de texto (shadcn/ui, sobre el contrato `--ui-*`). Ver `button.tsx`. */
export const ShInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full min-w-0 rounded-[var(--ui-radius)] px-3.5 text-sm',
        'border border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-text)]',
        'placeholder:text-[var(--ui-muted)] outline-none transition-colors',
        'focus-visible:border-[var(--ui-accent)]',
        'aria-[invalid=true]:border-[var(--ui-danger)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Las flechitas del input numérico invitan a subir de 1 en 1 y aquí las
        // cantidades van con su propio contador; además ensanchan el campo.
        '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        '[-moz-appearance:textfield]',
        className,
      )}
      {...props}
    />
  ),
);
ShInput.displayName = 'ShInput';

/** Área de texto, mismo contrato. */
export const ShTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[88px] w-full rounded-[var(--ui-radius)] px-3.5 py-3 text-sm leading-relaxed',
        'border border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-text)]',
        'placeholder:text-[var(--ui-muted)] outline-none transition-colors resize-y',
        'focus-visible:border-[var(--ui-accent)]',
        className,
      )}
      {...props}
    />
  ),
);
ShTextarea.displayName = 'ShTextarea';

/** Etiqueta accesible (Radix): al tocarla enfoca su campo. */
export const ShLabel = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-[11.5px] font-bold tracking-wide text-[var(--ui-muted)] select-none',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
ShLabel.displayName = 'ShLabel';
