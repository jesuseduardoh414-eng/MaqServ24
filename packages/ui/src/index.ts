export { Button, type ButtonProps } from './Button';
export { Card } from './Card';
export { Input } from './Input';
export { RecortarEspacios } from './RecortarEspacios';

// Cotizadores internos (maquinaria y triturados): los comparten el panel y el sitio.
export * from './cotizador';

// Primitivas de shadcn/ui (Radix) atadas al contrato de tokens --ui-*.
// Ver shadcn/button.tsx para por que no se usan los colores de fabrica.
export * from "./shadcn";
