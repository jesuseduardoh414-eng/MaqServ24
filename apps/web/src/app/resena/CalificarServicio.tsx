'use client';

import { useState } from 'react';
import Link from '@/components/Enlace';
import { Icon } from '@/components/Icon';

export interface DatosResena {
  folio: string;
  nombre: string;
  servicio: string;
  aliados: string[];
  cerradoEl: string | null;
  cantidad: string | null;
  resena: { rating: number; comment: string } | null;
}

const ETIQUETA = ['', 'Malo', 'Regular', 'Bien', 'Muy bien', 'Excelente'];

/**
 * La reseña cabe en una pantalla de teléfono: estrellas grandes, un comentario
 * opcional y un botón. Lo que más importa es la calificación; pedir texto
 * obligatorio hace que la mitad se vaya sin calificar.
 */
export function CalificarServicio({ token, datos }: { token: string; datos: DatosResena }) {
  const [rating, setRating] = useState(datos.resena?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(datos.resena?.comment ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const muestra = hover || rating;

  async function enviar() {
    if (!rating) { setError('Elige de 1 a 5 estrellas.'); return; }
    setEnviando(true); setError(null);
    try {
      const r = await fetch('/api/resena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, rating, comment: comment.trim() }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'No se pudo guardar. Inténtalo de nuevo.');
      setListo(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="ms-panel ms-panel-lg rs-card">
        <style>{CSS}</style>
        <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="check" size={22} /></span>
        <h1 className="rs-title">Gracias{datos.nombre ? `, ${datos.nombre}` : ''}</h1>
        <p className="ms-desc rs-desc">
          Tu calificación nos llegó. Si quieres cambiarla, vuelve a abrir el enlace del correo.
        </p>
        <Link href="/servicios" className="ms-btn ms-btn-sec ms-btn-block">Ver servicios de MAQSER24</Link>
      </div>
    );
  }

  return (
    <div className="ms-panel ms-panel-lg rs-card">
      <style>{CSS}</style>
      <p className="ms-kicker">Servicio {datos.folio}</p>
      <h1 className="rs-title rs-title-first">¿Cómo te fue?</h1>
      <p className="ms-desc rs-desc">
        {datos.servicio}
        {datos.aliados.length ? <> · te atendió <strong>{datos.aliados.join(' y ')}</strong></> : null}
        {datos.cantidad ? <> · {datos.cantidad}</> : null}
      </p>
      {datos.resena ? <p className="rs-ya">Ya calificaste este servicio. Puedes cambiar tu reseña aquí.</p> : null}

      <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} noValidate className="rs-stack">
        <div>
          <div className="rs-estrellas" role="radiogroup" aria-label="Calificación del servicio" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} de 5: ${ETIQUETA[n]}`}
                className={`rs-estrella${n <= muestra ? ' on' : ''}`}
                onClick={() => { setRating(n); setError(null); }}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
              >
                <Icon name="star" size={34} fill={n <= muestra} />
              </button>
            ))}
          </div>
          <p className="rs-etiqueta" aria-live="polite">{muestra ? ETIQUETA[muestra] : 'Toca una estrella'}</p>
        </div>

        <div className="ms-field">
          <label className="ms-label" htmlFor="rs-comentario">Cuéntanos más <span className="rs-opc">(opcional)</span></label>
          <textarea
            id="rs-comentario"
            className="ms-input rs-texto"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            placeholder="¿Llegó a tiempo? ¿El equipo y el operador estuvieron bien? ¿Qué mejorarías?"
            rows={4}
          />
        </div>

        {error ? (
          <div role="alert" className="ms-alert ms-alert-bad rs-alert">
            <Icon name="warning" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <button type="submit" disabled={enviando} className="ms-btn ms-btn-lg ms-btn-block">
          {enviando ? 'Enviando…' : datos.resena ? 'Guardar cambios' : 'Enviar calificación'}
        </button>
      </form>
    </div>
  );
}

/* Estilos propios de la reseña (prefijo `rs-`). Lo común sale de `ms-*`. */
const CSS = `
.rs-card{ width:100%; max-width:480px; margin:0 auto; box-sizing:border-box; }
.rs-title{ margin:14px 0 8px; font-family:var(--font-display); font-size:30px; font-weight:700; letter-spacing:-.025em; line-height:1.15; text-wrap:balance; }
.rs-title-first{ margin-top:0; }
.rs-desc{ margin:0 0 18px; }
.rs-ya{ margin:-6px 0 16px; font-size:13.5px; color:var(--color-text-muted); }
.rs-stack{ display:grid; gap:20px; }
.rs-estrellas{ display:flex; gap:6px; justify-content:center; }
.rs-estrella{ background:none; border:none; padding:4px; border-radius:10px; cursor:pointer; color:var(--color-text-muted); opacity:.45; line-height:0; transition:transform .12s ease, opacity .12s ease, color .12s ease; }
.rs-estrella.on{ color:#f5a524; opacity:1; }
.rs-estrella:hover{ transform:scale(1.08); }
.rs-estrella:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.rs-etiqueta{ margin:6px 0 0; text-align:center; font-weight:600; min-height:1.4em; color:var(--color-text); }
.rs-opc{ font-weight:400; color:var(--color-text-muted); }
.rs-texto{ min-height:104px; resize:vertical; line-height:1.5; font:inherit; }
.rs-alert{ font-size:13.5px; display:flex; gap:8px; align-items:flex-start; }
@media (prefers-reduced-motion: reduce){ .rs-estrella{ transition:none; } }
@media (max-width: 640px){ .rs-title{ font-size:26px; } }
`;
