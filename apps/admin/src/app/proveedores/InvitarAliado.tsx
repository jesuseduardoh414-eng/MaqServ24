'use client';

import { useEffect, useState } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { problemaEmail } from '@maqserv/config';
import { Modal } from '@/components/Modal';
import { Btn, Chip, FormField, Note, Panel } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';
import { waDe } from './wa';

/**
 * INVITAR ALIADO (2026-10-27, revisión de Proveedores).
 *
 * "Supongo que ahí se pueden mandar a invitar a otros." Se podía, pero solo
 * capturando TODO a mano en "Nuevo aliado". Ahora basta su nombre y su correo
 * o WhatsApp: le llega el enlace a "Regístrate como proveedor" con esos datos
 * ya puestos; él llena su base, sus municipios y sus equipos, y entra como
 * solicitud. A la oficina solo le queda aceptarlo.
 */

type Por = 'correo' | 'whatsapp';

export interface Invitacion {
  clave: string;
  nombre: string;
  contacto: string | null;
  correo: string | null;
  telefono: string | null;
  por: Por;
  cuando: string;
  veces: number;
  url: string;
}

/** El texto del WhatsApp: corto, con quién somos y el enlace. */
const textoWhatsApp = (nombre: string, contacto: string | null, url: string) =>
  `Hola${contacto ? ` ${contacto}` : ''}, te invitamos a la red de aliados de MAQSER24. Recibimos solicitudes de maquinaria, transporte y materiales para obras y se las pasamos a aliados como ${nombre}. Haz tu registro aquí (tus datos ya van puestos): ${url}`;

/**
 * Manda (o vuelve a mandar) la invitación. Con WhatsApp la pestaña se abre en
 * el clic —si se abre después de esperar a la API, el navegador la bloquea— y
 * se le pone la dirección cuando llega el enlace.
 */
async function mandar(d: { nombre: string; contacto: string | null; correo: string | null; telefono: string | null; por: Por }): Promise<{ ok: boolean; mensaje: string }> {
  const ventana = d.por === 'whatsapp' ? window.open('', '_blank') : null;
  const r = await fetch('/api/admin/providers/invitar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(d),
  });
  const res = await r.json().catch(() => null);
  if (!r.ok) {
    ventana?.close();
    return { ok: false, mensaje: typeof res?.message === 'string' ? res.message : 'No se pudo mandar la invitación.' };
  }
  if (ventana) ventana.location.href = `https://wa.me/${waDe(d.telefono)}?text=${encodeURIComponent(textoWhatsApp(d.nombre, d.contacto, res.url))}`;
  return { ok: true, mensaje: res.mensaje };
}

export function InvitarAliado({ abierto, onCerrar, onEnviada }: { abierto: boolean; onCerrar: () => void; onEnviada: () => void }) {
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<Por | null>(null);

  const correoOk = correo.trim() !== '' && !problemaEmail(correo.trim());
  const waOk = waDe(telefono) !== null;

  function cerrar() {
    setNombre(''); setContacto(''); setCorreo(''); setTelefono(''); setError(null);
    onCerrar();
  }

  async function enviar(por: Por) {
    if (nombre.trim().length < 2) { setError('Escribe el nombre del aliado.'); return; }
    setOcupado(por); setError(null);
    const r = await mandar({ nombre: nombre.trim(), contacto: contacto.trim() || null, correo: correo.trim() || null, telefono: telefono.trim() || null, por });
    setOcupado(null);
    if (!r.ok) { setError(r.mensaje); return; }
    mostrarResultado(r.mensaje, 'ok');
    onEnviada();
    cerrar();
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Invitar aliado"
      subtitulo="Le llega un enlace a su registro con estos datos ya puestos. Él llena dónde está, a qué municipios llega y qué equipos tiene; te llega como solicitud y solo lo aceptas."
      onCerrar={cerrar}
      ancho={620}
      pie={
        <>
          <Btn variant="ghost" onClick={cerrar}>Cancelar</Btn>
          <Btn icon="ph-whatsapp-logo" onClick={() => void enviar('whatsapp')} disabled={!waOk || ocupado !== null} title={waOk ? undefined : 'Escribe su WhatsApp a 10 dígitos'}>
            {ocupado === 'whatsapp' ? 'Abriendo…' : 'Mandar por WhatsApp'}
          </Btn>
          <Btn variant="primary" icon="ph-paper-plane-tilt" onClick={() => void enviar('correo')} disabled={!correoOk || ocupado !== null} title={correoOk ? undefined : 'Escribe su correo'}>
            {ocupado === 'correo' ? 'Mandando…' : 'Mandar por correo'}
          </Btn>
        </>
      }
    >
      {error ? <div role="alert" style={{ marginBottom: 16 }}><Note tone="bad">{error}</Note></div> : null}
      <div className="adm-form-grid">
        <FormField label="Nombre del aliado *" help="La empresa o la persona.">
          <input className="adm-input" maxLength={190} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Grúas del Norte" autoFocus />
        </FormField>
        <FormField label="Persona de contacto">
          <input className="adm-input" maxLength={190} value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Juan Pérez" />
        </FormField>
        <FormField label="Correo">
          <input className="adm-input" type="email" maxLength={190} value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@empresa.com" />
        </FormField>
        <FormField label="WhatsApp">
          <input className="adm-input" type="tel" inputMode="tel" maxLength={20} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="81 1234 5678" />
        </FormField>
      </div>
      <p className="adm-help" style={{ margin: '14px 0 0' }}>Con uno de los dos basta. Si pones los dos, mándale por donde te conteste más rápido.</p>
    </Modal>
  );
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

/**
 * Las invitaciones que todavía no terminan en registro. Sin ninguna, no se
 * pinta: quien ya se registró sale arriba, en "Solicitudes de proveedores".
 */
export function InvitacionesPendientes({ version }: { version: number }) {
  const [datos, setDatos] = useState<{ pendientes: Invitacion[]; registrados: number } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/providers/invitaciones', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [version, vuelta]);

  if (!datos || datos.pendientes.length === 0) return null;

  async function reenviar(i: Invitacion) {
    setOcupado(i.clave);
    const r = await mandar({ nombre: i.nombre, contacto: i.contacto, correo: i.correo, telefono: i.telefono, por: i.por });
    setOcupado(null);
    mostrarResultado(r.mensaje, r.ok ? 'ok' : 'bad');
    setVuelta((v) => v + 1);
  }

  async function quitar(i: Invitacion) {
    if (!(await confirmar({ titulo: `¿Quitar a «${i.nombre}» de la lista?`, mensaje: 'Si después se registra con su enlace, igual te llega como solicitud.', confirmar: 'Quitar' }))) return;
    setOcupado(i.clave);
    await fetch('/api/admin/providers/invitaciones/quitar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: i.clave, nombre: i.nombre }),
    });
    setOcupado(null);
    mostrarResultado(`«${i.nombre}» ya no sale en las invitaciones.`, 'ok');
    setVuelta((v) => v + 1);
  }

  const n = datos.pendientes.length;
  return (
    <Panel
      flush
      clip
      style={{ marginBottom: 24 }}
      icon="ph-paper-plane-tilt"
      title="Invitaciones sin respuesta"
      desc={`Les mandaste su enlace y todavía no se registran.${datos.registrados ? ` ${datos.registrados} ya se registr${datos.registrados === 1 ? 'ó' : 'aron'}.` : ''}`}
      action={<Chip tone="muted">{n}</Chip>}
    >
      {datos.pendientes.map((i) => (
        <div key={i.clave} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: '8px 16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <div className="adm-cell-title">{i.nombre}</div>
            <div className="adm-cell-sub">
              {i.por === 'correo' ? `Por correo a ${i.correo}` : `Por WhatsApp al ${i.telefono}`}
              {' · '}el {fechaCorta(i.cuando)}
              {i.veces > 1 ? ` · ${i.veces} veces` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="ghost" onClick={() => void quitar(i)} disabled={ocupado === i.clave}>Ya no</Btn>
            <Btn size="sm" icon={i.por === 'correo' ? 'ph-paper-plane-tilt' : 'ph-whatsapp-logo'} onClick={() => void reenviar(i)} disabled={ocupado === i.clave}>
              Volver a mandar
            </Btn>
          </div>
        </div>
      ))}
    </Panel>
  );
}
