/**
 * LA URL PÚBLICA DEL SITIO, para construir redirecciones.
 *
 * Detrás del proxy de cPanel (Passenger), lo que Node ve como origen de la
 * petición es `https://0.0.0.0:3000`: la dirección interna en la que escucha
 * Next, no la que tiene el visitante en su barra. Cualquier redirección armada
 * con `req.nextUrl.origin` lo manda ahí, y el navegador contesta
 * ERR_ADDRESS_INVALID. Pasó con "entrar con Google": el callback devolvía a
 * `https://0.0.0.0:3000/login?error=…` (2026-09-23).
 *
 * Orden de confianza:
 *  1. `SITE_URL`, que en producción está puesta y es la única fuente segura.
 *  2. Las cabeceras del proxy (`x-forwarded-host` / `host` + `x-forwarded-proto`),
 *     que es lo que hay en local y en cualquier despliegue sin la variable.
 *  3. El origen que calcula Next, como último recurso.
 *
 * Sin imports de servidor a propósito: lo usa también el middleware.
 */
export function origenPublico(req: { nextUrl: URL; headers: Headers }): string {
  const site = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  if (site) return site;

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(/:$/, '');
    return `${proto}://${host}`;
  }
  return req.nextUrl.origin;
}

/** `https://maqserv24.com` → `maqserv24.com`; vacío en local o sin SITE_URL. */
export function hostPublico(): string | null {
  const site = process.env.SITE_URL?.trim();
  if (!site) return null;
  try {
    return new URL(site).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Dominio para cookies que tienen que sobrevivir un cambio de host dentro del
 * mismo sitio (la de estado de Google se pone en el host donde se hizo clic y
 * se lee en el host al que Google regresa). Null en local: `localhost` no
 * admite atributo `domain`, y una IP tampoco.
 */
export function dominioCookie(): string | undefined {
  const host = hostPublico();
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host)) return undefined;
  return host.replace(/^www\./, '');
}
