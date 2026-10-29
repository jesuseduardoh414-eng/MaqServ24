import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Logger, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { condicionesSinPrecios, esCotizadorTipo, type CalculoCotizacion, type CatalogoCotizador, type CotizadorTipo } from '@maqserv/config';
import { avisarPanel } from '../notifications/panel';
import { leerAceptacion } from './aceptar-link';
import { leerZonas, municipiosDe } from '../common/zonas';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { completarTelefono, datosDeCuenta } from '../common/cuenta';
import { QuoterService } from './quoter.service';
import { QuoterServicio, type ServicioAbierto } from './quoter-servicio';
import { partidasPublicas, primerError, solicitudSitioSchema, tipoDe } from './quoter.dto';
import { conCandado } from '../common/candado';
import { prisma } from '@maqserv/db';

/** Lo que cabe en quotes.total (DECIMAL(10,2)). Más que esto se recortaba en silencio (QA 2026-09-28). */
const TOPE_TOTAL = 99_999_999;

/**
 * COTIZADORES EN EL SITIO PÚBLICO.
 *
 * `publico.habilitado` (en el tabulador, editable desde el panel): si está
 * apagado, estas rutas devuelven 404 y el cotizador simplemente no existe fuera
 * del panel.
 *
 * EL SITIO NUNCA ENSEÑA PRECIOS (decisión del usuario, 2026-10-23). El
 * visitante arma su requerimiento completo y lo envía sin ver un peso; el
 * servidor lo calcula igual y la solicitud llega al panel con su precio
 * estimado. Alguien lo revisa, lo corrige si hace falta y se lo manda al
 * cliente, que la acepta desde su cuenta. Antes había un interruptor
 * (`publico.mostrarPrecios`) y el cotizador enseñaba el total en el último
 * paso; el campo se queda en el tabulador por compatibilidad, pero aquí ya no
 * se lee: un precio que nadie revisó no puede llegarle al cliente.
 */
@Controller('quoter')
export class QuoterController {
  private readonly log = new Logger('Quoter');

  constructor(
    private readonly quoter: QuoterService,
    private readonly servicio: QuoterServicio,
  ) {}

  /**
   * El tabulador tal como lo puede ver un desconocido: SIEMPRE en ceros.
   *
   * No se manda con un flag para que el navegador lo esconda: un precio que
   * viaja al navegador es un precio publicado, aunque la pantalla no lo pinte —
   * basta abrir la pestaña de red para leerlo.
   */
  @Get('catalog/:kind')
  async catalogo(@Param('kind') kind: string) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.catalogo(tipo);
    if (!cat.publico.habilitado) throw new NotFoundException('Este cotizador no está disponible en el sitio.');
    // `sinDueños` SIEMPRE, con precios o sin ellos: de qué proveedor es cada
    // equipo es información de la operación, no del catálogo. Publicarla
    // entrega la red de aliados a cualquiera que abra la pestaña de red.
    // El sitio solo ofrece los municipios de las zonas que se anuncian (2026-10-22).
    const anunciados = municipiosDe(await leerZonas(), ['sitio']);
    const publico = anunciados.length ? { ...cat, municipios: anunciados } : cat;
    return sinDueños(sinPrecios(publico));
  }

  /**
   * Vista previa de totales: cerrada al público (2026-10-23). El sitio nunca
   * enseña precios; el panel calcula con su propia ruta (admin/quoter).
   */
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('calculate/:kind')
  async calcular(@Param('kind') kind: string) {
    tipoDe(kind);
    throw new ForbiddenException('Los precios no se calculan en el sitio: pide tu cotización y te la mandamos con precio.');
  }

  /**
   * El cliente SOLICITA EL SERVICIO con la cotización que armó.
   *
   * Desde el 2026-09-23 esto exige cuenta (ver `QuoterServicio` para el porqué
   * del flujo): el documento del cotizador se guarda congelado y, acto seguido,
   * se abre el servicio "por asignar" (desde el 2026-09-28 MAQSER24 elige al
   * aliado desde el panel; ya no se ofrece solo al dueño del equipo). Si ese
   * segundo paso falla, el documento se queda en `solicitada` —que es lo que
   * cuenta el contador del panel— y alguien lo atiende a mano: el cliente
   * nunca se queda sin folio ni sin nadie que se entere.
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('request/:kind')
  @UseGuards(JwtGuard)
  async solicitar(@Req() req: AuthedRequest, @Param('kind') kind: string, @Body() body: unknown) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.catalogo(tipo);
    if (!cat.publico.habilitado) throw new NotFoundException('Este cotizador no está disponible en el sitio.');

    const parsed = solicitudSitioSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    const datos = parsed.data;
    // La fecha del servicio no puede ser pasada (hoy en Monterrey, no en UTC), igual que en /cotizar.
    if (datos.fecha < new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date())) {
      throw new BadRequestException('La fecha ya pasó. Elige hoy o una fecha posterior.');
    }

    const userId = req.userId;
    const cuenta = await datosDeCuenta(userId);
    if (!cuenta) throw new ForbiddenException('La cuenta ya no existe.');

    // Solo renglones del tabulador y SIN precios del cliente (precio único).
    const partidas = partidasPublicas(tipo, datos.partidas, cat);
    const previo = await this.quoter.calcular(tipo, partidas, datos.opciones);
    if (Number(previo.total) > TOPE_TOTAL) {
      throw new BadRequestException('La cotización es demasiado grande para el cotizador en línea. Escríbenos y la armamos contigo.');
    }

    // Doble clic / doble envío (QA 2026-09-28): una solicitud por cliente a la
    // vez, y si la misma (mismas partidas y total) llegó hace menos de 2 min,
    // se devuelve esa en vez de abrir otra.
    return conCandado([`cotizador:${userId}`], async () => {
    const hace2min = new Date(Date.now() - 120_000);
    const recientes = await prisma.quoter_quotes.findMany({
      where: { user_id: userId, kind: tipo, origin: 'sitio', created_at: { gte: hace2min } },
      select: { folio: true, items: true, total: true },
    });
    const igual = recientes.find((r) => Number(r.total) === Number(previo.total) && JSON.stringify(r.items) === JSON.stringify(partidas));
    if (igual) {
      const q = await prisma.quotes.findFirst({ where: { requirements: { path: '$.folio', equals: igual.folio } }, select: { quote_number: true }, orderBy: { id: 'asc' } });
      return {
        folio: igual.folio,
        ...(q ? { quoteNumber: q.quote_number, url: `/cuenta/cotizaciones/${q.quote_number}` } : {}),
      };
    }
    const cliente = datos.cliente || cuenta.name;
    const cot = await this.quoter.crear(
      {
        tipo,
        cliente,
        obra: datos.obra,
        atencion: datos.atencion,
        municipio: datos.municipio,
        // El correo es el de la cuenta: es a donde va a entrar a ver el folio.
        correo: cuenta.email,
        telefono: datos.telefono || cuenta.phone,
        notas: datos.notas,
        opciones: datos.opciones,
        partidas,
      },
      { origen: 'sitio', estado: 'solicitada', userId },
    );

    // Primera vez que se conoce su teléfono: se guarda en la cuenta.
    void completarTelefono(userId, datos.telefono);

    // Abrir la solicitud en el panel (Solicitudes › Por cotizar). Si falla, el
    // documento se queda en `solicitada` y el equipo lo atiende a mano (ver arriba).
    let servicio: ServicioAbierto | null = null;
    try {
      servicio = await this.servicio.abrir({
        cotizacion: cot,
        catalogo: cat,
        partidas,
        cuenta,
        cliente,
        userId,
        // Empresa y obra que eligió, o la obra nueva con su dirección (2026-10-23).
        destino: { clientId: datos.clienteId ?? null, siteId: datos.obraId ?? null, direccion: datos.direccion || null, fecha: datos.fecha },
      });
    } catch (e) {
      this.log.error(`No se pudo abrir el servicio de ${cot.folio}: ${(e as Error).message}`);
    }

    // Ya no se aprueba sola (2026-10-23): llega a Solicitudes › Por cotizar con
    // su precio estimado; alguien lo revisa y se lo manda al cliente.

    /**
     * Los avisos salen SIN esperar a propósito.
     *
     * El SMTP de cPanel tarda lo suyo: encadenarlos aquí dejaría al cliente
     * mirando el botón "Enviando…" varios segundos por algo que no cambia su
     * solicitud, que ya está guardada. Si fallan, quedan en el registro de
     * correo.
     */
    void this.quoter.avisarSolicitud(cot.id, servicio);

    // La respuesta tampoco trae precio (2026-10-23): el acuse dice que se
    // recibió y que MAQSER24 le manda la cotización, no cuánto cuesta.
    return {
      folio: cot.folio,
      ...(servicio ? { quoteNumber: servicio.quoteNumber, url: servicio.url } : {}),
    };
    });
  }

  /**
   * ACEPTAR DESDE EL CORREO (2026-10-22, ver aceptar-link.ts).
   *
   * El enlace viaja en la cabecera, como el de la reseña. GET enseña la
   * cotización; solo POST la acepta.
   */
  private async documentoDelEnlace(auth: string | undefined) {
    const id = await leerAceptacion(auth?.replace(/^Bearer\s+/i, '').trim());
    if (!id) throw new BadRequestException('Este enlace ya no sirve: caducó o está incompleto. Escríbenos y te mandamos la cotización de nuevo.');
    const doc = await prisma.quoter_quotes.findUnique({ where: { id } });
    if (!doc || doc.origin !== 'panel' || !esCotizadorTipo(doc.kind)) throw new NotFoundException('No encontramos esta cotización.');
    const ligada = await prisma.quotes.findFirst({
      where: { requirements: { path: '$.folio', equals: doc.folio } },
      select: { quote_number: true },
      orderBy: { id: 'asc' },
    });
    return { doc, ligada };
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('aceptar')
  async verParaAceptar(@Headers('authorization') auth?: string) {
    const { doc, ligada } = await this.documentoDelEnlace(auth);
    const calc = (doc.snapshot as unknown as { calc?: CalculoCotizacion } | null)?.calc;
    return {
      folio: doc.folio,
      cliente: doc.client_name,
      obra: doc.work,
      municipio: doc.municipality,
      renglones: (calc?.renglones ?? []).map((r) => ({ concepto: r.concepto, cantidad: `${r.cantidad} ${r.unidad}`, importe: Number(r.importe) })),
      subtotal: Number(doc.subtotal),
      iva: Number(doc.tax),
      total: Number(doc.total),
      // 'aceptada' también cuando ya tiene servicio: lo aceptó por otro lado.
      estado: doc.state === 'aceptada' || ligada ? 'aceptada' : doc.state === 'cancelada' ? 'cancelada' : 'pendiente',
    };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('aceptar')
  async aceptarDesdeCorreo(@Headers('authorization') auth?: string) {
    const { doc } = await this.documentoDelEnlace(auth);
    // Bajo candado: dos clics seguidos abrían dos servicios.
    return conCandado([`aceptar:${doc.id}`], async () => {
      const { doc: d, ligada } = await this.documentoDelEnlace(auth);
      if (d.state === 'cancelada') throw new BadRequestException('Esta cotización se canceló. Escríbenos y la actualizamos.');
      if (d.state === 'aceptada' || ligada) return { ok: true, yaEstaba: true, folio: d.folio };

      await this.quoter.cambiarEstado(d.id, 'aceptada');
      const abierto = await this.servicio.abrirDesdePanel(d.id, await this.quoter.catalogo(d.kind as CotizadorTipo), null);
      void avisarPanel({
        modulo: 'servicios',
        evento: 'solicitud',
        // Nada sale solo a los aliados (2026-10-23): MAQSER24 elige a quién dárselo.
        titulo: `${d.client_name} aceptó ${d.folio} desde el correo: elige a quién dárselo`,
        cuerpo: abierto
          ? `Ya está en Servicios por asignar (${abierto.quoteNumber}). Ofrécelo a un aliado o mándalo a todos los que llegan a la obra.`
          : 'Ya está en Servicios por asignar: ofrécelo a un aliado o mándalo a todos.',
        link: '/servicios',
      });
      return { ok: true, yaEstaba: false, folio: d.folio };
    });
  }
}

/**
 * El mismo tabulador sin decir de quién es cada partida.
 *
 * `proveedor_id` existe para saber a quién avisarle cuando alguien cotiza; en
 * el navegador no pinta nada y sí dice quién surte qué, que es media lista de
 * proveedores de la competencia.
 */
function sinDueños(cat: CatalogoCotizador): CatalogoCotizador {
  if (cat.tipo === 'maquinaria') {
    return {
      ...cat,
      equipos: cat.equipos.map(({ proveedor_id: _p, ...e }) => e),
      servicios: cat.servicios.map(({ proveedor_id: _p, ...s }) => s),
    };
  }
  const { proveedor_id: _b, ...banco } = cat.material_banco;
  return {
    ...cat,
    productos: cat.productos.map(({ proveedor_id: _p, ...p }) => p),
    material_banco: banco,
  };
}

/**
 * El mismo tabulador con todo importe en cero.
 *
 * Se conservan nombres, zonas, unidades y condiciones: el visitante tiene que
 * poder decir "quiero una excavadora 10 días en Apodaca" con precisión. Lo
 * único que desaparece es cuánto cuesta.
 */
function sinPrecios(catalogo: CatalogoCotizador): CatalogoCotizador {
  // El navegador lee este flag para saber que no hay importes que pintar.
  // Las condiciones también van sin los renglones con precio (auditoría
  // 2026-10-28): al aliado ya se le quitaban, al público no.
  const condiciones = Object.fromEntries(
    Object.entries(catalogo.condiciones).map(([k, b]) => [k, condicionesSinPrecios([b])[0] ?? { ...b, puntos: [] }]),
  );
  const cat = { ...catalogo, condiciones, publico: { ...catalogo.publico, mostrarPrecios: false } } as CatalogoCotizador;
  if (cat.tipo === 'maquinaria') {
    return {
      ...cat,
      fletes: Object.fromEntries(Object.keys(cat.fletes).map((k) => [k, 0])),
      // El precio por hora en cero y la tarifa por día de antes fuera (2026-10-29).
      equipos: cat.equipos.map(({ tarifas: _antes, ...e }) => ({ ...e, precio_hora: 0 })),
      servicios: cat.servicios.map((s) => ({ ...s, precio: 0, presets: [] })),
    };
  }
  return {
    ...cat,
    productos: cat.productos.map((p) => ({ ...p, precio_ton: 0 })),
    fletes_ton: [],
    material_banco: { ...cat.material_banco, precio_m3_default: 0 },
    zonas: cat.zonas.map((z) => ({ ...z, flete: 0, precios: undefined })),
  };
}
