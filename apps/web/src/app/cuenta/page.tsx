import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import { redirect } from 'next/navigation';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { AccountShell } from './AccountShell';
import { ProfileForms } from './ProfileForms';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'account.title')} — ${t(theme, 'site.name')}` };
}

export default async function AccountPage() {
  const [theme, user] = await Promise.all([getTheme(), getSessionUser()]);
  if (!user) redirect('/login?next=/cuenta');

  return (
    <AccountShell
      theme={theme}
      user={user}
      active="perfil"
      title="Mi perfil"
      description="Tus datos de contacto, la dirección de entrega y la seguridad de tu cuenta."
    >
      <ProfileForms
        user={user}
        labels={{
          profileTitle: t(theme, 'account.profile.title'),
          name: t(theme, 'auth.field.name'),
          phone: t(theme, 'checkout.field.phone'),
          address: t(theme, 'checkout.field.address'),
          city: t(theme, 'checkout.field.city'),
          zip: t(theme, 'checkout.field.zip'),
          save: t(theme, 'account.profile.save'),
          saved: t(theme, 'account.profile.saved'),
          passwordTitle: t(theme, 'account.password.title'),
          current: t(theme, 'account.password.current'),
          next: t(theme, 'account.password.new'),
          submit: t(theme, 'account.password.submit'),
          changed: t(theme, 'account.password.changed'),
        }}
      />
    </AccountShell>
  );
}
