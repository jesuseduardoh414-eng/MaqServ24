'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';

const labelStyle: React.CSSProperties = { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: 'var(--color-error)', marginTop: 6, letterSpacing: '0.04em' };

function field(err: boolean): React.CSSProperties {
  return {
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)',
    background: err ? 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))' : 'var(--color-surface)',
    border: `1px solid ${err ? 'var(--color-error)' : 'var(--color-border)'}`,
    borderRadius: 6, padding: '14px 16px', marginTop: 8,
  };
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function ContactForm({ needs }: { needs: string[] }) {
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
      <div style={{ border: '1px solid var(--color-text)', borderRadius: 6, padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 22px' }}><Icon name="check" size={32} /></div>
        <h3 style={{ fontFamily: DISPLAY, margin: '0 0 12px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>¡Mensaje enviado!</h3>
        <p style={{ margin: '0 auto 24px', fontSize: 16, lineHeight: 1.6, color: 'var(--color-text-muted)', maxWidth: '40ch' }}>Gracias por escribirnos. Un asesor te contactará muy pronto.</p>
        <button type="button" onClick={reset} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none', padding: '13px 26px', borderRadius: 'var(--radius-button)', cursor: 'pointer' }}>Enviar otro mensaje</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }} className="ct-row">
        <div>
          <label htmlFor="ct-name" style={labelStyle}>Nombre*</label>
          <input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" style={field(nameErr)} />
          {nameErr ? <div style={errStyle}>Ingresa tu nombre.</div> : null}
        </div>
        <div>
          <label htmlFor="ct-company" style={labelStyle}>Empresa</label>
          <input id="ct-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Opcional" style={field(false)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }} className="ct-row">
        <div>
          <label htmlFor="ct-email" style={labelStyle}>Correo*</label>
          <input id="ct-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" style={field(emailErr)} />
          {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
        </div>
        <div>
          <label htmlFor="ct-phone" style={labelStyle}>Teléfono</label>
          <input id="ct-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 dígitos" style={field(false)} />
        </div>
      </div>

      {needs.length > 0 ? (
        <div>
          <label style={labelStyle}>¿En qué te ayudamos?</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {needs.map((n) => {
              const on = n === need;
              return (
                <button key={n} type="button" onClick={() => setNeed(n)} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em', padding: '9px 16px', borderRadius: 'var(--radius-button)', border: `1px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`, background: on ? 'var(--color-text)' : 'var(--color-surface)', color: on ? 'var(--color-bg)' : 'var(--color-text-muted)', transition: 'all .15s ease' }}>{n}</button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor="ct-message" style={labelStyle}>Mensaje*</label>
        <textarea id="ct-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe tu proyecto: tipo de equipo, fechas y ubicación." rows={5} style={{ ...field(messageErr), resize: 'vertical', lineHeight: 1.5, minHeight: 120, fontFamily: 'var(--font-sans)' }} />
        {messageErr ? <div style={errStyle}>Cuéntanos brevemente qué necesitas.</div> : null}
      </div>

      {serverErr ? <div role="alert" style={{ ...errStyle, marginTop: 0 }}>{serverErr}</div> : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '16px 34px', borderRadius: 'var(--radius-button)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Enviando…' : <>Enviar mensaje<Icon name="arrowRight" size={16} /></>}</button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>RESPUESTA EN &lt; 24 H HÁBILES</span>
      </div>
    </div>
  );
}
