import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { catalogoCotizadorSchema, esCotizadorTipo } from '@maqserv/config';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';
import { QuoterService } from '../quoter/quoter.service';
import { prisma } from '@maqserv/db';
import { calcularSchema, cotizacionPanelSchema, partidasDe, primerError, tipoDe } from '../quoter/quoter.dto';

/**
 * COTIZADORES INTERNOS · lado panel.
 *
 * Módulo propio (`cotizador`), separado de `cotizaciones`: la bandeja de lo que
 * pide el cliente y la herramienta que fija el precio no son la misma
 * responsabilidad, y esta última lleva dentro el tabulador de tarifas.
 */
@Controller('admin/quoter')
@UseGuards(AdminGuard)
@Modulo('cotizador')
export class AdminQuoterController {
  constructor(private readonly quoter: QuoterService) {}

  // ---- Tabulador ----

  /**
   * Lo que se puede ligar a un renglón: los equipos publicados que tienen
   * dueño. El dueño de cada renglón sale de aquí (ver `QuoterServicio`).
   */
  @Get('ligables')
  async ligables() {
    const productos = await prisma.products.findMany({
      where: { status: 1, provider_id: { not: null } },
      select: { id: true, name: true, category_id: true, provider_id: true },
      orderBy: { name: 'asc' },
      take: 2000,
    });
    const [cats, provs] = await Promise.all([
      prisma.categories.findMany({ where: { id: { in: [...new Set(productos.map((p) => p.category_id))] } }, select: { id: true, cat_slug: true } }),
      prisma.providers.findMany({ where: { id: { in: [...new Set(productos.map((p) => p.provider_id as number))] } }, select: { id: true, name: true } }),
    ]);
    const slug = new Map(cats.map((c) => [c.id, c.cat_slug]));
    const nombre = new Map(provs.map((p) => [p.id, p.name]));
    return productos.map((p) => ({
      id: p.id,
      name: p.name,
      linea: slug.get(p.category_id) ?? null,
      providerId: p.provider_id,
      provider: nombre.get(p.provider_id as number) ?? null,
    }));
  }

  @Get('catalog/:kind')
  catalogo(@Param('kind') kind: string) {
    return this.quoter.catalogo(tipoDe(kind));
  }

  /**
   * Guarda el tabulador COMPLETO, no un parche.
   *
   * Es a propósito: la pantalla edita un documento entero (tarifas, fletes,
   * zonas y condiciones se leen juntas) y con parches por campo dos personas
   * editando a la vez producirían un tabulador que ninguna de las dos escribió.
   * Enviando el objeto completo, la última en guardar gana y se ve qué guardó.
   */
  @Patch('catalog/:kind')
  async guardarCatalogo(@Param('kind') kind: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const tipo = tipoDe(kind);
    const parsed = catalogoCotizadorSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(`${issue?.path.join('.') ?? 'tabulador'}: ${issue?.message ?? 'datos inválidos'}`);
    }
    if (parsed.data.tipo !== tipo) throw new BadRequestException('El tabulador no corresponde a este cotizador.');

    const cat = await this.quoter.guardarCatalogo(tipo, parsed.data, req.adminEmail);
    // Sensible: mover una tarifa cambia lo que se le cobra a todo el mundo.
    await registrarAccion(req, 'cotizador', 'tabulador.guardar', tipo, `versión ${cat.version}`);
    return cat;
  }

  @Post('catalog/:kind/reset')
  async restaurarCatalogo(@Param('kind') kind: string, @Req() req: AdminRequest) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.restaurarCatalogo(tipo, req.adminEmail);
    await registrarAccion(req, 'cotizador', 'tabulador.restaurar', tipo, null);
    return cat;
  }

  /**
   * La lista de proveedores para poner dueño a cada partida.
   *
   * Vive bajo el módulo `cotizador` y no en /admin/providers a propósito:
   * quien pone precios no tiene por qué tener también el módulo de
   * proveedores, y pedirle los dos permisos para elegir un nombre de un
   * desplegable sería abrirle el expediente entero de los aliados.
   */
  @Get('providers')
  proveedores() {
    return this.quoter.proveedoresParaTabulador();
  }

  // ---- Cotizar ----

  @Post('calculate/:kind')
  async calcular(@Param('kind') kind: string, @Body() body: unknown) {
    const tipo = tipoDe(kind);
    const parsed = calcularSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    return this.quoter.calcular(tipo, partidasDe(tipo, parsed.data.partidas), parsed.data.opciones);
  }

  @Post('quotes/:kind')
  async crear(@Param('kind') kind: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const tipo = tipoDe(kind);
    const parsed = cotizacionPanelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    const d = parsed.data;
    const cot = await this.quoter.crear(
      {
        tipo,
        cliente: d.cliente,
        obra: d.obra,
        atencion: d.atencion,
        municipio: d.municipio,
        correo: d.correo,
        telefono: d.telefono,
        notas: d.notas,
        opciones: d.opciones,
        partidas: partidasDe(tipo, d.partidas),
      },
      { origen: 'panel', estado: 'borrador', adminId: req.adminId, adminNombre: req.adminNombre },
    );
    return { id: cot.id, folio: cot.folio, total: Number(cot.total) };
  }

  // ---- Historial ----

  @Get('quotes')
  listar(
    @Query('kind') kind?: string,
    @Query('state') state?: string,
    @Query('origin') origin?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.quoter.listar({
      tipo: kind && esCotizadorTipo(kind) ? kind : undefined,
      estado: state || undefined,
      origen: origin || undefined,
      buscar: search || undefined,
      pagina: Number(page ?? 1) || 1,
    });
  }

  @Get('quotes/:id')
  obtener(@Param('id') id: string) {
    return this.quoter.obtener(Number(id));
  }

  @Patch('quotes/:id/state')
  async cambiarEstado(@Param('id') id: string, @Body() body: { estado?: string }, @Req() req: AdminRequest) {
    const r = await this.quoter.cambiarEstado(Number(id), String(body?.estado ?? ''));
    await registrarAccion(req, 'cotizador', 'cotizacion.estado', `#${id}`, r.estado);
    return r;
  }

  /**
   * Mandarle la cotización al cliente por correo.
   *
   * Es un BOTÓN y no un efecto de guardar: una cotización se captura, se
   * revisa en pantalla y luego se manda. Si saliera sola al guardar, cualquier
   * error de captura —o una cotización hecha solo para dejar registro— ya
   * estaría en el buzón del cliente.
   *
   * Va a la bitácora porque es una comunicación con el cliente a nombre de la
   * empresa: quién la mandó y a dónde tiene que poderse reconstruir.
   */
  @Post('quotes/:id/enviar')
  async enviarAlCliente(@Param('id') id: string, @Req() req: AdminRequest) {
    const r = await this.quoter.enviarAlCliente(Number(id));
    const cot = await this.quoter.obtener(Number(id));
    await registrarAccion(req, 'cotizador', 'cotizacion.enviar', cot.folio, `por correo a ${r.correo}`);
    return r;
  }

  @Delete('quotes/:id')
  async eliminar(@Param('id') id: string, @Req() req: AdminRequest) {
    // Borrado: va a la bitácora aunque sea un borrador, porque desde fuera no
    // hay forma de distinguir un borrador tirado de una cotización emitida que
    // alguien quiso hacer desaparecer.
    const cot = await this.quoter.obtener(Number(id));
    const r = await this.quoter.eliminar(Number(id));
    await registrarAccion(req, 'cotizador', 'cotizacion.eliminar', cot.folio, `${cot.cliente} · $${cot.total}`);
    return r;
  }
}
