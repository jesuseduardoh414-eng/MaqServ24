import type { ReactNode } from 'react';

/**
 * BANDA CON LUZ (rediseño 2026-11-16, el estilo de «¿Por qué MAQSER24?» que
 * mandó el dueño): fondo azul oscuro en degradado, un brillo azul tenue y dos
 * trazos de luz en las esquinas (un panel con el borde biselado y su línea
 * azul con resplandor). Va a todo el ancho; el contenido trae su propio
 * contenedor.
 *
 * `lado` decide en qué orilla van los trazos: así dos bandas seguidas no se
 * ven iguales. Se usa alternando secciones, no en todas, para no saturar.
 * Los colores salen del tema, así que en modo claro queda claro.
 */
export function BandaLuz({ lado = 'derecha', children, id }: { lado?: 'derecha' | 'izquierda'; children: ReactNode; id?: string }) {
  const izq = lado === 'izquierda';
  return (
    <div className={`bl-banda${izq ? ' bl-izq' : ''}`} id={id}>
      <style>{BL_CSS}</style>
      <svg aria-hidden className="bl-trazo bl-arriba" viewBox="0 0 520 90" preserveAspectRatio="none">
        <polygon points="0,0 64,64 520,64 520,0" className="bl-panel" />
        <polyline points="0,0 64,64 520,64" className="bl-linea" />
      </svg>
      <svg aria-hidden className="bl-trazo bl-abajo" viewBox="0 0 520 90" preserveAspectRatio="none">
        <polygon points="0,90 64,26 520,26 520,90" className="bl-panel" />
        <polyline points="0,90 64,26 520,26" className="bl-linea" />
      </svg>
      <div className="bl-contenido">{children}</div>
    </div>
  );
}

const BL_CSS = `
.bl-banda{ position:relative; overflow:hidden; border-top:1px solid var(--color-border); border-bottom:1px solid var(--color-border);
  background:
    radial-gradient(900px 420px at 92% -8%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 62%),
    radial-gradient(700px 360px at 4% 108%, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 75%, var(--color-bg)), var(--color-bg)); }
.bl-banda.bl-izq{
  background:
    radial-gradient(900px 420px at 8% -8%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 62%),
    radial-gradient(700px 360px at 96% 108%, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 75%, var(--color-bg)), var(--color-bg)); }
.bl-contenido{ position:relative; }
.bl-trazo{ position:absolute; right:0; width:min(520px, 46vw); height:90px; pointer-events:none; overflow:visible; }
.bl-izq .bl-trazo{ right:auto; left:0; transform:scaleX(-1); }
.bl-arriba{ top:0; }
.bl-abajo{ bottom:0; }
.bl-panel{ fill: color-mix(in srgb, var(--color-text) 3.5%, transparent); }
.bl-linea{ fill:none; stroke: var(--color-primary); stroke-width:1.6; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 6px var(--color-primary)); }
@media (max-width: 640px){ .bl-trazo{ width: 62vw; height: 60px; } }
`;
