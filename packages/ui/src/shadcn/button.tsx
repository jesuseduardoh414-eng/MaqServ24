'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/**
 * Botón (shadcn/ui, adaptado).
 *
 * Es el componente de shadcn con una diferencia deliberada: en vez de la paleta
 * que trae de fábrica (`bg-primary`, `text-primary-foreground`…), usa el
 * contrato `--ui-*` que cada app declara en su `:root`.
 *
 * NO es capricho de estilo. shadcn define sus colores en `@theme` con nombres
 * como `--color-primary`, y este proyecto YA tiene un `--color-primary` que el
 * servidor inyecta desde la base de datos en cada carga: dejar las dos
 * definiciones habría hecho que una pisara a la otra y que el color de marca
 * dependiera del orden del CSS. Con `--ui-*` conviven, y el botón sigue
 * cambiando de color cuando se cambia la paleta en Diseño.
 */
const buttonVariants = cva(
  // El anillo de foco lo pone la regla `:focus-visible` global del sitio, que
  // en la hoja compilada va DESPUÉS de las utilidades de Tailwind y por tanto
  // gana. Añadir aquí otro solo dibujaba dos indicadores encimados.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[var(--ui-accent)] text-[var(--ui-accent-fg)] hover:opacity-90',
        outline:
          'border border-[var(--ui-border)] bg-transparent text-[var(--ui-text)] ' +
          'hover:border-[var(--ui-accent)] hover:text-[var(--ui-accent)]',
        ghost: 'bg-transparent text-[var(--ui-text)] hover:bg-[var(--ui-accent-soft)]',
        danger: 'bg-transparent text-[var(--ui-muted)] hover:text-[var(--ui-danger)]',
      },
      size: {
        default: 'h-[46px] px-5 text-sm rounded-[var(--ui-radius)]',
        sm: 'h-[38px] px-3.5 text-[13px] rounded-[calc(var(--ui-radius)-2px)]',
        icon: 'h-9 w-9 rounded-[calc(var(--ui-radius)-2px)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ShButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza el hijo en vez de un <button> (para envolver un <Link>). */
  asChild?: boolean;
}

export const ShButton = React.forwardRef<HTMLButtonElement, ShButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // Dentro de un <form>, un <button> sin `type` envía el formulario. El
        // cotizador vive dentro de uno y eso recargaba la página a media
        // captura; por defecto va `button` y quien quiera enviar lo pide.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
ShButton.displayName = 'ShButton';

export { buttonVariants };
