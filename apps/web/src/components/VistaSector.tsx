import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/Enlace';
import { BLOQUES_SECTOR, recortarSector, textoPlanoSector, type Theme } from '@maqserv/config';
import type { BloqueSectorDTO, ParteListaSectorDTO, StrategicSectorDetail } from '@maqserv/types';
import { t } from '@/lib/theme';
import { Icon } from '@/components/Icon';

/**
 * Página de un sector (encabezado + apartados + Servicios incluidos), sin el
 * menú ni el pie. La usan /sectores/[slug] y la vista previa del panel
 * (2026-11-16), así lo que se ve al editar es lo que sale publicado.
 *
 * Cada apartado lleva su título (el de siempre o el que se escribió), su frase
 * destacada y su texto; los vacíos no salen.
 */

const CSS = `
.sc-hero{ position:relative; min-height:420px; background:var(--band); overflow:hidden; border-bottom:1px solid var(--color-border); }
.sc-hero-in{ position:relative; max-width:1180px; margin:0 auto; min-height:420px; padding:40px 32px 44px; display:flex; flex-direction:column; justify-content:flex-end; }
.sc-hero .ms-hero-title{ color:#fff; text-shadow:0 2px 24px rgba(0,0,0,.35); }
.sc-hero .ms-hero-desc{ color:rgba(255,255,255,.9); text-shadow:0 1px 14px rgba(0,0,0,.55); }
.sc-body{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:48px; align-items:start; }
.sc-bloque{ margin-top:44px; }
.sc-bloque:first-child{ margin-top:0; }
.sc-bloque .ms-h2{ margin-bottom:12px; }
.sc-dest{ margin:0 0 14px; padding-left:14px; border-left:3px solid var(--color-primary); font-size:17px; font-weight:600; line-height:1.45; color:var(--color-text); }
.sc-rich{ font-size:16px; line-height:1.7; color:var(--color-text-muted); }
.sc-grupo{ margin:22px 0 10px; font-size:12.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--color-text-muted); }
.sc-grupo:first-child{ margin-top:0; }
.sc-nota{ margin:14px 0 0; font-size:14.5px; line-height:1.6; color:var(--color-text-muted); }
.sc-nota:first-child{ margin-top:0; margin-bottom:14px; }
.sc-list{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap:10px; }
.sc-list.con-detalle{ grid-template-columns:repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.sc-list > div{ display:flex; align-items:center; gap:12px; padding:14px 16px; }
.sc-list.con-detalle > div{ align-items:flex-start; }
.sc-list .ms-ico{ width:30px; height:30px; border-radius:8px; flex-shrink:0; }
.sc-item-nombre{ display:block; font-size:15px; font-weight:600; line-height:1.4; }
.sc-item-det{ display:block; margin-top:3px; font-size:14px; line-height:1.5; color:var(--color-text-muted); }
.sc-aside{ position:sticky; top:100px; }
.sc-cta{ display:flex; align-items:center; justify-content:space-between; gap:24px 40px; flex-wrap:wrap; background:var(--band); }
.sc-cta .ms-h2{ color:#fff; font-size:26px; }
@media (max-width: 900px){
  .sc-body{ grid-template-columns:minmax(0,1fr); gap:32px; }
  .sc-aside{ position:static; }
}
@media (max-width: 640px){
  .sc-hero, .sc-hero-in{ min-height:340px; }
  .sc-hero-in{ padding:32px 16px 32px; }
  .sc-dest{ font-size:16px; }
}
`;

const TITULO_DE = Object.fromEntries(BLOQUES_SECTOR.map((b) => [b.clave, b.titulo])) as Record<string, string>;

/** Lo que mandaba la API antes del 16 nov: sin `bloques` ni `lista`. */
function bloquesDe(s: StrategicSectorDetail): BloqueSectorDTO[] {
  if (Array.isArray(s.bloques)) return s.bloques;
  return [
    { clave: 'sobre', titulo: null, destacado: null, html: s.description },
    { clave: 'trayectoria', titulo: null, destacado: null, html: s.trayectoria },
    { clave: 'esencia', titulo: null, destacado: null, html: s.esencia },
    { clave: 'servicios', titulo: null, destacado: null, html: s.servicios },
    { clave: 'excelencia', titulo: null, destacado: null, html: s.excelencia },
  ];
}

function ListaServicios({ partes }: { partes: ParteListaSectorDTO[] }) {
  const piezas: ReactNode[] = [];
  let items: Extract<ParteListaSectorDTO, { tipo: 'item' }>[] = [];
  const cerrar = () => {
    if (!items.length) return;
    const conDetalle = items.some((i) => i.detalle);
    piezas.push(
      <div key={`l${piezas.length}`} className={`sc-list${conDetalle ? ' con-detalle' : ''}`}>
        {items.map((it, i) => (
          <div key={i} className="ms-panel">
            <span className="ms-ico" aria-hidden><Icon name="check" size={15} /></span>
            <span style={{ minWidth: 0 }}>
              <span className="sc-item-nombre">{it.detalle ? it.nombre : it.nombre.replace(/\.$/, '')}</span>
              {it.detalle ? <span className="sc-item-det">{it.detalle}</span> : null}
            </span>
          </div>
        ))}
      </div>,
    );
    items = [];
  };
  for (const p of partes) {
    if (p.tipo === 'item') { items.push(p); continue; }
    cerrar();
    piezas.push(p.tipo === 'grupo'
      ? <h3 key={`g${piezas.length}`} className="sc-grupo">{p.texto}</h3>
      : <p key={`n${piezas.length}`} className="sc-nota">{p.texto}</p>);
  }
  cerrar();
  return <>{piezas}</>;
}

export function VistaSector({ theme, sector, catalogo }: { theme: Theme; sector: StrategicSectorDetail; catalogo: string }) {
  const encabezado = sector.frase ?? (recortarSector(textoPlanoSector(sector.description), 170) || null);
  const bloques = bloquesDe(sector).filter((b) => b.html || b.destacado);
  const lista = sector.lista ?? { titulo: null, destacado: null, partes: (sector.serviciosLista ?? []).map((nombre) => ({ tipo: 'item' as const, nombre, detalle: null })) };

  return (
    <>
      <style>{CSS}</style>
      <div className="ms-page">
        {/* ===== ENCABEZADO (foto a sangre + degradado) =====
            Siempre la imagen (2026-11-16, el dueño): el video va solo en la
            tarjeta del inicio, donde salen todos los sectores. */}
        <section className="sc-hero">
          {sector.image ? (
            <Image src={sector.image} alt={sector.title} fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          ) : (
            <span className="ph" aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
          )}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,14,20,.06) 0%, rgba(10,14,20,.2) 44%, rgba(10,14,20,.66) 78%, rgba(10,14,20,.88) 100%)' }} />
          <div className="sc-hero-in">
            <h1 className="ms-hero-title">{sector.title}</h1>
            {encabezado ? <p className="ms-hero-desc">{encabezado}</p> : null}
          </div>
        </section>

        <main className="ms-wrap">
          <div className="sc-body">
            <div style={{ minWidth: 0 }}>
              {bloques.map((b) => (
                <section key={b.clave} className="sc-bloque">
                  <h2 className="ms-h2">{b.titulo ?? (b.clave === 'sobre' ? t(theme, 'sector.about') : TITULO_DE[b.clave])}</h2>
                  {b.destacado ? <p className="sc-dest">{b.destacado}</p> : null}
                  {b.html ? <div className="sector-rich sc-rich" dangerouslySetInnerHTML={{ __html: b.html }} /> : null}
                </section>
              ))}

              {lista.partes.length > 0 ? (
                <section className="sc-bloque">
                  <h2 className="ms-h2">{lista.titulo ?? t(theme, 'sector.services.title')}</h2>
                  {lista.destacado ? <p className="sc-dest">{lista.destacado}</p> : null}
                  <ListaServicios partes={lista.partes} />
                </section>
              ) : null}
            </div>

            <aside className="sc-aside">
              <div className="ms-panel ms-panel-lg">
                <h2 className="ms-h2" style={{ marginBottom: 8 }}>{t(theme, 'sector.cta.title')}</h2>
                <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{t(theme, 'sector.cta.body')}</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Link href="/contacto" className="ms-btn ms-btn-block">{t(theme, 'sector.cta.quote')}</Link>
                  <Link href={catalogo} className="ms-btn ms-btn-sec ms-btn-block">{t(theme, 'sector.cta.catalog')}</Link>
                </div>
              </div>
            </aside>
          </div>

          {/* ===== CTA FINAL ===== */}
          <section className="ms-section" style={{ marginTop: 64 }}>
            <div className="ms-panel ms-panel-lg sc-cta">
              <div style={{ maxWidth: 600, minWidth: 0 }}>
                <h2 className="ms-h2">{t(theme, 'sector.band.title')}</h2>
                <p style={{ margin: '8px 0 0', fontSize: '15.5px', lineHeight: 1.6, color: 'rgba(255,255,255,.78)' }}>{t(theme, 'sector.band.body')}</p>
              </div>
              <div className="ms-hero-acts" style={{ marginTop: 0 }}>
                <Link href="/contacto" className="ms-btn ms-btn-lg">{t(theme, 'sector.cta.quote')}</Link>
                <Link href="/" className="ms-btn ms-btn-lg ms-btn-sec" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>{t(theme, 'sector.band.others')}</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
