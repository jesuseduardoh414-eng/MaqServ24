import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une clases de Tailwind resolviendo conflictos (la última gana).
 *
 * Es el helper que shadcn/ui da por sentado en todos sus componentes: sin él,
 * pasar `className="bg-red-500"` a un botón que ya trae `bg-blue-500` deja las
 * dos clases y decide el orden del CSS, no quien lo escribió.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
