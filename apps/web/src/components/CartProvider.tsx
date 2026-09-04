'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RentalPeriod } from '@maqserv/types';

/**
 * Carrito del lado cliente con persistencia en localStorage.
 * Modelo de renta: PERIODO (día/semana/mes) × cantidad — el servidor recalcula
 * el precio del periodo contra la BD al hacer checkout (nunca se confía del cliente).
 */
export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  /** Unitario ya ajustado al periodo elegido. */
  price: number;
  image: string | null;
  qty: number;
  /** Renta: periodo elegido y su etiqueta ("MES"/"SEMANA"/"DÍA"). */
  period?: RentalPeriod;
  unitLabel?: string;
}

/** Total de línea: precio (del periodo) × cantidad. */
export function cartLineTotal(i: CartItem): number {
  return i.price * i.qty;
}

/**
 * Identidad de una LÍNEA del carrito: el mismo equipo en dos periodos
 * distintos son dos líneas. Antes se fusionaba solo por productId y "2 MES" +
 * "3 DÍA" terminaba como una línea de 5 al último periodo agregado.
 */
export function cartLineKey(i: { productId: number; period?: RentalPeriod }): string {
  return `${i.productId}|${i.period ?? ''}`;
}

interface CartApi {
  items: CartItem[];
  count: number;
  total: number;
  /** Add-on "operador certificado" (se cobra por equipo; monto lo define el panel). */
  operator: boolean;
  setOperator: (v: boolean) => void;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  setQty: (lineKey: string, qty: number) => void;
  remove: (lineKey: string) => void;
  /** Quita varias líneas de golpe (p. ej. las recién compradas). */
  removeLines: (lineKeys: string[]) => void;
  clear: () => void;
  /**
   * Selección del paso Carrito. Se guardan las líneas DES-marcadas (todo entra
   * seleccionado) y la comparte el checkout: lo que se deselecciona NO se
   * cobra — antes el checkout mandaba el carrito completo aunque el paso 1
   * mostrara un total por menos líneas.
   */
  deselected: Set<string>;
  toggleSelected: (lineKey: string) => void;
  setAllSelected: (on: boolean) => void;
  selectedItems: CartItem[];
}

const CartContext = createContext<CartApi | null>(null);
const STORAGE_KEY = 'servmaq_cart_v1';

interface Stored { items: CartItem[]; operator: boolean; deselected: string[] }

function readStored(raw: string): Stored {
  const parsed = JSON.parse(raw);
  // Compat: antes se guardaba solo el arreglo de items.
  if (Array.isArray(parsed)) return { items: parsed as CartItem[], operator: false, deselected: [] };
  return {
    items: Array.isArray(parsed?.items) ? (parsed.items as CartItem[]) : [],
    operator: Boolean(parsed?.operator),
    deselected: Array.isArray(parsed?.deselected) ? (parsed.deselected as string[]) : [],
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [operator, setOperator] = useState(false);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Hidratar desde localStorage solo en cliente (evita mismatch SSR)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = readStored(raw);
        setItems(s.items);
        setOperator(s.operator);
        setDeselected(new Set(s.deselected));
      }
    } catch {
      /* carrito corrupto → empezar vacío */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, operator, deselected: [...deselected] }));
  }, [items, operator, deselected, hydrated]);

  const api = useMemo<CartApi>(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    total: items.reduce((s, i) => s + cartLineTotal(i), 0),
    operator,
    setOperator,
    add: (item, qty = 1) =>
      setItems((prev) => {
        const key = cartLineKey(item);
        const found = prev.find((i) => cartLineKey(i) === key);
        if (found) {
          return prev.map((i) => (cartLineKey(i) === key ? { ...i, ...item, qty: i.qty + qty } : i));
        }
        return [...prev, { ...item, qty }];
      }),
    setQty: (lineKey, qty) =>
      setItems((prev) =>
        qty <= 0 ? prev.filter((i) => cartLineKey(i) !== lineKey)
                 : prev.map((i) => (cartLineKey(i) === lineKey ? { ...i, qty } : i)),
      ),
    remove: (lineKey) => setItems((prev) => prev.filter((i) => cartLineKey(i) !== lineKey)),
    removeLines: (lineKeys) => {
      const gone = new Set(lineKeys);
      setItems((prev) => prev.filter((i) => !gone.has(cartLineKey(i))));
      setDeselected((prev) => new Set([...prev].filter((k) => !gone.has(k))));
    },
    clear: () => { setItems([]); setOperator(false); setDeselected(new Set()); },
    deselected,
    toggleSelected: (lineKey) =>
      setDeselected((prev) => {
        const n = new Set(prev);
        if (n.has(lineKey)) n.delete(lineKey); else n.add(lineKey);
        return n;
      }),
    setAllSelected: (on) => setDeselected(on ? new Set() : new Set(items.map(cartLineKey))),
    selectedItems: items.filter((i) => !deselected.has(cartLineKey(i))),
  }), [items, operator, deselected]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
