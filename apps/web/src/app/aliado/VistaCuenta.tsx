'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { telHref } from '@/lib/telefono';
import { API, AZUL, Chip, Dato, Encabezado, ROJO, Titulo, VERDE, avisar, llamar } from './comun';
import type { Oferta } from './oferta';
import type { ContactoMaqser, DatosPortal } from './tipos';

/**
 * MI CUENTA (2026-10-27): sus datos, su perfil en la red, cómo va con
 * nosotros y cómo contactarnos. Todo lo que antes colgaba al final de la
 * página, ahora en su pantalla.
 */
export function VistaCuenta({ datos, oferta, contacto }: { datos: DatosPortal; oferta: Oferta; contacto?: ContactoMaqser }) {
  const router = useRouter();
  const { aliado, cumplimiento } = datos;
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const meses = aliado.monthsInNetwork === null
    ? null
    : aliado.monthsInNetwork === 0
      ? 'Nuevo en la red'
      : `${aliado.monthsInNetwork} ${aliado.monthsInNetwork === 1 ? 'mes' : 'meses'} en la red`;

  async function guardarDatos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGuardando(true);
    const ok = await llamar(`${API}/aliado/perfil`, {
      contactName: String(fd.get('contactName') ?? ''),
      city: String(fd.get('city') ?? ''),
      address: String(fd.get('address') ?? ''),
      coverage: String(fd.get('coverage') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    setGuardando(false);
    if (ok) { avisar('Listo, tus datos quedaron actualizados.'); setEditando(false); router.refresh(); }
  }

  return (
    <>
      <Encabezado titulo="Mi cuenta" desc="Tus datos de contacto, tu perfil en la red y cómo vas con nosotros." />

      <div className="al-cuenta">
        <div className="al-stack" style={{ gap: 24 }}>
          {/* ── Tus datos ── */}
          <section>
            <Titulo>Tus datos</Titulo>
            <div className="ms-panel">
              {!editando ? (
                <>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <Dato label="Contacto" valor={aliado.contactName} />
                    <Dato label="Teléfono" valor={aliado.phone} />
                    <Dato label="Correo" valor={aliado.email} />
                    <Dato label="Ciudad" valor={aliado.city} />
                    <Dato label="Dirección de tu base" valor={aliado.address} />
                    <Dato label="Zonas que cubres" valor={aliado.coverage.join(', ')} />
                  </div>
                  <button type="button" className="ms-btn ms-btn-sec ms-btn-block" style={{ marginTop: 18 }} onClick={() => setEditando(true)}>
                    <Icon name="user" size={15} />Corregir mis datos
                  </button>
                </>
              ) : (
                <form onSubmit={guardarDatos} style={{ display: 'grid', gap: 14 }}>
                  {/* El autocomplete también le dice al filtro de campos qué es cada uno
                      (nombre: solo letras; teléfono: solo números y 10 dígitos). */}
                  {([
                    ['contactName', 'Nombre de quien contesta', aliado.contactName, 'text', 'name', 190],
                    ['city', 'Ciudad', aliado.city, 'text', 'address-level2', 120],
                    ['address', 'Dirección de tu base', aliado.address, 'text', 'street-address', 500],
                  ] as const).map(([name, label, valor, tipo, auto, largo]) => (
                    <label key={name} className="ms-field">
                      <span className="ms-label">{label}</span>
                      <input name={name} type={tipo} defaultValue={valor ?? ''} className="ms-input" autoComplete={auto} maxLength={largo} />
                    </label>
                  ))}
                  <label className="ms-field">
                    <span className="ms-label">Zonas que cubres</span>
                    <input name="coverage" defaultValue={aliado.coverage.join(', ')} placeholder="Apodaca, Escobedo, García" className="ms-input" />
                    <span className="ms-hint">Separadas por coma.</span>
                  </label>
                  <p className="ms-hint">
                    Tu teléfono ({aliado.phone || 'sin teléfono'}) y tu correo ({aliado.email || 'sin correo'}) los cambiamos nosotros: escríbenos. Así nadie más puede quedarse con tus avisos. Lo mismo las líneas de servicio que atiendes.
                  </p>
                  <div className="al-acciones" style={{ marginTop: 0 }}>
                    <button type="submit" className="ms-btn" disabled={guardando}>
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setEditando(false)}>Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* ── Tu perfil en la red ── */}
          <section>
            <Titulo>Tu perfil en la red</Titulo>
            <div className="ms-panel" style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {aliado.verified ? <Chip tono="ok">Verificado</Chip> : <Chip>Sin sello</Chip>}
                {aliado.level === 'preferente' ? <Chip tono="info">Preferente</Chip> : null}
                {oferta.tipos.map((t) => <Chip key={t.clave} tono="info">{t.nombre}</Chip>)}
              </div>
              <div className="ms-desc al-meta" style={{ fontSize: 14 }}>
                <span><Icon name="mapPin" size={14} />{aliado.coverage.length ? aliado.coverage.join(', ') : 'Sin zonas registradas'}</span>
                {oferta.lineas.length ? <span><Icon name="grid" size={14} />{oferta.lineas.join(' · ')}</span> : null}
                {meses ? <span><Icon name="clock" size={14} />{meses}</span> : null}
              </div>
              {/* Lo que MAQSER24 le ofrece a alguien como él, con las palabras del documento. */}
              {oferta.tipos.length > 0 ? (
                <ul className="al-ofrece">
                  {oferta.tipos.map((t) => (
                    <li key={t.clave}><b>Como {t.nombre.toLowerCase()}:</b> {t.ofrece}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </div>

        <div className="al-stack" style={{ gap: 24 }}>
          {/* ── Cómo vas ── */}
          <section>
            <Titulo desc="Si el sistema te ordena con estos números, tienes derecho a verlos.">Cómo vas con nosotros</Titulo>
            <div className="ms-panel">
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{cumplimiento.resumen}</p>
              <div className="al-cifras" style={{ marginTop: 18 }}>
                {([
                  ['Te ofrecimos', cumplimiento.ofrecidos, 'var(--color-text)'],
                  ['Aceptaste', cumplimiento.aceptados, AZUL],
                  ['Completaste', cumplimiento.completados, VERDE],
                  ['Cancelaste', cumplimiento.cancelados, cumplimiento.cancelados ? ROJO : 'var(--color-text)'],
                ] as const).map(([t, n, c]) => (
                  <div key={t} className="al-cifra" style={{ background: 'var(--color-bg)' }}>
                    <span className="ms-stat-l">{t}</span>
                    <span className="ms-stat-n" style={{ color: c }}>{n}</span>
                  </div>
                ))}
              </div>
              <p className="ms-hint" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
                {cumplimiento.minutosRespuestaReal !== null
                  ? `Contestas en ~${cumplimiento.minutosRespuestaReal} min${cumplimiento.minutosRespuestaDeclarado !== null ? ` (tenemos anotado ${cumplimiento.minutosRespuestaDeclarado})` : ''}. `
                  : ''}
                Entre más rápido contestes y más puntual llegues, más arriba apareces cuando buscamos a quién ofrecerle.
              </p>
            </div>
          </section>

          {/* ── Contacto ── */}
          <section>
            <Titulo>¿Dudas? Estamos para ayudarte</Titulo>
            <div className="ms-panel al-contacto" style={{ display: 'grid', gap: 12 }}>
              <p className="ms-muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                Para cambiar tus líneas de servicio, corregir un equipo o aclarar una solicitud, contacta a MAQSER24.
              </p>
              {contacto?.phone ? (
                <a href={telHref(contacto.phone)} className="ms-btn">
                  <Icon name="phone" size={16} />{contacto.phone}
                </a>
              ) : null}
              {contacto?.email ? (
                <a href={`mailto:${contacto.email}`} className="ms-btn ms-btn-sec">
                  <Icon name="mail" size={16} />{contacto.email}
                </a>
              ) : null}
              {contacto?.hours ? (
                <div className="ms-small ms-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="clock" size={14} />{contacto.hours}</div>
              ) : null}
              <p className="ms-hint" style={{ fontSize: 12 }}>
                Este enlace es personal: no lo compartas. Quien lo tenga entra como tú.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
