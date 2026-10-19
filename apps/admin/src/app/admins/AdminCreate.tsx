'use client';

import { Modal } from '@/components/Modal';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTRASENA_MAX, MODULOS_META, REGLAS_CONTRASENA, ROLES_ADMIN, contrasenaSegura, modulosDe, type ContextoContrasena, type ModuloAdmin, type RolAdmin } from '@maqserv/config';
import { Btn, Chip } from '@/components/ui';
import { ReglasContrasena } from '@/components/ReglasContrasena';
import { mostrarResultado } from '@maqserv/ui';

// Del más estrecho al más amplio: el primero que se lee es el que menos abre.
const ROLES = [ROLES_ADMIN.administracion, ROLES_ADMIN.operaciones, ROLES_ADMIN.direccion];

/* Sin caracteres que se confunden al dictarla (O/0, l/1/I). */
const JUEGOS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#$*@%?'];

function azar(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/** 14 caracteres con uno de cada tipo, barajados, hasta que pase todas las reglas. */
function generarClave(ctx: ContextoContrasena): string {
  const todos = JUEGOS.join('');
  let p = '';
  for (let intento = 0; intento < 100; intento++) {
    const c = JUEGOS.map((j) => j[azar(j.length)]);
    while (c.length < 14) c.push(todos[azar(todos.length)]);
    for (let i = c.length - 1; i > 0; i--) {
      const j = azar(i + 1);
      [c[i], c[j]] = [c[j], c[i]];
    }
    p = c.join('');
    if (contrasenaSegura(p, ctx)) break;
  }
  return p;
}

/*
 * REDISEÑO (2026-10-15). Antes eran cuatro campos en una rejilla de tres
 * columnas: la lista de reglas estiraba la de Contraseña y dejaba un hueco
 * enorme bajo Nombre y Correo, y el Rol quedaba suelto abajo, lejos de su
 * explicación. Ahora son dos bloques —quién entra y qué ve— y el rol se elige
 * en tarjetas que ya traen la explicación: con tres roles, un desplegable
 * escondía justo lo que hay que leer antes de decidir.
 */
const CSS = `
.ad-bloque + .ad-bloque { border-top: 1px solid var(--adm-border); margin-top: 22px; padding-top: 20px; }
.ad-sec { margin: 0 0 14px; font-family: inherit; font-size: 11px; font-weight: 600; color: var(--adm-faint); text-transform: uppercase; letter-spacing: .08em; }
.ad-sec + .adm-help { margin: -8px 0 14px; }
.ad-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.ad-link { display: inline-flex; align-items: center; gap: 5px; border: 0; background: none; padding: 0; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--adm-accent); cursor: pointer; }
.ad-link:hover { text-decoration: underline; }
.ad-pass { position: relative; }
.ad-pass .adm-input { padding-right: 74px; }
.ad-pass-acc { position: absolute; top: 3px; right: 3px; display: flex; gap: 2px; }
.ad-roles { display: grid; gap: 8px; }
.ad-rol { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--adm-border-strong); border-radius: var(--adm-radius-sm); cursor: pointer; transition: border-color .15s ease, background .15s ease; }
.ad-rol:hover { background: rgba(255, 255, 255, 0.025); }
.ad-rol.is-on { border-color: color-mix(in srgb, var(--adm-accent) 55%, transparent); background: color-mix(in srgb, var(--adm-accent) 7%, transparent); }
.ad-rol:has(input:focus-visible) { outline: 2px solid var(--adm-accent); outline-offset: 2px; }
.ad-rol input { width: 16px; height: 16px; margin: 2px 0 0; flex-shrink: 0; accent-color: var(--adm-accent); cursor: pointer; }
.ad-rol-nombre { display: block; font-size: 14px; font-weight: 600; color: var(--adm-text); }
.ad-rol-desc { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.5; color: var(--adm-muted); }
.ad-rol-mods { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.ad-rol-mods > span:first-child { font-size: 12px; color: var(--adm-faint); margin-right: 2px; }
.adm-input.ad-bad, .adm-input.ad-bad:focus { border-color: color-mix(in srgb, var(--adm-bad) 70%, transparent); background: color-mix(in srgb, var(--adm-bad) 6%, transparent); }
.ad-err { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 500; line-height: 1.45; color: var(--adm-bad); }
.ad-err i { font-size: 15px; margin-top: 1px; flex-shrink: 0; }
.ad-pie-err { margin-right: auto; align-self: center; }
`;

type Campo = 'password' | 'email';

/** ¿A qué campo pertenece un rechazo de la API? (los textos los escribe la API: "La contraseña…", "…con ese correo"). */
function campoDelError(msg: string): Campo | null {
  if (/contraseña/i.test(msg)) return 'password';
  if (/correo/i.test(msg)) return 'email';
  return null;
}

/**
 * Alta de administrador: crea la fila con su contraseña (hash bcrypt); con eso ya puede entrar.
 * `permisos` trae lo que cada rol ve HOY (Administradores → Permisos lo puede
 * reajustar); si no llega, se muestra el reparto de fábrica.
 */
export function AdminCreate({ soyPrincipal, permisos }: { soyPrincipal: boolean; permisos?: Record<string, string[]> }) {
  // Dirección General solo la reparte la cuenta principal (la API también lo exige).
  const roles = soyPrincipal ? ROLES : ROLES.filter((r) => r.clave !== 'direccion');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // Controlado para explicar, en la tarjeta elegida, qué secciones verá.
  const [rol, setRol] = useState<RolAdmin>('operaciones');
  // Controlados para palomear la lista de requisitos mientras se escribe.
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [copiada, setCopiada] = useState(false);
  /*
   * DÓNDE SE AVISA UN RECHAZO. El error salía al final del formulario, que
   * hace scroll dentro del modal: quedaba fuera de la vista y parecía que el
   * botón no hacía nada. Ahora cada aviso va donde está el problema —bajo el
   * campo, que además recibe el foco (y con él, el scroll)— y lo que no es de
   * un campo, en el pie fijo, junto al botón que se acaba de pulsar.
   */
  const [intento, setIntento] = useState(false);
  const [errorCampo, setErrorCampo] = useState<{ campo: Campo; texto: string } | null>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const correoRef = useRef<HTMLInputElement>(null);

  const ctx = { nombre, correo };
  const faltan = REGLAS_CONTRASENA.filter((r) => !r.ok(clave, ctx)).length;
  const claveMala = (intento && !contrasenaSegura(clave, ctx)) || errorCampo?.campo === 'password';
  const correoMalo = errorCampo?.campo === 'email';

  function marcarCampo(campo: Campo, texto: string) {
    setErrorCampo({ campo, texto });
    (campo === 'password' ? passRef : correoRef).current?.focus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrorCampo(null);
    // La misma regla que aplica la API: si no pasa, ni se envía.
    if (!contrasenaSegura(clave, ctx)) {
      setIntento(true);
      passRef.current?.focus();
      return;
    }
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
      setNombre(''); setCorreo(''); setClave(''); setVer(false); setIntento(false);
      setOpen(false);
      mostrarResultado(`Administrador creado: ${email} ya puede entrar al panel`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear';
      const campo = campoDelError(msg);
      if (campo) marcarCampo(campo, msg);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const cerrar = () => { setOpen(false); setError(null); setErrorCampo(null); setIntento(false); setVer(false); };

  // Generada se deja a la vista: hay que dictarla o copiarla para dársela.
  function generar() {
    setClave(generarClave(ctx));
    setVer(true);
    if (errorCampo?.campo === 'password') setErrorCampo(null);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 1600);
    } catch {
      /* sin permiso de portapapeles: queda seleccionarla a mano */
    }
  }

  function seccionesDe(clave: RolAdmin): string[] | null {
    if (ROLES_ADMIN[clave].modulos === null) return null;
    return permisos?.[clave] ?? [...modulosDe(clave)];
  }

  return (
    <>
      <Btn variant="primary" icon="ph-plus" onClick={() => setOpen(true)}>
        Nuevo administrador
      </Btn>

      {/* Alta en modal (2026-09-25): antes se abría encima de la lista. */}
      <Modal
        abierto={open}
        titulo="Nuevo administrador"
        subtitulo="Podrá entrar al panel en cuanto lo crees. La contraseña no se manda por correo: dísela tú por un canal seguro."
        onCerrar={cerrar}
        ancho={640}
        pie={
          <>
            {/* En el pie (fijo): se ve siempre, junto al botón que se pulsó. */}
            {error ? (
              <p role="alert" className="ad-err ad-pie-err">
                <i className="ph ph-warning-circle" aria-hidden />{error}
              </p>
            ) : null}
            <Btn variant="ghost" onClick={cerrar}>Cancelar</Btn>
            {/* Fuera del <form> (va en el pie fijo del modal): `form` lo sigue enviando. */}
            <Btn variant="primary" type="submit" form="ad-form" disabled={busy}>
              {busy ? 'Creando…' : 'Crear administrador'}
            </Btn>
          </>
        }
      >
        <style>{CSS}</style>
        {/*
          `autoComplete="off"` + nombres no estándar: sin esto el navegador rellenaba
          este formulario con las credenciales del admin que ya está dentro (se veía en
          la pantalla: el correo de la sesión activa dentro del alta de otra cuenta).
        */}
        <form id="ad-form" onSubmit={onSubmit} autoComplete="off">
          <section className="ad-bloque">
            <h3 className="ad-sec">Datos de acceso</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              {/* `start`: el aviso bajo Correo no debe estirar (y bajar) el campo de al lado. */}
              <div className="adm-form-grid" style={{ alignItems: 'start' }}>
                <div className="adm-field">
                  <label className="adm-label" htmlFor="ad-name">Nombre</label>
                  <input id="ad-name" name="name" className="adm-input" data-campo="nombre" required minLength={2} maxLength={100} autoComplete="off" placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="adm-field">
                  <label className="adm-label" htmlFor="ad-email">Correo</label>
                  <input
                    ref={correoRef}
                    id="ad-email"
                    name="email"
                    type="email"
                    className={`adm-input${correoMalo ? ' ad-bad' : ''}`}
                    required
                    autoComplete="off"
                    placeholder="nombre@empresa.com"
                    value={correo}
                    onChange={(e) => { setCorreo(e.target.value); if (correoMalo) setErrorCampo(null); }}
                    aria-invalid={correoMalo || undefined}
                    aria-describedby={correoMalo ? 'ad-email-err' : undefined}
                  />
                  {correoMalo ? (
                    <p id="ad-email-err" role="alert" className="ad-err">
                      <i className="ph ph-warning-circle" aria-hidden />{errorCampo?.texto}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="adm-field">
                <div className="ad-label-row">
                  <label className="adm-label" htmlFor="ad-pass">Contraseña</label>
                  <button type="button" className="ad-link" onClick={generar}>
                    <i className="ph ph-sparkle" aria-hidden />Generar una segura
                  </button>
                </div>
                <div className="ad-pass">
                  <input
                    ref={passRef}
                    id="ad-pass"
                    name="password"
                    type={ver ? 'text' : 'password'}
                    className={`adm-input${claveMala ? ' ad-bad' : ''}`}
                    required
                    maxLength={CONTRASENA_MAX}
                    autoComplete="new-password"
                    placeholder="Mínimo 10 caracteres"
                    value={clave}
                    onChange={(e) => { setClave(e.target.value); if (errorCampo?.campo === 'password') setErrorCampo(null); }}
                    spellCheck={false}
                    aria-invalid={claveMala || undefined}
                    aria-describedby={claveMala ? 'ad-pass-err' : undefined}
                  />
                  <div className="ad-pass-acc">
                    {clave ? (
                      <button type="button" className="adm-ibtn is-plain" onClick={() => void copiar()} aria-label="Copiar contraseña" title={copiada ? 'Copiada' : 'Copiar'}>
                        <i className={`ph ${copiada ? 'ph-check' : 'ph-copy'}`} aria-hidden />
                      </button>
                    ) : null}
                    <button type="button" className="adm-ibtn is-plain" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver} title={ver ? 'Ocultar' : 'Mostrar'}>
                      <i className={`ph ${ver ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden />
                    </button>
                  </div>
                </div>
                {claveMala ? (
                  <p id="ad-pass-err" role="alert" className="ad-err" style={{ marginTop: 2 }}>
                    <i className="ph ph-warning-circle" aria-hidden />
                    {errorCampo?.campo === 'password'
                      ? errorCampo.texto
                      : `No se puede crear con esta contraseña: le falta${faltan === 1 ? '' : 'n'} ${faltan} requisito${faltan === 1 ? '' : 's'} (en rojo abajo).`}
                  </p>
                ) : null}
                <ReglasContrasena password={clave} nombre={nombre} correo={correo} marcar={intento} />
              </div>
            </div>
          </section>

          <section className="ad-bloque">
            <h3 className="ad-sec" id="ad-rol">Rol</h3>
            <p className="adm-help">
              Decide qué secciones verá. Si dudas, elige el más estrecho: ampliarlo después toma un clic; enterarse de que sobraba, no.
            </p>
            <div className="ad-roles" role="radiogroup" aria-labelledby="ad-rol">
              {roles.map((r) => {
                const activo = r.clave === rol;
                const secciones = activo ? seccionesDe(r.clave) : null;
                return (
                  <label key={r.clave} className={`ad-rol${activo ? ' is-on' : ''}`}>
                    <input type="radio" name="rol" value={r.clave} checked={activo} onChange={() => setRol(r.clave)} />
                    <span style={{ minWidth: 0 }}>
                      <span className="ad-rol-nombre">{r.nombre}</span>
                      <span className="ad-rol-desc">{r.descripcion}</span>
                      {activo ? (
                        <span className="ad-rol-mods">
                          <span>Verá:</span>
                          {secciones === null ? (
                            <Chip tone="accent">Todo el panel</Chip>
                          ) : (
                            secciones.map((m) => <Chip key={m}>{MODULOS_META[m as ModuloAdmin]?.nombre ?? m}</Chip>)
                          )}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </form>
      </Modal>
    </>
  );
}
