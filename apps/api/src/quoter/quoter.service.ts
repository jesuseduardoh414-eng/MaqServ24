import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import {
  CATALOGOS_DEFAULT,
  COTIZADORES_META,
  calcularCotizacion,
  catalogoCotizadorSchema,
  partidasPorProveedor,
  tieneImporte,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CotizadorTipo,
  type OpcionesCotizador,
  type PartidaCotizador,
} from '@maqserv/config';
import { MailerService } from '../notifications/mailer.service';
import {
  correoAcuseSolicitud,
  correoCotizacionDelPanel,
  correoSolicitudAProveedor,
  correoSolicitudInterna,
} from '../notifications/email-templates';

/**
 * COTIZADORES INTERNOS · la verdad del precio.
 *
 * Todo lo que cuesta dinero pasa por aquí: el navegador manda QUÉ eligió y este
 * servicio pone CUÁNTO vale, leyendo el tabulador de la base de datos. El
 * cálculo en sí no vive aquí sino en `@maqserv/config`, para que la pantalla
 * pueda ejecutar exactamente las mismas líneas mientras el usuario teclea sin
 * pedir permiso a la red en cada cambio.
 */
@Injectable()
export class QuoterService {
  private readonly log = new Logger('Quoter');

  constructor(private readonly mailer: MailerService) {}

  /**
   * Caché corta del tabulador.
   *
   * Cada tecla del usuario dispara un recálculo en su pantalla, pero al guardar
   * y al pedir el documento se recalcula aquí; sin caché, cada una de esas
   * llamadas cuesta un viaje a MySQL para leer la MISMA fila. 30 s es tiempo de
   * sobra para que un cambio de tarifa se note, y lo invalida a mano quien la
   * guarda (ver `guardarCatalogo`).
   */
  private cache = new Map<CotizadorTipo, { until: number; cat: CatalogoCotizador }>();
  private static readonly TTL_MS = 30_000;

  /**
   * El tabulador vigente.
   *
   * La primera vez no hay fila: se siembra con el catálogo de `@maqserv/config`
   * en vez de fallar. Es deliberado — el cotizador tiene que funcionar el día
   * que se despliega, sin que nadie se acuerde de correr un seed.
   *
   * Si la fila existe pero el JSON ya no cuadra con el esquema (alguien editó
   * la BD a mano, o el esquema cambió en un despliegue), se cae al catálogo por
   * defecto y se deja un error en el log. Es lo contrario de lo que haría uno
   * por reflejo —reventar—, pero reventar aquí deja el panel sin cotizador; con
   * el defecto, sigue cotizando y la pantalla de Tarifas avisa.
   */
  async catalogo(tipo: CotizadorTipo): Promise<CatalogoCotizador> {
    const hit = this.cache.get(tipo);
    if (hit && hit.until > Date.now()) return hit.cat;

    const fila = await prisma.quoter_catalogs.findUnique({ where: { kind: tipo } });
    let cat: CatalogoCotizador;

    if (!fila) {
      cat = CATALOGOS_DEFAULT[tipo];
      await prisma.quoter_catalogs
        .create({ data: { kind: tipo, version: cat.version, data: cat as unknown as Prisma.InputJsonValue } })
        .catch(() => {
          // Carrera con otra petición que sembró primero: da igual quién ganó.
        });
    } else {
      const parsed = catalogoCotizadorSchema.safeParse(fila.data);
      if (parsed.success && parsed.data.tipo === tipo) {
        cat = parsed.data;
      } else {
        this.log.error(
          `El tabulador de "${tipo}" guardado no pasa validación (${parsed.success ? 'tipo cruzado' : parsed.error.issues[0]?.message}). Se usa el de fábrica.`,
        );
        cat = CATALOGOS_DEFAULT[tipo];
      }
    }

    this.cache.set(tipo, { until: Date.now() + QuoterService.TTL_MS, cat });
    return cat;
  }

  /** Guarda el tabulador completo. Lo valida el controlador antes de llegar. */
  async guardarCatalogo(tipo: CotizadorTipo, cat: CatalogoCotizador, correo: string): Promise<CatalogoCotizador> {
    const data = { version: cat.version, data: cat as unknown as Prisma.InputJsonValue, updated_by: correo.slice(0, 190), updated_at: new Date() };
    await prisma.quoter_catalogs.upsert({
      where: { kind: tipo },
      create: { kind: tipo, ...data },
      update: data,
    });
    this.cache.delete(tipo);
    return cat;
  }

  /** Vuelve el tabulador a los valores de fábrica de `@maqserv/config`. */
  async restaurarCatalogo(tipo: CotizadorTipo, correo: string): Promise<CatalogoCotizador> {
    return this.guardarCatalogo(tipo, CATALOGOS_DEFAULT[tipo], correo);
  }

  /** Vista previa: calcula sin guardar nada. */
  async calcular(tipo: CotizadorTipo, partidas: PartidaCotizador[], opciones: Partial<OpcionesCotizador>): Promise<CalculoCotizacion> {
    const cat = await this.catalogo(tipo);
    return calcularCotizacion(cat, partidas, opciones);
  }

  /**
   * Folio consecutivo del mes: MQ-2609-0001 / TR-2609-0001.
   *
   * Se cuenta lo emitido en el mes en curso en vez de llevar un contador
   * aparte. Dos personas guardando a la vez pueden pedir el mismo número, y por
   * eso el alta reintenta cuando el índice único lo rechaza (ver `crear`): es
   * una colisión rarísima y resolverla con un reintento sale más barato que
   * mantener una tabla de secuencias.
   */
  private async siguienteFolio(tipo: CotizadorTipo, intento: number): Promise<string> {
    const prefijo = tipo === 'maquinaria' ? 'MQ' : 'TR';
    const ahora = new Date();
    const aa = String(ahora.getFullYear()).slice(2);
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const n = await prisma.quoter_quotes.count({ where: { kind: tipo, created_at: { gte: desde } } });
    return `${prefijo}-${aa}${mm}-${String(n + 1 + intento).padStart(4, '0')}`;
  }

  /**
   * Emite una cotización.
   *
   * Recalcula SIEMPRE desde el tabulador —lo que mandó el navegador no se
   * cree— y guarda el resultado congelado en `snapshot`: el documento seguirá
   * diciendo lo mismo dentro de un año aunque las tarifas hayan subido.
   */
  async crear(entrada: {
    tipo: CotizadorTipo;
    cliente: string;
    obra?: string | null;
    atencion?: string | null;
    municipio?: string | null;
    correo?: string | null;
    telefono?: string | null;
    notas?: string | null;
    opciones: Partial<OpcionesCotizador>;
    partidas: PartidaCotizador[];
  }, contexto: {
    origen: 'panel' | 'sitio';
    estado: string;
    adminId?: number | null;
    adminNombre?: string | null;
    userId?: number | null;
  }) {
    const cat = await this.catalogo(entrada.tipo);
    const calc = calcularCotizacion(cat, entrada.partidas, entrada.opciones);
    if (!tieneImporte(calc)) {
      throw new BadRequestException('La cotización no tiene partidas con importe. Revisa cantidades y precios.');
    }

    const snapshot = {
      calc,
      version: cat.version,
      empresa: cat.empresa,
      firma: cat.firma,
      saludo: cat.saludo,
      emitida: new Date().toISOString(),
    };

    const base = {
      kind: entrada.tipo,
      origin: contexto.origen,
      state: contexto.estado,
      client_name: (entrada.cliente || 'Sin nombre').slice(0, 190),
      work: entrada.obra?.slice(0, 190) || null,
      attention: entrada.atencion?.slice(0, 190) || null,
      municipality: entrada.municipio?.slice(0, 90) || null,
      email: entrada.correo?.slice(0, 190) || null,
      phone: entrada.telefono?.slice(0, 40) || null,
      notes: entrada.notas || null,
      options: entrada.opciones as unknown as Prisma.InputJsonValue,
      items: entrada.partidas as unknown as Prisma.InputJsonValue,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      subtotal: new Prisma.Decimal(calc.subtotal),
      tax: new Prisma.Decimal(calc.iva),
      total: new Prisma.Decimal(calc.total),
      admin_id: contexto.adminId ?? null,
      admin_name: contexto.adminNombre?.slice(0, 190) ?? null,
      user_id: contexto.userId ?? null,
    };

    // Reintento por colisión de folio (ver `siguienteFolio`). 5 vueltas es más
    // de lo que hará falta nunca; a la sexta es otro problema y hay que verlo.
    for (let intento = 0; intento < 5; intento += 1) {
      try {
        const folio = await this.siguienteFolio(entrada.tipo, intento);
        return await prisma.quoter_quotes.create({ data: { ...base, folio } });
      } catch (e) {
        const duplicado = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!duplicado) throw e;
      }
    }
    throw new BadRequestException('No se pudo asignar folio. Inténtalo de nuevo.');
  }

  /**
   * DOCUMENTO DE UNA SOLICITUD POR MÁQUINA (2026-09-25).
   *
   * El cliente quiere el mismo documento de siempre (folio, empresa, partidas,
   * condiciones, firma) aunque el precio ya no salga del tabulador sino de la
   * máquina que eligió. El cálculo llega hecho por el recomendador; aquí solo
   * se congela con los datos de la empresa del tabulador de su línea y se le
   * da folio. Nace `solicitada` (2026-09-25): "aparecen aceptadas pero aún no
   * apruebo nada". Pasa a `aceptada` cuando los aliados aceptan todos sus
   * servicios (ver `ServiceService.responder`).
   */
  async documentoDeMaquina(d: {
    tipo: CotizadorTipo;
    calc: CalculoCotizacion;
    cliente: string;
    obra?: string | null;
    atencion?: string | null;
    municipio?: string | null;
    correo?: string | null;
    telefono?: string | null;
    notas?: string | null;
    items: unknown;
    userId: number;
  }) {
    const cat = await this.catalogo(d.tipo);
    const snapshot = {
      calc: d.calc,
      version: cat.version,
      empresa: cat.empresa,
      firma: cat.firma,
      saludo: cat.saludo,
      emitida: new Date().toISOString(),
    };
    const base = {
      kind: d.tipo,
      origin: 'sitio',
      state: 'solicitada',
      client_name: (d.cliente || 'Sin nombre').slice(0, 190),
      work: d.obra?.slice(0, 190) || null,
      attention: d.atencion?.slice(0, 190) || null,
      municipality: d.municipio?.slice(0, 90) || null,
      email: d.correo?.slice(0, 190) || null,
      phone: d.telefono?.slice(0, 40) || null,
      notes: d.notas || null,
      options: {} as Prisma.InputJsonValue,
      items: d.items as Prisma.InputJsonValue,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      subtotal: new Prisma.Decimal(d.calc.subtotal),
      tax: new Prisma.Decimal(d.calc.iva),
      total: new Prisma.Decimal(d.calc.total),
      user_id: d.userId,
    };
    for (let intento = 0; intento < 5; intento += 1) {
      try {
        const folio = await this.siguienteFolio(d.tipo, intento);
        return await prisma.quoter_quotes.create({ data: { ...base, folio }, select: { id: true, folio: true } });
      } catch (e) {
        const duplicado = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!duplicado) throw e;
      }
    }
    throw new BadRequestException('No se pudo asignar folio. Inténtalo de nuevo.');
  }

  async listar(filtros: { tipo?: CotizadorTipo; estado?: string; origen?: string; buscar?: string; pagina?: number }) {
    const porPagina = 25;
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const where: Prisma.quoter_quotesWhereInput = {};
    if (filtros.tipo) where.kind = filtros.tipo;
    if (filtros.estado) where.state = filtros.estado;
    if (filtros.origen) where.origin = filtros.origen;
    const term = filtros.buscar?.trim();
    if (term) {
      // Sin `mode`: la colación utf8mb4_unicode_ci de MySQL ya ignora
      // mayúsculas y acentos.
      where.OR = [
        { folio: { contains: term } },
        { client_name: { contains: term } },
        { work: { contains: term } },
        { email: { contains: term } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.quoter_quotes.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true, kind: true, folio: true, origin: true, state: true,
          client_name: true, work: true, municipality: true, email: true, phone: true,
          total: true, admin_name: true, created_at: true,
        },
      }),
      prisma.quoter_quotes.count({ where }),
    ]);

    return {
      items: items.map((q) => ({
        id: q.id,
        tipo: q.kind,
        folio: q.folio,
        origen: q.origin,
        estado: q.state,
        cliente: q.client_name,
        obra: q.work,
        municipio: q.municipality,
        correo: q.email,
        telefono: q.phone,
        total: Number(q.total),
        admin: q.admin_name,
        fecha: q.created_at,
      })),
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
    };
  }

  /** Una cotización completa, con su cálculo congelado listo para imprimir. */
  async obtener(id: number) {
    const q = await prisma.quoter_quotes.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return {
      id: q.id,
      tipo: q.kind as CotizadorTipo,
      folio: q.folio,
      origen: q.origin,
      estado: q.state,
      cliente: q.client_name,
      obra: q.work,
      atencion: q.attention,
      municipio: q.municipality,
      correo: q.email,
      telefono: q.phone,
      notas: q.notes,
      opciones: q.options as unknown as OpcionesCotizador,
      partidas: q.items as unknown as PartidaCotizador[],
      documento: q.snapshot as unknown as {
        calc: CalculoCotizacion;
        version: string;
        empresa: CatalogoCotizador['empresa'];
        firma: CatalogoCotizador['firma'];
        saludo: string;
        emitida: string;
      },
      total: Number(q.total),
      admin: q.admin_name,
      fecha: q.created_at,
    };
  }


  /**
   * Los proveedores, para el selector de dueño del tabulador.
   *
   * Devuelve lo MÍNIMO: id, nombre y si tiene correo. Quien edita tarifas
   * necesita elegir un nombre de una lista, no el expediente del aliado — y
   * `conCorreo` está porque es lo único que decide si el aviso podrá salir:
   * asignar un dueño sin correo se ve igual de bien en la pantalla y no avisa
   * a nadie.
   */
  async proveedoresParaTabulador() {
    const provs = await prisma.providers.findMany({
      where: { status: 1 },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });
    return provs.map((p) => ({ id: p.id, nombre: p.name, conCorreo: Boolean(p.email?.trim()) }));
  }

  // ─────────────────────────── Avisos por correo ───────────────────────────

  /**
   * LO QUE PASA CUANDO ENTRA UNA SOLICITUD DEL SITIO.
   *
   * Tres correos, y ninguno es decorativo:
   *
   *  - Al PROVEEDOR dueño de cada partida. Es lo que convierte el cotizador en
   *    algo que el proveedor usa: publica su máquina y se entera de que se la
   *    pidieron. Uno por proveedor, no por renglón — pedirle tres equipos es un
   *    solo trabajo para él.
   *  - Al equipo de MAQSER24. Antes, la promesa del acuse —"un asesor se
   *    pondrá en contacto"— dependía de que alguien abriera el panel por su
   *    cuenta, y una solicitud podía dormir días sin que nadie lo supiera.
   *  - Al visitante, con su folio, que hasta ahora solo vivía en la pantalla.
   *
   * NUNCA tumba la solicitud: se llama sin esperar desde el controlador y
   * atrapa todo. Si el servidor de correo está caído, la cotización ya quedó
   * guardada y el panel la enseña igual — el correo avisa de lo que pasó, no es
   * la cosa que pasó.
   */
  /**
   * @param servicio Si la solicitud ya se convirtió en servicio (ver
   *   `QuoterServicio`), a los proveedores ya les escribió `ofrecer` con su
   *   enlace del portal: aquí NO se les vuelve a escribir. Dos correos el
   *   mismo minuto por lo mismo enseñan a archivar sin leer.
   */
  async avisarSolicitud(
    id: number,
    servicio?: { quoteNumber: string; proveedores: string[]; url: string } | null,
  ): Promise<void> {
    try {
      const q = await prisma.quoter_quotes.findUnique({ where: { id } });
      if (!q) return;

      const tipo = q.kind as CotizadorTipo;
      const cat = await this.catalogo(tipo);
      const partidas = q.items as unknown as PartidaCotizador[];
      const cotizador = COTIZADORES_META[tipo].titulo.toLowerCase();
      const calc = (q.snapshot as unknown as { calc: CalculoCotizacion }).calc;
      const conceptos = (calc?.renglones ?? [])
        .filter((r) => r.clase !== 'flete')
        .map((r) => `${r.concepto} · ${r.cantidad} ${r.unidad}`);

      // 1. A cada proveedor, lo suyo (solo si NO se le ofreció ya como servicio).
      const avisados: string[] = servicio ? [...servicio.proveedores] : [];
      const reparto = servicio ? [] : partidasPorProveedor(cat, partidas);
      if (reparto.length > 0) {
        const provs = await prisma.providers.findMany({
          where: { id: { in: reparto.map((r) => r.proveedorId) } },
          select: { id: true, name: true, email: true, contact_name: true },
        });
        for (const { proveedorId, conceptos: suyos } of reparto) {
          const p = provs.find((x) => x.id === proveedorId);
          // Un proveedor sin correo no detiene nada: el aviso interno dirá a
          // quién sí se le avisó, y de ahí se ve quién falta por capturar.
          if (!p?.email) continue;
          await this.mailer.enviar({
            kind: 'quoter_request_provider',
            to: p.email,
            toName: p.contact_name,
            providerId: p.id,
            ...correoSolicitudAProveedor({
              contacto: p.contact_name,
              folio: q.folio,
              cotizador,
              municipio: q.municipality,
              obra: q.work,
              conceptos: suyos,
            }),
          });
          avisados.push(p.name);
        }
      }

      // 2. Al equipo. Va al buzón desde el que sale el correo de la plataforma:
      //    es el único que se sabe que existe — el publicado en el sitio no.
      const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
      if (interno) {
        const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
        await this.mailer.enviar({
          kind: 'quoter_request_internal',
          to: interno,
          ...correoSolicitudInterna({
            folio: q.folio,
            cotizador,
            cliente: q.client_name,
            correo: q.email,
            telefono: q.phone,
            municipio: q.municipality,
            obra: q.work,
            total: Number(q.total),
            conceptos,
            proveedoresAvisados: avisados,
            url: `${panel}/cotizador/historial/${q.id}`,
          }),
        });
      }

      // 3. Al cliente: qué pasó con su solicitud y dónde seguirla.
      if (q.email) {
        const sitio = (process.env.SITE_URL ?? 'https://maqserv24.com').replace(/\/+$/, '');
        await this.mailer.enviar({
          kind: 'quoter_request_ack',
          to: q.email,
          toName: q.client_name,
          ...correoAcuseSolicitud({
            nombre: q.client_name,
            folio: q.folio,
            cotizador,
            total: cat.publico.mostrarPrecios ? Number(q.total) : null,
            proveedores: servicio?.proveedores ?? [],
            url: servicio ? `${sitio}${servicio.url}` : null,
          }),
        });
      }
    } catch (e) {
      this.log.error(`No se pudieron mandar los avisos de la solicitud ${id}: ${(e as Error).message}`);
    }
  }

  /**
   * MANDARLE LA COTIZACIÓN AL CLIENTE, desde el panel.
   *
   * Sale del `snapshot`, no del tabulador de hoy: lo que reciba tiene que ser
   * exactamente lo que se revisó en pantalla antes de apretar el botón.
   *
   * Aquí SÍ se espera el resultado y sí se avisa si falló, al revés que en
   * `avisarSolicitud`: alguien apretó un botón que dice "enviar" y necesita
   * saber si salió.
   *
   * Y solo pasa a `enviada` cuando el correo salió DE VERDAD. Marcarla enviada
   * con el correo apagado o rebotado es la clase de mentira que se descubre
   * cuando el cliente llama preguntando por algo que nunca recibió.
   */
  async enviarAlCliente(id: number): Promise<{ ok: true; estado: string; correo: string }> {
    const q = await prisma.quoter_quotes.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    if (!q.email?.trim()) {
      throw new BadRequestException('Esta cotización no tiene correo del cliente. Captúralo y vuelve a intentar.');
    }

    const doc = q.snapshot as unknown as {
      calc: CalculoCotizacion;
      firma: CatalogoCotizador['firma'];
      saludo: string;
    };
    const calc = doc.calc;

    const envio = await this.mailer.enviar({
      kind: 'quoter_quote_sent',
      to: q.email,
      toName: q.client_name,
      ...correoCotizacionDelPanel({
        nombre: q.client_name,
        folio: q.folio,
        cotizador: COTIZADORES_META[q.kind as CotizadorTipo].titulo.toLowerCase(),
        obra: q.work,
        saludo: doc.saludo ?? '',
        renglones: calc.renglones.map((r) => ({
          clase: r.clase,
          concepto: r.concepto,
          unidad: r.unidad,
          cantidad: r.cantidad,
          pu: r.pu,
          importe: r.importe,
        })),
        subtotal: calc.subtotal,
        iva: calc.con_iva ? calc.iva : null,
        total: calc.total,
        condiciones: calc.condiciones ?? [],
        notas: q.notes,
        firma: doc.firma?.nombre ? doc.firma : null,
      }),
    });

    if (envio !== 'enviado') {
      throw new BadRequestException(
        envio === 'omitido'
          ? `El correo "${q.email}" no es válido. Corrígelo en la cotización y vuelve a intentar.`
          : envio === 'simulado'
            ? 'El correo está apagado (MAIL_ENABLED). Quedó registrado el intento, pero no salió nada.'
            : 'El correo no salió. El motivo está en Configuración → Correo.',
      );
    }

    await prisma.quoter_quotes.update({
      where: { id },
      data: { state: 'enviada', updated_at: new Date() },
    });

    return { ok: true, estado: 'enviada', correo: q.email };
  }

  private static readonly ESTADOS = ['solicitada', 'borrador', 'enviada', 'aceptada', 'cancelada'];

  async cambiarEstado(id: number, estado: string) {
    if (!QuoterService.ESTADOS.includes(estado)) throw new BadRequestException('Estado desconocido');
    const existe = await prisma.quoter_quotes.count({ where: { id } });
    if (!existe) throw new NotFoundException('Cotización no encontrada');
    await prisma.quoter_quotes.update({ where: { id }, data: { state: estado, updated_at: new Date() } });
    return { ok: true, estado };
  }

  async eliminar(id: number) {
    const existe = await prisma.quoter_quotes.count({ where: { id } });
    if (!existe) throw new NotFoundException('Cotización no encontrada');
    await prisma.quoter_quotes.delete({ where: { id } });
    return { ok: true };
  }
}
