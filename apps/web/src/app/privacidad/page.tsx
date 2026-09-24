import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import { defaultTheme, LEGAL_DEFAULTS } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { LegalPage } from '@/components/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/privacidad', titulo: t(theme, 'seo.privacy.title'), descripcion: t(theme, 'seo.privacy.description') });
}

export default async function PrivacidadPage() {
  const theme = await getTheme();
  const legal = theme.tokens.legal ?? defaultTheme.tokens.legal;
  const doc = legal.privacy.sections.length > 0 ? legal.privacy : LEGAL_DEFAULTS.privacy;

  return (
    <LegalPage
      theme={theme}
      eyebrow="PRIVACIDAD"
      title="Aviso de Privacidad"
      updated={doc.updated || 'Julio 2026'}
      intro={doc.intro}
      sections={doc.sections}
    />
  );
}
