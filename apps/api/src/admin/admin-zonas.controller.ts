import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { MUNICIPIOS_NORTE, centroDeMunicipio } from '@maqserv/config';
import { AdminGuard, type AdminRequest, Modulo } from './admin-auth';
import { registrarAccion } from './audit';
import { guardarZonas, leerZonas } from '../common/zonas';
import { lista } from '../common/json-list';
import { coberturaDe, normalizarZona } from '../quotes/matching';

const zonasSchema = z.array(z.object({
  id: z.string().trim().min(1).max(40),
  nombre: z.string().trim().min(2).max(80),
  estado: z.enum(['sitio', 'interna', 'pausada']),
  municipios: z.array(z.string().trim().min(2).max(80)).max(80),
})).min(1).max(30);

/**
 * ZONAS (2026-10-22, Fase B). Se editan aquí y de aquí salen los municipios de
 * los cotizadores (common/zonas.ts). Junto a cada municipio va lo único que
 * importa para decidir: cuántos aliados llegan, para saber dónde reclutar antes
 * de que un cliente se quede sin nadie.
 */
@Modulo('configuracion')
@Controller('admin/zonas')
@UseGuards(AdminGuard)
export class AdminZonasController {
  // Verla, cualquiera del panel (2026-10-26, "Zonas y cobertura"); guardar sigue siendo de configuración.
  @Modulo('inicio')
  @Get()
  async zonas() {
    const zonas = await leerZonas();
    const [aliados, solicitudes] = await Promise.all([
      prisma.providers.findMany({ where: { status: 1 }, select: { coverage: true, lat: true, lng: true, coverage_radius_km: true } }),
      prisma.quotes.findMany({ where: { created_at: { gte: new Date(Date.now() - 90 * 86_400_000) } }, select: { region: true, address: true } }),
    ]);
    const textos = solicitudes.map((s) => normalizarZona(`${s.region ?? ''} ${s.address ?? ''}`));
    const llegan = (municipio: string) => {
      const c = centroDeMunicipio(municipio);
      const punto = c ? { lat: c.lat, lon: c.lng } : null;
      return aliados.filter((a) => coberturaDe(
        { coverage: lista(a.coverage), lat: a.lat != null ? Number(a.lat) : null, lng: a.lng != null ? Number(a.lng) : null, coverageRadiusKm: a.coverage_radius_km },
        { categoria: null, zona: municipio.replace(/,\s*(Coah|Chih)\.?$/i, ''), punto },
      ).cubre).length;
    };
    const salud = zonas.map((z) => {
      // Con su cabecera en el mapa (2026-10-28): null si el nombre no está en la tabla.
      const municipios = z.municipios.map((m) => { const c = centroDeMunicipio(m); return { nombre: m, aliados: llegan(m), lat: c?.lat ?? null, lng: c?.lng ?? null }; });
      const claves = z.municipios.map((m) => normalizarZona(m.replace(/,\s*(Coah|Chih)\.?$/i, '')));
      return {
        id: z.id,
        municipios,
        sinAliado: municipios.filter((m) => m.aliados === 0).map((m) => m.nombre),
        unSolo: municipios.filter((m) => m.aliados === 1).map((m) => m.nombre),
        solicitudes90: textos.filter((t) => claves.some((k) => k && t.includes(k))).length,
      };
    });
    const usados = new Set(zonas.flatMap((z) => z.municipios));
    return { zonas, salud, sugerencias: MUNICIPIOS_NORTE.filter((m) => !usados.has(m)) };
  }

  @Put()
  async guardar(@Body() body: unknown, @Req() req: AdminRequest) {
    const d = zonasSchema.safeParse(body);
    if (!d.success) throw new BadRequestException(d.error.issues[0]?.message ?? 'Zonas inválidas');
    const ids = new Set<string>();
    const vistos = new Map<string, string>();
    for (const z of d.data) {
      if (ids.has(z.id)) throw new BadRequestException('Hay dos zonas con el mismo identificador.');
      ids.add(z.id);
      for (const m of z.municipios) {
        const k = m.toLowerCase();
        if (vistos.has(k) && vistos.get(k) !== z.id) throw new BadRequestException(`${m} está en dos zonas. Déjalo solo en una.`);
        vistos.set(k, z.id);
      }
    }
    const limpias = d.data.map((z) => ({ ...z, municipios: [...new Set(z.municipios)] }));
    await guardarZonas(limpias, req.adminEmail ?? 'panel');
    await registrarAccion(req, 'configuracion', 'zonas.guardar', 'zonas', limpias.map((z) => `${z.nombre}: ${z.estado}`).join(' · '));
    return { ok: true };
  }
}
