'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

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
  onElegir,
}: {
  /** Devuelve la obra elegida, o null al volver a "otra dirección". */
  onElegir: (obra: ObraCliente | null) => void;
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

  // Opciones como tarjetas seleccionables (radio 8, borde 1 px); la elegida
  // se marca con borde y fondo azul tenue más una palomita, no solo con color.
  return (
    <section className="ms-panel">
      <style>{`
        .sp-list{ display:grid; gap:10px; margin-top:18px; }
        .sp-opc{ display:flex; gap:12px; align-items:flex-start; width:100%; text-align:left; padding:13px 14px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text); font:inherit; cursor:pointer; transition:border-color .18s ease, background-color .18s ease; }
        .sp-opc:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
        .sp-opc[aria-pressed="true"]{ border-color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 8%, transparent); }
        .sp-opc:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
        .sp-marca{ width:20px; height:20px; flex-shrink:0; margin-top:1px; border-radius:50%; border:1.5px solid var(--color-border); display:grid; place-items:center; color:var(--color-primary-fg); }
        .sp-opc[aria-pressed="true"] .sp-marca{ background:var(--color-primary); border-color:var(--color-primary); }
        .sp-txt{ min-width:0; display:grid; gap:3px; }
        .sp-nom{ font-size:14.5px; font-weight:600; }
        .sp-sub{ font-size:13px; line-height:1.45; color:var(--color-text-muted); overflow-wrap:anywhere; }
      `}</style>
      <h2 className="ms-h2">¿Para cuál de tus obras?</h2>
      <p className="ms-h2-desc">Elige una y llenamos la dirección por ti.</p>

      <div className="sp-list">
        {obras.map((o) => {
          const activo = elegida === o.id;
          return (
            <button key={o.id} type="button" onClick={() => escoger(o)} aria-pressed={activo} className="sp-opc">
              <span className="sp-marca" aria-hidden>{activo ? <Icon name="check" size={12} /> : null}</span>
              <span className="sp-txt">
                <span className="sp-nom">{o.name}</span>
                {o.address ? <span className="sp-sub">{o.address}</span> : null}
                {o.requirements.length > 0 ? (
                  // Se le recuerdan sus propios requisitos: es lo que evita la
                  // llamada de "¿y traen inducción?" con la máquina en la puerta.
                  <span className="sp-sub">Pide: {o.requirements.join(' · ')}</span>
                ) : null}
              </span>
            </button>
          );
        })}

        <button type="button" onClick={() => escoger(null)} aria-pressed={elegida === null} className="sp-opc">
          <span className="sp-marca" aria-hidden>{elegida === null ? <Icon name="check" size={12} /> : null}</span>
          <span className="sp-txt">
            <span className="sp-nom">Es otra dirección</span>
            <span className="sp-sub">La escribo abajo y queda guardada como obra nueva.</span>
          </span>
        </button>
      </div>
    </section>
  );
}
