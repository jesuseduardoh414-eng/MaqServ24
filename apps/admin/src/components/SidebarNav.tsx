'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navegación del admin agrupada por secciones funcionales.
 * (Hoy solo existe el rol superadmin: todos ven todo. Cuando haya roles,
 * bastará con filtrar estos grupos/ítems según permisos.)
 */
type BadgeKey = 'orders' | 'quotes' | 'withdraws';
type Item = { href: string; label: string; icon: string; badge?: BadgeKey };

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Panel',
    items: [
      { href: '/', label: 'Inicio', icon: 'ph-house' },
      // Inicio dice que hay que atender; esto dice si lo que se hizo sirvio.
      { href: '/indicadores', label: 'Indicadores', icon: 'ph-chart-line-up' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { href: '/productos', label: 'Productos', icon: 'ph-package' },
      { href: '/categorias', label: 'Categorías', icon: 'ph-squares-four' },
      { href: '/disponibilidad', label: 'Disponibilidad', icon: 'ph-calendar-check' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { href: '/ordenes', label: 'Órdenes', icon: 'ph-receipt', badge: 'orders' },
      { href: '/cotizaciones', label: 'Cotizaciones', icon: 'ph-file-text', badge: 'quotes' },
      // Lo que pasa DESPUÉS de que el cliente acepta. Va junto a cotizaciones
      // porque es su continuación, no un módulo aparte.
      { href: '/servicios', label: 'Servicios', icon: 'ph-truck' },
      // La empresa que contrata y sus frentes abiertos. Va aparte de Cuentas
      // porque casi todas las solicitudes las hace alguien sin registrarse.
      { href: '/clientes', label: 'Clientes y obras', icon: 'ph-buildings' },
    ],
  },
  {
    // La red de aliados es el activo del modelo (documento institucional, 15),
    // no un submenu del marketplace: va en su propio grupo y antes que este.
    title: 'Red de aliados',
    items: [{ href: '/proveedores', label: 'Proveedores', icon: 'ph-handshake' }],
  },
  {
    title: 'Marketplace',
    items: [
      { href: '/vendedores', label: 'Vendedores', icon: 'ph-storefront' },
      { href: '/retiros', label: 'Retiros', icon: 'ph-hand-coins', badge: 'withdraws' },
    ],
  },
  {
    // Se llamaba "Clientes", pero el cliente —la empresa que contrata— ahora
    // vive en Ventas. Esto es lo que rodea a la relacion: quien tiene cuenta,
    // que opina y quien pidio que le escribieran.
    title: 'Comunidad',
    items: [
      { href: '/usuarios', label: 'Cuentas', icon: 'ph-users' },
      { href: '/resenas', label: 'Reseñas', icon: 'ph-star' },
      { href: '/preguntas', label: 'Preguntas', icon: 'ph-chats-circle' },
      { href: '/suscriptores', label: 'Suscriptores', icon: 'ph-envelope-simple' },
    ],
  },
  {
    title: 'Diseño del sitio',
    items: [
      { href: '/diseno/marca', label: 'Identidad de marca', icon: 'ph-palette' },
      { href: '/diseno/hero', label: 'Sección 1 · Hero', icon: 'ph-layout' },
      { href: '/diseno/categorias', label: 'Sección 2 · Categorías', icon: 'ph-squares-four' },
      { href: '/diseno/productos', label: 'Sección 3 · Productos', icon: 'ph-package' },
      { href: '/diseno/quienes-somos', label: 'Sección 4 · Quiénes somos', icon: 'ph-shield-check' },
      { href: '/diseno/sectores', label: 'Sección 5 · Sectores', icon: 'ph-buildings' },
      { href: '/diseno/oferta', label: 'Sección 6 · Oferta', icon: 'ph-tag' },
      { href: '/diseno/resenas', label: 'Sección 7 · Reseñas', icon: 'ph-star' },
      { href: '/diseno/faq', label: 'Sección 8 · Preguntas frecuentes', icon: 'ph-question' },
      { href: '/diseno/servicios', label: 'Servicios', icon: 'ph-wrench' },
      { href: '/diseno/marcas', label: 'Marcas', icon: 'ph-certificate' },
      { href: '/blog', label: 'Blog', icon: 'ph-article' },
      { href: '/diseno/contacto', label: 'Contacto', icon: 'ph-address-book' },
      { href: '/diseno/footer', label: 'Footer', icon: 'ph-rows' },
      { href: '/diseno/legal', label: 'Legal (términos/privacidad)', icon: 'ph-scroll' },
      { href: '/temas', label: 'Temas y colores', icon: 'ph-swatches' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/correo', label: 'Correo', icon: 'ph-envelope-simple-open' },
      { href: '/pagos', label: 'Pagos', icon: 'ph-credit-card' },
      { href: '/traslado', label: 'Traslado', icon: 'ph-truck' },
      { href: '/admins', label: 'Administradores', icon: 'ph-user-gear' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Badges = Record<BadgeKey, number>;

export function SidebarNav({ collapsed, query }: { collapsed: boolean; query: string }) {
  const pathname = usePathname() || '/';
  const [badges, setBadges] = useState<Badges>({ orders: 0, quotes: 0, withdraws: 0 });

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
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const showLabels = !collapsed;
  const groups = GROUPS.map((g) => ({
    ...g,
    items: q ? g.items.filter((it) => it.label.toLowerCase().includes(q)) : g.items,
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="adm-nav">
      {groups.map((g) => (
        <div className="adm-nav-group" key={g.title}>
          {showLabels ? <div className="adm-group-title">{g.title}</div> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {g.items.map((it) => {
              const active = isActive(pathname, it.href);
              const count = it.badge ? badges[it.badge] : 0;
              return (
                <Link
                  key={it.href}
                  href={it.href}
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
