'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { telHref } from '@/lib/telefono';
import { CSS } from './estilos';
import { Chip, Insignia, estadoDocs, iniciales } from './comun';
import { ofertaDeAliado } from './oferta';
import { rutaDe, urlDeRuta, type ContactoMaqser, type DatosPortal, type Ruta, type Vista } from './tipos';
import { VistaInicio } from './VistaInicio';
import { VistaSolicitudes } from './VistaSolicitudes';
import { VistaEquipos } from './VistaEquipos';
import { VistaCobros } from './VistaCobros';
import { VistaPapeles } from './VistaPapeles';
import { VistaCuenta } from './VistaCuenta';

export type { DatosPortal, ContactoMaqser } from './tipos';

/**
 * EL PANEL DEL ALIADO (rediseño 2026-10-27: pantallas en vez de una sola página).
 *
 * Antes todo iba en una columna hacia abajo: solicitudes, lo que trae,
 * cobros, equipos, historial, papeles, datos… y el aliado se perdía. Ahora es
 * un panel con menú (barra lateral en escritorio, pestañas fijas en teléfono)
 * y seis pantallas:
 *
 *   Inicio       — lo que necesita su atención hoy y a dónde ir.
 *   Solicitudes  — por contestar / en curso / historial, como una bandeja:
 *                  lista ordenada a la izquierda y la elegida a la derecha.
 *   Equipos      — lo que tiene dado de alta, con filtros y mantenimiento.
 *   Cobros       — qué facturar y cuándo se le paga.
 *   Papeles      — su expediente y la subida.
 *   Mi cuenta    — datos, cómo va con nosotros y contacto.
 *
 * La pantalla va en la URL (`?v=`), así "atrás" funciona, recargar no lo
 * manda al inicio y un correo puede abrir la pantalla correcta. Cambiar de
 * pantalla no vuelve a pedir nada al servidor: los datos ya vienen completos.
 *
 * DECISIONES QUE VALE LA PENA DEJAR ESCRITAS (vienen del diseño de 2026-09-24):
 *
 * 1. Rechazar PIDE motivo; aceptar pide CUÁNDO LLEGA. El "no" sin motivo no
 *    sirve para nada, y el "sí" sin fecha no deja medir su puntualidad.
 * 2. Se le enseña su propio historial. Si el sistema lo ordena con esos
 *    números, tiene derecho a verlos, y es la única forma de discutirlos.
 * 3. "Para recibir trabajo" es una lista de lo que falta, no una calificación.
 */

export type Ir = (r: Ruta, modo?: 'push' | 'replace') => void;

/** Los enlaces viejos con ancla (`/aliado#solicitudes`) siguen abriendo su pantalla. */
const ANCLAS: Record<string, Ruta> = {
  solicitudes: { vista: 'solicitudes', filtro: 'pendientes' },
  'en-curso': { vista: 'solicitudes', filtro: 'curso' },
  equipos: { vista: 'equipos' },
  cobros: { vista: 'cobros' },
  papeles: { vista: 'papeles' },
};

/**
 * No recibe token. La credencial del aliado vive en una cookie httpOnly que el
 * proxy adjunta; el JavaScript de esta pantalla nunca la ve.
 */
export function PortalAliado({ datos, contacto, rutaInicial }: { datos: DatosPortal; contacto?: ContactoMaqser; rutaInicial?: Ruta }) {
  const [ruta, setRuta] = useState<Ruta>(rutaInicial ?? { vista: 'inicio' });
  // La pantalla actual, legible desde `ir` sin volver a crear la función.
  const vistaActual = useRef(ruta.vista);
  vistaActual.current = ruta.vista;

  const ir = useCallback<Ir>((r, modo = 'push') => {
    // Al cambiar de pantalla se empieza arriba; dentro de la misma (elegir una solicitud) no.
    if (vistaActual.current !== r.vista) window.scrollTo({ top: 0 });
    setRuta(r);
    const url = urlDeRuta(r);
    if (modo === 'replace') window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }, []);

  // "Atrás" del navegador, y los enlaces viejos con `#solicitudes`.
  useEffect(() => {
    const leer = () => setRuta(rutaDe(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener('popstate', leer);
    const ancla = ANCLAS[window.location.hash.replace('#', '')];
    if (ancla) ir(ancla, 'replace');
    return () => window.removeEventListener('popstate', leer);
  }, [ir]);

  const { aliado, porContestar, documentos } = datos;
  const oferta = ofertaDeAliado(aliado);
  const docs = estadoDocs(documentos.estado);
  const sinFactura = (datos.cobros ?? []).filter((c) => c.estado === 'falta-factura').length;

  const nav: Array<{ v: Vista; label: string; icono: IconName; insignia?: number; tono?: 'info' | 'warn' | 'muted'; punto?: string | null }> = [
    { v: 'inicio', label: 'Inicio', icono: 'home' },
    { v: 'solicitudes', label: 'Solicitudes', icono: 'bell', insignia: porContestar.length, tono: 'info' },
    { v: 'equipos', label: oferta.ofertaCorta, icono: 'box', insignia: (datos.propuestas ?? []).length, tono: 'muted' },
    { v: 'cobros', label: 'Cobros', icono: 'calculator', insignia: sinFactura, tono: 'warn' },
    { v: 'papeles', label: 'Papeles', icono: 'shield', punto: docs.tono === 'ok' ? null : docs.color },
    { v: 'cuenta', label: 'Mi cuenta', icono: 'user' },
  ];

  // Enlaces de verdad (abren en otra pestaña con el botón central) que, al
  // clic normal, cambian de pantalla sin recargar.
  const enlaces = nav.map((n) => (
    <a
      key={n.v}
      href={urlDeRuta({ vista: n.v })}
      className="al-nav-b"
      aria-current={ruta.vista === n.v ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        ir({ vista: n.v, ...(n.v === 'solicitudes' ? { filtro: ruta.vista === 'solicitudes' ? ruta.filtro : undefined } : {}) });
      }}
    >
      <Icon name={n.icono} size={17} />
      <span>{n.label}</span>
      {n.insignia ? (
        <Insignia n={n.insignia} tono={n.tono} />
      ) : n.punto ? (
        <span className="al-punto" style={{ background: n.punto }} role="img" aria-label={`Papeles: ${docs.label}`} />
      ) : null}
    </a>
  ));

  const ayuda = (
    <div className="al-ayuda">
      <p className="al-ayuda-k">¿Dudas? Habla con MAQSER24</p>
      {contacto?.phone ? <a href={telHref(contacto.phone)}><Icon name="phone" size={15} />{contacto.phone}</a> : null}
      {contacto?.email ? <a href={`mailto:${contacto.email}`}><Icon name="mail" size={15} />{contacto.email}</a> : null}
      {contacto?.hours ? <span className="al-ayuda-h"><Icon name="clock" size={14} />{contacto.hours}</span> : null}
      <a href="/"><Icon name="arrowRight" size={15} />Ir al sitio</a>
      <p className="al-ayuda-nota">Este enlace es personal: no lo compartas. Quien lo tenga entra como tú.</p>
    </div>
  );

  return (
    <div className="al-root">
      <style>{CSS}</style>
      <div className="al-grid">
        <aside className="al-side" aria-label="Tu panel">
          <div className="al-me">
            <span className="al-avatar" aria-hidden>{iniciales(aliado.name)}</span>
            <div className="al-me-txt">
              <p className="al-me-k">Panel de aliado</p>
              <p className="al-me-n">{aliado.name}</p>
              <div className="al-me-chips">
                {aliado.verified ? <Chip tono="ok">Verificado</Chip> : <Chip>Sin sello</Chip>}
                {aliado.level === 'preferente' ? <Chip tono="info">Preferente</Chip> : null}
              </div>
            </div>
          </div>
          <nav className="al-nav al-nav-desk" aria-label="Pantallas del panel">{enlaces}</nav>
          <div className="al-ayuda-desk">{ayuda}</div>
        </aside>

        <div className="al-main">
          <nav className="al-tabs-mob" aria-label="Pantallas del panel">{enlaces}</nav>
          {/* `key` por pantalla: al cambiar, los formularios a medias no se arrastran. */}
          <div className="al-vista" key={ruta.vista}>
            {ruta.vista === 'inicio' ? <VistaInicio datos={datos} oferta={oferta} ir={ir} /> : null}
            {ruta.vista === 'solicitudes' ? <VistaSolicitudes datos={datos} ruta={ruta} ir={ir} oferta={oferta} /> : null}
            {ruta.vista === 'equipos' ? <VistaEquipos datos={datos} oferta={oferta} /> : null}
            {ruta.vista === 'cobros' ? <VistaCobros datos={datos} /> : null}
            {ruta.vista === 'papeles' ? <VistaPapeles datos={datos} /> : null}
            {ruta.vista === 'cuenta' ? <VistaCuenta datos={datos} oferta={oferta} contacto={contacto} /> : null}
          </div>
          <div className="al-ayuda-mob">{ayuda}</div>
        </div>
      </div>
    </div>
  );
}
