'use client';

import Link from '@/components/Enlace';
import { ShSelectCampo } from '@maqserv/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { TIPOS_PROVEEDOR, centroDeMunicipio, problemaEmail, problemaNombre, problemaTelefono, radioDeCobertura, type LineaRegistro, type TipoProveedor } from '@maqserv/config';
import { evento } from '@/lib/analitica';
import { Icon } from '@/components/Icon';

const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán',
  'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

/** En cuánto contesta: el panel lo guarda en minutos ("Responde en ~30 min"). */
const RESPUESTAS: Array<[string, string]> = [
  ['', 'Prefiero no decir'],
  ['15', 'En 15 minutos'],
  ['30', 'En media hora'],
  ['60', 'En una hora'],
  ['120', 'En dos horas'],
  ['480', 'El mismo día'],
];

// Mismas reglas que la API (@maqserv/config). Antes bastaban 10 dígitos en
// cualquier parte: "81-1234-5678 o casa" pasaba.
const correoOk = (v: string) => !problemaEmail(v);
const telefonoOk = (v: string) => !!v.trim() && !problemaTelefono(v);
const aLista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Hasta dónde llega, mientras escribe: la misma cuenta que hace el panel
 * (`radioDeCobertura`). Fuera de los tres estados de la tabla no hay cifra
 * aquí; se calcula al revisar el registro.
 */
function KmCalculados({ municipio, estado, cobertura }: { municipio: string; estado: string; cobertura: string }) {
  const lista = aLista(cobertura);
  if (!municipio.trim() || !lista.length) return null;
  const base = centroDeMunicipio(municipio, estado);
  const r = base ? radioDeCobertura(base, lista, estado) : null;
  let texto: ReactNode;
  if (r?.km) texto = <>Llegas hasta <b>~{r.km} km</b> de tu base · el más lejano es {r.masLejano}.</>;
  else texto = 'Calcularemos hasta cuántos kilómetros llegas al revisar tu registro.';
  return (
    <p className="ms-hint" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span style={{ display: 'flex', paddingTop: 1 }}><Icon name="mapPin" size={14} /></span>
      <span>{texto}</span>
    </p>
  );
}

/**
 * "Regístrate como proveedor" (2026-10-06). Mismas piezas que el formulario de
 * Contacto (`ms-field`, `ms-tab`…). Llega al panel como solicitud por revisar.
 *
 * Pide lo mismo que el alta del panel (2026-10-09): su dirección, su
 * municipio y los municipios a los que llega. Antes solo ciudad y estado, y al
 * aceptarlo había que volver a pedirle dónde estaba y hasta dónde llegaba.
 *
 * LO QUE OFRECE, LIBRE (2026-11-18, el dueño: «para el registro de los
 * proveedores, ahí sí pueden meter lo que sea, cualquier servicio, ya que eso
 * no va a ir en el sitio público»). Antes elegía las categorías de MAQSER24 y
 * sus tipos, y lo que no estaba en la lista quedaba «por clasificar». Ahora
 * escribe cada servicio o equipo en su renglón (con sugerencias de lo que
 * MAQSER24 maneja), cuántas unidades, marca o capacidad y, si quiere, cuánto
 * cobra. Nada de esto se publica: es la libreta del administrador, que lo busca
 * por zona o servicio y le escribe por WhatsApp.
 */

/** Un servicio o equipo que ofrece, escrito como quiera. */
interface Servicio { id: number; nombre: string; unidades: string; detalle: string; precio: string }

const renglonVacio = (): Servicio => ({ id: Date.now() + Math.random(), nombre: '', unidades: '1', detalle: '', precio: '' });

export function RegistroProveedorForm({ lineas, inicial }: {
  /** Lo que MAQSER24 maneja: solo para sugerir nombres mientras escribe. */
  lineas: LineaRegistro[];
  /** Lo que trae la invitación del panel (2026-10-27): ya escrito, se puede corregir. */
  inicial?: { nombre: string; contacto: string; correo: string; telefono: string };
}) {
  const [tipo, setTipo] = useState<TipoProveedor>('empresa');
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [contacto, setContacto] = useState(inicial?.contacto ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [correo, setCorreo] = useState(inicial?.correo ?? '');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('Nuevo León');
  const [municipios, setMunicipios] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [servicios, setServicios] = useState<Servicio[]>(() => [renglonVacio()]);
  const [mensaje, setMensaje] = useState('');
  const [sitio, setSitio] = useState(''); // trampa para bots
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  // Sugerencias: los tipos y las líneas que MAQSER24 ya maneja (se puede escribir cualquier otra cosa).
  const sugerencias = useMemo(() => {
    const s = new Set<string>();
    for (const l of lineas) {
      s.add(l.nombre);
      for (const t of l.tipos) s.add(t.nombre);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [lineas]);

  const empresa = tipo === 'empresa';
  const escritos = servicios.filter((s) => s.nombre.trim().length >= 2);
  const err = {
    nombre: tocado && nombre.trim().length < 2,
    telefono: tocado && !telefonoOk(telefono),
    contacto: tocado && empresa && !!problemaNombre(contacto),
    correo: tocado && correo.trim() !== '' && !correoOk(correo.trim()),
    ciudad: tocado && !ciudad.trim(),
    municipios: tocado && aLista(municipios).length === 0,
    servicios: tocado && escritos.length === 0,
  };

  const cambiar = (id: number, campo: keyof Servicio, v: string) => setServicios((l) => l.map((s) => (s.id === id ? { ...s, [campo]: v } : s)));
  const quitar = (id: number) => setServicios((l) => (l.length > 1 ? l.filter((s) => s.id !== id) : [renglonVacio()]));

  async function enviar() {
    setTocado(true);
    setErrorServidor(null);
    if (
      nombre.trim().length < 2 || !telefonoOk(telefono) || (correo.trim() && !correoOk(correo.trim())) ||
      (empresa && problemaNombre(contacto)) ||
      !ciudad.trim() || aLista(municipios).length === 0 || escritos.length === 0
    ) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nombre, contacto: empresa ? contacto : '', telefono, correo,
          direccion, ciudad, estado, municipios: aLista(municipios), respuesta: respuesta ? Number(respuesta) : null,
          servicios: escritos.map((s) => ({
            nombre: s.nombre.trim(), unidades: Number(s.unidades) || 1, detalle: s.detalle.trim(), precio: s.precio.trim(),
          })),
          mensaje, sitio,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(typeof d?.message === 'string' ? d.message : 'No se pudo enviar. Inténtalo de nuevo.');
      }
      setListo(true);
      evento('registro_proveedor', { tipo }); // solo el tipo, nunca los datos
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    } catch (e) {
      setErrorServidor((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="ms-empty" role="status">
        <span className="ms-ico ms-ico-lg" style={{ color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
          <Icon name="check" size={22} />
        </span>
        <h3 className="ms-empty-t">Registro enviado</h3>
        <p className="ms-empty-p">
          Gracias por tu interés en la red MAQSER24. Nuestro equipo revisará la información.
          {correo.trim()
            ? ' Si te aceptamos, te llega por correo el enlace a tu portal de aliado.'
            : ' Si te aceptamos, te contactamos por teléfono para darte acceso a tu portal de aliado.'}
        </p>
        <div className="ms-empty-acts">
          <Link href="/" className="ms-btn ms-btn-sec">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="ms-field">
        <span className="ms-label" id="rp-tipo">Te registras como<span className="ms-req">*</span></span>
        <div className="ms-tabs" role="radiogroup" aria-labelledby="rp-tipo">
          {TIPOS_PROVEEDOR.map((t) => (
            <button key={t.clave} type="button" role="radio" className="ms-tab" data-on={t.clave === tipo} aria-checked={t.clave === tipo} onClick={() => setTipo(t.clave)}>
              {t.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="ms-grid2">
        <div className="ms-field">
          <label htmlFor="rp-nombre" className="ms-label">{empresa ? 'Nombre de la empresa' : 'Tu nombre'}<span className="ms-req">*</span></label>
          <input id="rp-nombre" className="ms-input" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-invalid={err.nombre} autoComplete={empresa ? 'organization' : 'name'} />
          {err.nombre ? <p className="ms-error">{empresa ? 'Escribe el nombre de la empresa.' : 'Escribe tu nombre.'}</p> : null}
        </div>
        {empresa ? (
          <div className="ms-field">
            <label htmlFor="rp-contacto" className="ms-label">Persona de contacto</label>
            <input id="rp-contacto" className="ms-input" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Quién atenderá" autoComplete="name" maxLength={190} aria-invalid={err.contacto} />
            {err.contacto ? <p className="ms-error">{problemaNombre(contacto)}</p> : null}
          </div>
        ) : null}
        <div className="ms-field">
          <label htmlFor="rp-tel" className="ms-label">Teléfono o WhatsApp<span className="ms-req">*</span></label>
          <input id="rp-tel" type="tel" className="ms-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="81 1234 5678" aria-invalid={err.telefono} autoComplete="tel" inputMode="tel" maxLength={20} />
          {err.telefono ? <p className="ms-error">{problemaTelefono(telefono) ?? 'Escribe un teléfono de 10 dígitos.'}</p> : null}
        </div>
        <div className="ms-field">
          <label htmlFor="rp-correo" className="ms-label">Correo</label>
          <input id="rp-correo" type="email" className="ms-input" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" aria-invalid={err.correo} autoComplete="email" />
          {err.correo ? <p className="ms-error">{problemaEmail(correo)}</p> : <p className="ms-hint">Aquí te llega el enlace a tu portal si te aceptamos.</p>}
        </div>
        <div className="ms-field">
          <label htmlFor="rp-respuesta" className="ms-label">¿En cuánto contestas una solicitud?</label>
          <ShSelectCampo id="rp-respuesta" value={respuesta} onChange={setRespuesta} options={RESPUESTAS.map(([v, t]) => ({ value: v, label: t }))} />
        </div>
      </div>

      {/* Dónde está y hasta dónde llega: lo mismo que pide el alta del panel. */}
      <div style={{ display: 'grid', gap: 14 }}>
        <h3 className="ms-h3">Dónde estás y hasta dónde llegas</h3>
        <div className="ms-field">
          <label htmlFor="rp-direccion" className="ms-label">Dirección de tu base</label>
          <input id="rp-direccion" className="ms-input" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número y colonia" autoComplete="street-address" />
          <p className="ms-hint">Donde guardas tus equipos o sale tu personal. Con ella te ubicamos en el mapa.</p>
        </div>
        <div className="ms-grid2">
          <div className="ms-field">
            <label htmlFor="rp-ciudad" className="ms-label">Municipio<span className="ms-req">*</span></label>
            <input id="rp-ciudad" className="ms-input" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Monterrey" aria-invalid={err.ciudad} autoComplete="address-level2" />
            {err.ciudad ? <p className="ms-error">Escribe tu municipio.</p> : null}
          </div>
          <div className="ms-field">
            <label htmlFor="rp-estado" className="ms-label">Estado<span className="ms-req">*</span></label>
            <ShSelectCampo id="rp-estado" value={estado} onChange={setEstado} options={ESTADOS_MX.map((e) => ({ value: e, label: e }))} />
          </div>
        </div>
        <div className="ms-field">
          <label htmlFor="rp-municipios" className="ms-label">Municipios a los que llegas<span className="ms-req">*</span></label>
          <input id="rp-municipios" className="ms-input" value={municipios} onChange={(e) => setMunicipios(e.target.value)} placeholder="Apodaca, Escobedo, García" aria-invalid={err.municipios} />
          {err.municipios ? <p className="ms-error">Escribe al menos un municipio.</p> : <p className="ms-hint">Sepáralos con comas.</p>}
          <KmCalculados municipio={ciudad} estado={estado} cobertura={municipios} />
        </div>
      </div>

      {/* Lo que ofrece: libre, un renglón por cosa (2026-11-18). */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <h3 className="ms-h3" id="rp-ofrece">¿Qué servicios o equipos ofreces?<span className="ms-req">*</span></h3>
          <p className="ms-hint" style={{ marginTop: 4 }}>
            Escribe todo lo que das, uno por renglón: maquinaria, camiones, grúas, materiales, mano de obra… lo que sea.
            Las sugerencias son lo que MAQSER24 ya maneja, pero puedes escribir cualquier otra cosa.
          </p>
        </div>
        <datalist id="rp-sugerencias">{sugerencias.map((s) => <option key={s} value={s} />)}</datalist>
        <div role="group" aria-labelledby="rp-ofrece" style={{ display: 'grid', gap: 8 }}>
          {servicios.map((s, i) => (
            <div key={s.id} className="rp-equipo" data-on={s.nombre.trim().length >= 2}>
              <div className="rp-serv">
                <input className="ms-input rp-s-nombre" list="rp-sugerencias" aria-label={`Servicio o equipo ${i + 1}`} value={s.nombre} maxLength={160} onChange={(e) => cambiar(s.id, 'nombre', e.target.value)} placeholder="Qué es (ej. Grúa 30 t, pipa de agua)" />
                <input className="ms-input rp-s-unidades" aria-label="Unidades" inputMode="numeric" value={s.unidades} onChange={(e) => cambiar(s.id, 'unidades', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="1" />
                <input className="ms-input rp-s-detalle" aria-label="Marca, modelo o capacidad" value={s.detalle} maxLength={160} onChange={(e) => cambiar(s.id, 'detalle', e.target.value)} placeholder="Marca, modelo o capacidad" />
                <input className="ms-input rp-s-precio" aria-label="Cuánto cobras" value={s.precio} maxLength={120} onChange={(e) => cambiar(s.id, 'precio', e.target.value)} placeholder="Cuánto cobras (opcional)" />
                <button type="button" className="ms-btn ms-btn-sec ms-btn-sm rp-s-quitar" aria-label={`Quitar el renglón ${i + 1}`} onClick={() => quitar(s.id)}>Quitar</button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="ms-btn ms-btn-sec ms-btn-sm"
            style={{ justifySelf: 'start' }}
            disabled={servicios.length >= 40}
            onClick={() => setServicios((l) => [...l, renglonVacio()])}
          >
            + Agregar otro
          </button>
        </div>
        {err.servicios ? <p className="ms-error">Escribe al menos un servicio o equipo que ofrezcas.</p> : null}
      </div>

      <div className="ms-field">
        <label htmlFor="rp-mensaje" className="ms-label">¿Algo más que debamos saber?</label>
        <textarea id="rp-mensaje" className="ms-textarea" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3}
          placeholder="Si rentas con operador, horarios, años de experiencia…" />
      </div>

      {/* Trampa para bots: fuera de la vista y del teclado. */}
      <div aria-hidden style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="rp-sitio">No llenar</label>
        <input id="rp-sitio" tabIndex={-1} autoComplete="off" value={sitio} onChange={(e) => setSitio(e.target.value)} />
      </div>

      {errorServidor ? (
        <div role="alert" className="ms-alert ms-alert-bad">
          <span style={{ color: 'var(--color-error)', display: 'flex', paddingTop: 2 }}><Icon name="warning" size={16} /></span>
          <span>{errorServidor}</span>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px 20px', flexWrap: 'wrap' }}>
        <button type="button" onClick={enviar} disabled={enviando} className="ms-btn ms-btn-lg">
          {enviando ? 'Enviando…' : <>Enviar registro<Icon name="arrowRight" size={16} /></>}
        </button>
        <p className="ms-hint">Al enviar aceptas el <Link href="/privacidad">aviso de privacidad</Link>.</p>
      </div>
    </div>
  );
}
