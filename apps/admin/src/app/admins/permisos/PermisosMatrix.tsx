'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

export interface ModuloFila {
  clave: string;
  nombre: string;
  detalle: string;
  obligatorio: boolean;
}
export interface RolFila {
  clave: string;
  nombre: string;
  descripcion: string;
  modulos: string[];
  fijo: boolean;
  personalizado: boolean;
}

/**
 * Reparto de permisos: una tarjeta por rol con sus módulos en casillas.
 *
 * Tarjetas y no una tabla rol × módulo: son 5 × 16 casillas, y en una tabla de
 * 16 renglones con 5 columnas hay que contar con el dedo para saber qué se está
 * marcando. Aquí cada equipo se lee y se guarda por separado, que además es
 * como se decide (se habla de "lo que ve Operaciones", no de "quién ve pagos").
 *
 * Se guarda por rol y sólo cuando hay cambios: el botón está apagado mientras
 * la lista sea la misma con la que se abrió la pantalla.
 */
export function PermisosMatrix({ modulos, roles }: { modulos: ModuloFila[]; roles: RolFila[] }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {roles.map((rol) => (
        <TarjetaRol key={rol.clave} rol={rol} modulos={modulos} />
      ))}
    </div>
  );
}

function TarjetaRol({ rol, modulos }: { rol: RolFila; modulos: ModuloFila[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(rol.modulos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const original = rol.modulos;
  const sucio = sel.length !== original.length || sel.some((m) => !original.includes(m));

  function alternar(clave: string, obligatorio: boolean) {
    if (obligatorio) return;
    setOk(false);
    setSel((prev) => (prev.includes(clave) ? prev.filter((m) => m !== clave) : [...prev, clave]));
  }

  async function guardar() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/roles/${rol.clave}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulos: sel }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(typeof d?.message === 'string' ? d.message : 'No se pudo guardar');
      return;
    }
    setOk(true);
    router.refresh();
  }

  async function restablecer() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/roles/${rol.clave}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { setError('No se pudo restablecer'); return; }
    const d = await res.json().catch(() => null);
    if (Array.isArray(d?.modulos)) setSel(d.modulos as string[]);
    setOk(true);
    router.refresh();
  }

  return (
    <section
      style={{
        background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 16,
        padding: 18, opacity: rol.fijo ? 0.72 : 1,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text }}>{rol.nombre}</h2>
            {rol.fijo ? <Etiqueta texto="Ve todo el panel" /> : null}
            {rol.personalizado ? <Etiqueta texto="Personalizado" acento /> : null}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: '#8A8A8F', lineHeight: 1.5 }}>{rol.descripcion}</p>
        </div>
        <span style={{ fontSize: 12, color: '#7A7A7F', whiteSpace: 'nowrap' }}>
          {rol.fijo ? `${modulos.length} de ${modulos.length}` : `${sel.length} de ${modulos.length}`} módulos
        </span>
      </header>

      {rol.fijo ? (
        <p style={{ margin: '14px 0 0', fontSize: 12.5, color: '#7A7A7F', lineHeight: 1.6 }}>
          Dirección no se restringe a propósito: si se le pudiera quitar el módulo de cuentas,
          un clic dejaría el panel sin nadie capaz de volver a repartir permisos.
        </p>
      ) : (
        <>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
              gap: 8, marginTop: 14,
            }}
          >
            {modulos.map((m) => {
              const marcado = sel.includes(m.clave) || m.obligatorio;
              return (
                <label
                  key={m.clave}
                  title={m.detalle}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    borderRadius: 11, cursor: m.obligatorio ? 'default' : 'pointer',
                    border: `1px solid ${marcado ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : D.inputBorder}`,
                    background: marcado ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                    opacity: m.obligatorio ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={m.obligatorio || busy}
                    onChange={() => alternar(m.clave, m.obligatorio)}
                    style={{ marginTop: 2, accentColor: 'var(--color-primary)', width: 15, height: 15 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: D.text }}>{m.nombre}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#7A7A7F', lineHeight: 1.45 }}>{m.detalle}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <footer style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={guardar}
              disabled={!sucio || busy}
              style={{
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, borderRadius: 10, padding: '9px 16px',
                border: 'none', cursor: sucio && !busy ? 'pointer' : 'default',
                background: sucio ? D.accent : 'rgba(255,255,255,0.06)',
                color: sucio ? D.accentInk : '#7A7A7F',
              }}
            >
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {sucio ? (
              <button
                type="button"
                onClick={() => { setSel(original); setOk(false); }}
                disabled={busy}
                style={ghost}
              >
                Descartar
              </button>
            ) : null}
            {rol.personalizado ? (
              <button type="button" onClick={restablecer} disabled={busy} style={ghost}>
                Volver a los de fábrica
              </button>
            ) : null}
            {error ? <span style={{ fontSize: 12.5, color: '#f55' }}>{error}</span> : null}
            {ok && !sucio ? <span style={{ fontSize: 12.5, color: '#3fbf8f' }}>Guardado</span> : null}
          </footer>
        </>
      )}
    </section>
  );
}

const ghost: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: 'transparent',
  color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
};

function Etiqueta({ texto, acento = false }: { texto: string; acento?: boolean }) {
  return (
    <span
      style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: 999,
        color: acento ? 'var(--color-primary)' : '#8A8A8F',
        border: `1px solid ${acento ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : D.inputBorder}`,
      }}
    >
      {texto}
    </span>
  );
}
