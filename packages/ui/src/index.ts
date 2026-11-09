export { Button, type ButtonProps } from './Button';
export { Card } from './Card';
export { Input } from './Input';
export { FiltroDeCampos } from './FiltroDeCampos';
export { ResultadosHost, Toast, mostrarResultado, type TonoResultado } from './Resultados';

// Cotizadores internos (maquinaria y triturados): los comparten el panel y el sitio.
export * from './cotizador';
// Calculadoras de material (2026-11-09): por ahora solo en el enlace de los cotizadores.
export * from './calculadoras';

// Primitivas de shadcn/ui (Radix) atadas al contrato de tokens --ui-*.
// Ver shadcn/button.tsx para por que no se usan los colores de fabrica.
export * from "./shadcn";
