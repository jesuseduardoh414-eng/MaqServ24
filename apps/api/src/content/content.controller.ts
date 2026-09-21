import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
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

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('subscribe')
  subscribe(@Body() body: { email?: string }) {
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 190) {
      throw new BadRequestException('Correo inválido');
    }
    return this.content.subscribe(email);
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
