import { permanentRedirect } from 'next/navigation';

/** El cotizador por tipo se volvió guiado (2026-09-25): esta ruta solo redirige. */
export default function CotizadorMaquinariaPage() {
  permanentRedirect('/cotizador?linea=maquinaria-pesada');
}
