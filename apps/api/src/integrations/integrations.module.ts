import { Controller, Get, Injectable, Logger, Module, Post, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import { AdminGuard } from '../admin/admin-auth';
import { imageUrl } from '../catalog/images';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

/**
 * Perfex CRM (brief Hito 5): al crear un suscriptor se envía como lead.
 * Env-driven: sin PERFEX_URL/PERFEX_TOKEN degrada a no-op (log).
 * API de Perfex: POST {PERFEX_URL}/api/leads con header authtoken.
 */
@Injectable()
export class PerfexService {
  private readonly logger = new Logger(PerfexService.name);

  private get config(): { url: string; token: string } | null {
    const url = process.env.PERFEX_URL;
    const token = process.env.PERFEX_TOKEN;
    return url && token ? { url: url.replace(/\/$/, ''), token } : null;
  }

  get enabled(): boolean {
    return this.config !== null;
  }

  /** Envía un lead a Perfex. Devuelve true si se envió. */
  async pushLead(data: { name: string; email: string; source?: string }): Promise<boolean> {
    const cfg = this.config;
    if (!cfg) {
      this.logger.debug(`Perfex no configurado — lead omitido (${data.email})`);
      return false;
    }
    try {
      const form = new URLSearchParams({
        name: data.name || data.email,
        email: data.email,
        source: data.source ?? 'Ecommerce',
        status: '1',
      });
      // El CRM del cliente es un tercero y el lead se manda mientras alguien
      // espera a que su formulario responda: sin tope, un Perfex caído convierte
      // "suscribirse al boletín" en una pantalla colgada. El catch de abajo ya
      // trata el fallo como lo que es —un lead que no se sincronizó—, sin tumbar
      // la operación.
      const res = await fetch(`${cfg.url}/api/leads`, {
        method: 'POST',
        headers: { authtoken: cfg.token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`Perfex respondió ${res.status} para ${data.email}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Perfex: ${(err as Error).message}`);
      return false;
    }
  }
}

/** Feed de inventario para el chatbot IA (brief Hito 5). Público. */
@Controller('api')
class FeedController {
  @Get('feed-inventario')
  async feed() {
    const rows = await prisma.products.findMany({
      where: { status: 1 },
      orderBy: { id: 'desc' },
      select: {
        id: true, name: true, cprice: true, pprice: true, stock: true, photo: true,
        is_rental: true, rental_freight: true, Marca: true, description: true, category_id: true,
      },
    });
    const cats = await prisma.categories.findMany({ select: { id: true, cat_name: true } });
    const catMap = new Map(cats.map((c) => [c.id, c.cat_name]));
    return {
      generado: new Date().toISOString(),
      total: rows.length,
      productos: rows.map((p) => ({
        id: p.id,
        nombre: p.name,
        marca: p.Marca,
        categoria: catMap.get(p.category_id) ?? null,
        precio: p.cprice,
        precioAnterior: p.pprice,
        enRenta: p.is_rental,
        tarifaFletePorKm: p.rental_freight ? Number(p.rental_freight) : null,
        stock: p.stock,
        disponible: p.stock === null || p.stock > 0,
        descripcion: p.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
        imagen: imageUrl(p.photo),
        url: `${SITE_URL}/productos/${productSlug(p.name, p.id)}`,
      })),
    };
  }
}

// La carga inicial de suscriptores a Perfex vivía aquí (`POST admin/perfex/sync-subscribers`)
// pero NO tenía botón en el panel: era inalcanzable. Se movió a
// `admin-subscribers.controller.ts` (`POST admin/subscribers/sync`), junto a la lista
// que sincroniza y con su botón.

@Module({
  controllers: [FeedController],
  providers: [PerfexService],
  exports: [PerfexService],
})
export class IntegrationsModule {}
