import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CatalogoCotizador } from '@maqserv/config';
import { verifyAccessToken } from '../common/app-auth';
import { QuoterService } from './quoter.service';
import { calcularSchema, partidasDe, primerError, solicitudSitioSchema, tipoDe } from './quoter.dto';

/**
 * COTIZADORES EN EL SITIO PÚBLICO.
 *
 * Dos interruptores, ambos en el tabulador y editables desde el panel:
 *
 *  - `publico.habilitado`: si está apagado, estas rutas devuelven 404 y el
 *    cotizador simplemente no existe fuera del panel.
 *  - `publico.mostrarPrecios`: apagado, el visitante arma su requerimiento
 *    completo y lo envía, pero NO ve importes y el endpoint de cálculo se
 *    cierra. Publicar el tabulador entero —tarifas, fletes y márgenes— es una
 *    decisión comercial, y cuando la respuesta sea "todavía no", esto evita que
 *    la única alternativa sea quitar el cotizador del sitio.
 */
@Controller('quoter')
export class QuoterController {
  constructor(private readonly quoter: QuoterService) {}

  /**
   * El tabulador tal como lo puede ver un desconocido.
   *
   * Cuando los precios están ocultos NO se manda el tabulador con un flag para
   * que el navegador lo esconda: se manda en ceros. Un precio que viaja al
   * navegador es un precio publicado, aunque la pantalla no lo pinte — basta
   * abrir la pestaña de red para leerlo.
   */
  @Get('catalog/:kind')
  async catalogo(@Param('kind') kind: string) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.catalogo(tipo);
    if (!cat.publico.habilitado) throw new NotFoundException('Este cotizador no está disponible en el sitio.');
    // `sinDueños` SIEMPRE, con precios o sin ellos: de qué proveedor es cada
    // equipo es información de la operación, no del catálogo. Publicarla
    // entrega la red de aliados a cualquiera que abra la pestaña de red.
    return sinDueños(cat.publico.mostrarPrecios ? cat : sinPrecios(cat));
  }

  /** Vista previa de totales. Solo si el tabulador es público. */
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('calculate/:kind')
  async calcular(@Param('kind') kind: string, @Body() body: unknown) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.catalogo(tipo);
    if (!cat.publico.habilitado) throw new NotFoundException('Este cotizador no está disponible en el sitio.');
    if (!cat.publico.mostrarPrecios) throw new ForbiddenException('Los precios de este cotizador no son públicos.');

    const parsed = calcularSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    return this.quoter.calcular(tipo, partidasDe(tipo, parsed.data.partidas), parsed.data.opciones);
  }

  /**
   * El visitante envía su requerimiento.
   *
   * Nace en estado `solicitada`, que es lo que cuenta el contador del panel:
   * una solicitud que nadie ve es peor que no tener el formulario, porque la
   * persona ya se fue creyendo que la contactarían.
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('request/:kind')
  async solicitar(@Param('kind') kind: string, @Body() body: unknown, @Headers('authorization') auth?: string) {
    const tipo = tipoDe(kind);
    const cat = await this.quoter.catalogo(tipo);
    if (!cat.publico.habilitado) throw new NotFoundException('Este cotizador no está disponible en el sitio.');

    const parsed = solicitudSitioSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(primerError(parsed.error));
    const datos = parsed.data;

    // Si trae sesión, la solicitud queda ligada a la cuenta; si no, sigue como
    // invitado (mismo criterio que el cotizador de catálogo en /quotes).
    let userId: number | null = null;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      try {
        const claims = await verifyAccessToken(token);
        userId = claims.app_metadata?.app_user_id ?? null;
      } catch {
        userId = null;
      }
    }

    const cot = await this.quoter.crear(
      {
        tipo,
        cliente: datos.cliente,
        obra: datos.obra,
        atencion: datos.atencion,
        municipio: datos.municipio,
        correo: datos.correo,
        telefono: datos.telefono,
        notas: datos.notas,
        opciones: datos.opciones,
        partidas: partidasDe(tipo, datos.partidas),
      },
      { origen: 'sitio', estado: 'solicitada', userId },
    );

    /**
     * Los avisos salen SIN esperar a propósito.
     *
     * Son tres correos —proveedor, equipo, visitante— y el SMTP de cPanel
     * tarda lo suyo: encadenarlos aquí dejaría al visitante mirando el botón
     * "Enviando…" varios segundos por algo que no cambia su solicitud, que ya
     * está guardada. Si fallan, quedan en el registro de correo.
     */
    void this.quoter.avisarSolicitud(cot.id);

    // Con precios ocultos, la respuesta tampoco los trae: el acuse dice que se
    // recibió y quién dará seguimiento, no cuánto cuesta.
    return cat.publico.mostrarPrecios
      ? { folio: cot.folio, total: Number(cot.total) }
      : { folio: cot.folio };
  }
}

/**
 * El mismo tabulador con todo importe en cero.
 *
 * Se conservan nombres, zonas, unidades y condiciones: el visitante tiene que
 * poder decir "quiero una excavadora 10 días en Apodaca" con precisión. Lo
 * único que desaparece es cuánto cuesta.
 */
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

function sinPrecios(cat: CatalogoCotizador): CatalogoCotizador {
  if (cat.tipo === 'maquinaria') {
    return {
      ...cat,
      fletes: Object.fromEntries(Object.keys(cat.fletes).map((k) => [k, 0])),
      equipos: cat.equipos.map((e) => ({ ...e, tarifas: { dia: 0, semana: 0, mes: 0 } })),
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
