'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { problemaEmail, problemaNombre } from '@maqserv/config';

/**
 * "¿No encuentras tu respuesta? Pregúntanos" (2026-10-12).
 *
 * Sin cuenta: nombre, correo y la pregunta. Llega al panel (Sitio web ›
 * Preguntas), se responde, se le avisa por correo y, si le sirve a más gente,
 * se publica aquí arriba. Plegado al inicio para no empujar las respuestas.
 */
export function PreguntaFaq({ hayPreguntas = true, abrir = false }: { hayPreguntas?: boolean; abrir?: boolean }) {
  // Plegada al inicio: abierta sin pedirlo se sentía como algo que no se cierra.
  // `abrir` solo cuando la persona ya pidió preguntar (botón "Hacer una pregunta" del home).
  const [abierto, setAbierto] = useState(abrir);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [sitio, setSitio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  async function enviar() {
    // Antes del envío, con las reglas de la API: el error sale al instante y
    // sin perder lo escrito.
    const problema =
      (nombre.trim() ? problemaNombre(nombre) : 'Escribe tu nombre.') ??
      (correo.trim() ? problemaEmail(correo) : 'Escribe tu correo para avisarte cuando respondamos.') ??
      (pregunta.trim().length < 10 ? 'Escribe tu pregunta con un poco más de detalle.' : null);
    if (problema) { setError(problema); return; }
    setEnviando(true); setError(null);
    try {
      const r = await fetch('/api/preguntas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, pregunta, sitio }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo enviar. Inténtalo de nuevo.');
      setListo(correo.trim());
      setPregunta('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function cerrar() { setAbierto(false); setError(null); setListo(null); }

  return (
    <div className="ms-panel pf-caja">
      <style>{CSS}</style>
      <div className="pf-cab">
        <div>
          <p className="pf-titulo">{hayPreguntas ? '¿No encuentras tu respuesta?' : '¿Tienes una pregunta?'}</p>
          <p className="pf-sub">Pregúntanos. Te contestamos por correo y, si le sirve a más gente, la publicamos aquí.</p>
        </div>
        {!abierto ? (
          <button type="button" className="ms-btn ms-btn-sec" onClick={() => setAbierto(true)} aria-expanded={false}>
            <Icon name="chat" size={16} />Hacer una pregunta
          </button>
        ) : null}
      </div>

      {abierto && listo ? (
        <div className="pf-hecho">
          <div role="status" className="ms-alert pf-listo">
            <Icon name="check" size={16} />
            <span>Recibimos tu pregunta. Te avisamos a <strong>{listo}</strong> en cuanto la respondamos.</span>
          </div>
          <div className="pf-acciones">
            <button type="button" className="ms-btn ms-btn-sec" onClick={cerrar}>Listo</button>
            <button type="button" className="ms-link ms-link-muted pf-otra" onClick={() => setListo(null)}>Hacer otra pregunta</button>
          </div>
        </div>
      ) : null}

      {abierto && !listo ? (
        <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} noValidate className="pf-form">
          <div className="pf-fila">
            <div className="ms-field">
              <label className="ms-label" htmlFor="pf-nombre">Tu nombre</label>
              <input id="pf-nombre" className="ms-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={190} />
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="pf-correo">Tu correo</label>
              <input id="pf-correo" className="ms-input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" placeholder="Para avisarte cuando respondamos" />
            </div>
          </div>
          <div className="ms-field">
            <label className="ms-label" htmlFor="pf-pregunta">Tu pregunta</label>
            <textarea id="pf-pregunta" className="ms-input pf-texto" rows={3} value={pregunta} onChange={(e) => setPregunta(e.target.value.slice(0, 500))} placeholder="¿Llegan a Santiago? ¿La renta incluye operador?" />
          </div>
          {/* Campo trampa: las personas no lo ven; si viene lleno, es un bot. */}
          <input className="pf-trampa" tabIndex={-1} autoComplete="off" aria-hidden="true" name="sitio" value={sitio} onChange={(e) => setSitio(e.target.value)} />
          {error ? (
            <div role="alert" className="ms-alert ms-alert-bad pf-error"><Icon name="warning" size={16} /><span>{error}</span></div>
          ) : null}
          <div className="pf-acciones">
            <button type="submit" className="ms-btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar pregunta'}</button>
            <button type="button" className="ms-btn ms-btn-sec" onClick={cerrar} disabled={enviando}>Cancelar</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

const CSS = `
.pf-caja{ margin-top:18px; display:grid; gap:16px; }
.pf-cab{ display:flex; gap:14px 20px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.pf-cab > div{ min-width:0; flex:1 1 280px; }
.pf-titulo{ margin:0; font-weight:700; font-size:16.5px; color:var(--color-text); }
.pf-sub{ margin:4px 0 0; font-size:14px; color:var(--color-text-muted); line-height:1.5; }
.pf-form{ display:grid; gap:14px; }
.pf-fila{ display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
.pf-texto{ min-height:88px; resize:vertical; line-height:1.5; font:inherit; }
.pf-trampa{ position:absolute; left:-10000px; width:1px; height:1px; opacity:0; }
.pf-listo, .pf-error{ display:flex; gap:8px; align-items:flex-start; font-size:14px; }
.pf-acciones{ display:flex; gap:10px 14px; align-items:center; flex-wrap:wrap; }
.pf-hecho{ display:grid; gap:12px; }
.pf-otra{ background:none; border:none; padding:0; cursor:pointer; font:inherit; }
`;
