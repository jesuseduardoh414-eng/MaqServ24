import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { LINEAS_SERVICIO, themeSchema, type Theme } from '@maqserv/config';
import { sinSupabase } from '../common/sin-supabase';
import { enlacesDeCatalogo } from '../common/enlaces-catalogo';

/** Un minuto: es lo que tarda el sitio en regenerar sus páginas (ISR). */
const TTL_PRODUCTOS_MS = 60_000;

@Injectable()
export class ThemeService {
  private hayProductosCache: { at: number; valor: boolean } | null = null;

  /** Tema activo con tokens/copys PUBLICADOS (lo que ve el sitio). */
  async getActive(): Promise<Theme> {
    // En paralelo: el costo de la API son los viajes en serie a la base.
    const [row, hayProductos] = await Promise.all([
      prisma.theme.findFirst({ where: { active: true } }),
      this.hayProductos(),
    ]);
    if (!row) throw new NotFoundException('No hay tema activo configurado');

    // Imágenes que aún apuntan a Supabase → media.maqserv24.com (ver sin-supabase.ts).
    // Sin productos publicados, los enlaces a /productos van a /servicios (ver enlaces-catalogo.ts).
    const limpiar = <T>(v: T): T => (hayProductos ? sinSupabase(v) : enlacesDeCatalogo(sinSupabase(v)));

    // Validar contra el schema compartido: si el registro está corrupto,
    // mejor fallar aquí que renderizar una UI rota.
    return themeSchema.parse({
      slug: row.slug,
      name: row.name,
      active: row.active,
      tokens: limpiar(row.tokens),
      copys: limpiar(row.copys),
    });
  }

  /**
   * ¿Hay algún PRODUCTO (no servicio) publicado? Misma regla que
   * `ProductsService.resumen()` —todo lo que no cae en una línea de servicio—
   * pero en un solo viaje. Si la consulta falla se supone que sí: dejar los
   * enlaces como están es lo seguro, nunca esconder productos reales.
   */
  private async hayProductos(): Promise<boolean> {
    const c = this.hayProductosCache;
    if (c && Date.now() - c.at < TTL_PRODUCTOS_MS) return c.valor;
    try {
      const filas = await prisma.$queryRaw<Array<{ n: bigint | number }>>`
        SELECT COUNT(*) AS n FROM products p
        WHERE p.status = 1 AND p.category_id IS NOT NULL
          AND p.category_id NOT IN (SELECT id FROM categories WHERE cat_slug IN (${Prisma.join([...LINEAS_SERVICIO])}))`;
      const valor = Number(filas[0]?.n ?? 0) > 0;
      this.hayProductosCache = { at: Date.now(), valor };
      return valor;
    } catch {
      return true;
    }
  }
}
