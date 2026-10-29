'use client';

import { useEffect, useState } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { Btn } from '@/components/ui';

/**
 * MARGEN DE MAQSER24 SOBRE EL COSTO DEL ALIADO, SOLO PRODUCTOS (2026-09-25).
 *
 * Para lo que se vende a precio fijo: el precio al cliente se propone como lo
 * que cobra el aliado más este porcentaje. Los servicios no lo usan (se
 * cotizan con el tabulador). Vivía en Tarifas y condiciones; desde el
 * 2026-10-28 está aquí, en Inventario, que es donde se usa, y solo aparece si
 * hay alguna categoría de productos. Se guarda en `platform_settings`.
 */
export function MargenProductos() {
  const [margen, setMargen] = useState('');
  const [guardado, setGuardado] = useState('');
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'guardando' | 'error'>('cargando');
  useEffect(() => {
    void fetch('/api/admin/catalog/ajustes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.margenPct === 'number') { setMargen(String(d.margenPct)); setGuardado(String(d.margenPct)); setEstado('listo'); }
        else setEstado('error');
      })
      .catch(() => setEstado('error'));
  }, []);
  async function guardar() {
    setEstado('guardando');
    const r = await fetch('/api/admin/catalog/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ margenPct: Number(margen) }) });
    setEstado(r.ok ? 'listo' : 'error');
    if (r.ok) { setGuardado(margen); mostrarResultado(`Margen de productos: ${margen} %.`, 'ok'); }
    else mostrarResultado('No se pudo guardar el margen.', 'bad');
  }
  if (estado === 'error') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', border: '1px solid var(--adm-border)', borderRadius: 10, marginBottom: 24 }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>Margen sobre el costo del aliado</div>
        <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>Solo productos a precio fijo: al darles precio se propone lo que cobra el aliado más este porcentaje. Los equipos se cotizan con Tarifas.</div>
      </div>
      <div style={{ position: 'relative', width: 110 }}>
        <input className="adm-input adm-num" style={{ paddingRight: 28, height: 34 }} type="number" min={0} max={300} step="1" value={margen} disabled={estado === 'cargando'} onChange={(e) => setMargen(e.target.value)} aria-label="Margen en porcentaje" />
        <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-muted)', fontSize: 13, pointerEvents: 'none' }}>%</span>
      </div>
      <Btn size="sm" onClick={() => void guardar()} disabled={estado !== 'listo' || margen === '' || margen === guardado}>
        {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
      </Btn>
    </div>
  );
}
