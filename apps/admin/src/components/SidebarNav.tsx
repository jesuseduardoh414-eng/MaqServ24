'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NEWSLETTER_ACTIVO, modulosDe, type ModuloAdmin, type RolAdmin } from '@maqserv/config';

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

type BadgeKey = 'orders' | 'quotes' | 'withdraws' | 'messages' | 'quoterRequests';
/**
 * Una entrada del menú. `hijos` la convierte en submenú: entonces NO navega,
 * sólo abre y cierra su lista (ver "Secciones del home", más abajo).
 */
type Item = {
  modulo: ModuloAdmin;
  label: string;
  icon: string;
  /** Ausente sólo en las entradas que existen para agrupar. */
  href?: string;
  badge?: BadgeKey;
  hijos?: Array<{ href: string; label: string }>;
};

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Panel',
    items: [
      { modulo: 'inicio', href: '/', label: 'Inicio', icon: 'ph-house' },
      // Inicio dice que hay que atender; esto dice si lo que se hizo sirvio.
      { modulo: 'indicadores', href: '/indicadores', label: 'Indicadores', icon: 'ph-chart-line-up' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      // Servicios y productos se gestionan aparte (2026-09-25): hoy todo son
      // servicios; "Productos" queda listo para lo que se venda a precio fijo.
      { modulo: 'catalogo', href: '/catalogo/servicios', label: 'Servicios', icon: 'ph-wrench' },
      { modulo: 'catalogo', href: '/catalogo/productos', label: 'Productos', icon: 'ph-package' },
      { modulo: 'catalogo', href: '/categorias', label: 'Categorías', icon: 'ph-squares-four' },
      { modulo: 'disponibilidad', href: '/disponibilidad', label: 'Disponibilidad', icon: 'ph-calendar-check' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { modulo: 'ordenes', href: '/ordenes', label: 'Órdenes', icon: 'ph-receipt', badge: 'orders' },
      { modulo: 'cotizaciones', href: '/cotizaciones', label: 'Cotizaciones', icon: 'ph-file-text', badge: 'quotes' },
      // Lo que pasa DESPUÉS de que el cliente acepta. Va junto a cotizaciones
      // porque es su continuación, no un módulo aparte.
      { modulo: 'servicios', href: '/servicios', label: 'Servicios', icon: 'ph-truck' },
      // Servicios dice que esta pasando; la agenda dice que VIENE.
      { modulo: 'agenda', href: '/agenda', label: 'Agenda', icon: 'ph-calendar-blank' },
      // La empresa que contrata y sus frentes abiertos. Va aparte de Cuentas
      // porque casi todas las solicitudes las hace alguien sin registrarse.
      { modulo: 'clientes', href: '/clientes', label: 'Clientes y obras', icon: 'ph-buildings' },
    ],
  },
  {
    // El cotizador interno: la herramienta con la que se arma el precio. Va en
    // su propio grupo y no dentro de Ventas porque son DOS cotizadores con
    // tabuladores distintos, y el cliente pidió expresamente verlos abiertos:
    // "al seleccionar despliega 2 opciones, maquinaria y triturados".
    title: 'Cotizador',
    items: [
      { modulo: 'cotizador', href: '/cotizador/maquinaria', label: 'Maquinaria', icon: 'ph-tractor' },
      { modulo: 'cotizador', href: '/cotizador/triturados', label: 'Triturados', icon: 'ph-mountains' },
      // Lleva contador porque una solicitud del sitio que nadie abre es un
      // cliente esperando una llamada que no va a llegar.
      { modulo: 'cotizador', href: '/cotizador/historial', label: 'Historial', icon: 'ph-clock-counter-clockwise', badge: 'quoterRequests' },
      { modulo: 'cotizador', href: '/cotizador/tarifas', label: 'Tarifas y condiciones', icon: 'ph-sliders-horizontal' },
    ],
  },
  {
    // La red de aliados es el activo del modelo (documento institucional, 15),
    // no un submenu del marketplace: va en su propio grupo y antes que este.
    title: 'Red de aliados',
    items: [{ modulo: 'proveedores', href: '/proveedores', label: 'Proveedores', icon: 'ph-handshake' }],
  },
  {
    title: 'Marketplace',
    items: [
      { modulo: 'marketplace', href: '/vendedores', label: 'Vendedores', icon: 'ph-storefront' },
      { modulo: 'marketplace', href: '/retiros', label: 'Retiros', icon: 'ph-hand-coins', badge: 'withdraws' },
    ],
  },
  {
    // Se llamaba "Clientes", pero el cliente —la empresa que contrata— ahora
    // vive en Ventas. Esto es lo que rodea a la relacion: quien tiene cuenta,
    // que opina y quien pidio que le escribieran.
    title: 'Comunidad',
    items: [
      { modulo: 'comunidad', href: '/usuarios', label: 'Cuentas', icon: 'ph-users' },
      { modulo: 'comunidad', href: '/resenas', label: 'Reseñas', icon: 'ph-star' },
      { modulo: 'comunidad', href: '/preguntas', label: 'Preguntas', icon: 'ph-chats-circle' },
      // Quien escribió por el formulario de Contacto y espera respuesta. Lleva
      // contador porque un mensaje sin contestar es un cliente perdiéndose.
      { modulo: 'comunidad', href: '/mensajes', label: 'Mensajes', icon: 'ph-chat-centered-text', badge: 'messages' },
      // El boletín no está en el modelo MAQSER24: apagado, no se ofrece (ver
      // newsletter.ts en @maqserv/config). Los correos guardados siguen en la tabla.
      ...(NEWSLETTER_ACTIVO
        ? [{ modulo: 'comunidad' as const, href: '/suscriptores', label: 'Suscriptores', icon: 'ph-envelope-simple' }]
        : []),
    ],
  },
  {
    title: 'Diseño del sitio',
    items: [
      { modulo: 'diseno', href: '/diseno/marca', label: 'Identidad de marca', icon: 'ph-palette' },
      // Las ocho secciones del home, en UNA entrada que se despliega: sueltas
      // eran ocho renglones de doce, y se comían el grupo entero. El número se
      // queda porque es el orden en que salen en la página; el "Sección N ·"
      // sobra cuando el submenú ya se llama así.
      {
        modulo: 'diseno',
        label: 'Secciones del home',
        icon: 'ph-stack',
        hijos: [
          { href: '/diseno/hero', label: '1 · Hero' },
          { href: '/diseno/categorias', label: '2 · Categorías' },
          { href: '/diseno/productos', label: '3 · Productos' },
          { href: '/diseno/quienes-somos', label: '4 · Quiénes somos' },
          { href: '/diseno/sectores', label: '5 · Sectores' },
          { href: '/diseno/oferta', label: '6 · Oferta' },
          { href: '/diseno/resenas', label: '7 · Reseñas' },
          { href: '/diseno/faq', label: '8 · Preguntas frecuentes' },
        ],
      },
      { modulo: 'diseno', href: '/diseno/marcas', label: 'Marcas', icon: 'ph-certificate' },
      { modulo: 'diseno', href: '/blog', label: 'Blog', icon: 'ph-article' },
      { modulo: 'diseno', href: '/diseno/contacto', label: 'Contacto', icon: 'ph-address-book' },
      { modulo: 'diseno', href: '/diseno/footer', label: 'Footer', icon: 'ph-rows' },
      { modulo: 'diseno', href: '/diseno/legal', label: 'Legal (términos/privacidad)', icon: 'ph-scroll' },
      { modulo: 'diseno', href: '/temas', label: 'Temas y colores', icon: 'ph-swatches' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { modulo: 'configuracion', href: '/correo', label: 'Correo', icon: 'ph-envelope-simple-open' },
      { modulo: 'configuracion', href: '/pagos', label: 'Pagos', icon: 'ph-credit-card' },
      { modulo: 'configuracion', href: '/traslado', label: 'Traslado', icon: 'ph-truck' },
      { modulo: 'admins', href: '/admins', label: 'Administradores', icon: 'ph-user-gear' },
      { modulo: 'admins', href: '/admins/permisos', label: 'Permisos', icon: 'ph-lock-key' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Badges = Record<BadgeKey, number>;

export function SidebarNav({ collapsed, query, rol, modulos }: { collapsed: boolean; query: string; rol: RolAdmin; modulos?: readonly ModuloAdmin[] }) {
  const pathname = usePathname() || '/';
  const [badges, setBadges] = useState<Badges>({ orders: 0, quotes: 0, withdraws: 0, messages: 0, quoterRequests: 0 });
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
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/dashboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setBadges({
          orders: d.pendingOrders ?? 0,
          quotes: d.pendingQuotes ?? 0,
          withdraws: d.withdrawsPending ?? 0,
          messages: d.pendingMessages ?? 0,
          quoterRequests: d.pendingQuoterRequests ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
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
      .filter((it) => mios.includes(it.modulo))
      // Buscar también entra al submenú: escribir "oferta" tiene que encontrar
      // la sección aunque su entrada esté plegada. Si lo que coincide es el
      // nombre del submenú, se muestra con todos sus hijos.
      .map((it) => {
        if (!q || !it.hijos) return it;
        if (coincide(it.label)) return it;
        return { ...it, hijos: it.hijos.filter((h) => coincide(h.label)) };
      })
      .filter((it) => {
        if (!q) return true;
        if (it.hijos) return coincide(it.label) || it.hijos.length > 0;
        return coincide(it.label);
      }),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="adm-nav" ref={nav}>
      {groups.map((g) => (
        <div className="adm-nav-group" key={g.title}>
          {/* El título es un RÓTULO, no un botón: los grupos no se pliegan.
              Lo único que se despliega aquí es la entrada que tiene hijos. */}
          {showLabels ? <div className="adm-group-title">{g.title}</div> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {g.items.map((it) => {
              const count = it.badge ? badges[it.badge] : 0;

              // --- Entrada con submenú (hoy sólo "Secciones del home") ---
              if (it.hijos) {
                const dentro = it.hijos.some((h) => isActive(pathname, h.href));
                // En modo riel no hay sitio para desplegar nada: el icono lleva
                // a la primera sección, que es por donde se entra igualmente.
                if (!showLabels) {
                  return (
                    <Link key={it.label} href={it.hijos[0].href} className={`adm-navlink${dentro ? ' active' : ''}`} title={it.label}>
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
                      className={`adm-navlink adm-navbtn${dentro ? ' active' : ''}`}
                      onClick={() => alternarSubmenu(claveSub)}
                      aria-expanded={abiertoSub}
                    >
                      {dentro ? <span className="adm-active-bar" /> : null}
                      <i className={`ph ${it.icon} adm-navico`} aria-hidden />
                      <span className="adm-navlabel">{it.label}</span>
                      <i className={`ph ph-caret-down adm-sub-caret${abiertoSub ? '' : ' cerrado'}`} aria-hidden />
                    </button>
                    {abiertoSub ? (
                      <div className="adm-subnav">
                        {it.hijos.map((h) => {
                          const act = isActive(pathname, h.href);
                          return (
                            <Link key={h.href} href={h.href} className={`adm-navlink adm-navsub${act ? ' active' : ''}`} title={h.label}>
                              <span className="adm-navlabel">{h.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
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
                >
                  {active ? <span className="adm-active-bar" /> : null}
                  <i className={`ph ${it.icon} adm-navico`} aria-hidden />
                  {showLabels ? <span className="adm-navlabel">{it.label}</span> : null}
                  {showLabels && count > 0 ? <span className="adm-badge">{count}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 ? <div className="adm-nav-empty">Sin resultados</div> : null}
    </nav>
  );
}
