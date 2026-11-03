import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NOINDEX } from '@/lib/seo';
import type { ProductCard } from '@maqserv/types';
import { parseProductSlug, requestFormFor } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { getProduct, getCategories } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { QuoteForm } from './QuoteForm';
import { QuoteGate } from './QuoteGate';
import { A_LA_MEDIDA, COTIZADOR, LISTA_PARA_COTIZAR } from '@/lib/enlace-cotizar';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'quote.form.title')} — ${t(theme, 'site.name')}` };
}

/** `lista` y `medida`: vienen de «Tu lista para cotizar» y de «Pedir algo a la medida». */
type Search = { producto?: string; servicio?: string; lista?: string; medida?: string };

export default async function QuotePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  /**
   * SIN NADA QUE COTIZAR, AL COTIZADOR (2026-11-03, pedido del dueño): el
   * formulario abría con «Buscar equipo» y se esperaba el cliente con los
   * servicios disponibles. Queda para un equipo, una categoría sin precio, la
   * lista o «Pedir algo a la medida»; /cotizar a secas (botones guardados en
   * el diseño, enlaces viejos) lleva a elegir la categoría.
   */
  if (!sp.producto && !sp.servicio && !sp.lista && !sp.medida) redirect(COTIZADOR);
  const [theme, user] = await Promise.all([getTheme(), getSessionUser()]);

  /**
   * SIN CUENTA NO SE COTIZA (2026-09-23): el visitante ve el candado en lugar
   * del formulario, y `next` trae esta misma URL con su equipo o servicio para
   * que al entrar aterrice exactamente aquí. Ver QuoteGate.
   */
  const next = sp.producto
    ? `/cotizar?producto=${encodeURIComponent(sp.producto)}`
    : sp.servicio
      ? `/cotizar?servicio=${encodeURIComponent(sp.servicio)}`
      : sp.lista ? LISTA_PARA_COTIZAR : A_LA_MEDIDA;

  // ?producto= acepta id numérico o slug nombre-id
  let product: ProductCard | null = null;
  if (sp.producto) {
    const id = /^\d+$/.test(sp.producto) ? Number(sp.producto) : parseProductSlug(sp.producto);
    if (id) product = await getProduct(id).catch(() => null);
  }

  // ?servicio= viene de las categorías SIN catálogo (transporte, triturados,
  // materiales, asfalto).
  // No hay producto que enganchar, así que se resuelve el nombre de la categoría
  // y se deja escrito en la solicitud para que el cliente no tenga que
  // explicarlo. Se busca contra las categorías reales en vez de traducir el
  // slug a mano: si el cliente le cambia el nombre desde el admin, esto lo
  // sigue sin tocar código.
  let servicio: string | null = null;
  let categoriaServicio: string | null = null;
  if (sp.servicio && !product) {
    const cats = await getCategories().catch(() => []);
    const cat = cats.find((c) => c.slug === sp.servicio);
    servicio = cat?.name ?? null;
    categoriaServicio = cat?.slug ?? null;
  }

  return (
    <>
      <SiteHeader theme={theme} />
      {/* Pantalla de trabajo: contenedor angosto y encabezado `.ms-head`
          del sistema de diseño (ver components/EstilosSistema.tsx). */}
      <div className="ms-page">
        <main className="ms-wrap-narrow">
          <header className="ms-head">
            <div className="ms-head-txt">
              <h1 className="ms-title">{t(theme, 'quote.form.title')}</h1>
              <p className="ms-desc">{t(theme, 'quote.form.subtitle')}</p>
            </div>
          </header>
          {!user ? (
            <QuoteGate theme={theme} next={next} />
          ) : (
            <QuoteForm
              product={product}
              servicio={servicio}
              formulario={requestFormFor(categoriaServicio ?? product?.categorySlug)}
              categoriaServicio={categoriaServicio ?? product?.categorySlug ?? null}
              user={user}
              logoDocumento={theme.tokens.branding?.logoLight ?? theme.tokens.branding?.logoAlt ?? null}
              labels={{
                name: t(theme, 'auth.field.name'),
                email: t(theme, 'auth.field.email'),
                phone: t(theme, 'checkout.field.phone'),
                company: t(theme, 'quote.form.company'),
                region: t(theme, 'quote.form.region'),
                industry: t(theme, 'quote.form.industry'),
                address: t(theme, 'quote.form.address'),
                comments: t(theme, 'quote.form.comments'),
                qty: t(theme, 'quote.form.qty'),
                days: t(theme, 'quote.form.days'),
                submit: t(theme, 'quote.form.submit'),
                successTitle: t(theme, 'quote.form.success.title'),
                successBody: t(theme, 'quote.form.success.body'),
                numberLabel: t(theme, 'quote.form.number'),
                emailLocked: t(theme, 'quote.form.emailLocked'),
                phoneSaved: t(theme, 'quote.form.phoneSaved'),
              }}
            />
          )}
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
