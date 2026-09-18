import {
  BadRequestException, Body, Controller, Get, Post, Req, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { googleActivo, perfilDesdeCodigo } from './google';
import { JwtGuard, type AuthedRequest } from './jwt.guard';

/**
 * Puertas de entrada: se prueban a ciegas (contraseñas filtradas de otros sitios) y
 * cada intento cuesta poco al atacante. Supabase pone su propio límite, pero es suyo y
 * puede cambiar: el nuestro es explícito y está a la vista.
 *
 * `refresh` NO se limita aquí: el middleware del panel lo llama solo al renovar, y
 * apretarlo cerraría sesiones legítimas. Se queda con el techo global.
 */
const AUTH_LIMIT = { default: { ttl: 60_000, limit: 10 } };

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(190),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

const googleSchema = z.object({
  code: z.string().min(10).max(2048),
  /** El MISMO que se mandó a Google; si no coincide, Google rechaza el canje. */
  redirectUri: z.string().url().max(400),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Qué proveedores externos están realmente configurados.
   *
   * Lo consulta el sitio para decidir si pinta el botón de Google. Antes el
   * botón salía siempre y al tocarlo decía "estará disponible pronto", que es
   * la peor versión: promete algo que no existe. Público a propósito — no
   * revela nada, solo si una integración está encendida.
   */
  @Get('providers')
  proveedores() {
    return { google: googleActivo() };
  }

  /**
   * Canjea el código de Google por una sesión nuestra.
   *
   * Lo llama el SERVIDOR de la web (nunca el navegador): aquí vive el
   * `client_secret`. Ver la cabecera de `google.ts` para el recorrido completo.
   */
  @Throttle(AUTH_LIMIT)
  @Post('google')
  async google(@Body() body: unknown) {
    if (!googleActivo()) {
      throw new ServiceUnavailableException('El inicio con Google no está configurado en el servidor.');
    }
    const parsed = googleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const perfil = await perfilDesdeCodigo(parsed.data.code, parsed.data.redirectUri);
    return this.auth.loginConGoogle(perfil);
  }

  @Throttle(AUTH_LIMIT)
  @Post('register')
  register(@Body() body: unknown) {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    return this.auth.register(parsed.data);
  }

  @Throttle(AUTH_LIMIT)
  @Post('login')
  login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    return this.auth.login(parsed.data);
  }

  // Más apretado: cada intento manda un CORREO. Sin esto se puede usar la tienda
  // para inundar el buzón de alguien.
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  forgotPassword(@Body() body: unknown) {
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Correo inválido');
    return this.auth.forgotPassword(parsed.data.email, parsed.data.redirectTo);
  }

  // Segundo paso de "olvidé mi contraseña": el token viene del enlace del correo.
  // Mismo límite que el login: es una puerta de entrada y el token se puede probar a ciegas.
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  resetPassword(@Body() body: unknown) {
    const parsed = z.object({ token: z.string().min(32).max(200), password: z.string().min(8).max(100) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    return this.auth.resetPassword(parsed.data.token, parsed.data.password);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    const token = (body as { refresh_token?: string })?.refresh_token;
    if (!token) throw new BadRequestException('Falta refresh_token');
    return this.auth.refresh(token);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.userId);
  }
}
