'use client';

import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { AMBAR, AZUL, Barra, Chip, Encabezado, GRIS, SIGUIENTE, Titulo, VERDE, dinero, estadoDocs, fechaHora, fechaLarga, minutosDesde, pagoTexto } from './comun';
import type { Ir } from './PortalAliado';
import type { Oferta } from './oferta';
import type { DatosPortal } from './tipos';

/**
 * INICIO (2026-10-27): lo que necesita su atención hoy, en orden, y a dónde ir.
 *
 * Nada de aquí se contesta aquí: cada aviso lleva a su pantalla. La idea es
 * que un aliado que abre el enlace desde el teléfono sepa en tres segundos si
 * tiene algo que hacer y qué es.
 */

type Aviso = {
  tono: 'info' | 'warn' | 'bad' | '';
  icono: IconName;
  titulo: string;
  texto: string;
  accion: string;
  ir: () => void;
};

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export function VistaInicio({ datos, oferta, ir }: { datos: DatosPortal; oferta: Oferta; ir: Ir }) {
  const { aliado, porContestar, enCurso, equipos, documentos, cumplimiento } = datos;
  const cobros = datos.cobros ?? [];
  const propuestas = datos.propuestas ?? [];
  const docs = estadoDocs(documentos.estado);

  // La fecha se arma en el navegador: el servidor puede estar en otra zona horaria.
  const [hoy, setHoy] = useState<string | null>(null);
  useEffect(() => setHoy(fechaLarga(new Date())), []);

  const nombre = (aliado.contactName?.trim() || aliado.name).split(/\s+/)[0] ?? aliado.name;

  // ── Lo que necesita acción, de lo más urgente a lo informativo ──
  const sinFactura = cobros.filter((c) => c.estado === 'falta-factura');
  const programados = cobros.filter((c) => c.estado === 'programado');
  const sumar = (xs: { monto: number }[]) => xs.reduce((t, c) => t + c.monto, 0);
  const masVieja = porContestar.reduce<number>((m, s) => Math.max(m, minutosDesde(s.offeredAt)), 0);
  const conPaso = enCurso.filter((s) => SIGUIENTE[s.state ?? 'asignado']);

  const avisos: Aviso[] = [];
  if (porContestar.length) {
    avisos.push({
      tono: 'info',
      icono: 'bell',
      titulo: `${porContestar.length} ${plural(porContestar.length, 'solicitud espera', 'solicitudes esperan')} tu respuesta`,
      texto: masVieja >= 60 * 24
        ? `La más antigua lleva ${Math.round(masVieja / 1440)} ${plural(Math.round(masVieja / 1440), 'día', 'días')} sin respuesta. La oferta sale a varios aliados a la vez: quien contesta primero se la queda.`
        : 'La oferta sale a varios aliados a la vez: quien contesta primero se la queda.',
      accion: 'Contestar',
      ir: () => ir({ vista: 'solicitudes', filtro: 'pendientes' }),
    });
  }
  if (conPaso.length) {
    const s = conPaso[0]!;
    const sig = SIGUIENTE[s.state ?? 'asignado']!;
    avisos.push({
      tono: 'info',
      icono: 'truck',
      titulo: enCurso.length === 1 ? 'Tienes un trabajo en curso' : `Tienes ${enCurso.length} trabajos en curso`,
      texto: `${s.site ?? s.category ?? 'Servicio'}: el siguiente paso es "${sig.texto}". ${s.committedAt ? `Llegada comprometida ${fechaHora(s.committedAt)}.` : ''}`.trim(),
      accion: 'Reportar avance',
      ir: () => ir({ vista: 'solicitudes', filtro: 'curso', seleccion: s.quoteNumber }),
    });
  }
  if (sinFactura.length) {
    avisos.push({
      tono: 'warn',
      icono: 'calculator',
      titulo: `${sinFactura.length} ${plural(sinFactura.length, 'servicio terminado', 'servicios terminados')} sin factura`,
      texto: `Son ${dinero(sumar(sinFactura))} con IVA. Te pagamos en cuanto subas tu factura y el cliente pague.`,
      accion: 'Subir factura',
      ir: () => ir({ vista: 'cobros' }),
    });
  }
  if (docs.tono !== 'ok') {
    const faltan = documentos.faltan ?? [];
    avisos.push({
      tono: docs.tono === 'bad' ? 'bad' : 'warn',
      icono: 'shield',
      titulo: documentos.lista.length === 0
        ? 'Todavía no tienes papeles entregados'
        : documentos.estado === 'vencido' ? 'Tienes un papel vencido' : documentos.estado === 'por-vencer' ? 'Tienes un papel por vencer' : 'Te faltan papeles',
      texto: faltan.length
        ? `Te falta: ${faltan.join(' y ')}. Sin ellos no tienes el sello de verificado y sales al final de las propuestas.`
        : documentos.avisos.map((a) => `${a.name || a.kind}: ${a.texto.toLowerCase()}`).join(' · ') || 'Con tus papeles vigentes obtienes el sello de verificado.',
      accion: documentos.lista.length === 0 ? 'Subir papeles' : 'Renovar',
      ir: () => ir({ vista: 'papeles' }),
    });
  }
  if (programados.length) {
    const proximo = [...programados].sort((a, b) => (a.pagarEl ?? '').localeCompare(b.pagarEl ?? ''))[0]!;
    avisos.push({
      tono: '',
      icono: 'check',
      titulo: `Tienes ${dinero(sumar(programados))} con pago programado`,
      texto: proximo.pagarEl ? `El primero te llega el ${new Date(`${proximo.pagarEl.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}.` : 'Te avisamos por correo cuando salga.',
      accion: 'Ver cobros',
      ir: () => ir({ vista: 'cobros' }),
    });
  }
  if (propuestas.length) {
    avisos.push({
      tono: '',
      icono: 'box',
      titulo: `${propuestas.length} ${plural(propuestas.length, 'equipo nuevo', 'equipos nuevos')} en revisión`,
      texto: 'No estaban en la lista: MAQSER24 los revisa y te avisa por correo.',
      accion: 'Ver',
      ir: () => ir({ vista: 'equipos' }),
    });
  }

  // ── Para recibir trabajo: qué le falta, en orden ──
  const pasos: Array<{ hecho: boolean; texto: string; ayuda: string; vista?: () => void }> = [
    { hecho: Boolean(aliado.phone && aliado.email && aliado.coverage.length), texto: 'Tus datos y tu cobertura', ayuda: 'Teléfono, correo y los municipios a los que llegas.', vista: () => ir({ vista: 'cuenta' }) },
    { hecho: documentos.lista.length > 0 && !(documentos.faltan?.length), texto: 'Entregar tus papeles', ayuda: documentos.faltan?.length ? `Te falta: ${documentos.faltan.join(' y ')}.` : 'Póliza de seguro, constancia fiscal y DC-3 de tus operadores.', vista: () => ir({ vista: 'papeles' }) },
    { hecho: aliado.verified, texto: 'Sello de verificado', ayuda: 'Sale solo en cuanto tu constancia fiscal y tu póliza de seguro están vigentes.' },
    { hecho: equipos.length > 0, texto: `Ofrecer tus ${oferta.queOfrece}`, ayuda: propuestas.length ? 'Ya enviaste lo que tienes: MAQSER24 revisa lo nuevo.' : `Toca "${oferta.botonOfrecer}" y elige qué tienes de la lista: te empiezan a llegar sus solicitudes.`, vista: () => ir({ vista: 'equipos' }) },
  ];
  const listos = pasos.filter((p) => p.hecho).length;

  const kpis: Array<{ n: number | string; label: string; color: string; icono: IconName; ir: () => void }> = [
    { n: porContestar.length, label: 'Por contestar', color: porContestar.length ? AZUL : GRIS, icono: 'bell', ir: () => ir({ vista: 'solicitudes', filtro: 'pendientes' }) },
    { n: enCurso.length, label: 'En curso', color: enCurso.length ? VERDE : GRIS, icono: 'truck', ir: () => ir({ vista: 'solicitudes', filtro: 'curso' }) },
    { n: sinFactura.length ? dinero(sumar(sinFactura)) ?? '0' : programados.length ? dinero(sumar(programados)) ?? '0' : 0, label: sinFactura.length ? 'Por facturar' : programados.length ? 'Pago programado' : 'Por cobrar', color: sinFactura.length ? AMBAR : programados.length ? VERDE : GRIS, icono: 'calculator', ir: () => ir({ vista: 'cobros' }) },
    { n: docs.label, label: 'Papeles', color: docs.color, icono: 'shield', ir: () => ir({ vista: 'papeles' }) },
  ];

  return (
    <>
      <Encabezado
        titulo={`Hola, ${nombre}`}
        desc={hoy ? `${hoy.charAt(0).toUpperCase()}${hoy.slice(1)}. ${avisos.length ? 'Esto es lo que tienes pendiente, en orden.' : 'No tienes nada pendiente.'}` : ' '}
      />

      {/* ── Resumen en cifras: cada una lleva a su pantalla ── */}
      <nav className="al-kpis" aria-label="Resumen">
        {kpis.map((k) => (
          <button key={k.label} type="button" className="al-kpi" onClick={k.ir}>
            <span className="ms-stat-l"><Icon name={k.icono} size={14} />{k.label}</span>
            <span className={`ms-stat-n${typeof k.n === 'number' ? '' : ' al-stat-txt'}`} style={{ color: k.color }}>{k.n}</span>
          </button>
        ))}
      </nav>

      {/* ── Lo que necesita acción ── */}
      <section>
        <Titulo>{avisos.length ? 'Pendientes' : 'Todo al día'}</Titulo>
        {avisos.length ? (
          <div className="al-avisos">
            {avisos.map((a) => (
              <div key={a.titulo} className="al-aviso" data-tono={a.tono}>
                <span className={`ms-ico${a.tono === 'warn' ? ' ms-ico-warn' : a.tono === 'bad' ? ' ms-ico-bad' : a.tono === '' ? ' ms-ico-muted' : ''}`} aria-hidden>
                  <Icon name={a.icono} size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="al-aviso-t">{a.titulo}</p>
                  <p className="al-aviso-p">{a.texto}</p>
                </div>
                <button type="button" className={`ms-btn ms-btn-sm${a.tono === '' ? ' ms-btn-sec' : ''}`} onClick={a.ir}>
                  {a.accion}<Icon name="arrowRight" size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="ms-empty al-vacio">
            <span className="ms-ico ms-ico-ok" aria-hidden><Icon name="check" size={19} /></span>
            <p className="ms-h3" style={{ marginTop: 10 }}>Nada pendiente por ahora</p>
            <p className="ms-empty-p">Cuando un cliente pida algo de tus {oferta.oferta}, aparece aquí y te avisamos por correo al instante.</p>
          </div>
        )}
      </section>

      {/* ── Para recibir trabajo ── */}
      {listos < pasos.length ? (
        <section className="ms-panel">
          <div className="al-card-top" style={{ alignItems: 'center', marginBottom: 12 }}>
            <h2 className="ms-h3">Para empezar a recibir trabajo</h2>
            <span className="ms-small ms-muted ms-num">{listos} de {pasos.length}</span>
          </div>
          <Barra valor={listos / pasos.length} color={VERDE} />
          <ol className="al-pasos">
            {pasos.map((p) => (
              <li key={p.texto}>
                <span className="al-paso-ico" data-on={p.hecho} aria-hidden>
                  {p.hecho ? <Icon name="check" size={13} /> : null}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="al-paso-t" data-on={p.hecho}>{p.texto}</span>
                  {!p.hecho ? (
                    <span className="al-paso-a">
                      {p.ayuda}{' '}
                      {p.vista ? <button type="button" className="ms-link" onClick={p.vista}>Ir<Icon name="arrowRight" size={13} /></button> : null}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ── Lo que trae ahora, en corto ── */}
      {enCurso.length ? (
        <section>
          <Titulo desc="Toca uno para ver la obra, el contacto y reportar el avance.">Lo que traes ahora</Titulo>
          <div className="al-hoy">
            {enCurso.map((s) => {
              const sig = SIGUIENTE[s.state ?? 'asignado'];
              return (
                <div key={s.quoteNumber} className="al-hoy-i">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="al-hoy-t">{s.site ?? s.category ?? 'Servicio'}</span>
                      <Chip tono="info">{s.stateLabel ?? 'Asignado'}</Chip>
                    </div>
                    <span className="al-hoy-s">
                      Folio {s.quoteNumber}{s.committedAt ? ` · llegada ${fechaHora(s.committedAt)}` : ''}{pagoTexto(s.pago) ? ` · te pagamos ${pagoTexto(s.pago)}` : ''}
                      {sig ? ` · siguiente paso: ${sig.texto.toLowerCase()}` : ''}
                    </span>
                  </div>
                  <button type="button" className="ms-btn ms-btn-sm ms-btn-sec" onClick={() => ir({ vista: 'solicitudes', filtro: 'curso', seleccion: s.quoteNumber })}>
                    {sig ? 'Reportar avance' : 'Ver'}<Icon name="arrowRight" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Cómo va, en una línea ── */}
      <section className="ms-panel" style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p className="ms-h3" style={{ margin: 0 }}>Cómo vas con nosotros</p>
          <p className="ms-muted" style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.55 }}>
            {cumplimiento.resumen}
            {cumplimiento.ofrecidos ? ` Te ofrecimos ${cumplimiento.ofrecidos}, aceptaste ${cumplimiento.aceptados} y completaste ${cumplimiento.completados}.` : ''}
          </p>
        </div>
        <button type="button" className="ms-link" onClick={() => ir({ vista: 'cuenta' })}>Ver detalle<Icon name="arrowRight" size={14} /></button>
      </section>

      {/* Lo que MAQSER24 le ofrece a alguien como él, con las palabras del documento. */}
      {oferta.tipos.length && !equipos.length ? (
        <ul className="al-ofrece">
          {oferta.tipos.map((t) => (
            <li key={t.clave}><b>Como {t.nombre.toLowerCase()}:</b> {t.ofrece}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
