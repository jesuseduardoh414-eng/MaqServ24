import Link from 'next/link';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { Icon } from '@/components/Icon';

/**
 * EL CANDADO DE COTIZAR (decisión del 2026-09-23).
 *
 * El visitante puede ver el catálogo, las líneas de servicio y los
 * cotizadores; para PEDIR una cotización necesita cuenta. Tres razones que
 * conviene dejar escritas:
 *
 *  1. El resto del camino ya la exigía: ver la cotización, aceptarla y seguir
 *     el servicio solo se puede desde Mi cuenta. Un invitado se quedaba con un
 *     folio que no podía abrir en ningún lado.
 *  2. Con cuenta no vuelve a capturar nombre, correo ni teléfono en cada
 *     solicitud: salen del perfil.
 *  3. La solicitud nace ligada a quien la pidió, y con eso el módulo de
 *     Clientes y los indicadores de repetición dejan de adivinar por correo.
 *
 * Se muestra ANTES del formulario y no al final, a propósito: pedir la cuenta
 * después de seis pasos de captura sería tirar lo escrito. Lo que sí se
 * conserva es lo que viene en la URL (el equipo o el servicio elegido) y el
 * carrito, que vive en el navegador; por eso `next` trae la URL completa.
 */
export function QuoteGate({ theme, next }: { theme: Theme; next: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  // Tarjeta del sistema de diseño (`ms-panel-lg`); lo propio lleva prefijo `qg-`.
  return (
    <section className="ms-panel ms-panel-lg qg-caja">
      <style>{`
        .qg-caja{ max-width:640px; display:grid; gap:0; }
        .qg-cab{ display:flex; gap:14px; align-items:center; margin-bottom:16px; }
        .qg-cab .ms-kicker{ margin:0; }
        .qg-titulo{ font-size:24px; }
        .qg-cuerpo{ margin:10px 0 0; font-size:15px; line-height:1.6; color:var(--color-text-muted); max-width:60ch; }
        .qg-acts{ display:flex; gap:12px; flex-wrap:wrap; margin-top:24px; }
        .qg-notas{ display:grid; gap:4px; margin-top:18px; }
        @media (max-width: 640px){ .qg-acts .ms-btn{ flex:1 1 100%; } .qg-titulo{ font-size:21px; } }
      `}</style>
      <div className="qg-cab">
        <span className="ms-ico" aria-hidden><Icon name="user" size={20} /></span>
        <p className="ms-kicker">{t(theme, 'quote.gate.eyebrow')}</p>
      </div>
      <h2 className="ms-h2 qg-titulo">{t(theme, 'quote.gate.title')}</h2>
      <p className="qg-cuerpo">{t(theme, 'quote.gate.body')}</p>
      <div className="qg-acts">
        <Link href={`/registro${q}`} className="ms-btn">
          {t(theme, 'quote.gate.register')}<Icon name="arrowRight" size={16} />
        </Link>
        <Link href={`/login${q}`} className="ms-btn ms-btn-sec">
          {t(theme, 'quote.gate.login')}
        </Link>
      </div>
      <div className="qg-notas">
        <p className="ms-hint">{t(theme, 'quote.gate.hint')}</p>
        <p className="ms-hint">{t(theme, 'quote.gate.keep')}</p>
      </div>
    </section>
  );
}
