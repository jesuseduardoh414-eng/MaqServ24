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
      <TrazosLuz lado={lado} />
      <div className="bl-contenido">{children}</div>
    </div>
  );
}

/**
 * Solo los dos trazos de luz de las esquinas, para fondos que ya tienen el
 * suyo (la portada del inicio). El contenedor necesita `position: relative`
 * y `overflow: hidden`.
 */
export function TrazosLuz({ lado = 'derecha', partes = 'ambas' }: { lado?: 'derecha' | 'izquierda'; partes?: 'ambas' | 'arriba' | 'abajo' }) {
  const izq = lado === 'izquierda' ? ' bl-trazo-izq' : '';
  return (
    <>
      <style>{BL_CSS}</style>
      {partes !== 'abajo' ? (
        <svg aria-hidden className={`bl-trazo bl-arriba${izq}`} viewBox="0 0 520 90" preserveAspectRatio="none">
          <polygon points="0,0 64,64 520,64 520,0" className="bl-panel" />
          <polyline points="0,0 64,64 520,64" className="bl-linea" />
        </svg>
      ) : null}
      {partes !== 'arriba' ? (
        <svg aria-hidden className={`bl-trazo bl-abajo${izq}`} viewBox="0 0 520 90" preserveAspectRatio="none">
          <polygon points="0,90 64,26 520,26 520,90" className="bl-panel" />
          <polyline points="0,90 64,26 520,26" className="bl-linea" />
        </svg>
      ) : null}
    </>
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
/* Rejilla de plano tenue junto a la esquina del trazo (2026-11-16), como la portada. */
.bl-banda::before{ content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image: linear-gradient(color-mix(in srgb, var(--color-text) 5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-text) 5%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 55% 85% at 100% 0%, #000 10%, transparent 70%); mask-image: radial-gradient(ellipse 55% 85% at 100% 0%, #000 10%, transparent 70%); }
.bl-banda.bl-izq::before{ -webkit-mask-image: radial-gradient(ellipse 55% 85% at 0% 0%, #000 10%, transparent 70%); mask-image: radial-gradient(ellipse 55% 85% at 0% 0%, #000 10%, transparent 70%); }
/* Dos bandas seguidas: una sola línea entre ellas. */
.bl-banda + .bl-banda{ border-top-color: transparent; }
.bl-contenido{ position:relative; }
.bl-trazo{ position:absolute; right:0; width:min(520px, 46vw); height:clamp(58px, 9vh, 90px); pointer-events:none; overflow:visible; z-index:0; }
.bl-trazo-izq{ right:auto; left:0; transform:scaleX(-1); }
.bl-arriba{ top:0; }
.bl-abajo{ bottom:0; }
.bl-panel{ fill: color-mix(in srgb, var(--color-text) 3.5%, transparent); }
.bl-linea{ fill:none; stroke: var(--color-primary); stroke-width:1.6; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 6px var(--color-primary)); }
@media (max-width: 640px){ .bl-trazo{ width: 62vw; height: 60px; } }
`;
