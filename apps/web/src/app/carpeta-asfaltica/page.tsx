import type { Metadata } from 'next';
import { LandingServicio, landingMetadata } from '@/components/LandingServicio';

// Página de aterrizaje: el contenido está en lib/landings.ts.
const RUTA = '/carpeta-asfaltica';

export function generateMetadata(): Promise<Metadata> {
  return landingMetadata(RUTA);
}

export default function Page() {
  return <LandingServicio ruta={RUTA} />;
}
