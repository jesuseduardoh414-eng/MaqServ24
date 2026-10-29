'use client';

import Link from 'next/link';
import { ShSelectCampo } from '@maqserv/ui';
import { useState, type ReactNode } from 'react';
import { TIPOS_PROVEEDOR, centroDeMunicipio, problemaEmail, problemaNombre, problemaTelefono, radioDeCobertura, type LineaRegistro, type TipoProveedor } from '@maqserv/config';
import { evento } from '@/lib/analitica';
import { Icon } from '@/components/Icon';

/** El renglón de una categoría nueva: su nombre, la etiqueta y Quitar. */
const CSS_NUEVA = `.rp-nueva{ display:flex; gap:8px; align-items:center; margin-bottom:10px; } .rp-nueva .ms-input{ flex:1 1 auto; min-width:0; }`;

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
 * SUS EQUIPOS (2026-10-26). Antes era un texto libre ("cuéntanos de tu
 * maquinaria"). Ahora elige las categorías que MAQSER24 tiene en el panel y,
 * en cada una, marca los tipos que tiene con cuántas unidades, o agrega otro.
 * Al aceptarlo, esos equipos ya quedan a su nombre en Disponibilidad.
 */

/** Un equipo marcado de la lista: cuántas, y marca/modelo si quiere. */
interface Marcado { unidades: string; marca: string; modelo: string }
/** Un equipo "otro" que no está en la lista. */
interface Otro { id: number; categoria: string; nombre: string; marca: string; modelo: string; unidades: string }

export function RegistroProveedorForm({ lineas, inicial }: {
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
  const [ofrece, setOfrece] = useState<string[]>([]);
  /** Tipos marcados, por id de la ficha. */
  const [marcados, setMarcados] = useState<Record<number, Marcado>>({});
  const [otros, setOtros] = useState<Otro[]>([]);
  /**
   * CATEGORÍAS QUE NO ESTÁN EN LA LISTA (2026-10-28): "Otra" abre una con su
   * nombre y sus equipos. Llega a MAQSER24 como categoría nueva, que decide si
   * es la misma que otra, si la autoriza o si no la maneja.
   */
  const [nuevas, setNuevas] = useState<Array<{ clave: string; nombre: string }>>([]);
  const [mensaje, setMensaje] = useState('');
  const [sitio, setSitio] = useState(''); // trampa para bots
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const empresa = tipo === 'empresa';
  const err = {
    nombre: tocado && nombre.trim().length < 2,
    telefono: tocado && !telefonoOk(telefono),
    contacto: tocado && empresa && !!problemaNombre(contacto),
    correo: tocado && correo.trim() !== '' && !correoOk(correo.trim()),
    ciudad: tocado && !ciudad.trim(),
    municipios: tocado && aLista(municipios).length === 0,
    ofrece: tocado && ofrece.length === 0,
  };

  // Lo que se manda: los tipos marcados de las líneas elegidas y los "otro" con nombre.
  // Las categorías nuevas van al final, sin tipos: solo "otro".
  const elegidas: Array<LineaRegistro & { nueva?: boolean }> = [
    ...lineas.filter((l) => ofrece.includes(l.slug)),
    ...nuevas.filter((n) => ofrece.includes(n.clave)).map((n) => ({ slug: n.clave, nombre: n.nombre, tipos: [], nueva: true })),
  ];
  const equipos = [
    ...elegidas.flatMap((l) => l.tipos.filter((t) => marcados[t.id]).map((t) => ({
      categoria: l.slug, tipoId: t.id, nombre: t.nombre, marca: marcados[t.id].marca.trim(), modelo: marcados[t.id].modelo.trim(), unidades: Number(marcados[t.id].unidades) || 1,
    }))),
    ...otros.filter((o) => ofrece.includes(o.categoria) && o.nombre.trim().length >= 3).map((o) => ({
      categoria: o.categoria, tipoId: null, nombre: o.nombre.trim(), marca: o.marca.trim(), modelo: o.modelo.trim(), unidades: Number(o.unidades) || 1,
    })),
  ];
  const errEquipos = tocado && ofrece.length > 0 && equipos.length === 0;
  const errNueva = tocado && nuevas.some((n) => n.nombre.trim().length < 3);

  /** "Otra: no está en la lista": una categoría nueva, ya con un renglón para su primer equipo. */
  function agregarNueva() {
    const clave = `nueva-${Date.now()}`;
    setNuevas((l) => [...l, { clave, nombre: '' }]);
    setOfrece((v) => [...v, clave]);
    setOtros((lst) => [...lst, { id: Date.now(), categoria: clave, nombre: '', marca: '', modelo: '', unidades: '1' }]);
  }
  function quitarNueva(clave: string) {
    setNuevas((l) => l.filter((n) => n.clave !== clave));
    setOfrece((v) => v.filter((x) => x !== clave));
    setOtros((lst) => lst.filter((o) => o.categoria !== clave));
  }

  function alternar(clave: string) {
    setOfrece((v) => (v.includes(clave) ? v.filter((x) => x !== clave) : [...v, clave]));
  }

  function marcar(id: number) {
    setMarcados((m) => {
      const n = { ...m };
      if (n[id]) delete n[id]; else n[id] = { unidades: '1', marca: '', modelo: '' };
      return n;
    });
  }
  const cambiarMarcado = (id: number, campo: keyof Marcado, v: string) => setMarcados((m) => ({ ...m, [id]: { ...m[id], [campo]: v } }));
  const cambiarOtro = (id: number, campo: keyof Otro, v: string) => setOtros((l) => l.map((o) => (o.id === id ? { ...o, [campo]: v } : o)));

  async function enviar() {
    setTocado(true);
    setErrorServidor(null);
    if (
      nombre.trim().length < 2 || !telefonoOk(telefono) || (correo.trim() && !correoOk(correo.trim())) ||
      (empresa && problemaNombre(contacto)) ||
      !ciudad.trim() || aLista(municipios).length === 0 || ofrece.length === 0 || equipos.length === 0 ||
      nuevas.some((n) => n.nombre.trim().length < 3)
    ) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nombre, contacto: empresa ? contacto : '', telefono, correo,
          direccion, ciudad, estado, municipios: aLista(municipios), respuesta: respuesta ? Number(respuesta) : null,
          ofrece, equipos, nuevas: nuevas.map((n) => ({ clave: n.clave, nombre: n.nombre.trim() })), mensaje, sitio,
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
      <style>{CSS_NUEVA}</style>
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

      <div className="ms-field">
        <span className="ms-label" id="rp-ofrece">¿Qué ofreces?<span className="ms-req">*</span></span>
        {lineas.length === 0 ? (
          <p className="ms-error">No pudimos cargar las opciones. Recarga la página en unos segundos.</p>
        ) : (
          <div className="ms-tabs" role="group" aria-labelledby="rp-ofrece">
            {lineas.map((l) => {
              const on = ofrece.includes(l.slug);
              return (
                <button key={l.slug} type="button" className="ms-tab" data-on={on} aria-pressed={on} onClick={() => alternar(l.slug)}>
                  {on ? <Icon name="check" size={14} /> : null}{l.nombre}
                </button>
              );
            })}
            {nuevas.length < 3 ? (
              <button type="button" className="ms-tab" onClick={agregarNueva}>
                + Otra: no está en la lista
              </button>
            ) : null}
          </div>
        )}
        {err.ofrece ? <p className="ms-error">Elige al menos una opción.</p> : <p className="ms-hint">Puedes elegir varias.</p>}
      </div>

      {/* Sus equipos, por cada línea elegida: los tipos que MAQSER24 ya ofrece, o uno nuevo. */}
      {elegidas.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <h3 className="ms-h3">Tus equipos<span className="ms-req">*</span></h3>
            <p className="ms-hint" style={{ marginTop: 4 }}>Marca lo que tienes y cuántas unidades. Si no está en la lista, agrégalo.</p>
          </div>
          {elegidas.map((l) => (
            <fieldset key={l.slug} className="rp-linea">
              {l.nueva ? (
                <div className="rp-nueva">
                  <input
                    className="ms-input"
                    aria-label="Nombre de la categoría nueva"
                    value={l.nombre}
                    maxLength={100}
                    onChange={(e) => setNuevas((lst) => lst.map((n) => (n.clave === l.slug ? { ...n, nombre: e.target.value } : n)))}
                    placeholder="¿Qué categoría es? (ej. Grúas)"
                  />
                  <span className="ms-chip">Nueva</span>
                  <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" onClick={() => quitarNueva(l.slug)}>Quitar</button>
                </div>
              ) : (
                <legend className="ms-label">{l.nombre}</legend>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {l.tipos.map((t) => {
                  const m = marcados[t.id];
                  return (
                    <div key={t.id} className="rp-equipo" data-on={Boolean(m)}>
                      <label className="rp-equipo-n">
                        <input type="checkbox" checked={Boolean(m)} onChange={() => marcar(t.id)} />
                        <span>{t.nombre}</span>
                      </label>
                      {m ? (
                        <div className="rp-equipo-d">
                          <input className="ms-input" aria-label={`Unidades de ${t.nombre}`} inputMode="numeric" value={m.unidades} onChange={(e) => cambiarMarcado(t.id, 'unidades', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1" />
                          <input className="ms-input" aria-label={`Marca de ${t.nombre}`} value={m.marca} maxLength={120} onChange={(e) => cambiarMarcado(t.id, 'marca', e.target.value)} placeholder="Marca (opcional)" />
                          <input className="ms-input" aria-label={`Modelo de ${t.nombre}`} value={m.modelo} maxLength={120} onChange={(e) => cambiarMarcado(t.id, 'modelo', e.target.value)} placeholder="Modelo (opcional)" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {otros.filter((o) => o.categoria === l.slug).map((o) => (
                  <div key={o.id} className="rp-equipo" data-on>
                    <div className="rp-equipo-d rp-otro">
                      <input className="ms-input" aria-label="Qué equipo es" value={o.nombre} maxLength={160} onChange={(e) => cambiarOtro(o.id, 'nombre', e.target.value)} placeholder="Qué es (ej. Grúa 30 t)" />
                      <input className="ms-input" aria-label="Unidades" inputMode="numeric" value={o.unidades} onChange={(e) => cambiarOtro(o.id, 'unidades', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1" />
                      <input className="ms-input" aria-label="Marca" value={o.marca} maxLength={120} onChange={(e) => cambiarOtro(o.id, 'marca', e.target.value)} placeholder="Marca (opcional)" />
                      <input className="ms-input" aria-label="Modelo" value={o.modelo} maxLength={120} onChange={(e) => cambiarOtro(o.id, 'modelo', e.target.value)} placeholder="Modelo (opcional)" />
                      <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" aria-label="Quitar este equipo" onClick={() => setOtros((lst) => lst.filter((x) => x.id !== o.id))}>Quitar</button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="ms-btn ms-btn-sec ms-btn-sm"
                  style={{ justifySelf: 'start' }}
                  onClick={() => setOtros((lst) => [...lst, { id: Date.now(), categoria: l.slug, nombre: '', marca: '', modelo: '', unidades: '1' }])}
                >
                  Agregar otro equipo
                </button>
              </div>
            </fieldset>
          ))}
          {errEquipos ? <p className="ms-error">Marca al menos un equipo o agrega uno.</p> : null}
          {errNueva ? <p className="ms-error">Escribe el nombre de la categoría nueva.</p> : null}
        </div>
      ) : null}

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
