import {
  BadRequestException, Controller, Delete, Get, NotFoundException, Param,
  ParseIntPipe, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { prisma } from '@maqserv/db';
import { videoStorage } from '../common/media-multer';
import { borrarSubidas } from '../common/media';
import { revalidarSitio } from '../common/revalidar-sitio';
import { RUTA_VIDEO_SERVICIO, videoDeServicio } from '../catalog/video-servicio';
import { AdminGuard, Modulo } from './admin-auth';

/** Mismo tope que los videos de categoría y del hero. Debe caber en `middlewareClientMaxBodySize` del panel. */
const VIDEO_MAX_MB = 30;

/** Lo que hay guardado solo se borra del disco si es un video nuestro (no un enlace legacy). */
const nuestro = (ruta: string | null) => (ruta && RUTA_VIDEO_SERVICIO.test(ruta.trim()) ? ruta.trim() : null);

/**
 * Video principal de un servicio (2026-10-20; ver `catalog/video-servicio.ts`).
 * Va aparte del PATCH de la ficha, como el de las categorías: un archivo de
 * varios MB no debe viajar cada vez que se corrige el nombre. El anterior se
 * borra del disco al reemplazarlo o quitarlo: pesan mucho para dejarlos huérfanos.
 */
@Modulo('catalogo')
@Controller('admin/catalog/products')
@UseGuards(AdminGuard)
export class AdminProductVideoController {
  @Get(':id/video')
  async get(@Param('id', ParseIntPipe) id: number) {
    const p = await prisma.products.findUnique({ where: { id }, select: { youtube: true } });
    if (!p) throw new NotFoundException();
    return { video: videoDeServicio(p.youtube) };
  }

  @Post(':id/video')
  @UseInterceptors(FileInterceptor('video', { storage: videoStorage(), limits: { fileSize: VIDEO_MAX_MB * 1024 * 1024 } }))
  async upload(@Param('id', ParseIntPipe) id: number, @UploadedFile() video?: Express.Multer.File) {
    if (!video) throw new BadRequestException('Falta el video');
    const ruta = `uploads/${video.filename}`;
    const p = await prisma.products.findUnique({ where: { id }, select: { youtube: true } });
    if (!p) {
      await borrarSubidas([ruta]);
      throw new NotFoundException();
    }
    await prisma.products.update({ where: { id }, data: { youtube: ruta } });
    const anterior = nuestro(p.youtube);
    if (anterior && anterior !== ruta) void borrarSubidas([anterior]);
    // Que la tarjeta y la ficha lo enseñen ya y no al minuto.
    await revalidarSitio();
    return { ok: true, video: videoDeServicio(ruta) };
  }

  @Delete(':id/video')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const p = await prisma.products.findUnique({ where: { id }, select: { youtube: true } });
    if (!p) throw new NotFoundException();
    const anterior = nuestro(p.youtube);
    // Un enlace legacy se queda como estaba: solo se quita lo que subimos.
    if (anterior) {
      await prisma.products.update({ where: { id }, data: { youtube: null } });
      void borrarSubidas([anterior]);
      await revalidarSitio();
    }
    return { ok: true };
  }
}
