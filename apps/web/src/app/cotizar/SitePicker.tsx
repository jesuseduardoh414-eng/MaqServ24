'use client';

import { useEffect, useState } from 'react';

/**
 * "¿PARA CUÁL DE TUS OBRAS?"
 *
 * A quien ya nos dijo dónde trabaja no se le vuelve a preguntar. El documento
 * lo pide de los dos lados: para el proveedor, "la información que ya está
 * validada no debería solicitarse de nuevo"; y para el cliente, la sección 19
 * advierte que "si para solicitar una máquina el usuario tiene que llenar un
 * formulario interminable, la digitalización habrá sustituido una fricción por
 * otra".
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Si no hay obras, no se pinta NADA. Es el caso de casi todo el mundo —la
 *   mayoría cotiza sin cuenta— y un recuadro que diga "no tienes obras" sería
 *   ruido en el paso donde menos sobra.
 *
 * 2. Elegir una obra NO bloquea la dirección, la rellena. Una obra grande tiene
 *    varios accesos, y el cliente tiene que poder escribir "por la puerta 4"
 *    sin salirse a editar su expediente.
 */

export interface ObraCliente {
  id: number;
  name: string;
  address: string | null;
  municipality: string | null;
  contactName: string | null;
  contactPhone: string | null;
  requirements: string[];
}

export function SitePicker({
  onElegir, estilos,
}: {
  /** Devuelve la obra elegida, o null al volver a "otra dirección". */
  onElegir: (obra: ObraCliente | null) => void;
  estilos: { tarjeta: React.CSSProperties; leyenda: React.CSSProperties };
}) {
  const [obras, setObras] = useState<ObraCliente[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/proxy/quotes/mis-obras')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.sites?.length) setObras(d.sites); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (obras.length === 0) return null;

  const escoger = (o: ObraCliente | null) => {
    setElegida(o?.id ?? null);
    onElegir(o);
  };

  const boton = (activo: boolean): React.CSSProperties => ({
    textAlign: 'left',
    border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: activo ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  });

  return (
    <div style={estilos.tarjeta}>
      <h2 style={estilos.leyenda}>¿Para cuál de tus obras?</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
        Elige una y llenamos la dirección por ti.
      </p>

      <div style={{ display: 'grid', gap: 9 }}>
        {obras.map((o) => {
          const activo = elegida === o.id;
          return (
            <button key={o.id} type="button" onClick={() => escoger(o)} aria-pressed={activo} style={boton(activo)}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{o.name}</span>
              {o.address ? (
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>
                  {o.address}
                </span>
              ) : null}
              {o.requirements.length > 0 ? (
                // Se le recuerdan sus propios requisitos: es lo que evita la
                // llamada de "¿y traen inducción?" con la máquina en la puerta.
                <span style={{ display: 'block', fontSize: 12, color: 'var(--color-primary)', marginTop: 5 }}>
                  Pide: {o.requirements.join(' · ')}
                </span>
              ) : null}
            </button>
          );
        })}

        <button type="button" onClick={() => escoger(null)} aria-pressed={elegida === null} style={boton(elegida === null)}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>Es otra dirección</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>
            La escribo abajo y queda guardada como obra nueva.
          </span>
        </button>
      </div>
    </div>
  );
}
