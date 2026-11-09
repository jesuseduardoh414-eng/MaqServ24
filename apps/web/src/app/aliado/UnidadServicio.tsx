'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/Enlace';
import { ShSelectCampo } from '@maqserv/ui';
import { Icon } from '@/components/Icon';
import { avisar } from './comun';
import type { UnidadElegida } from './tipos';

/**
 * QUÉ UNIDAD VA, desde el portal del aliado (2026-11-09).
 *
 * Las obras suelen pedir las placas para dejar entrar, y la oficina las tiene
 * que poder dar sin llamarle. El aliado elige cuál de sus unidades
 * identificadas manda; la apartada para este servicio ya viene elegida y basta
 * un toque. Se ve en el panel, en el servicio.
 */

type Opcion = UnidadElegida & { apartada: boolean };

const clave = (u: { productId: number; indice: number }) => `${u.productId}:${u.indice}`;

export function UnidadServicio({ quoteNumber, inicial, opciones }: { quoteNumber: string; inicial: UnidadElegida | null; opciones: Opcion[] }) {
  const router = useRouter();
  const [unidad, setUnidad] = useState<UnidadElegida | null>(inicial);
  const [editando, setEditando] = useState(!inicial);
  // La apartada para el servicio, o la única que tiene: ya viene elegida.
  const sugerida = opciones.find((o) => o.apartada) ?? (opciones.length === 1 ? opciones[0] : null);
  const [valor, setValor] = useState(inicial ? clave(inicial) : sugerida ? clave(sugerida) : '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const o = opciones.find((x) => clave(x) === valor);
    if (!o) { setError('Elige la unidad que va.'); return; }
    setOcupado(true);
    setError(null);
    const r = await fetch(`/api/proxy/aliado/servicios/${encodeURIComponent(quoteNumber)}/unidad`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: o.productId, indice: o.indice }),
    }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setOcupado(false);
    if (!r?.ok) { setError(b?.message ?? 'No se pudo guardar. Inténtalo otra vez.'); return; }
    setUnidad(b.unidad);
    setEditando(false);
    avisar('Listo: MAQSER24 ya sabe qué unidad va.');
    router.refresh();
  }

  const caja: React.CSSProperties = { marginTop: 14, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', display: 'grid', gap: 10 };

  if (!editando && unidad) {
    return (
      <div style={caja}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Va la unidad: </span>
            <strong>{unidad.texto}</strong>
            {unidad.equipo ? <span style={{ color: 'var(--color-text-muted)' }}> · {unidad.equipo}</span> : null}
          </div>
          {opciones.some((o) => clave(o) !== clave(unidad)) ? <button type="button" className="ms-link" onClick={() => setEditando(true)} style={{ fontSize: 13.5 }}>Cambiar</button> : null}
        </div>
      </div>
    );
  }

  // Sin unidades identificadas en esa línea: se le dice dónde ponerlas.
  if (!opciones.length) {
    return (
      <div style={caja}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>¿Qué unidad va?</div>
        <p className="ms-hint" style={{ margin: 0 }}>
          Las obras suelen pedir las placas para dejar entrar. Ponle a tus unidades su número económico o sus placas y aquí eliges cuál va.
        </p>
        <Link href="/aliado?v=equipos" className="ms-link" style={{ fontSize: 13.5 }}>
          <Icon name="truck" size={15} />Ir a mis equipos
        </Link>
      </div>
    );
  }

  return (
    <div style={caja}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>¿Qué unidad va?</div>
      <p className="ms-hint" style={{ margin: 0 }}>Las obras suelen pedir las placas para dejar entrar: MAQSER24 se las pasa a la obra.</p>
      <ShSelectCampo
        id={`unidad-${quoteNumber}`}
        aria-label="Unidad que va"
        value={valor}
        onChange={(v) => { setValor(v); setError(null); }}
        placeholder="Elige la unidad"
        options={opciones.map((o) => ({ value: clave(o), label: `${o.texto} · ${o.equipo}` }))}
      />
      {error ? <span className="ms-hint" role="alert" style={{ color: 'var(--color-error)' }}>{error}</span> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ms-btn" disabled={ocupado || !valor} onClick={() => void guardar()}>
          <Icon name="check" size={16} />{ocupado ? 'Guardando…' : 'Esa va'}
        </button>
        {unidad ? <button type="button" className="ms-btn ms-btn-sec" onClick={() => { setEditando(false); setValor(clave(unidad)); }}>Cancelar</button> : null}
      </div>
    </div>
  );
}
