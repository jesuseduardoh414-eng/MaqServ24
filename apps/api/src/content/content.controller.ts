import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('hero')
  hero() {
    return this.content.hero();
  }

  @Get('sectors')
  sectors() {
    return this.content.sectors();
  }

  @Get('sectors/:id')
  sectorById(@Param('id', ParseIntPipe) id: number) {
    return this.content.sectorById(id);
  }

  @Get('why-choose-us')
  whyChooseUs() {
    return this.content.whyChooseUs();
  }

  @Get('blogs')
  blogs(@Query('limit') limit?: string) {
    return this.content.blogs(limit ? Number(limit) : undefined);
  }

  @Get('blogs/:id')
  blogById(@Param('id', ParseIntPipe) id: number) {
    return this.content.blogById(id);
  }

  @Get('inf-sitio')
  infSitio() {
    return this.content.infSitio();
  }

  // Formularios abiertos, sin sesión: son a los que llega el spam automatizado y cada
  // envío deja un lead en el CRM. 5 por minuto sobra para una persona escribiendo.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('contact')
  contact(@Body() body: { name?: string; email?: string; phone?: string; company?: string; need?: string; message?: string }) {
    return this.content.contactMessage(body ?? {});
  }

  // Pregunta desde Preguntas frecuentes (2026-10-12): sin cuenta, con nombre y
  // correo. Llega al panel (Sitio web › Preguntas) por responder.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('questions')
  question(@Body() body: Record<string, unknown>) {
    return this.content.siteQuestion(body ?? {});
  }

  // "Regístrate como proveedor" (2026-10-06). Más estricto que contacto: cada
  // envío crea una ficha en el panel.
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('provider-signup')
  providerSignup(@Body() body: Record<string, unknown>) {
    return this.content.providerSignup(body ?? {});
  }

  @Get('faqs')
  faqs() {
    return this.content.faqs();
  }

  @Get('reviews')
  reviews(@Query('limit') limit?: string) {
    return this.content.reviews(limit ? Number(limit) : undefined);
  }
}
