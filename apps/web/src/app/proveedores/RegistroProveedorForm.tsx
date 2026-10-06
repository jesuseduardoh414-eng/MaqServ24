'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OFERTAS_PROVEEDOR, TIPOS_PROVEEDOR, type OfertaProveedor, type TipoProveedor } from '@maqserv/config';
import { evento } from '@/lib/analitica';
import { Icon } from '@/components/Icon';

const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán',
  'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

const correoOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digitos = (v: string) => v.replace(/\D/g, '').length;

/**
 * "Regístrate como proveedor" (2026-10-06). Mismas piezas que el formulario de
 * Contacto (`ms-field`, `ms-tab`…). Llega al panel como solicitud por revisar.
 */
export function RegistroProveedorForm() {
  const [tipo, setTipo] = useState<TipoProveedor>('empresa');
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('Nuevo León');
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
    ofrece: tocado && ofrece.length === 0,
    mensaje: tocado && mensaje.trim().length < 10,
  };

  function alternar(clave: OfertaProveedor) {
    setOfrece((v) => (v.includes(clave) ? v.filter((x) => x !== clave) : [...v, clave]));
  }

  async function enviar() {
    setTocado(true);
    setErrorServidor(null);
    if (nombre.trim().length < 2 || digitos(telefono) < 10 || (correo.trim() && !correoOk(correo.trim())) || !ciudad.trim() || ofrece.length === 0 || mensaje.trim().length < 10) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nombre, contacto: empresa ? contacto : '', telefono, correo, ciudad, estado, ofrece, mensaje, sitio }),
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
        <p className="ms-empty-p">Gracias por tu interés en la red MAQSER24. Nuestro equipo revisará la información y se pondrá en contacto contigo para continuar el proceso.</p>
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
          {err.correo ? <p className="ms-error">Correo no válido.</p> : null}
        </div>
        <div className="ms-field">
          <label htmlFor="rp-ciudad" className="ms-label">Ciudad<span className="ms-req">*</span></label>
          <input id="rp-ciudad" className="ms-input" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Monterrey" aria-invalid={err.ciudad} autoComplete="address-level2" />
          {err.ciudad ? <p className="ms-error">Escribe tu ciudad.</p> : null}
        </div>
        <div className="ms-field">
          <label htmlFor="rp-estado" className="ms-label">Estado<span className="ms-req">*</span></label>
          <select id="rp-estado" className="ms-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS_MX.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
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
          placeholder="Equipos (tipo, marca, modelo, cantidad), si rentas con operador, zonas donde trabajas…" />
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
