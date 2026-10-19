'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';

export interface FaqVista { id: number; question: string; answer: string }

const POR_PAGINA = 20;
/** Sin acentos ni mayúsculas: "camion" encuentra "Camión". */
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sinEtiquetas = (s: string) => s.replace(/<[^>]+>/g, ' ');

/**
 * Todas las preguntas publicadas, con buscador (2026-10-12). Se muestran de 20
 * en 20: con cien preguntas abiertas de golpe nadie encuentra la suya; con el
 * buscador, sí.
 */
export function FaqLista({ faqs }: { faqs: FaqVista[] }) {
  const [q, setQ] = useState('');
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const indice = useMemo(() => faqs.map((f) => ({ f, texto: normal(`${f.question} ${sinEtiquetas(f.answer)}`) })), [faqs]);
  const filtradas = useMemo(() => {
    const palabras = normal(q.trim()).split(/\s+/).filter(Boolean);
    return palabras.length ? indice.filter((x) => palabras.every((p) => x.texto.includes(p))).map((x) => x.f) : faqs;
  }, [indice, faqs, q]);
  const mostradas = filtradas.slice(0, visibles);

  if (faqs.length === 0) {
    return <p className="fl-vacio">Todavía no hay preguntas publicadas. Haz la tuya aquí abajo.</p>;
  }

  return (
    <div className="fl">
      <style>{CSS}</style>
      <div className="fl-buscar">
        <span className="fl-lupa" aria-hidden><Icon name="search" size={18} /></span>
        <input
          id="fl-buscar"
          className="ms-input fl-input"
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setVisibles(POR_PAGINA); }}
          placeholder={`Buscar entre ${faqs.length} ${faqs.length === 1 ? 'pregunta' : 'preguntas'}…`}
          aria-label="Buscar una pregunta"
        />
      </div>
      {q.trim() ? (
        <p className="fl-conteo" aria-live="polite">
          {filtradas.length === 0 ? 'No encontramos esa pregunta.' : `${filtradas.length} ${filtradas.length === 1 ? 'resultado' : 'resultados'}`}
          {filtradas.length === 0 ? <> <a href="#preguntar" className="ms-link">Pregúntanos</a> y te contestamos.</> : null}
        </p>
      ) : null}

      <div className="fl-items">
        {mostradas.map((f) => (
          <details key={f.id} name="faq-pagina" className="faq fl-item">
            <summary className="fl-q">
              <span>{f.question}</span>
              <span className="faq-plus fl-mas" aria-hidden>+</span>
            </summary>
            <div className="fl-a" dangerouslySetInnerHTML={{ __html: f.answer }} />
          </details>
        ))}
      </div>

      {filtradas.length > visibles ? (
        <div className="fl-mas-wrap">
          <button type="button" className="ms-btn ms-btn-sec" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
            Ver más preguntas ({filtradas.length - visibles})
          </button>
        </div>
      ) : null}
    </div>
  );
}

const CSS = `
.fl{ display:grid; gap:14px; }
.fl-buscar{ position:relative; }
.fl-lupa{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--color-text-muted); display:inline-flex; pointer-events:none; }
.fl-input{ padding-left:42px; }
.fl-conteo{ margin:0; font-size:14px; color:var(--color-text-muted); }
.fl-items{ display:grid; gap:10px; }
.fl-item{ background:var(--color-surface); border:1px solid var(--color-border); border-radius:14px; overflow:hidden; }
.fl-q{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 22px; cursor:pointer; font-weight:600; font-size:15.5px; color:var(--color-text); }
.fl-q > span:first-child{ min-width:0; }
.fl-mas{ font-size:22px; line-height:1; color:var(--color-primary); flex-shrink:0; }
.fl-a{ padding:0 22px 20px; color:var(--color-text-muted); font-size:14.5px; line-height:1.6; white-space:pre-line; overflow-wrap:anywhere; }
.fl-mas-wrap{ display:flex; justify-content:center; margin-top:6px; }
.fl-vacio{ margin:0; color:var(--color-text-muted); }
`;
