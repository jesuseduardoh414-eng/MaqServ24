'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { OFERTAS_PROVEEDOR, TIPOS_PROVEEDOR, centroDeMunicipio, radioDeCobertura, type OfertaProveedor, type TipoProveedor } from '@maqserv/config';
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

const correoOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digitos = (v: string) => v.replace(/\D/g, '').length;
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
 */
export function RegistroProveedorForm() {
  const [tipo, setTipo] = useState<TipoProveedor>('empresa');
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('Nuevo León');
  const [municipios, setMunicipios] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [ofrece, setOfrece] = useState<OfertaProveedor[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [sitio, setSitio] = useState(''); // trampa para bots
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const empresa = tipo === 'empresa';
  const err = {
    nombre: tocado && nombre.trim().length < 2,
    telefono: tocado && digitos(telefono) < 10,
    correo: tocado && correo.trim() !== '' && !correoOk(correo.trim()),
    ciudad: tocado && !ciudad.trim(),
    municipios: tocado && aLista(municipios).length === 0,
    ofrece: tocado && ofrece.length === 0,
    mensaje: tocado && mensaje.trim().length < 10,
  };

  function alternar(clave: OfertaProveedor) {
    setOfrece((v) => (v.includes(clave) ? v.filter((x) => x !== clave) : [...v, clave]));
  }

  async function enviar() {
    setTocado(true);
    setErrorServidor(null);
    if (
      nombre.trim().length < 2 || digitos(telefono) < 10 || (correo.trim() && !correoOk(correo.trim())) ||
      !ciudad.trim() || aLista(municipios).length === 0 || ofrece.length === 0 || mensaje.trim().length < 10
    ) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nombre, contacto: empresa ? contacto : '', telefono, correo,
          direccion, ciudad, estado, municipios: aLista(municipios), respuesta: respuesta ? Number(respuesta) : null,
          ofrece, mensaje, sitio,
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
            <input id="rp-contacto" className="ms-input" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Quién atenderá" autoComplete="name" />
          </div>
        ) : null}
        <div className="ms-field">
          <label htmlFor="rp-tel" className="ms-label">Teléfono o WhatsApp<span className="ms-req">*</span></label>
          <input id="rp-tel" type="tel" className="ms-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" aria-invalid={err.telefono} autoComplete="tel" />
          {err.telefono ? <p className="ms-error">Escribe un teléfono de 10 dígitos.</p> : null}
        </div>
        <div className="ms-field">
          <label htmlFor="rp-correo" className="ms-label">Correo</label>
          <input id="rp-correo" type="email" className="ms-input" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" aria-invalid={err.correo} autoComplete="email" />
          {err.correo ? <p className="ms-error">Correo no válido.</p> : <p className="ms-hint">Aquí te llega el enlace a tu portal si te aceptamos.</p>}
        </div>
        <div className="ms-field">
          <label htmlFor="rp-respuesta" className="ms-label">¿En cuánto contestas una solicitud?</label>
          <select id="rp-respuesta" className="ms-select" value={respuesta} onChange={(e) => setRespuesta(e.target.value)}>
            {RESPUESTAS.map(([v, t]) => <option key={v || 'nd'} value={v}>{t}</option>)}
          </select>
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
            <select id="rp-estado" className="ms-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS_MX.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
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
        <div className="ms-tabs" role="group" aria-labelledby="rp-ofrece">
          {OFERTAS_PROVEEDOR.map((o) => {
            const on = ofrece.includes(o.clave);
            return (
              <button key={o.clave} type="button" className="ms-tab" data-on={on} aria-pressed={on} onClick={() => alternar(o.clave)}>
                {on ? <Icon name="check" size={14} /> : null}{o.nombre}
              </button>
            );
          })}
        </div>
        {err.ofrece ? <p className="ms-error">Elige al menos una opción.</p> : <p className="ms-hint">Puedes elegir varias.</p>}
      </div>

      <div className="ms-field">
        <label htmlFor="rp-mensaje" className="ms-label">Cuéntanos de tu maquinaria o servicios<span className="ms-req">*</span></label>
        <textarea id="rp-mensaje" className="ms-textarea" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={5} aria-invalid={err.mensaje}
          placeholder="Equipos (tipo, marca, modelo, cantidad), si rentas con operador…" />
        {err.mensaje ? <p className="ms-error">Cuéntanos brevemente qué ofreces.</p> : null}
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
