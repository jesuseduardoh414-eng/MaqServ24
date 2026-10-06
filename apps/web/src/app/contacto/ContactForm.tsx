'use client';

import { evento } from '@/lib/analitica';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Formulario de contacto. Usa las piezas comunes del sistema de diseño
 * (`ms-field`, `ms-input`, `ms-tab`, `ms-btn`…); aquí solo queda la lógica.
 */
export function ContactForm({ needs: deTema }: { needs: string[] }) {
  // `?necesidad=` (2026-10-06): las páginas que mandan aquí (p. ej. venta de
  // maquinaria) dejan el motivo ya elegido; si no está entre los del tema, se
  // agrega al frente. Se lee en el cliente para que la página siga siendo estática.
  const [needs, setNeeds] = useState(deTema);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [need, setNeed] = useState(needs[0] ?? 'Rentar equipo');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get('necesidad')?.trim().slice(0, 60);
    if (!pedida) return;
    if (!deTema.includes(pedida)) setNeeds([pedida, ...deTema]);
    setNeed(pedida);
  }, [deTema]);

  const nameErr = touched && !name.trim();
  const emailErr = touched && !emailOk(email.trim());
  const messageErr = touched && message.trim().length < 4;

  async function submit() {
    setTouched(true);
    setServerErr(null);
    if (!name.trim() || !emailOk(email.trim()) || message.trim().length < 4) return;
    setBusy(true);
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, email, phone, need, message }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(typeof d?.message === 'string' ? d.message : 'No se pudo enviar');
      }
      setDone(true);
      evento('contacto_enviado', { motivo: need }); // solo la categoría, nunca los datos del formulario
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    } catch (e) {
      setServerErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setName(''); setCompany(''); setEmail(''); setPhone(''); setMessage('');
    setNeed(needs[0] ?? 'Rentar equipo'); setTouched(false); setDone(false); setServerErr(null);
  }

  if (done) {
    return (
      <div className="ms-empty" role="status">
        <span className="ms-ico ms-ico-lg" style={{ color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
          <Icon name="check" size={22} />
        </span>
        <h3 className="ms-empty-t">Mensaje enviado</h3>
        <p className="ms-empty-p">Gracias por escribirnos. Un asesor te contactará muy pronto.</p>
        <div className="ms-empty-acts">
          <button type="button" onClick={reset} className="ms-btn ms-btn-sec">Enviar otro mensaje</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="ms-grid2">
        <div className="ms-field">
          <label htmlFor="ct-name" className="ms-label">Nombre<span className="ms-req">*</span></label>
          <input id="ct-name" className="ms-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" aria-invalid={nameErr} autoComplete="name" />
          {nameErr ? <p className="ms-error">Ingresa tu nombre.</p> : null}
        </div>
        <div className="ms-field">
          <label htmlFor="ct-company" className="ms-label">Empresa</label>
          <input id="ct-company" className="ms-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Opcional" autoComplete="organization" />
        </div>
        <div className="ms-field">
          <label htmlFor="ct-email" className="ms-label">Correo<span className="ms-req">*</span></label>
          <input id="ct-email" type="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" aria-invalid={emailErr} autoComplete="email" />
          {emailErr ? <p className="ms-error">Correo no válido.</p> : null}
        </div>
        <div className="ms-field">
          <label htmlFor="ct-phone" className="ms-label">Teléfono</label>
          <input id="ct-phone" type="tel" className="ms-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 dígitos" autoComplete="tel" />
        </div>
      </div>

      {needs.length > 0 ? (
        <div className="ms-field">
          <span className="ms-label" id="ct-need">¿En qué te ayudamos?</span>
          <div className="ms-tabs" role="group" aria-labelledby="ct-need">
            {needs.map((n) => (
              <button key={n} type="button" className="ms-tab" data-on={n === need} aria-pressed={n === need} onClick={() => setNeed(n)}>{n}</button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ms-field">
        <label htmlFor="ct-message" className="ms-label">Mensaje<span className="ms-req">*</span></label>
        <textarea id="ct-message" className="ms-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe tu proyecto: tipo de equipo, fechas y ubicación." rows={5} aria-invalid={messageErr} />
        {messageErr ? <p className="ms-error">Cuéntanos brevemente qué necesitas.</p> : null}
      </div>

      {serverErr ? (
        <div role="alert" className="ms-alert ms-alert-bad">
          <span style={{ color: 'var(--color-error)', display: 'flex', paddingTop: 2 }}><Icon name="warning" size={16} /></span>
          <span>{serverErr}</span>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px 20px', flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={busy} className="ms-btn ms-btn-lg">
          {busy ? 'Enviando…' : <>Enviar mensaje<Icon name="arrowRight" size={16} /></>}
        </button>
        <p className="ms-hint">Respondemos en menos de 24 h hábiles.</p>
      </div>
    </div>
  );
}
