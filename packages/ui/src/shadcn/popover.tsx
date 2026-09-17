'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../lib/utils';

/** Popover (shadcn/ui sobre Radix). Base del combobox. Ver `select.tsx`. */
const ShPopover = PopoverPrimitive.Root;
const ShPopoverTrigger = PopoverPrimitive.Trigger;
const ShPopoverAnchor = PopoverPrimitive.Anchor;

const ShPopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-[120] overflow-hidden rounded-[var(--ui-radius)] p-1',
        'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)]',
        // Sombra más honda que la del cromo: el panel flota sobre el contenido
        // y sin separarlo se leía como parte del formulario.
        'shadow-[0_18px_48px_-12px_rgba(0,0,0,.6)] outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
ShPopoverContent.displayName = 'ShPopoverContent';

export { ShPopover, ShPopoverTrigger, ShPopoverAnchor, ShPopoverContent };
