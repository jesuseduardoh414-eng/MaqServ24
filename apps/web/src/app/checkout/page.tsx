import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { PaymentMethod } from '@maqserv/types';
import { defaultTheme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { CheckoutForm } from './CheckoutForm';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'checkout.title')} — ${t(theme, 'site.name')}` };
}

export default async function CheckoutPage() {
  const [theme, user] = await Promise.all([getTheme(), getSessionUser()]);
  if (!user) redirect('/login');

  const methods = (await fetch(`${API_URL}/payments/methods`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    .then((r) => r.json())
    .catch(() => [])) as PaymentMethod[];

  return (
    <>
      <SiteHeader theme={theme} />
      {/* El formulario trae su propio contenedor (stepper + título), igual que el carrito. */}
      <CheckoutForm
        user={user}
        config={theme.tokens.checkout ?? defaultTheme.tokens.checkout}
        methods={methods}
        labels={{
            title: t(theme, 'checkout.title'),
            contactTitle: t(theme, 'checkout.contact.title'),
            name: t(theme, 'auth.field.name'),
            email: t(theme, 'auth.field.email'),
            phone: t(theme, 'checkout.field.phone'),
            address: t(theme, 'checkout.field.address'),
            city: t(theme, 'checkout.field.city'),
            zip: t(theme, 'checkout.field.zip'),
            note: t(theme, 'checkout.field.note'),
            methodTitle: t(theme, 'checkout.method.title'),
            summaryTitle: t(theme, 'checkout.summary.title'),
            submit: t(theme, 'checkout.submit'),
            emptyCart: t(theme, 'cart.empty'),
            browse: t(theme, 'cart.browse'),
            total: t(theme, 'cart.total'),
            couponLabel: t(theme, 'checkout.coupon.label'),
            couponApply: t(theme, 'checkout.coupon.apply'),
            couponApplied: t(theme, 'checkout.coupon.applied'),
            couponInvalid: t(theme, 'checkout.coupon.invalid'),
          discount: t(theme, 'checkout.discount'),
        }}
      />
      <SiteFooter theme={theme} />
    </>
  );
}
