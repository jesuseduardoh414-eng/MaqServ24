import type { Metadata } from 'next';
import type { ProductCard } from '@maqserv/types';
import { parseProductSlug } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { getProduct, getCategories } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { QuoteForm } from './QuoteForm';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'quote.form.title')} — ${t(theme, 'site.name')}` };
}

type Search = { producto?: string; servicio?: string };

export default async function QuotePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [theme, user] = await Promise.all([getTheme(), getSessionUser()]);

  // ?producto= acepta id numérico o slug nombre-id
  let product: ProductCard | null = null;
  if (sp.producto) {
    const id = /^\d+$/.test(sp.producto) ? Number(sp.producto) : parseProductSlug(sp.producto);
    if (id) product = await getProduct(id).catch(() => null);
  }

  // ?servicio= viene de las categorías SIN catálogo (agua en pipas, triturados).
  // No hay producto que enganchar, así que se resuelve el nombre de la categoría
  // y se deja escrito en la solicitud para que el cliente no tenga que
  // explicarlo. Se busca contra las categorías reales en vez de traducir el
  // slug a mano: si el cliente le cambia el nombre desde el admin, esto lo
  // sigue sin tocar código.
  let servicio: string | null = null;
  if (sp.servicio && !product) {
    const cats = await getCategories().catch(() => []);
    servicio = cats.find((c) => c.slug === sp.servicio)?.name ?? null;
  }

  return (
    <>
      <SiteHeader theme={theme} />
      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
        <style>{`
          @media (max-width: 760px){
            .qf-wrap{ padding-left:22px !important; padding-right:22px !important; }
            .qf-title{ font-size:34px !important; }
            .qf-two{ grid-template-columns:1fr !important; }
          }
          .qf-field:focus{ border-color: var(--color-text) !important; }
          .qf-hit:hover{ background: color-mix(in srgb, var(--color-text) 5%, transparent) !important; }
        `}</style>
        <main className="qf-wrap" style={{ maxWidth: 820, margin: '0 auto', padding: '44px 40px 60px' }}>
          <div style={{ borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 28 }}>
            <h1 className="qf-title" style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>{t(theme, 'quote.form.title')}</h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '10px 0 0', fontSize: 15, lineHeight: 1.6 }}>{t(theme, 'quote.form.subtitle')}</p>
          </div>
          <QuoteForm
          product={product}
          servicio={servicio}
          user={user}
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
            }}
          />
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
