'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MODULOS_META, ROLES_ADMIN, modulosDe, type ModuloAdmin, type RolAdmin } from '@maqserv/config';
import { mostrarResultado } from '@maqserv/ui';
import { Modal } from '@/components/Modal';
import { Btn, FormField, Note } from '@/components/ui';

const ROLES = Object.values(ROLES_ADMIN);

/**
 * INVITAR AL PANEL (2026-10-28, decisión del dueño). Solo lo necesario: nombre,
 * correo y rol. La contraseña ya no se captura aquí: le llega un correo con un
 * enlace para crearla, y con ella entra. `permisos` trae lo que cada rol ve HOY
 * (la pestaña Permisos lo puede cambiar), para que se lea al elegir.
 */
export function AdminCreate({ soyPrincipal, permisos }: { soyPrincipal: boolean; permisos?: Record<string, string[]> }) {
  const router = useRouter();
  const roles = soyPrincipal ? ROLES : ROLES.filter((r) => r.clave !== 'direccion');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<RolAdmin>('operaciones');

  const modulosDel = (clave: RolAdmin): string[] => {
    if (clave === 'direccion') return [];
    const lista = (permisos?.[clave] ?? [...modulosDe(clave)]) as ModuloAdmin[];
    return lista.map((m) => MODULOS_META[m]?.nombre ?? m);
  };

  function cerrar() {
    setOpen(false);
    setError(null);
  }

  async function mandar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre.trim(), email: correo.trim(), rol }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.message === 'string' ? body.message : 'No se pudo mandar la invitación.');
      mostrarResultado(`Invitación mandada a ${correo.trim()}. Le llega un correo para crear su contraseña.`);
      setNombre(''); setCorreo(''); setRol('operaciones');
      cerrar();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mandar la invitación.');
    } finally {
      setBusy(false);
    }
  }

  const listo = nombre.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

  return (
    <>
      <Btn variant="primary" icon="ph-user-plus" onClick={() => setOpen(true)}>Invitar al panel</Btn>
      {open ? (
        <Modal
          abierto
          titulo="Invitar al panel"
          subtitulo="Le llega un correo con un enlace para crear su contraseña; con ella entra."
          onCerrar={cerrar}
          ancho={560}
          pie={
            <>
              <Btn variant="ghost" onClick={cerrar} disabled={busy}>Cancelar</Btn>
              <Btn variant="primary" icon="ph-paper-plane-tilt" onClick={() => void mandar()} disabled={busy || !listo}>{busy ? 'Mandando…' : 'Mandar invitación'}</Btn>
            </>
          }
        >
          <style>{`
            .ai-rol { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 12px; border: 1px solid var(--adm-border); border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
            .ai-rol:hover { border-color: var(--adm-border-strong); }
            .ai-rol[aria-checked="true"] { border-color: var(--adm-accent); background: color-mix(in srgb, var(--adm-accent) 8%, transparent); }
            .ai-rol .pt { flex: 0 0 auto; width: 16px; height: 16px; margin-top: 2px; border-radius: 50%; border: 2px solid var(--adm-border-strong); }
            .ai-rol[aria-checked="true"] .pt { border-color: var(--adm-accent); background: radial-gradient(circle, var(--adm-accent) 45%, transparent 50%); }
            .ai-rol .n { font-size: 14px; font-weight: 600; color: var(--adm-text); }
            .ai-rol .v { font-size: 12.5px; color: var(--adm-muted); line-height: 1.45; margin-top: 2px; }
          `}</style>
          {error ? <div role="alert" style={{ marginBottom: 14 }}><Note tone="bad">{error}</Note></div> : null}
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="adm-form-grid">
              <FormField label="Nombre">
                <input className="adm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" autoFocus maxLength={100} />
              </FormField>
              <FormField label="Correo">
                <input className="adm-input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@empresa.com" maxLength={190} />
              </FormField>
            </div>
            <FormField label="Rol" help="Decide qué secciones verá. Se cambia después desde la lista.">
              <div role="radiogroup" aria-label="Rol" style={{ display: 'grid', gap: 8 }}>
                {roles.map((r) => {
                  const ve = modulosDel(r.clave);
                  return (
                    <button key={r.clave} type="button" role="radio" aria-checked={rol === r.clave} className="ai-rol" onClick={() => setRol(r.clave)}>
                      <span className="pt" aria-hidden />
                      <span style={{ minWidth: 0 }}>
                        <span className="n">{r.nombre}</span>
                        <span className="v" style={{ display: 'block' }}>{r.clave === 'direccion' ? 'Ve todo el panel; da de alta cuentas y cambia tarifas y permisos.' : `Ve: ${ve.join(', ')}.`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </FormField>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
