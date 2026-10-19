import type { Metadata } from 'next';
import { getTheme, t } from '@/lib/theme';
import { getFaqs } from '@/lib/api';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { FaqLista } from '@/components/FaqLista';
import { PreguntaFaq } from '@/components/PreguntaFaq';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, {
    ruta: '/preguntas-frecuentes',
    titulo: 'Preguntas frecuentes',
    descripcion: 'Respuestas sobre renta de maquinaria, triturados, transporte y materiales en Monterrey y su zona metropolitana. Si no encuentras la tuya, pregúntanos.',
  });
}

const sinHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * PREGUNTAS FRECUENTES (2026-10-12).
 *
 * Todas las publicadas, con buscador, y el lugar para preguntar. El home
 * enseña solo las seis más recientes y trae aquí: con cien preguntas en el
 * home, el home deja de ser el home.
 */
export default async function PreguntasFrecuentesPage({ searchParams }: { searchParams: Promise<{ preguntar?: string }> }) {
  const [theme, faqs, sp] = await Promise.all([getTheme(), getFaqs().catch(() => []), searchParams]);

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: 'Preguntas frecuentes' }])} />
      {faqs.length > 0 ? (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: sinHtml(f.answer) } })),
          }}
        />
      ) : null}

      <div className="ms-page">
        <main className="ms-wrap" style={{ maxWidth: 860 }}>
          <header className="ms-hero" style={{ paddingTop: 16 }}>
            <p className="ms-kicker">{t(theme, 'home.faq.eyebrow')}</p>
            <h1 className="ms-hero-title">Preguntas frecuentes</h1>
            <p className="ms-hero-desc">Lo que más nos preguntan sobre renta de maquinaria, triturados, transporte y materiales. Si no encuentras tu respuesta, pregúntanos al final.</p>
          </header>

          <FaqLista faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))} />

          <section id="preguntar" style={{ scrollMarginTop: 100, marginTop: 28 }}>
            <PreguntaFaq hayPreguntas={faqs.length > 0} abrir={sp.preguntar === '1'} />
          </section>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
