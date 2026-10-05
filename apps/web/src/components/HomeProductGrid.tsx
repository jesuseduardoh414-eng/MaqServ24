'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductCard as ProductCardDto } from '@maqserv/types';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { ProductCard } from '@/components/ProductCard';

/**
 * Grid de productos destacados con tabs por categoría (diseño "Productos -
 * Destacados y Catálogo"). Datos reales de la BD; filtrado en cliente. La card
 * (compartida con el catálogo) trae carrito y wishlist; aquí se precarga qué
 * productos ya están en favoritos para pintar el corazón.
 */
export function HomeProductGrid({
  products,
  categories,
  theme,
  align = 'center',
  showTabs = true,
}: {
  products: ProductCardDto[];
  categories: Array<{ slug: string; name: string }>;
  theme: Theme;
  align?: 'left' | 'center';
  showTabs?: boolean;
}) {
  const [tab, setTab] = useState<string>('all');
  const [wish, setWish] = useState<Set<number>>(new Set());

  const tabs = useMemo(() => {
    const present = new Set(products.map((p) => p.categorySlug).filter(Boolean) as string[]);
    return categories.filter((c) => present.has(c.slug));
  }, [products, categories]);

  const visible = tab === 'all' ? products : products.filter((p) => p.categorySlug === tab);

  useEffect(() => {
    fetch('/api/proxy/wishlist/ids')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: number[]) => Array.isArray(ids) && setWish(new Set(ids)))
      .catch(() => {});
  }, []);

  // Pestañas del sistema (`.ms-tab`, `aria-selected` marca la activa).
  // `flexShrink: 0` evita que se aplasten antes de desbordar; `.ms-tab` ya
  // trae `white-space: nowrap`.
  const tabBtn: React.CSSProperties = { flexShrink: 0 };

  return (
    <>
      {/*
        Filtro de destacados: UNA SOLA FILA, siempre.

        Con `flexWrap: 'wrap'` se partía en dos y hasta tres renglones en móvil
        y empujaba los productos fuera de la pantalla: al entrar, lo primero
        que se veía era una pila de botones en vez del equipo. Ahora no se
        parte, se desplaza de lado — el mismo gesto que el visitante ya hace en
        el carrusel de categorías.
      */}
      {showTabs ? (
        <div
          className="no-sb"
          role="tablist"
          style={{
            display: 'flex',
            // `safe center`: centra mientras quepa y, en cuanto no cabe, se
            // comporta como `start`. Con `center` a secas el desbordamiento se
            // reparte por los dos lados y la primera pestaña —"Todos", la
            // activa por defecto— nacía cortada por la izquierda.
            justifyContent: align === 'left' ? 'flex-start' : 'safe center',
            gap: 6,
            flexWrap: 'nowrap',
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            // Aire al final para que la última pestaña no quede pegada al
            // borde cuando se llega al tope del desplazamiento.
            padding: '2px 2px 2px 0',
            margin: '24px 0 28px',
          }}
        >
          <button type="button" role="tab" className="ms-tab" aria-selected={tab === 'all'} style={tabBtn} onClick={() => setTab('all')}>
            {t(theme, 'home.featured.filterAll')}
          </button>
          {tabs.map((c) => (
            <button key={c.slug} type="button" role="tab" className="ms-tab" aria-selected={tab === c.slug} style={tabBtn} onClick={() => setTab(c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ height: 34 }} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 16 }}>
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} theme={theme} initialFaved={wish.has(p.id)} />
        ))}
      </div>
    </>
  );
}
