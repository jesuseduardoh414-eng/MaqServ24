'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

/**
 * INCIDENCIAS DE CAMPO (documento institucional, sección 30).
 *
 * "Registro, evidencias, responsables, escalamiento y cierre."
 *
 * La pantalla está hecha para que registrar sea barato: tres clics y una
 * frase. Si levantar una incidencia cuesta trabajo, no se levanta — y entonces
 * el registro dice que todo va bien porque nadie tuvo tiempo de decir lo
 * contrario.
 */

interface Incidencia {
  id: number;
  quoteId: number;
  quoteNumber: string;
  cliente: string;
  categoria: string | null;
  provider: { id: number; name: string } | null;
  kind: string;
  kindLabel: string;
  severity: string;
  responsible: string;
  description: string;
  state: string;
  resolution: string | null;
  openedAt: string;
  closedAt: string | null;
}

interface Tipo { clave: string; label: string; ejemplo: string }

const C = {
  panel: '#141416', panel2: '#1b1e26', panel3: '#212530',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

const COLOR_SEV: Record<string, string> = { alta: C.bad, media: C.warn, baja: C.dim };
const RESPONSABLE: Record<string, string> = {
  cliente: 'Del cliente', aliado: 'Del aliado', plataforma: 'Nuestra', nadie: 'De nadie',
};

const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
};
const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 9,
  padding: '9px 15px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9,
  padding: '9px 15px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export function Incidencias({
  quoteId, quoteNumber, onCerrar,
}: {
  quoteId: number;
  quoteNumber: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<Incidencia[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState(false);
  const [f, setF] = useState({ kind: 'retraso', severity: 'media', responsible: 'nadie', description: '' });
  const [ocupado, setOcupado] = useState(false);

  async function recargar() {
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/incidencias?quoteId=${quoteId}&estado=todas`),
      fetch('/api/admin/incidencias/catalogo'),
    ]);
    if (r1.ok) setLista(await r1.json());
    if (r2.ok) setTipos((await r2.json()).tipos);
    setCargando(false);
  }

  useEffect(() => { recargar(); }, [quoteId]);

  async function abrir() {
    if (f.description.trim().length < 4) return;
    setOcupado(true);
    const r = await fetch('/api/admin/incidencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, ...f, description: f.description.trim() }),
    });
    setOcupado(false);
    if (r.ok) {
      setF({ kind: 'retraso', severity: 'media', responsible: 'nadie', description: '' });
      setAbriendo(false);
      recargar();
      router.refresh();
    }
  }

  async function cerrar(id: number) {
    const resolution = window.prompt('¿Cómo se resolvió?');
    if (!resolution || resolution.trim().length < 4) return;
    // Al cerrar se puede corregir de quién fue: al abrir no siempre se sabe, y
    // obligar a decidirlo en caliente produce culpables inventados.
    const quien = window.prompt('¿De quién fue? cliente / aliado / plataforma / nadie', 'nadie');
    setOcupado(true);
    await fetch(`/api/admin/incidencias/${id}/cerrar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolution: resolution.trim(),
        ...(quien && ['cliente', 'aliado', 'plataforma', 'nadie'].includes(quien) ? { responsible: quien } : {}),
      }),
    });
    setOcupado(false);
    recargar();
    router.refresh();
  }

  const abiertas = lista.filter((i) => i.state === 'abierta');
  const elegido = tipos.find((t) => t.clave === f.kind);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Incidencias del servicio"
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 18, padding: 24,
          width: 'min(600px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', color: C.ink,
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Incidencias</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
          {quoteNumber} · {abiertas.length > 0 ? `${abiertas.length} sin resolver` : 'nada sin resolver'}.
          Lo que no se registra no se puede corregir.
        </p>

        {!abriendo ? (
          <button type="button" style={{ ...boton, marginBottom: 16 }} onClick={() => setAbriendo(true)}>
            + Levantar incidencia
          </button>
        ) : (
          <div style={{ background: C.panel3, border: `1px solid ${C.line2}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 11 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Qué pasó</span>
                <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={input}>
                  {tipos.map((t) => <option key={t.clave} value={t.clave}>{t.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Qué tan grave</span>
                <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} style={input}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>De quién fue</span>
                <select value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })} style={input}>
                  {/* "De nadie" primero y por defecto: muchas incidencias no son
                      culpa de alguien, y obligar a señalar culpable haría que
                      nadie quisiera levantarlas. */}
                  <option value="nadie">De nadie / aún no se sabe</option>
                  <option value="aliado">Del aliado</option>
                  <option value="cliente">Del cliente</option>
                  <option value="plataforma">Nuestra</option>
                </select>
              </label>
            </div>

            {elegido ? (
              <div style={{ fontSize: 12, color: C.dim, marginTop: 9, lineHeight: 1.5 }}>{elegido.ejemplo}</div>
            ) : null}

            <label style={{ display: 'grid', gap: 5, marginTop: 13 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Qué pasó, con detalle</span>
              <textarea
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                rows={3}
                placeholder="La unidad llegó a las 10:40, comprometida para las 8:00. El residente ya había movido la cuadrilla."
                style={{ ...input, resize: 'vertical', lineHeight: 1.55 }}
                autoFocus
              />
            </label>

            <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
              <button type="button" style={{ ...boton, opacity: ocupado ? 0.6 : 1 }} onClick={abrir} disabled={ocupado}>
                Registrar
              </button>
              <button type="button" style={botonSec} onClick={() => setAbriendo(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {cargando ? <div style={{ fontSize: 13, color: C.dim }}>Cargando…</div> : null}

        {!cargando && lista.length === 0 ? (
          <div style={{ fontSize: 13, color: C.dim, padding: '14px 0' }}>
            Este servicio no ha tenido incidencias.
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {lista.map((i) => (
            <div
              key={i.id}
              style={{
                border: `1px solid ${i.state === 'abierta' ? `color-mix(in srgb, ${COLOR_SEV[i.severity]} 40%, transparent)` : C.line}`,
                borderRadius: 12, padding: '13px 15px',
                opacity: i.state === 'cerrada' ? 0.62 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{i.kindLabel}</span>
                  <span style={{ marginLeft: 9, fontSize: 11, fontWeight: 700, color: COLOR_SEV[i.severity] }}>
                    {i.severity.toUpperCase()}
                  </span>
                  <span style={{ marginLeft: 9, fontSize: 11.5, color: C.dim }}>
                    {RESPONSABLE[i.responsible] ?? i.responsible}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: C.dim }}>
                  {i.state === 'cerrada' ? `cerrada ${fecha(i.closedAt)}` : fecha(i.openedAt)}
                </span>
              </div>

              <p style={{ margin: '8px 0 0', fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>{i.description}</p>

              {i.resolution ? (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: C.ok, lineHeight: 1.55 }}>
                  Se resolvió: {i.resolution}
                </p>
              ) : null}

              {i.state === 'abierta' ? (
                <button
                  type="button"
                  style={{ ...botonSec, marginTop: 11, padding: '7px 13px', fontSize: 12.5 }}
                  onClick={() => cerrar(i.id)}
                  disabled={ocupado}
                >
                  Marcar resuelta
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <button type="button" onClick={onCerrar} style={{ ...botonSec, width: '100%', marginTop: 20, padding: '11px 16px' }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
