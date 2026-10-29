import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { catalogoCotizadorSchema, conZonaDeLaObra, esCotizadorTipo, faltaZona, llevaFlete, normalizarNombre } from '@maqserv/config';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';
import { revisarCampos } from '../common/campos';
import { QuoterService } from '../quoter/quoter.service';
import { QuoterServicio } from '../quoter/quoter-servicio';
import { Recotizar } from '../quoter/recotizar';
import { prisma } from '@maqserv/db';
import { calcularSchema, cotizacionPanelSchema, partidasDe, primerError, tipoDe } from '../quoter/quoter.dto';
import { resolverClienteYObra } from '../quotes/client-resolver';

/**
 * COTIZADORES INTERNOS · lado panel.
 *
 * Módulo propio (`cotizador`), separado de `cotizaciones`: la bandeja de lo que
 * pide el cliente y la herramienta que fija el precio no son la misma
 * responsabilidad, y esta última lleva dentro el tabulador de tarifas.
 */

const dinero = z.coerce.number().min(0, 'Un precio no puede ser negativo').max(100_000_000);

/** El precio de una ficha en el cotizador, tal como lo manda su pantalla. */
const fichaSchema = z.object({
  oculto: z.boolean().default(false),
  renglones: z.array(z.object({
    id: z.string().max(40).optional(),
    nombre: z.string().trim().min(2, 'Pon el nombre con el que sale en el cotizador').max(120),
    /** Equipo: precio por hora (2026-10-29; antes, tarifa por día en tres tramos). */
    precio_hora: dinero.optional(),
    flete_tipo: z.string().trim().max(60).optional(),
    precio: dinero.optional(),
    cond: z.string().max(40).optional(),
    /** Servicio: precio por viaje en cada zona (el agua, 2026-10-29). Null: ya no cobra por zona. */
    precios_zona: z.record(z.string().max(40), dinero).nullable().optional(),
  })).max(30),
  /** Tipos de flete creados desde la ficha: nombre → monto. */
  fletesNuevos: z.record(z.string().trim().min(2).max(60), dinero).optional(),
});

@Controller('admin/quoter')
@UseGuards(AdminGuard)
@Modulo('cotizador')
export class AdminQuoterController {
  constructor(
    private readonly quoter: QuoterService,
    private readonly servicio: QuoterServicio,
    private readonly recotizar: Recotizar,
  ) {}

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
  @Modulo('tarifas') // cambiar precios: solo Dirección de fábrica (2026-10-22)
  @Patch('catalog/:kind')
  async guardarCatalogo(@Param('kind') kind: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const tipo = tipoDe(kind);
    const parsed = catalogoCotizadorSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(`${issue?.path.join('.') ?? 'tabulador'}: ${issue?.message ?? 'datos inválidos'}`);
    }
    if (parsed.data.tipo !== tipo) throw new BadRequestException('El tabulador no corresponde a este cotizador.');
    // Los datos de la empresa salen impresos en cada cotización: se revisan al
    // guardar (el esquema compartido no, para no tumbar la LECTURA de lo viejo).
    const { empresa, firma } = parsed.data;
    const malo = revisarCampos([['telefono', empresa.telefono], ['correo', empresa.correo], ['rfc', empresa.rfc], ['telefono', firma.telefono]]);
    if (malo) throw new BadRequestException(malo);
    // Un municipio en dos zonas de precio tendría dos precios (2026-10-29).
    if (parsed.data.tipo === 'maquinaria') {
      const visto = new Map<string, string>();
      for (const z of parsed.data.zonas_precio ?? []) {
        for (const m of z.municipios) {
          const clave = normalizarNombre(m);
          if (!clave) continue;
          const otra = visto.get(clave);
          if (otra && otra !== z.nombre) throw new BadRequestException(`${m} está en ${otra} y en ${z.nombre}: déjalo en una sola zona.`);
          visto.set(clave, z.nombre);
        }
      }
    }

    const cat = await this.quoter.guardarCatalogo(tipo, parsed.data, req.adminEmail);
    // Sensible: mover una tarifa cambia lo que se le cobra a todo el mundo.
    await registrarAccion(req, 'cotizador', 'tabulador.guardar', tipo, `versión ${cat.version}`);
    return cat;
  }

  @Modulo('tarifas') // cambiar precios: solo Dirección de fábrica (2026-10-22)
  @Post('catalog/:kind/reset')
  async restaurarCatalogo(@Param('kind') kind: string, @Req() req: AdminRequest) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.restaurarCatalogo(tipo, req.adminEmail);
    await registrarAccion(req, 'cotizador', 'tabulador.restaurar', tipo, null);
    return cat;
  }

  /** A qué ficha de Inventario pertenece cada renglón (Tarifas ya solo los enseña). */
  @Get('catalog/:kind/fichas')
  fichasDeRenglones(@Param('kind') kind: string) {
    return this.quoter.fichasDeRenglones(tipoDe(kind));
  }

  // ---- El precio de cada tipo, desde su ficha (2026-10-19) ----

  @Get('ficha/:productId')
  ficha(@Param('productId', ParseIntPipe) productId: number) {
    return this.quoter.fichaEnCotizador(productId);
  }

  @Modulo('tarifas') // cambiar precios: solo Dirección de fábrica (2026-10-22)
  @Put('ficha/:productId')
  async guardarFicha(@Param('productId', ParseIntPipe) productId: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const parsed = fichaSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    const r = await this.quoter.guardarFicha(productId, parsed.data, req.adminEmail);
    // Sensible como el tabulador: es el precio que se le cobra a todo el mundo.
    await registrarAccion(req, 'cotizador', 'tabulador.ficha', r.tipo, r.nombre);
    return r.ficha;
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

  /**
   * CLIENTES Y OBRAS PARA EL COTIZADOR DEL PANEL (2026-10-23): se elige un
   * cliente registrado y una de sus obras, o se escriben nuevos y se dan de
   * alta al guardar la cotización.
   */
  @Get('clientes')
  clientes() {
    return prisma.clients.findMany({
      where: { status: 1 },
      orderBy: { name: 'asc' },
      take: 3000,
      select: { id: true, name: true, email: true, phone: true },
    });
  }

  @Get('clientes/:id/obras')
  obrasDeCliente(@Param('id', ParseIntPipe) id: number) {
    return prisma.client_sites.findMany({
      where: { client_id: id, status: 1 },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true, municipality: true, contact_name: true, contact_phone: true },
    });
  }

  @Post('calculate/:kind')
  async calcular(@Param('kind') kind: string, @Body() body: unknown) {
    const tipo = tipoDe(kind);
    const parsed = calcularSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    return this.quoter.calcular(tipo, partidasDe(tipo, parsed.data.partidas), parsed.data.opciones);
  }

  /** Los datos de una solicitud del formulario para abrir el cotizador ya llenado (2026-10-15). */
  @Get('solicitud/:id')
  datosParaCotizar(@Param('id') id: string) {
    return this.quoter.datosParaCotizar(Number(id));
  }

  @Post('quotes/:kind')
  async crear(@Param('kind') kind: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const tipo = tipoDe(kind);
    const parsed = cotizacionPanelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    const d = parsed.data;
    // Cotizando una solicitud del formulario: se revisa ANTES de emitir, para
    // no dejar un folio suelto si la solicitud ya no admite precio nuevo.
    const solicitudId = Number((body as { solicitudId?: unknown } | null)?.solicitudId) || null;
    const solicitud = solicitudId ? await this.quoter.solicitudLigable(solicitudId) : null;
    // El agua sin zona elegida toma la del municipio de la obra; sin zona no se cotiza (2026-10-29).
    const cat = await this.quoter.catalogo(tipo);
    const partidas = conZonaDeLaObra(cat, partidasDe(tipo, d.partidas), d.municipio);
    const sinZona = faltaZona(cat, partidas, d.municipio);
    if (sinZona) throw new BadRequestException(sinZona);

    /**
     * Su documento todavía no se le manda al cliente (2026-10-23): se rehace
     * ese MISMO documento, con su folio, en vez de emitir otro. Si ya se había
     * mandado, sale uno nuevo que lo reemplaza (abajo).
     */
    const enSuLugar = solicitud ? await this.recotizar.documentoEditable(solicitud, tipo) : null;
    if (solicitud && enSuLugar) {
      const doc = await this.recotizar.recalcular(enSuLugar.id, {
        partidas,
        opciones: d.opciones,
        contexto: { cliente: d.cliente, obra: d.obra, atencion: d.atencion, municipio: d.municipio, correo: d.correo, telefono: d.telefono, notas: d.notas },
        adminNombre: req.adminNombre ?? null,
      });
      await registrarAccion(req, 'cotizaciones', 'solicitud.cotizar', solicitud.quote_number, `documento ${doc.folio} actualizado · $${Number(doc.total)}`);
      return { id: doc.id, folio: doc.folio, total: Number(doc.total), solicitud: { id: Number(solicitud.id), quoteNumber: solicitud.quote_number } };
    }

    /**
     * A qué cliente y obra va (2026-10-23): los registrados que eligió, o los
     * nuevos que escribió, que se dan de alta aquí mismo. Al volver a cotizar
     * una solicitud no: esa ya tiene los suyos.
     */
    // La fecha del servicio no puede ser pasada (hoy en Monterrey), igual que en el sitio.
    if (d.fecha && d.fecha < new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date())) {
      throw new BadRequestException('La fecha ya pasó. Elige hoy o una fecha posterior.');
    }
    const destino = solicitud
      ? null
      : await resolverClienteYObra({
          companyName: d.cliente,
          contactName: d.atencion || d.cliente,
          email: d.correo || null,
          phone: d.telefono || null,
          address: d.obraId ? null : d.direccion ? [d.direccion, d.municipio].filter(Boolean).join(', ') : null,
          region: d.municipio || null,
          siteName: d.obraId ? null : d.obra || null,
          clientId: d.clienteId ?? null,
          siteId: d.obraId ?? null,
          confiarEnIds: true,
        });

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
        partidas,
      },
      {
        origen: 'panel', estado: 'borrador', adminId: req.adminId, adminNombre: req.adminNombre,
        // De la cuenta del cliente: así el documento es suyo también en el sitio.
        userId: solicitud?.user_id != null ? Number(solicitud.user_id) : null,
        destino: destino?.clientId ? { clientId: destino.clientId, siteId: destino.siteId } : null,
        fecha: d.fecha || null,
        // Triturados con flete: la ubicación en Google Maps, si la pegaron (2026-10-29).
        ubicacion: tipo === 'triturados' && llevaFlete(partidas) ? d.ubicacion || null : null,
      },
    );
    if (solicitud) {
      await this.recotizar.ligar(solicitud, cot);
      await registrarAccion(req, 'cotizaciones', 'solicitud.cotizar', solicitud.quote_number, `documento ${cot.folio} · $${Number(cot.total)}`);
    }
    return {
      id: cot.id,
      folio: cot.folio,
      total: Number(cot.total),
      solicitud: solicitud ? { id: Number(solicitud.id), quoteNumber: solicitud.quote_number } : null,
    };
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
    /**
     * Aceptada = el cliente dijo que sí (2026-10-15): se abre su servicio, que
     * queda por asignar para que MAQSER24 elija a quién dárselo (2026-10-23).
     * Solo para las que armó el panel; las del sitio y las ligadas a una
     * solicitud ya tienen su servicio.
     */
    if (r.estado === 'aceptada') {
      const doc = await prisma.quoter_quotes.findUnique({ where: { id: Number(id) }, select: { kind: true } });
      if (doc && esCotizadorTipo(doc.kind)) {
        const abierto = await this.servicio.abrirDesdePanel(Number(id), await this.quoter.catalogo(doc.kind), req.adminNombre ?? null);
        if (abierto) {
          await registrarAccion(req, 'cotizador', 'cotizacion.servicio', abierto.quoteNumber, 'servicio abierto, por asignar');
          return { ...r, servicio: { quoteNumber: abierto.quoteNumber, ofrecidos: abierto.proveedores } };
        }
      }
    }
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
    const r = await this.quoter.enviarAlCliente(Number(id), req.adminNombre ?? null);
    const cot = await this.quoter.obtener(Number(id));
    await registrarAccion(req, 'cotizador', 'cotizacion.enviar', cot.folio, `por correo a ${r.correo}${r.respondidas.length ? ` · responde ${r.respondidas.join(', ')}` : ''}`);
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
