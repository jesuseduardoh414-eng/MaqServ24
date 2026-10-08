'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Chip, StatusText } from '@/components/ui';

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
 *
 * Estilo del kit (2026-10-08): las tarjetas se quedan —cada una es un
 * formulario con su propio Guardar—, pero planas (`adm-card`), y las casillas
 * marcadas con un velo del acento en lugar de un bloque de color.
 */
export function PermisosMatrix({ modulos, roles }: { modulos: ModuloFila[]; roles: RolFila[] }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <style>{`
        .pm-mod { border: 1px solid var(--adm-border-strong); background: transparent; transition: border-color .15s ease, background .15s ease; }
        .pm-mod.is-on { border-color: color-mix(in srgb, var(--adm-accent) 40%, transparent); background: color-mix(in srgb, var(--adm-accent) 8%, transparent); }
        .pm-mod:not(.is-on):hover { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.02); }
      `}</style>
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
    <section className="adm-card" style={{ opacity: rol.fijo ? 0.72 : 1 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 className="adm-h2">{rol.nombre}</h2>
            {rol.fijo ? <Chip tone="muted">Ve todo el panel</Chip> : null}
            {rol.personalizado ? <Chip tone="accent">Personalizado</Chip> : null}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>{rol.descripcion}</p>
        </div>
        <span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-muted)', whiteSpace: 'nowrap' }}>
          {rol.fijo ? `${modulos.length} de ${modulos.length}` : `${sel.length} de ${modulos.length}`} módulos
        </span>
      </header>

      {rol.fijo ? (
        <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.6 }}>
          Dirección no se restringe a propósito: si se le pudiera quitar el módulo de cuentas,
          un clic dejaría el panel sin nadie capaz de volver a repartir permisos.
        </p>
      ) : (
        <>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(232px, 100%), 1fr))',
              gap: 8, marginTop: 16,
            }}
          >
            {modulos.map((m) => {
              const marcado = sel.includes(m.clave) || m.obligatorio;
              return (
                <label
                  key={m.clave}
                  title={m.detalle}
                  className={`pm-mod${marcado ? ' is-on' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    borderRadius: 8, cursor: m.obligatorio ? 'default' : 'pointer',
                    opacity: m.obligatorio ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={m.obligatorio || busy}
                    onChange={() => alternar(m.clave, m.obligatorio)}
                    style={{ marginTop: 2, accentColor: 'var(--adm-accent)', width: 15, height: 15, flexShrink: 0 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>{m.nombre}</span>
                    <span style={{ display: 'block', marginTop: 1, fontSize: 12, color: 'var(--adm-muted)', lineHeight: 1.45 }}>{m.detalle}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <footer style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {/* Solo se ve como acción principal cuando hay algo que guardar. */}
            <Btn size="sm" variant={sucio ? 'primary' : 'secondary'} onClick={guardar} disabled={!sucio || busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
            {sucio ? (
              <Btn size="sm" variant="ghost" onClick={() => { setSel(original); setOk(false); }} disabled={busy}>
                Descartar
              </Btn>
            ) : null}
            {rol.personalizado ? (
              <Btn size="sm" variant="ghost" icon="ph-arrow-counter-clockwise" onClick={restablecer} disabled={busy}>
                Volver a los de fábrica
              </Btn>
            ) : null}
            {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)' }}>{error}</span> : null}
            {ok && !sucio ? <span role="status"><StatusText tone="ok">Guardado</StatusText></span> : null}
          </footer>
        </>
      )}
    </section>
  );
}
