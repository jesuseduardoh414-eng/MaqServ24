import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon, type IconName } from '@/components/Icon';
import { RegistroProveedorForm } from './RegistroProveedorForm';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, {
    ruta: '/proveedores',
    titulo: 'Regístrate como proveedor de maquinaria y servicios',
    descripcion: 'Registra tu empresa, maquinaria o servicios para formar parte de la red de proveedores MAQSER24 en Monterrey y el norte de México.',
  });
}

/** Qué pasa después de enviar. Sin promesas de plazos: lo decide la revisión. */
const PASOS: Array<{ icono: IconName; titulo: string; texto: string }> = [
  { icono: 'article', titulo: 'Envías tu registro', texto: 'Tu empresa o tus datos, qué equipos o servicios ofreces, dónde está tu base y a qué municipios llegas.' },
  { icono: 'search', titulo: 'Revisamos la información', texto: 'El equipo de MAQSER24 revisa tu registro y lo que ofreces.' },
  // Desde 2026-10-09 el enlace sale solo al aceptarlo (ver `aceptarSolicitud` en la API).
  { icono: 'link', titulo: 'Te damos acceso', texto: 'Si te aceptamos, te llega por correo el enlace a tu portal: ahí subes tus papeles, ofreces tus equipos y contestas solicitudes.' },
];

const CSS = `
.rp-main{ display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:56px; align-items:start; }
.rp-pasos{ display:grid; gap:10px; margin:0; padding:0; list-style:none; }
.rp-paso{ display:grid; grid-template-columns:auto minmax(0,1fr); gap:14px; align-items:start; padding:16px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; }
.rp-paso-t{ display:block; font-size:15px; font-weight:600; color:var(--color-text); }
.rp-paso-p{ display:block; margin-top:4px; font-size:14px; line-height:1.55; color:var(--color-text-muted); }
@media (max-width: 960px){ .rp-main{ grid-template-columns:minmax(0,1fr); gap:40px; } }
`;

export default async function ProveedoresPage() {
  const theme = await getTheme();

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: 'Regístrate como proveedor' }])} />
      <style>{CSS}</style>

      <div className="ms-page">
        <main className="ms-wrap">
          <header className="ms-hero" style={{ paddingTop: 16 }}>
            <p className="ms-kicker">Red de proveedores</p>
            <h1 className="ms-hero-title">Regístrate como proveedor</h1>
            <p className="ms-hero-desc">
              Registra tu empresa, maquinaria o servicios. Nuestro equipo revisará la información y se pondrá en contacto contigo para continuar el proceso.
            </p>
          </header>

          <div className="rp-main">
            <section aria-labelledby="rp-form-t">
              <div className="ms-sec-head">
                <div>
                  <h2 id="rp-form-t" className="ms-h2">Tus datos</h2>
                  <p className="ms-h2-desc">Para empresas y propietarios de equipo. Los campos con asterisco son obligatorios.</p>
                </div>
              </div>
              <div className="ms-panel ms-panel-lg">
                <RegistroProveedorForm />
              </div>
            </section>

            <section aria-labelledby="rp-pasos-t">
              <div className="ms-sec-head">
                <h2 id="rp-pasos-t" className="ms-h2">Cómo sigue</h2>
              </div>
              <ol className="rp-pasos">
                {PASOS.map((p) => (
                  <li key={p.titulo} className="rp-paso">
                    <span className="ms-ico" aria-hidden><Icon name={p.icono} size={18} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="rp-paso-t">{p.titulo}</span>
                      <span className="rp-paso-p">{p.texto}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
