'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULOS_CON_CORREO, modulosDe, type ModuloAdmin, type RolAdmin } from '@maqserv/config';
import { MARCAR_PRUEBAS, RONDA_ACTUAL, atributosPrueba, marcaDeVarias, marcaPrueba } from './estado-pruebas';

/**
 * `useLayoutEffect` en cliente y `useEffect` en el servidor.
 *
 * Restaurar el scroll tiene que pasar ANTES de pintar, o se ve el salto: el
 * menú aparece arriba y brinca a su sitio. Pero `useLayoutEffect` a secas
 * chilla en el render del servidor, donde no hay layout que medir.
 */
const useLayoutEffectSeguro = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Navegación del admin agrupada por secciones funcionales, filtrada por el rol
 * de quien mira (documento institucional, sección 24).
 *
 * El menú NO es la seguridad: la API cierra cada ruta por su cuenta con el
 * mismo `@Modulo` (ver `admin-auth.ts`). Esto es lo otro que pide el requisito
 * —"lo que un rol no puede hacer, no aparece en su menú"— y es lo que evita el
 * paseo por pantallas que terminan en un error rojo.
 *
 * Los dos leen la MISMA tabla de `@maqserv/config`: si un día divergen, el menú
 * escondería algo que la API sigue sirviendo.
 */
/** Qué submenús dejó abiertos esta persona (ver `abiertos`, más abajo). */
const SUBMENUS_KEY = 'maqserv_admin_nav_submenus';
/** Por dónde iba el menú. Ver `useLayoutEffectSeguro` en el componente. */
const SCROLL_KEY = 'maqserv_admin_nav_scroll';

type BadgeKey = 'quotes' | 'messages';
/**
 * Un hijo de submenú: un enlace, o un submenú de enlaces (un solo nivel más).
 * `modulo` en un enlace es su PERMISO cuando difiere del de la entrada que lo
 * contiene (Reseñas y Preguntas son de Comunidad dentro de Sitio web).
 */
type Hijo = { href: string; label: string; modulo?: ModuloAdmin } | { label: string; hijos: Array<{ href: string; label: string }> };

/**
 * EL MENÚ EN EL ORDEN DEL FLUJO (documento, sección 16 · Modelo operativo).
 *
 * Una solicitud entra, se cotiza, se ejecuta y se cobra: las cuatro primeras
 * secciones van numeradas porque ese orden ES el trabajo de cada día. Debajo,
 * lo que sostiene ese flujo (la red y su oferta) y los ajustes, que casi no
 * se tocan. Cada sección lista sus módulos por el `title` de GROUPS, en el
 * orden en que se usan.
 */
const SECCIONES: ReadonlyArray<{ titulo: string | null; grupos: readonly string[] }> = [
  { titulo: 'Panel', grupos: ['Panel'] },
  // 1. El cliente pide: llega la solicitud, se identifica al cliente y su obra.
  { titulo: '1 · Recibir', grupos: ['Solicitudes', 'Clientes', 'Comunicaciones'] },
  // 2. Se busca quién puede, si está libre, si llega, y se arma el precio.
  // Sin "Matching" (2026-10-15): los aliados sugeridos ya viven en cada
  // solicitud y en "Buscar aliado" de Servicios; una pantalla aparte repetía eso.
  { titulo: '2 · Cotizar', grupos: ['Disponibilidad', 'Geolocalización', 'Cotización'] },
  // 3. Se asigna, se da seguimiento y se cierra con evidencias.
  // Sin "Documentos" (2026-10-15): los papeles de cada aliado y sus
  // vencimientos ya se ven en Proveedores.
  { titulo: '3 · Ejecutar', grupos: ['Operaciones'] },
  // 4. Se cobra, se paga al aliado y se mide cómo fue.
  { titulo: '4 · Cobrar y medir', grupos: ['Administración', 'Analítica'] },
  // Lo que alimenta el flujo: quién ofrece, qué ofrece y cómo se clasifica.
  { titulo: 'Red y oferta', grupos: ['Proveedores', 'Inventario / capacidad', 'Catálogo'] },
  { titulo: 'Ajustes', grupos: ['Configuración', 'Sitio web'] },
];

/**
 * Una entrada del menú. `hijos` la convierte en submenú: entonces NO navega,
 * sólo abre y cierra su lista (ver "Secciones del home", más abajo).
 */
type Item = {
  modulo: ModuloAdmin;
  /** También la ve quien tenga alguno de estos permisos (la pantalla filtra lo que enseña). */
  tambien?: readonly ModuloAdmin[];
  label: string;
  icon: string;
  /** Ausente sólo en las entradas que existen para agrupar. */
  href?: string;
  badge?: BadgeKey;
  hijos?: Hijo[];
  /** Módulo del documento que aún no se construye: se ve, pero no navega. */
  pronto?: boolean;
  /**
   * Pantalla que ya se ve pero solo como DISEÑO, con datos de ejemplo
   * (Administración, 2026-10-09): navega, y la etiqueta avisa que no es real.
   */
  diseno?: boolean;
};

/**
 * EL MENÚ SIGUE LOS 15 MÓDULOS DEL DOCUMENTO (sección 17, 2026-10-08).
 *
 * Cada grupo es un módulo del documento; el orden en pantalla lo decide
 * SECCIONES, no el orden de esta lista. Las pantallas que
 * ya existían se movieron a su módulo con el nombre que les corresponde, y los
 * módulos que aún no existen aparecen con "Pronto" y sin enlace (ver
 * `pronto`), para que se vea el mapa completo. Lo que el modelo no tiene
 * (marketplace, boletín) estuvo en "Sobrantes" y se retiró el 2026-10-15.
 *
 * `modulo` sigue siendo la clave de PERMISO (admin-roles.ts), no el grupo:
 * por eso una entrada "Pronto" toma el permiso más cercano y nada cambia en
 * quién ve qué.
 */
const GROUPS: Array<{ title: string; icon: string; items: Item[] }> = [
  {
    title: 'Panel', icon: 'ph-house',
    items: [
      { modulo: 'inicio', href: '/', label: 'Inicio', icon: 'ph-house' },
    ],
  },
  {
    title: 'Catálogo', icon: 'ph-squares-four',
    items: [
      { modulo: 'catalogo', href: '/categorias', label: 'Categorías y atributos', icon: 'ph-squares-four' },
    ],
  },
  {
    title: 'Inventario / capacidad', icon: 'ph-wrench',
    items: [
      // Antes "Equipos": todas las fichas de las cinco líneas, con su aliado.
      { modulo: 'catalogo', href: '/catalogo/servicios', label: 'Inventario', icon: 'ph-wrench' },
    ],
  },
  {
    title: 'Disponibilidad', icon: 'ph-calendar-check',
    items: [
      { modulo: 'disponibilidad', href: '/disponibilidad', label: 'Disponibilidad', icon: 'ph-calendar-check' },
    ],
  },
  {
    title: 'Solicitudes', icon: 'ph-tray',
    items: [
      // Una sola entrada de lo que pide el cliente (2026-10-08). El historial
      // del cotizador era el archivo de documentos y pasó a Cotización.
      { modulo: 'cotizaciones', href: '/cotizaciones', label: 'Solicitudes', icon: 'ph-tray', badge: 'quotes' },
    ],
  },
  {
    title: 'Cotización', icon: 'ph-calculator',
    items: [
      { modulo: 'cotizador', href: '/cotizador/maquinaria', label: 'Cotizador de maquinaria', icon: 'ph-tractor' },
      { modulo: 'cotizador', href: '/cotizador/triturados', label: 'Cotizador de triturados', icon: 'ph-mountains' },
      // Sin contador: es archivo, no bandeja (sus "solicitadas" ya están en Solicitudes).
      { modulo: 'cotizador', href: '/cotizador/historial', label: 'Cotizaciones emitidas', icon: 'ph-files' },
    ],
  },
  {
    title: 'Geolocalización', icon: 'ph-map-trifold',
    items: [
      { modulo: 'proveedores', href: '/cobertura', label: 'Mapa y cobertura', icon: 'ph-map-trifold' },
    ],
  },
  {
    title: 'Proveedores', icon: 'ph-handshake',
    items: [
      { modulo: 'proveedores', href: '/proveedores', label: 'Proveedores', icon: 'ph-handshake' },
      // El CRM (2026-10-06) se juntó con Proveedores el 2026-10-08: sus costos
      // de referencia viven en el expediente de cada aliado.
    ],
  },
  {
    title: 'Clientes', icon: 'ph-buildings',
    items: [
      { modulo: 'clientes', href: '/clientes', label: 'Clientes y obras', icon: 'ph-buildings' },
      { modulo: 'comunidad', href: '/usuarios', label: 'Cuentas del sitio', icon: 'ph-users' },
    ],
  },
  {
    title: 'Operaciones', icon: 'ph-truck',
    items: [
      // Lo que pasa después de que el cliente acepta: asignación, estatus, incidencias, cierre.
      { modulo: 'servicios', href: '/servicios', label: 'Servicios en curso', icon: 'ph-truck' },
      { modulo: 'agenda', href: '/agenda', label: 'Agenda', icon: 'ph-calendar-blank' },
    ],
  },
  {
    title: 'Comunicaciones', icon: 'ph-chat-centered-text',
    items: [
      { modulo: 'comunidad', href: '/mensajes', label: 'Mensajes', icon: 'ph-chat-centered-text', badge: 'messages' },
    ],
  },
  {
    title: 'Administración', icon: 'ph-bank',
    items: [
      { modulo: 'administracion', href: '/administracion/cobranza', label: 'Cobranza a clientes', icon: 'ph-invoice' },
      { modulo: 'administracion', href: '/administracion/pagos', label: 'Pagos a aliados', icon: 'ph-hand-coins' },
      { modulo: 'administracion', href: '/administracion/margen', label: 'Margen', icon: 'ph-scales' },
    ],
  },
  {
    title: 'Analítica', icon: 'ph-chart-line-up',
    items: [
      { modulo: 'indicadores', href: '/indicadores', label: 'Indicadores', icon: 'ph-chart-line-up' },
    ],
  },
  {
    title: 'Configuración', icon: 'ph-gear',
    items: [
      { modulo: 'cotizador', href: '/cotizador/tarifas', label: 'Tarifas y condiciones', icon: 'ph-sliders-horizontal' },
      { modulo: 'configuracion', href: '/zonas', label: 'Zonas', icon: 'ph-map-pin-area' },
      // Cada rol ve ahí los correos de sus módulos (2026-10-12).
      { modulo: 'configuracion', tambien: MODULOS_CON_CORREO, href: '/correo', label: 'Correo', icon: 'ph-envelope-simple-open' },
      { modulo: 'admins', href: '/admins', label: 'Administradores', icon: 'ph-user-gear' },
      { modulo: 'admins', href: '/admins/permisos', label: 'Permisos', icon: 'ph-lock-key' },
    ],
  },
  {
    // No es módulo del documento: es lo que opera Marca y Crecimiento (sección
    // 24). Casi no se toca, así que va en UNA entrada plegada (2026-10-08):
    // abierta eran nueve renglones al fondo del menú.
    title: 'Sitio web', icon: 'ph-globe',
    items: [
      {
        modulo: 'diseno',
        label: 'Sitio web',
        icon: 'ph-globe',
        hijos: [
          { href: '/diseno/marca', label: 'Identidad de marca' },
          // Las nueve secciones del home, plegadas a su vez. El número es el
          // orden en que salen en la página.
          {
            label: 'Secciones del home',
            hijos: [
              { href: '/diseno/hero', label: '1 · Hero' },
              { href: '/diseno/categorias', label: '2 · Categorías' },
              { href: '/diseno/promociones', label: '3 · Promociones del mes' },
              { href: '/diseno/productos', label: '4 · Productos' },
              { href: '/diseno/quienes-somos', label: '5 · Quiénes somos' },
              { href: '/diseno/sectores', label: '6 · Sectores' },
              { href: '/diseno/oferta', label: '7 · Oferta' },
              { href: '/diseno/resenas', label: '8 · Reseñas' },
              { href: '/diseno/faq', label: '9 · Preguntas frecuentes' },
            ],
          },
          { href: '/diseno/marcas', label: 'Marcas' },
          { href: '/blog', label: 'Blog' },
          { href: '/diseno/contacto', label: 'Contacto' },
          { href: '/diseno/footer', label: 'Footer' },
          { href: '/diseno/legal', label: 'Legal (términos/privacidad)' },
          { href: '/temas', label: 'Temas y colores' },
          // Lo que el público escribe y se publica en el sitio (revisión del
          // panel, 2026-10-08): antes estaban en Sobrantes. "Aprobar" en el
          // nombre (2026-10-15): "7 · Reseñas" de arriba es cómo se ven en el home.
          { href: '/resenas', label: 'Aprobar reseñas', modulo: 'comunidad' },
        ],
      },
    ],
  },
];

/** Las hojas (enlaces reales) de una lista de hijos, entrando a los submenús. */
function hojas(hijos: Hijo[]): Array<{ href: string; label: string }> {
  return hijos.flatMap((h) => ('hijos' in h ? h.hijos : [h]));
}

/** Para la búsqueda: deja solo lo que coincide; un submenú que coincide por nombre va entero. */
function filtrarHijos(hijos: Hijo[], coincide: (t: string) => boolean): Hijo[] {
  return hijos.flatMap((h): Hijo[] => {
    if (!('hijos' in h)) return coincide(h.label) ? [h] : [];
    if (coincide(h.label)) return [h];
    const dentro = h.hijos.filter((x) => coincide(x.label));
    return dentro.length > 0 ? [{ ...h, hijos: dentro }] : [];
  });
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Badges = Record<BadgeKey, number>;

export function SidebarNav({ collapsed, query, rol, modulos }: { collapsed: boolean; query: string; rol: RolAdmin; modulos?: readonly ModuloAdmin[] }) {
  const pathname = usePathname() || '/';
  const [badges, setBadges] = useState<Badges>({ quotes: 0, messages: 0 });
  /**
   * Qué submenús dejó ABIERTOS esta persona. Nacen cerrados —para eso se
   * agruparon—, así que aquí sólo se apunta lo que alguien abrió a mano. Se lee
   * tras montar para no romper la hidratación.
   */
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(SUBMENUS_KEY);
      if (guardado) setAbiertos(JSON.parse(guardado) as Record<string, boolean>);
    } catch {
      /* sin localStorage: todos cerrados */
    }
  }, []);

  /**
   * EL MENÚ NO VUELVE ARRIBA AL NAVEGAR.
   *
   * Cada página del panel monta su propio `AdminShell`, así que al cambiar de
   * pantalla este componente se crea de nuevo y su scroll nace en cero: con el
   * menú largo, quien estaba en Configuración aterrizaba arriba del todo y
   * tenía que volver a bajar para saber dónde estaba. El contenido SÍ debe
   * empezar arriba —eso no se toca—; lo que se conserva es el menú.
   *
   * En `sessionStorage` y no en `localStorage`: es la posición de esta sesión
   * de trabajo, no una preferencia que deba sobrevivir semanas.
   */
  const nav = useRef<HTMLElement>(null);

  useLayoutEffectSeguro(() => {
    const el = nav.current;
    if (!el) return;
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
      if (y > 0) el.scrollTop = y;
    } catch {
      /* sin sessionStorage: arranca arriba, como antes */
    }
  }, []);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    // Un cuadro de espera: el evento de scroll dispara decenas de veces por
    // gesto y escribir en cada una es tirar trabajo a la basura.
    let pendiente = 0;
    const alDesplazar = () => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => {
        try { sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop)); } catch { /* ignora */ }
      });
    };
    el.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      el.removeEventListener('scroll', alDesplazar);
      cancelAnimationFrame(pendiente);
    };
  }, []);

  function alternarSubmenu(clave: string) {
    setAbiertos((prev) => {
      const next = { ...prev, [clave]: !prev[clave] };
      try { localStorage.setItem(SUBMENUS_KEY, JSON.stringify(next)); } catch { /* ignora */ }
      return next;
    });
  }

  // Contadores en vivo (pendientes) desde el resumen del panel.
  // Se recargan también cuando la campana recibe un aviso nuevo (`adm:avisos`).
  useEffect(() => {
    let alive = true;
    const cargar = () =>
      fetch('/api/admin/dashboard')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          setBadges({
            quotes: d.pendingQuotes ?? 0,
            messages: d.pendingMessages ?? 0,
          });
        })
        .catch(() => {});
    void cargar();
    window.addEventListener('adm:avisos', cargar);
    return () => {
      alive = false;
      window.removeEventListener('adm:avisos', cargar);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const showLabels = !collapsed;
  // El permiso se aplica ANTES que la búsqueda: escribir "pagos" no puede
  // sacar del cajón una pantalla que este rol no tiene.
  // `modulos` viene de /admin/auth/me, que ya aplicó lo que Dirección haya
  // cambiado en Permisos. La tabla del código queda de respaldo por si esta
  // pantalla se dibuja antes de tener la respuesta.
  const mios = modulos ?? modulosDe(rol);
  const coincide = (texto: string) => texto.toLowerCase().includes(q);
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items
      // Cada enlace de un submenú usa su propio permiso si lo trae, si no el
      // de su entrada: así Comercial ve Reseñas dentro de Sitio web aunque no
      // tenga Diseño, y Marca ve Sitio web sin Reseñas.
      .map((it) => (it.hijos ? { ...it, hijos: it.hijos.filter((h) => mios.includes(('modulo' in h && h.modulo) || it.modulo)) } : it))
      .filter((it) => (it.hijos ? it.hijos.length > 0 : mios.includes(it.modulo) || !!it.tambien?.some((m) => mios.includes(m))))
      // Buscar también entra al submenú: escribir "oferta" tiene que encontrar
      // la sección aunque su entrada esté plegada. Si lo que coincide es el
      // nombre del submenú, se muestra con todos sus hijos.
      .map((it) => {
        if (!q || !it.hijos) return it;
        if (coincide(it.label)) return it;
        return { ...it, hijos: filtrarHijos(it.hijos, coincide) };
      })
      .filter((it) => {
        if (!q) return true;
        if (it.hijos) return coincide(it.label) || it.hijos.length > 0;
        return coincide(it.label);
      }),
  })).filter((g) => g.items.length > 0);

  /** Una entrada del menú: enlace, submenú (Sitio web) o módulo por construir. */
  const renderItem = (it: Item) => {
    const count = it.badge ? badges[it.badge] : 0;

    // --- Entrada con submenú (hoy sólo "Sitio web") ---
    if (it.hijos) {
      const enlaces = hojas(it.hijos);
      const dentro = enlaces.some((h) => isActive(pathname, h.href));
      // En modo riel no hay sitio para desplegar nada: el icono lleva
      // a la primera sección, que es por donde se entra igualmente.
      if (!showLabels) {
        return (
          <Link key={it.label} href={enlaces[0].href} className={`adm-navlink${dentro ? ' active' : ''}`} title={it.label} {...atributosPrueba(marcaDeVarias(enlaces.map((e) => e.href)), it.label)}>
            {dentro ? <span className="adm-active-bar" /> : null}
            <i className={`ph ${it.icon} adm-navico`} aria-hidden />
          </Link>
        );
      }
      const claveSub = it.label;
      // Cerrado salvo que lo hayas abierto, estés dentro o busques.
      const abiertoSub = Boolean(q) || dentro || Boolean(abiertos[claveSub]);
      return (
        <div key={it.label}>
          <button
            type="button"
            className="adm-navlink adm-navbtn"
            onClick={() => alternarSubmenu(claveSub)}
            aria-expanded={abiertoSub}
            {...atributosPrueba(marcaDeVarias(enlaces.map((e) => e.href)), it.label)}
          >
            {dentro ? <span className="adm-active-bar" /> : null}
            <i className={`ph ${it.icon} adm-navico`} aria-hidden />
            <span className="adm-navlabel">{it.label}</span>
            <i className={`ph ph-caret-down adm-sub-caret${abiertoSub ? '' : ' cerrado'}`} aria-hidden />
          </button>
          {abiertoSub ? (
            <div className="adm-subnav">
              {it.hijos.map((h) => {
                // Submenú dentro del submenú (Secciones del home).
                if ('hijos' in h) {
                  const claveH = `${it.label}/${h.label}`;
                  const dentroH = h.hijos.some((x) => isActive(pathname, x.href));
                  const abiertoH = Boolean(q) || dentroH || Boolean(abiertos[claveH]);
                  return (
                    <div key={claveH}>
                      <button
                        type="button"
                        className={`adm-navlink adm-navsub adm-navbtn${dentroH ? ' active' : ''}`}
                        onClick={() => alternarSubmenu(claveH)}
                        aria-expanded={abiertoH}
                        {...atributosPrueba(marcaDeVarias(h.hijos.map((x) => x.href)), h.label)}
                      >
                        <span className="adm-navlabel">{h.label}</span>
                        <i className={`ph ph-caret-down adm-sub-caret${abiertoH ? '' : ' cerrado'}`} aria-hidden />
                      </button>
                      {abiertoH ? (
                        <div className="adm-subnav">
                          {h.hijos.map((x) => {
                            const actX = isActive(pathname, x.href);
                            return (
                              <Link key={x.href} href={x.href} className={`adm-navlink adm-navsub${actX ? ' active' : ''}`} title={x.label} {...atributosPrueba(marcaPrueba(x.href), x.label)}>
                                <span className="adm-navlabel">{x.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                const act = isActive(pathname, h.href);
                return (
                  <Link key={h.href} href={h.href} className={`adm-navlink adm-navsub${act ? ' active' : ''}`} title={h.label} {...atributosPrueba(marcaPrueba(h.href), h.label)}>
                    <span className="adm-navlabel">{h.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    // --- Módulo por construir: sin enlace, para no llevar a un 404 ---
    if (it.pronto) {
      return (
        <div key={it.label} className="adm-navlink adm-pronto" title={`${it.label} · próximamente`} aria-disabled="true">
          <i className={`ph ${it.icon} adm-navico`} aria-hidden />
          {showLabels ? <span className="adm-navlabel">{it.label}</span> : null}
          {showLabels ? <span className="adm-badge adm-pronto-chip">Pronto</span> : null}
        </div>
      );
    }

    // --- Entrada normal ---
    const href = it.href as string;
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className={`adm-navlink${active ? ' active' : ''}`}
        title={it.label}
        {...atributosPrueba(marcaPrueba(href), it.label)}
      >
        {active ? <span className="adm-active-bar" /> : null}
        <i className={`ph ${it.icon} adm-navico`} aria-hidden />
        {showLabels ? <span className="adm-navlabel">{it.label}</span> : null}
        {showLabels && count > 0 ? <span className="adm-badge">{count}</span> : null}
        {showLabels && it.diseno ? <span className="adm-badge adm-pronto-chip" title="Vista de diseño con datos de ejemplo">Diseño</span> : null}
      </Link>
    );
  };

  /*
   * MÓDULOS CON VARIAS PANTALLAS, PLEGADOS (2026-10-08).
   *
   * Un grupo con más de una entrada se dibuja como UNA entrada con el nombre
   * del módulo que se despliega; uno con una sola entrada, como esa entrada.
   * Así el menú son los módulos del documento, uno por renglón. Se abre solo
   * si estás dentro o buscas, y recuerda lo que abriste a mano. Cerrado,
   * suma los contadores de sus pantallas para que nada pendiente se esconda.
   */
  const renderGrupo = (g: (typeof groups)[number]) => {
    if (!showLabels || g.items.length === 1) return g.items.map(renderItem);
    const enlaces = g.items.flatMap((it) => (it.hijos ? hojas(it.hijos) : it.href ? [{ href: it.href, label: it.label }] : []));
    const dentro = enlaces.some((h) => isActive(pathname, h.href));
    const clave = `grupo:${g.title}`;
    const abierto = Boolean(q) || dentro || Boolean(abiertos[clave]);
    const total = g.items.reduce((n, it) => n + (it.badge ? badges[it.badge] : 0), 0);
    return (
      <div key={clave}>
        <button
          type="button"
          className="adm-navlink adm-navbtn"
          onClick={() => alternarSubmenu(clave)}
          aria-expanded={abierto}
          {...atributosPrueba(marcaDeVarias(enlaces.map((e) => e.href)), g.title)}
        >
          <i className={`ph ${g.icon} adm-navico`} aria-hidden />
          <span className="adm-navlabel">{g.title}</span>
          {!abierto && total > 0 ? <span className="adm-badge">{total}</span> : null}
          <i className={`ph ph-caret-down adm-sub-caret${abierto ? '' : ' cerrado'}`} aria-hidden />
        </button>
        {abierto ? <div className="adm-subnav adm-subnav-grupo">{g.items.map(renderItem)}</div> : null}
      </div>
    );
  };

  return (
    <nav className="adm-nav" ref={nav}>
      {/* Solo en local: qué se probó ya (ver estado-pruebas.ts). */}
      {MARCAR_PRUEBAS && showLabels ? (
        <div className="adm-prueba-leyenda" aria-label="Estado de las pruebas">
          <span className="adm-prueba-leyenda-t">Pruebas · Ronda {RONDA_ACTUAL}</span>
          <span data-prueba="probado">Probado</span>
          <span data-prueba="probando">Probando</span>
          <span data-prueba="falta">Falta</span>
        </div>
      ) : null}
      {SECCIONES.map((s) => {
        const deSeccion = s.grupos.flatMap((t) => groups.filter((g) => g.title === t));
        if (deSeccion.length === 0) return null;
        return (
          <div className="adm-nav-group" key={s.titulo ?? s.grupos[0]}>
            {showLabels && s.titulo ? <div className="adm-group-title">{s.titulo}</div> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {deSeccion.map((g) => renderGrupo(g))}
            </div>
          </div>
        );
      })}
      {groups.length === 0 ? <div className="adm-nav-empty">Sin resultados</div> : null}
    </nav>
  );
}
