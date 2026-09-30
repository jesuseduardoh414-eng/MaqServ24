import { BadRequestException, Body, Controller, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@maqserv/db';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { problemaContrasena } from '@maqserv/config';

const profileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(250).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(12).optional(),
  /** Estado/región: columna legacy `residency`, hasta ahora sin usar. */
  residency: z.string().max(100).optional(),
});

const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8).max(100),
});

@Controller('auth')
@UseGuards(JwtGuard)
export class ProfileController {
  @Patch('profile')
  async update(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const u = await prisma.users.update({
      where: { id: req.userId },
      data: { ...parsed.data, updated_at: new Date() },
    });
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      address: u.address, city: u.city, zip: u.zip,
      residency: u.residency, createdAt: u.created_at ? u.created_at.toISOString() : null,
    };
  }

  @Post('change-password')
  async changePassword(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    }
    const u = await prisma.users.findUnique({ where: { id: req.userId } });
    if (!u?.password || !(await bcrypt.compare(parsed.data.current, u.password))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    const debil = problemaContrasena(parsed.data.next, { nombre: u.name, correo: u.email });
    if (debil) throw new BadRequestException(debil);
    await prisma.users.update({
      where: { id: req.userId },
      data: { password: await bcrypt.hash(parsed.data.next, 10), updated_at: new Date() },
    });
    return { ok: true };
  }
}
