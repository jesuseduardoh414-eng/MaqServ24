'use client';

import { Modal } from '@/components/Modal';
import { useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { ROLES_ADMIN, modulosDe, type RolAdmin } from '@maqserv/config';
import { Btn, Chip, Note, StatusText } from '@/components/ui';
import { ReglasContrasena } from '@/components/ReglasContrasena';

const ROLES = Object.values(ROLES_ADMIN);

/** Alta de administrador: crea la fila con su contraseña (hash bcrypt); con eso ya puede entrar. */
export function AdminCreate({ soyPrincipal }: { soyPrincipal: boolean }) {
  // Dirección General solo la reparte la cuenta principal (la API también lo exige).
  const roles = soyPrincipal ? ROLES : ROLES.filter((r) => r.clave !== 'direccion');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // Controlado para poder explicar, debajo, qué implica el rol elegido.
  const [rol, setRol] = useState<RolAdmin>('operaciones');
  // Controlados para palomear la lista de requisitos mientras se escribe.
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '');
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          email,
          password: String(data.get('password') ?? ''),
          rol,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.message === 'string' ? body.message : 'No se pudo crear');
      form.reset();
      setNombre(''); setCorreo(''); setClave('');
      setOpen(false);
      setOk(`${email} ya puede entrar al panel.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  const cerrar = () => { setOpen(false); setError(null); };

  return (
    <>
      {ok ? (
        <span role="status">
          <StatusText tone="ok">{ok}</StatusText>
        </span>
      ) : null}
      <Btn variant="primary" icon="ph-plus" onClick={() => { setOpen(true); setOk(null); }}>
        Nuevo administrador
      </Btn>

      {/* Alta en modal (2026-09-25): antes se abría encima de la lista. */}
      <Modal
        abierto={open}
        titulo="Nuevo administrador"
        subtitulo="Elige el rol con cuidado: decide qué secciones verá. Dile la contraseña por un canal seguro: no se la mandamos por correo."
        onCerrar={cerrar}
        ancho={720}
        pie={
          <>
            <Btn variant="ghost" onClick={cerrar}>Cancelar</Btn>
            {/* Fuera del <form> (va en el pie fijo del modal): `form` lo sigue enviando. */}
            <Btn variant="primary" type="submit" form="ad-form" disabled={busy}>
              {busy ? 'Creando…' : 'Crear administrador'}
            </Btn>
          </>
        }
      >
        {/*
          `autoComplete="off"` + nombres no estándar: sin esto el navegador rellenaba
          este formulario con las credenciales del admin que ya está dentro (se veía en
          la pantalla: el correo de la sesión activa dentro del alta de otra cuenta).
        */}
        <form id="ad-form" onSubmit={onSubmit} autoComplete="off" style={{ display: 'grid', gap: 16 }}>
          <div className="adm-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', alignItems: 'start' }}>
            <div className="adm-field">
              <label className="adm-label" htmlFor="ad-name">Nombre</label>
              <input id="ad-name" name="name" className="adm-input" required minLength={2} maxLength={100} autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="ad-email">Correo</label>
              <input id="ad-email" name="email" type="email" className="adm-input" required autoComplete="off" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="ad-pass">Contraseña</label>
              <input id="ad-pass" name="password" type="password" className="adm-input" required autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
              <ReglasContrasena password={clave} nombre={nombre} correo={correo} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="ad-rol">Rol</label>
              <AdminSelect
                id="ad-rol"
                name="rol"
                ariaLabel="Rol"
                value={rol}
                onChange={(v) => setRol(v as RolAdmin)}
                options={roles.map((r) => ({ value: r.clave, label: r.nombre }))}
              />
            </div>
          </div>

          {/* Qué implica el rol elegido, en la misma pantalla donde se elige. */}
          <Note icon="ph-user-gear">
            <div>{ROLES_ADMIN[rol].descripcion}</div>
            <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {modulosDe(rol).map((m) => (
                <Chip key={m}>{m}</Chip>
              ))}
            </div>
          </Note>

          <p className="adm-help" style={{ margin: 0 }}>
            Dirección General es el único rol que administra cuentas y permisos. Si dudas, elige el más
            estrecho: ampliar un rol después toma un clic; enterarse de que sobraba, no.
          </p>

          {error ? (
            <div role="alert">
              <Note tone="bad">{error}</Note>
            </div>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
