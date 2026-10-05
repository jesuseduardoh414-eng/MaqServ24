import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { themeSchema, type Theme } from '@maqserv/config';
import { sinSupabase } from '../common/sin-supabase';

@Injectable()
export class ThemeService {
  /** Tema activo con tokens/copys PUBLICADOS (lo que ve el sitio). */
  async getActive(): Promise<Theme> {
    const row = await prisma.theme.findFirst({ where: { active: true } });
    if (!row) throw new NotFoundException('No hay tema activo configurado');

    // Validar contra el schema compartido: si el registro está corrupto,
    // mejor fallar aquí que renderizar una UI rota.
    // Imágenes que aún apuntan a Supabase → media.maqserv24.com (ver sin-supabase.ts).
    return themeSchema.parse({
      slug: row.slug,
      name: row.name,
      active: row.active,
      tokens: sinSupabase(row.tokens),
      copys: sinSupabase(row.copys),
    });
  }
}
