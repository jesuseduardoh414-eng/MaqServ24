'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * EL PANEL DEL ALIADO.
 *
 * Está pensado para un teléfono a media obra, no para un escritorio: lo que
 * espera respuesta va arriba y en grande, y todo lo demás cabe abajo. Es la
 * única pantalla del proyecto donde el usuario tiene las manos sucias y treinta
 * segundos.
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Rechazar PIDE motivo, aceptar no. El "no" sin explicación no sirve para
 *    nada; con motivo, se vuelve el dato que dice si la red alcanza para esa
 *    zona o esa línea. Es lo mismo que ya hace operaciones, y por eso se pide
 *    igual de los dos lados.
 *
 * 2. Se le enseña su propio historial de cumplimiento. Si el sistema lo va a
 *    ordenar con esos números, tiene derecho a verlos — y es la única forma de
 *    que pueda discutirlos.
 */

export interface DatosPortal {
  aliado: {
    id: number;
    name: string;
    contactName: string | null;
    level: string;
    verified: boolean;
    docsStatus: string;
    coverage: string[];
    categories: string[];
    monthsInNetwork: number | null;
  };
  porContestar: Array<{
    assignmentId: number;
    quoteNumber: string;
    category: string | null;
    address: string | null;
    site: string | null;
    detail: string | null;
    requirements: string[];
    offeredAt: string;
  }>;
  enCurso: Array<{
    quoteNumber: string;
    category: string | null;
    state: string | null;
    site: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    requirements: string[];
  }>;
  equipos: Array<{
    id: number;
    name: string;
    state: string;
    location: string | null;
    diasSinConfirmar: number | null;
    confirmacion: string;
  }>;
  documentos: {
    estado: string;
    avisos: Array<{ documentId: number; kind: string; name: string | null; expiresAt: string; texto: string; urgencia: string }>;
    diasAviso: number;
  };
  cumplimiento: {
    resumen: string;
    ofrecidos: number;
    aceptados: number;
    completados: number;
    cancelados: number;
    minutosRespuestaReal: number | null;
    minutosRespuestaDeclarado: number | null;
    confiable: boolean;
  };
}

const card: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  padding: '18px 20px',
};

const btn: React.CSSProperties = {
  border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-fg)',
  borderRadius: 'var(--radius-sm)', padding: '12px 20px', fontWeight: 700, fontSize: 15,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btnSec: React.CSSProperties = {
  border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)',
  borderRadius: 'var(--radius-sm)', padding: '12px 20px', fontWeight: 600, fontSize: 15,
  cursor: 'pointer', fontFamily: 'inherit',
};

export function PortalAliado({ datos, token }: { datos: DatosPortal; token: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { aliado, porContestar, enCurso, equipos, documentos, cumplimiento } = datos;

  async function llamar(url: string, body?: unknown) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setMsg(j?.message ?? 'No se pudo guardar. Intenta otra vez.');
      return false;
    }
    return true;
  }

  const API = '/api/proxy';

  async function contestar(assignmentId: number, estado: 'aceptado' | 'rechazado') {
    let motivo: string | undefined;
    if (estado === 'rechazado') {
      // Decisión 1: el "no" sin motivo no sirve para nada.
      const r = window.prompt('¿Por qué no puedes tomarlo? Nos sirve para no volver a ofrecerte lo mismo.');
      if (r === null) return;
      motivo = r || undefined;
    }
    setOcupado(assignmentId); setMsg(null);
    const ok = await llamar(`${API}/aliado/solicitudes/${assignmentId}`, { estado, motivo });
    setOcupado(null);
    if (ok) { setMsg(estado === 'aceptado' ? 'Listo, quedó tuyo. Te mandamos los datos de la obra por correo.' : 'Gracias por avisarnos.'); router.refresh(); }
  }

  async function confirmar(productId: number) {
    setOcupado(productId); setMsg(null);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/confirmar`);
    setOcupado(null);
    if (ok) { setMsg('Confirmado. Gracias.'); router.refresh(); }
  }

  async function moverEquipo(productId: number, actual: string | null) {
    const donde = window.prompt('¿Dónde está ahora?', actual ?? '');
    if (donde === null) return;
    setOcupado(productId); setMsg(null);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/ubicacion`, { location: donde });
    setOcupado(null);
    if (ok) { setMsg('Actualizado.'); router.refresh(); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px clamp(16px, 5vw, 28px) 60px' }}>
      <header style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          Panel de aliado
        </div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(26px, 5vw, 34px)', margin: '8px 0 0', letterSpacing: '-0.02em' }}>
          {aliado.name}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          {aliado.verified ? '✓ Expediente verificado · ' : ''}
          {aliado.coverage.length > 0 ? `Cubres ${aliado.coverage.join(', ')}` : 'Sin zonas registradas'}
        </p>
      </header>

      {msg ? (
        <div style={{ ...card, marginBottom: 18, borderColor: 'var(--color-primary)', fontSize: 14.5 }}>{msg}</div>
      ) : null}

      {/* Lo único con lo que puede hacer algo AHORA. Todo lo demás es consulta. */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>
          {porContestar.length > 0 ? `${porContestar.length} solicitud${porContestar.length === 1 ? '' : 'es'} esperando tu respuesta` : 'Nada pendiente por contestar'}
        </h2>

        {porContestar.length === 0 ? (
          <div style={{ ...card, color: 'var(--color-text-muted)', fontSize: 14 }}>
            Cuando nos entre un trabajo que te toque, aparece aquí y te avisamos por correo.
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 14 }}>
          {porContestar.map((s) => (
            <div key={s.assignmentId} style={{ ...card, borderColor: 'var(--color-primary)' }}>
              <div style={{ fontSize: 16.5, fontWeight: 700 }}>{s.category ?? 'Servicio'}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 5, lineHeight: 1.6 }}>
                {s.site ? <>{s.site}<br /></> : null}
                {s.address ?? 'Sin ubicación'}
              </div>
              {s.detail ? (
                <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.detail}</p>
              ) : null}

              {s.requirements.length > 0 ? (
                // Se le dice ANTES de aceptar: enterarse de la inducción cuando
                // la unidad ya está en la puerta es el problema que esto evita.
                <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)', borderRadius: 'var(--radius-sm)', fontSize: 13.5 }}>
                  <strong>Esta obra exige:</strong> {s.requirements.join(' · ')}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button type="button" style={{ ...btn, flex: '1 1 140px', opacity: ocupado === s.assignmentId ? 0.6 : 1 }} onClick={() => contestar(s.assignmentId, 'aceptado')} disabled={ocupado === s.assignmentId}>
                  Sí puedo
                </button>
                <button type="button" style={{ ...btnSec, flex: '1 1 140px' }} onClick={() => contestar(s.assignmentId, 'rechazado')} disabled={ocupado === s.assignmentId}>
                  No puedo
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
                Folio {s.quoteNumber}
              </div>
            </div>
          ))}
        </div>
      </section>

      {enCurso.length > 0 ? (
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Lo que traes ahora</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {enCurso.map((s) => (
              <div key={s.quoteNumber} style={card}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{s.site ?? s.category ?? 'Servicio'}</div>
                <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                  {s.address ?? ''}
                  {s.contactName ? <><br />En obra: {s.contactName}</> : null}
                  {s.contactPhone ? <> · <a href={`tel:${s.contactPhone}`} style={{ color: 'var(--color-primary)' }}>{s.contactPhone}</a></> : null}
                </div>
                {s.requirements.length > 0 ? (
                  <div style={{ marginTop: 9, fontSize: 13, color: 'var(--color-warning)' }}>
                    Exige: {s.requirements.join(' · ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Confirmar disponibilidad: el control del documento contra el dato viejo. */}
      {equipos.length > 0 ? (
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>Tus equipos</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Si confirmas seguido, te llegan más solicitudes: sólo te proponemos lo que sabemos que
            está libre.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {equipos.map((e) => {
              const viejo = e.diasSinConfirmar === null || e.diasSinConfirmar > 14;
              return (
                <div key={e.id} style={{ ...card, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{e.name}</div>
                      <div style={{ fontSize: 12.5, color: viejo ? 'var(--color-warning)' : 'var(--color-text-muted)', marginTop: 3 }}>
                        {e.confirmacion}{e.location ? ` · ${e.location}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...btnSec, padding: '9px 14px', fontSize: 13.5 }} onClick={() => moverEquipo(e.id, e.location)} disabled={ocupado === e.id}>
                        Dónde está
                      </button>
                      <button type="button" style={{ ...btn, padding: '9px 14px', fontSize: 13.5, opacity: ocupado === e.id ? 0.6 : 1 }} onClick={() => confirmar(e.id)} disabled={ocupado === e.id}>
                        Sigue libre
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {documentos.avisos.length > 0 ? (
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>Tus papeles</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Un papel vencido te quita el sello de verificado y te saca de las propuestas. Mándanos
            el renovado y lo subimos.
          </p>
          <div style={{ ...card, display: 'grid', gap: 8 }}>
            {documentos.avisos.map((d) => (
              <div key={d.documentId} style={{ fontSize: 13.5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: d.urgencia === 'vencido' ? 'var(--color-error)' : 'var(--color-warning)', fontWeight: 700, minWidth: 150 }}>
                  {d.texto}
                </span>
                <span>{d.name || d.kind}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Decisión 2: si el sistema lo ordena con estos números, tiene derecho a verlos. */}
      <section>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Cómo vas con nosotros</h2>
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{cumplimiento.resumen}</p>
          {cumplimiento.ofrecidos > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 12, marginTop: 16 }}>
              {[
                ['Te ofrecimos', cumplimiento.ofrecidos],
                ['Aceptaste', cumplimiento.aceptados],
                ['Completaste', cumplimiento.completados],
                ['Cancelaste', cumplimiento.cancelados],
              ].map(([t, n]) => (
                <div key={String(t)}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{n as number}</div>
                </div>
              ))}
            </div>
          ) : null}
          {cumplimiento.minutosRespuestaReal !== null ? (
            <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Contestas en ~{cumplimiento.minutosRespuestaReal} min
              {cumplimiento.minutosRespuestaDeclarado !== null
                ? ` y tenemos anotado que respondes en ${cumplimiento.minutosRespuestaDeclarado}.`
                : '.'}
              {' '}Entre más rápido contestes, más arriba apareces cuando buscamos a quién ofrecerle.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
