'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

type Operador = { nombre: string; telefono: string | null } | null;

/**
 * EL OPERADOR DE LA UNIDAD, desde el portal del aliado (2026-10-15).
 *
 * Quien maneja la unidad comparte la ubicación y va marcando "salí", "llegué"
 * desde SU enlace, que solo abre este servicio. Aquí el aliado dice quién es
 * y se lo manda por WhatsApp. Volver a mandarlo invalida el anterior.
 */
export function OperadorServicio({ quoteNumber, inicial }: { quoteNumber: string; inicial: Operador }) {
  const [operador, setOperador] = useState<Operador>(inicial);
  const [editando, setEditando] = useState(!inicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<{ url: string; whatsapp: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function mandar(datos: { nombre: string; telefono: string }) {
    setOcupado(true);
    setError(null);
    setCopiado(false);
    const r = await fetch(`/api/proxy/aliado/servicios/${encodeURIComponent(quoteNumber)}/operador`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: datos.nombre, telefono: datos.telefono || null }),
    }).catch(() => null);
    setOcupado(false);
    const b = await r?.json().catch(() => null);
    if (!r?.ok) { setError(b?.message ?? 'No se pudo guardar. Inténtalo otra vez.'); return; }
    setOperador(b.operador);
    setEnlace({ url: b.url, whatsapp: b.whatsapp });
    setEditando(false);
  }

  async function copiar() {
    if (!enlace) return;
    try { await navigator.clipboard.writeText(enlace.url); setCopiado(true); } catch { setCopiado(false); }
  }

  const caja: React.CSSProperties = { marginTop: 14, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', display: 'grid', gap: 10 };

  if (editando) {
    return (
      <div style={caja}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>¿Quién maneja la unidad?</div>
        <p className="ms-hint" style={{ margin: 0 }}>Le mandamos un enlace solo para este servicio: la dirección, el contacto en obra y los botones para avisar que salió y llegó. Desde ahí comparte su ubicación.</p>
        <input className="ms-input" placeholder="Nombre del operador" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
        <input className="ms-input" placeholder="Su celular (WhatsApp)" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={20} />
        {error ? <span className="ms-hint" role="alert" style={{ color: 'var(--color-error)' }}>{error}</span> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ms-btn" disabled={ocupado || nombre.trim().length < 2} onClick={() => void mandar({ nombre, telefono })}>
            <Icon name="chat" size={16} />{ocupado ? 'Guardando…' : 'Guardar y armar su enlace'}
          </button>
          {operador ? <button type="button" className="ms-btn ms-btn-sec" onClick={() => setEditando(false)}>Cancelar</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={caja}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Operador: </span>
          <strong>{operador?.nombre}</strong>{operador?.telefono ? <span style={{ color: 'var(--color-text-muted)' }}> · {operador.telefono}</span> : null}
        </div>
        <button type="button" className="ms-link" onClick={() => setEditando(true)} style={{ fontSize: 13.5 }}>Cambiar</button>
      </div>
      {enlace ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {enlace.whatsapp ? (
            <a className="ms-btn" href={enlace.whatsapp} target="_blank" rel="noopener"><Icon name="chat" size={16} />Mandárselo por WhatsApp</a>
          ) : null}
          <button type="button" className="ms-btn ms-btn-sec" onClick={() => void copiar()}><Icon name="link" size={16} />{copiado ? 'Copiado' : 'Copiar enlace'}</button>
        </div>
      ) : (
        <button type="button" className="ms-btn ms-btn-sec" disabled={ocupado} onClick={() => operador && void mandar({ nombre: operador.nombre, telefono: operador.telefono ?? '' })}>
          <Icon name="link" size={16} />{ocupado ? 'Armando…' : 'Volver a mandarle su enlace'}
        </button>
      )}
      {error ? <span className="ms-hint" role="alert" style={{ color: 'var(--color-error)' }}>{error}</span> : null}
    </div>
  );
}
