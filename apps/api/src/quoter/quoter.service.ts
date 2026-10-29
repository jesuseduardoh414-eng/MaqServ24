import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import {
  CATALOGOS_DEFAULT,
  COTIZADORES_META,
  COTIZADOR_TIPOS,
  aplicarRenglonesDeFicha,
  calcularCotizacion,
  catalogoCotizadorSchema,
  centroDeMunicipio,
  cobraFlete,
  conRenglonesGuardados,
  minimoHorasDe,
  precioHoraDe,
  precioZona,
  renglonesDeFicha,
  seccionDeLinea,
  tieneImporte,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CotizadorTipo,
  type OpcionesCotizador,
  type PartidaCotizador,
  type RenglonDeFicha,
} from '@maqserv/config';
import { conCandado } from '../common/candado';
import { MailerService } from '../notifications/mailer.service';
import { NotificationsService } from '../notifications/notifications.service';
import { sincronizarReserva } from '../quotes/reservas';
import { vigenciaPorDefecto } from '../quotes/quote-validity';
import { firmarAceptacion, rutaAceptar } from './aceptar-link';
import { leerZonas, municipiosDe } from '../common/zonas';
import type { RefTarifa } from './tarifa-ref';
import { documentosVencidos, tieneSolicitud } from './documento-estado';
import {
  correoAcuseSolicitud,
  correoCotizacionDelPanel,
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

  constructor(
    private readonly mailer: MailerService,
    private readonly notifications: NotificationsService,
  ) {}

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
    const guardado = await this.marcarFichasInactivas(await this.catalogoGuardado(tipo));
    // Los municipios salen de Configuración › Zonas (2026-10-22): las anunciadas
    // y las internas; el sitio filtra solo las anunciadas (quoter.controller).
    const deZonas = municipiosDe(await leerZonas(), ['sitio', 'interna']);
    const cat = deZonas.length ? { ...guardado, municipios: deZonas } : guardado;
    this.cache.set(tipo, { until: Date.now() + QuoterService.TTL_MS, cat });
    return cat;
  }

  /**
   * El tabulador TAL COMO ESTÁ GUARDADO: sin caché y sin las marcas que se
   * calculan al leer. Es el que se edita; editar sobre `catalogo()` guardaría
   * como "oculto" lo que solo está oculto porque su ficha está de baja.
   */
  async catalogoGuardado(tipo: CotizadorTipo): Promise<CatalogoCotizador> {
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
    return cat;
  }

  /**
   * Un renglón cuya ficha se dio de baja (o se borró) no se ofrece al cotizar:
   * la ficha ES el tipo, y si el tipo salió del catálogo también sale del
   * cotizador (2026-10-19). Se calcula al leer y NO se guarda, así que al
   * reactivar la ficha vuelve solo. Un renglón sin ficha (tabuladores viejos)
   * se queda como estaba.
   */
  private async marcarFichasInactivas(cat: CatalogoCotizador): Promise<CatalogoCotizador> {
    const renglones: Array<{ productos?: number[] }> = cat.tipo === 'maquinaria' ? [...cat.equipos, ...cat.servicios] : cat.productos;
    const ids = [...new Set(renglones.flatMap((r) => r.productos ?? []))];
    if (ids.length === 0) return cat;
    const productos = await prisma.products.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, provider_id: true } });
    const porId = new Map(productos.map((p) => [p.id, p]));
    const inactivo = (r: { productos?: number[] }): boolean => {
      const lista = r.productos ?? [];
      if (lista.length === 0) return false;
      const vivos = lista.map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
      const ficha = vivos.find((p) => p.provider_id === null);
      if (ficha) return ficha.status !== 1;
      // Todo lo que tenía ligado se borró: su ficha ya no existe.
      return vivos.length === 0;
    };
    const marca = <T extends { productos?: number[]; oculto?: boolean }>(r: T): T => (!r.oculto && inactivo(r) ? { ...r, oculto: true } : r);
    return cat.tipo === 'maquinaria'
      ? { ...cat, equipos: cat.equipos.map(marca), servicios: cat.servicios.map(marca) }
      : { ...cat, productos: cat.productos.map(marca) };
  }

  /** Escribe el tabulador y tira la caché. Lo de antes de llegar aquí ya se validó. */
  private async escribir(tipo: CotizadorTipo, cat: CatalogoCotizador, correo: string): Promise<void> {
    const data = { version: cat.version, data: cat as unknown as Prisma.InputJsonValue, updated_by: correo.slice(0, 190), updated_at: new Date() };
    await prisma.quoter_catalogs.upsert({
      where: { kind: tipo },
      create: { kind: tipo, ...data },
      update: data,
    });
    this.cache.delete(tipo);
  }

  /**
   * Guarda lo GENERAL del tabulador (Tarifas y condiciones). Los equipos,
   * servicios y materiales se quedan como están guardados: desde el
   * 2026-10-19 son de su ficha (ver `guardarFicha`). Lo valida el controlador.
   */
  async guardarCatalogo(tipo: CotizadorTipo, cat: CatalogoCotizador, correo: string): Promise<CatalogoCotizador> {
    await conCandado([`tabulador:${tipo}`], async () => {
      await this.escribir(tipo, conRenglonesGuardados(cat, await this.catalogoGuardado(tipo)), correo);
    });
    return this.catalogo(tipo);
  }

  /**
   * Un cambio de datos que se hace solo al arrancar (ver `cobro-por-hora.ts`):
   * `cambiar` recibe el tabulador guardado y devuelve el nuevo, o null si no
   * hay nada que hacer. Bajo el mismo candado que el panel y validado igual.
   */
  async migrarTabulador(tipo: CotizadorTipo, cambiar: (cat: CatalogoCotizador) => Promise<CatalogoCotizador | null>, quien: string): Promise<boolean> {
    let hecho = false;
    await conCandado([`tabulador:${tipo}`], async () => {
      const nuevo = await cambiar(structuredClone(await this.catalogoGuardado(tipo)));
      if (!nuevo) return;
      const ok = catalogoCotizadorSchema.safeParse(nuevo);
      if (!ok.success) throw new Error(`${ok.error.issues[0]?.path.join('.') ?? ''} ${ok.error.issues[0]?.message ?? 'dato inválido'}`.trim());
      await this.escribir(tipo, ok.data, quien);
      hecho = true;
    });
    return hecho;
  }

  /** Vuelve lo general a los valores de fábrica. Los precios de cada tipo no se tocan: viven en su ficha. */
  async restaurarCatalogo(tipo: CotizadorTipo, correo: string): Promise<CatalogoCotizador> {
    return this.guardarCatalogo(tipo, CATALOGOS_DEFAULT[tipo], correo);
  }

  /**
   * LO QUE UNA FICHA DE INVENTARIO TIENE EN EL COTIZADOR (2026-10-19).
   *
   * Lo pide la ficha para enseñar y editar su precio. `seccion` es null cuando
   * su línea no tiene cotizador (materiales, asfalto): esas se cotizan con el
   * formulario y el precio se pone al responder.
   */
  async fichaEnCotizador(productId: number) {
    const p = await prisma.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, status: true, provider_id: true, category_id: true },
    });
    if (!p) throw new NotFoundException('Esa ficha no existe.');
    const linea = (await prisma.categories.findUnique({ where: { id: p.category_id }, select: { cat_slug: true } }))?.cat_slug ?? null;
    const seccion = seccionDeLinea(linea);
    const base = { productId: p.id, nombreFicha: p.name, linea, seccion, deAliado: p.provider_id !== null, activa: p.status === 1 };
    if (!seccion) return { ...base, renglones: [], oculto: false, fletes: [], condiciones: [], cobro: null, zonas: [] };
    const cat = await this.catalogoGuardado(seccion.tipo);
    const { renglones, oculto } = renglonesDeFicha(cat, seccion.clase, p.id);
    return {
      ...base,
      renglones,
      oculto,
      fletes: cat.tipo === 'maquinaria' ? Object.entries(cat.fletes).map(([nombre, monto]) => ({ nombre, monto })) : [],
      condiciones: Object.entries(cat.condiciones).map(([clave, b]) => ({ clave, titulo: b.titulo })),
      // Cómo se cobra la maquinaria (2026-10-29), para que la ficha lo diga junto al precio.
      cobro: cat.tipo === 'maquinaria'
        ? { jornada: cat.jornada_horas, minimo: minimoHorasDe(cat), conFlete: cobraFlete(cat) }
        : null,
      // Las zonas de agua y retiro (2026-10-29): un servicio puede cobrar distinto en cada una.
      zonas: cat.tipo === 'maquinaria' ? (cat.zonas_precio ?? []).map((z) => ({ id: z.id, nombre: z.nombre, municipios: z.municipios })) : [],
    };
  }

  /**
   * Guarda el precio de una ficha en el cotizador: sus renglones, si sale o
   * no, y los tipos de flete nuevos que haya creado ahí mismo. Una sola vez,
   * desde la ficha; el cotizador del sitio y el del panel lo leen de aquí.
   */
  async guardarFicha(
    productId: number,
    d: { renglones: RenglonDeFicha[]; oculto: boolean; fletesNuevos?: Record<string, number> },
    correo: string,
  ) {
    const p = await prisma.products.findUnique({ where: { id: productId }, select: { id: true, name: true, provider_id: true, category_id: true } });
    if (!p) throw new NotFoundException('Esa ficha no existe.');
    if (p.provider_id !== null) {
      throw new BadRequestException('El precio se pone en la ficha del tipo, no en el equipo de un aliado: el cotizador maneja un solo precio por tipo.');
    }
    const linea = (await prisma.categories.findUnique({ where: { id: p.category_id }, select: { cat_slug: true } }))?.cat_slug ?? null;
    const seccion = seccionDeLinea(linea);
    if (!seccion) throw new BadRequestException('Esta línea no tiene cotizador: se cotiza con el formulario y el precio se pone al responder.');

    await conCandado([`tabulador:${seccion.tipo}`], async () => {
      let cat = await this.catalogoGuardado(seccion.tipo);
      if (cat.tipo === 'maquinaria') {
        const actual = cat;
        const nuevos = Object.entries(d.fletesNuevos ?? {}).filter(([k]) => k.trim() && !(k.trim() in actual.fletes));
        const fletes = { ...actual.fletes, ...Object.fromEntries(nuevos.map(([k, v]) => [k.trim(), v])) };
        cat = { ...actual, fletes };
        if (seccion.clase === 'equipo') {
          const malo = d.renglones.find((r) => !r.flete_tipo || !(r.flete_tipo in fletes));
          if (malo) throw new BadRequestException(`«${malo.nombre}»: elige qué flete se le cobra.`);
        } else {
          const malo = d.renglones.find((r) => r.cond && !(r.cond in actual.condiciones));
          if (malo) throw new BadRequestException(`«${malo.nombre}»: esas condiciones no existen.`);
        }
      }
      const siguiente = catalogoCotizadorSchema.safeParse(
        aplicarRenglonesDeFicha(cat, seccion.clase, p.id, d.renglones, { oculto: d.oculto, linea: linea as string }),
      );
      if (!siguiente.success) {
        const issue = siguiente.error.issues[0];
        throw new BadRequestException(`No se pudo guardar el precio: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
      }
      await this.escribir(seccion.tipo, siguiente.data, correo);
    });
    return { tipo: seccion.tipo, nombre: p.name, ficha: await this.fichaEnCotizador(p.id) };
  }

  /**
   * CORREGIR UNA TARIFA DESDE EL DESGLOSE DE UNA SOLICITUD (2026-10-23).
   *
   * "Si el administrador ve que hay una tarifa mal, la puede corregir en ese
   * momento y se actualiza en todo el sistema." Escribe en el MISMO tabulador
   * que leen los dos cotizadores y la ficha del tipo, así que no hay una
   * segunda copia que se quede atrás. Devuelve el valor anterior (en la misma
   * unidad en que se editó) para la bitácora y para reconocer, en las demás
   * solicitudes pendientes, los renglones que traían la tarifa vieja.
   */
  async corregirTarifa(tipo: CotizadorTipo, ref: RefTarifa, valor: number, correo: string): Promise<{ antes: number | null; nombre: string }> {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    let antes: number | null = null;
    let nombre = '';
    await conCandado([`tabulador:${tipo}`], async () => {
      const cat = structuredClone(await this.catalogoGuardado(tipo));
      const falta = () => new BadRequestException('Esa tarifa ya no está en el tabulador: vuelve a abrir la solicitud.');
      if (cat.tipo === 'maquinaria') {
        if (ref.clase === 'equipo') {
          // Por hora (2026-10-29). Una solicitud de antes trae `tramo`: su valor (y el de antes) es por día.
          const e = cat.equipos.find((x) => x.id === ref.id);
          if (!e) throw falta();
          const porDia = ref.tramo ? cat.jornada_horas : 1;
          antes = r2(precioHoraDe(cat, e) * porDia);
          e.precio_hora = r2(valor / porDia);
          delete e.tarifas;
          nombre = `${e.nombre} · por hora`;
        } else if (ref.clase === 'flete') {
          if (!(ref.tipo in cat.fletes)) throw falta();
          antes = cat.fletes[ref.tipo];
          cat.fletes[ref.tipo] = r2(valor);
          nombre = `Flete ${ref.tipo}`;
        } else if (ref.clase === 'servicio') {
          const s = cat.servicios.find((x) => x.id === ref.id);
          if (!s) throw falta();
          if (ref.zona && s.precios_zona && ref.zona in s.precios_zona) {
            // Por zona (el agua): cambia solo el precio de esa zona.
            antes = s.precios_zona[ref.zona];
            s.precios_zona[ref.zona] = r2(valor);
            nombre = `${s.nombre} · ${cat.zonas_precio?.find((z) => z.id === ref.zona)?.nombre ?? ref.zona}`;
          } else {
            antes = s.precio;
            s.precio = r2(valor);
            nombre = s.nombre;
          }
        } else throw falta();
      } else {
        if (ref.clase === 'material') {
          const p = cat.productos.find((x) => x.id === ref.id);
          if (!p) throw falta();
          antes = p.precio_ton;
          p.precio_ton = r2(valor);
          nombre = p.nombre;
        } else if (ref.clase === 'flete_zona') {
          const z = cat.zonas.find((x) => x.id === ref.zonaId);
          if (!z || cat.ton_por_viaje <= 0) throw falta();
          // Se piensa por tonelada (así sale en el documento) y se guarda por viaje.
          antes = Math.round(z.flete / cat.ton_por_viaje);
          z.flete = r2(valor * cat.ton_por_viaje);
          nombre = `Flete zona ${z.nombre}`;
        } else if (ref.clase === 'banco') {
          antes = cat.material_banco.precio_m3_default;
          cat.material_banco.precio_m3_default = r2(valor);
          nombre = cat.material_banco.nombre;
        } else if (ref.clase === 'zona') {
          const z = cat.zonas.find((x) => x.id === ref.zonaId);
          const p = cat.productos.find((x) => x.id === ref.productoId);
          if (!z || !p) throw falta();
          antes = precioZona(cat, z, p.id);
          z.precios = { ...(z.precios ?? {}), [p.id]: r2(valor) };
          nombre = `${p.nombre} · ${z.nombre}`;
        } else throw falta();
      }
      const ok = catalogoCotizadorSchema.safeParse(cat);
      if (!ok.success) throw new BadRequestException(`No se pudo guardar la tarifa: ${ok.error.issues[0]?.message ?? 'dato inválido'}`);
      await this.escribir(tipo, ok.data, correo);
    });
    return { antes, nombre };
  }

  /**
   * Una ficha que se BORRA se lleva sus renglones del tabulador: el tipo se
   * borra una sola vez (2026-10-19). Si lo borrado era el equipo de un aliado
   * ligado a un renglón, el renglón se queda y solo se suelta esa liga.
   * Nunca lanza: borrar la ficha ya pasó y esto es limpieza.
   */
  async quitarDelTabulador(productId: number, eraFicha: boolean, correo: string): Promise<void> {
    const sin = (l?: number[]) => (l ? l.filter((x) => x !== productId) : l);
    for (const tipo of COTIZADOR_TIPOS) {
      try {
        await conCandado([`tabulador:${tipo}`], async () => {
          const cat = await this.catalogoGuardado(tipo);
          let sig: CatalogoCotizador = cat;
          if (eraFicha) {
            for (const clase of ['equipo', 'servicio', 'material'] as const) {
              sig = aplicarRenglonesDeFicha(sig, clase, productId, [], { oculto: false, linea: '' });
            }
          } else if (sig.tipo === 'maquinaria') {
            sig = { ...sig, equipos: sig.equipos.map((e) => ({ ...e, productos: sin(e.productos) })), servicios: sig.servicios.map((s) => ({ ...s, productos: sin(s.productos) })) };
          } else {
            sig = { ...sig, productos: sig.productos.map((p) => ({ ...p, productos: sin(p.productos) })), material_banco: { ...sig.material_banco, productos: sin(sig.material_banco.productos) } };
          }
          if (JSON.stringify(sig) !== JSON.stringify(cat)) await this.escribir(tipo, sig, correo);
        });
      } catch (e) {
        this.log.warn(`No se pudo limpiar el tabulador de "${tipo}" tras borrar el producto ${productId}: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Para Tarifas y condiciones, que ya solo enseña los renglones: a qué ficha
   * pertenece cada uno, para llevar a editarlo ahí.
   */
  async fichasDeRenglones(tipo: CotizadorTipo): Promise<Record<string, { id: number; nombre: string; activa: boolean } | null>> {
    const cat = await this.catalogoGuardado(tipo);
    const renglones: Array<{ id: string; productos?: number[] }> = cat.tipo === 'maquinaria' ? [...cat.equipos, ...cat.servicios] : cat.productos;
    const ids = [...new Set(renglones.flatMap((r) => r.productos ?? []))];
    const fichas = ids.length
      ? await prisma.products.findMany({ where: { id: { in: ids }, provider_id: null }, select: { id: true, name: true, status: true } })
      : [];
    const porId = new Map(fichas.map((f) => [f.id, f]));
    return Object.fromEntries(renglones.map((r) => {
      const f = (r.productos ?? []).map((id) => porId.get(id)).find(Boolean);
      return [r.id, f ? { id: f.id, nombre: f.name, activa: f.status === 1 } : null];
    }));
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
    // El siguiente es el MAYOR del mes + 1, no "cuántos hay + 1" (QA
    // 2026-09-28): con cuentas, borrar documentos del mes hacía chocar todos
    // los folios nuevos con los que quedaban y ya no se podía emitir.
    const base = `${prefijo}-${aa}${mm}-`;
    const ultimo = await prisma.quoter_quotes.findFirst({
      where: { folio: { startsWith: base } },
      orderBy: { folio: 'desc' },
      select: { folio: true },
    });
    const n = ultimo ? Number(ultimo.folio.slice(base.length)) || 0 : 0;
    return `${base}${String(n + 1 + intento).padStart(4, '0')}`;
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
    /**
     * Cliente y obra registrados (panel, 2026-10-23). Van en el documento
     * congelado para que, al aceptarse, su servicio caiga en ellos.
     */
    destino?: { clientId: number | null; siteId: number | null } | null;
    /** Fecha de inicio o entrega (panel, 2026-10-23): sale en el documento y pasa al servicio. */
    fecha?: string | null;
    /** Triturados con flete (2026-10-29): la ubicación de la obra en Google Maps. Sale en el documento y pasa al servicio. */
    ubicacion?: string | null;
    /** Del acceso directo, sin cliente (2026-10-29): el nombre se queda vacío y el documento no lo imprime. */
    sinCliente?: boolean;
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
      ...(contexto.destino?.clientId ? { destino: contexto.destino } : {}),
      ...(contexto.fecha ? { fecha: contexto.fecha } : {}),
      ...(contexto.ubicacion ? { ubicacion: contexto.ubicacion } : {}),
    };

    const base = {
      kind: entrada.tipo,
      origin: contexto.origen,
      state: contexto.estado,
      client_name: (entrada.cliente || (contexto.sinCliente ? '' : 'Sin nombre')).slice(0, 190),
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
   * COTIZAR UNA SOLICITUD CON EL TABULADOR (2026-10-15).
   *
   * La solicitud del formulario "Cotizar" llega sin precio, y "Responder" solo
   * dejaba poner flete e impuesto: si el equipo no tenía precio en el catálogo
   * al cliente le llegaba $0 de renta, y sin documento. Ahora se cotiza en el
   * mismo cotizador del panel, ya llenado con los datos de la solicitud, y el
   * documento (MQ-/TR-) queda ligado a ella: los importes salen de él.
   *
   * Se puede volver a cotizar mientras el cliente no acepte. Si ya se le había
   * respondido con otro precio, la solicitud regresa a "Por cotizar" para que
   * se le mande el bueno.
   *
   * Desde el 2026-10-23 también las del cotizador del sitio en VARIAS partes:
   * el documento se recotiza entero y cada parte recibe lo suyo (Recotizar).
   */
  async solicitudLigable(quoteId: number) {
    const q = await prisma.quotes.findUnique({
      where: { id: BigInt(quoteId) },
      select: {
        id: true, quote_number: true, name: true, company_name: true, email: true, phone: true,
        address: true, region: true, product_interested: true, requirements: true, comments: true,
        status: true, accepted_at: true, user_id: true,
        client_sites: { select: { name: true, address: true, municipality: true } },
      },
    });
    if (!q) throw new NotFoundException('Solicitud no encontrada');
    const req = (q.requirements ?? {}) as Record<string, unknown>;
    if (req.origen === 'maquina') throw new BadRequestException('Esta solicitud ya trae su documento del cotizador.');
    if (q.accepted_at) throw new BadRequestException('El cliente ya aceptó esta cotización: su precio ya no se cambia.');
    if (q.status === 'rejected') throw new BadRequestException('Esta solicitud está descartada.');
    return q;
  }

  /**
   * Lo que el cotizador necesita para abrirse ya llenado, y lo que pidió el
   * cliente para tenerlo a la vista. Con documento, también sus partidas
   * (2026-10-23): "Volver a cotizar" abría el cotizador vacío y había que
   * capturar todo otra vez.
   */
  async datosParaCotizar(quoteId: number) {
    const q = await this.solicitudLigable(quoteId);
    const req = (q.requirements ?? {}) as Record<string, unknown>;
    const doc = typeof req.quoterId === 'number' ? await prisma.quoter_quotes.findUnique({ where: { id: req.quoterId } }) : null;
    const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const internas = new Set(['origen', 'cotizador', 'folio', 'quoterId', 'obra', 'obra_ubicacion', 'productos', 'productId', 'renglones']);
    // El municipio casi nunca viene solo: va al final de la dirección ("Av. …, San
    // Pedro Garza García") y `region` es el ESTADO. Se busca pieza por pieza.
    const municipio = [q.client_sites?.municipality, texto(req.obra_ubicacion), q.address, q.region]
      .flatMap((t) => (t ?? '').split(',').map((p) => p.trim()).filter(Boolean).reverse())
      .map((p) => centroDeMunicipio(p)?.nombre)
      .find(Boolean);
    return {
      id: Number(q.id),
      quoteNumber: q.quote_number,
      folioActual: texto(req.folio) || null,
      inicial: {
        cliente: q.company_name?.trim() || q.name,
        obra: q.client_sites?.name ?? (texto(req.obra) || q.address || ''),
        atencion: q.company_name ? q.name : '',
        municipio: municipio ?? (q.client_sites?.municipality || texto(req.obra_ubicacion) || q.region || ''),
        correo: q.email ?? '',
        telefono: q.phone ?? '',
        notas: '',
      },
      pide: q.product_interested ?? null,
      detalle: Object.entries(req)
        .filter(([k, v]) => !internas.has(k) && typeof v === 'string' && v.trim())
        .slice(0, 12)
        .map(([k, v]) => [k, String(v)] as [string, string]),
      comentarios: q.comments ?? null,
      documento: doc
        ? {
            tipo: doc.kind,
            partidas: doc.items as unknown as PartidaCotizador[],
            opciones: (doc.options ?? {}) as Partial<OpcionesCotizador>,
            // Sin mandar todavía: se actualiza ese mismo documento (mismo folio).
            mismoFolio: ['solicitada', 'borrador'].includes(doc.state),
          }
        : null,
    };
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
          total: true, admin_name: true, created_at: true, updated_at: true,
        },
      }),
      prisma.quoter_quotes.count({ where }),
    ]);
    const vencidas = await documentosVencidos(items);

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
        /** Enviada y su vigencia ya pasó sin respuesta (2026-10-26). */
        vencida: vencidas.has(q.id),
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
        /** Fecha de inicio o entrega y, en triturados con flete, la ubicación en Google Maps. */
        fecha?: string;
        ubicacion?: string;
      },
      total: Number(q.total),
      admin: q.admin_name,
      fecha: q.created_at,
      /** Salió de una solicitud: esa la acepta el cliente desde su cuenta (2026-10-26). */
      ligada: await tieneSolicitud(q.folio),
      vencida: (await documentosVencidos([q])).has(q.id),
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
   * Dos correos, y ninguno es decorativo:
   *
   *  - Al equipo de MAQSER24. Antes, la promesa del acuse —"un asesor se
   *    pondrá en contacto"— dependía de que alguien abriera el panel por su
   *    cuenta, y una solicitud podía dormir días sin que nadie lo supiera.
   *    Lleva el precio ESTIMADO: el cliente no lo vio (2026-10-23).
   *  - Al visitante, con su folio, que hasta ahora solo vivía en la pantalla.
   *    Sin importes: el precio se lo manda una persona desde el panel.
   *
   * A los proveedores ya NO se les escribe aquí (2026-10-23): nada sale a los
   * aliados hasta que MAQSER24 revisa el precio, el cliente lo acepta y alguien
   * elige a quién se le da (Servicios › Buscar aliado).
   *
   * NUNCA tumba la solicitud: se llama sin esperar desde el controlador y
   * atrapa todo. Si el servidor de correo está caído, la cotización ya quedó
   * guardada y el panel la enseña igual — el correo avisa de lo que pasó, no es
   * la cosa que pasó.
   *
   * @param servicio La solicitud ya abierta en Solicitudes (ver
   *   `QuoterServicio`): de ahí salen el enlace del cliente y el del panel.
   */
  async avisarSolicitud(
    id: number,
    servicio?: { quoteId?: number; quoteNumber: string; url: string } | null,
  ): Promise<void> {
    try {
      const q = await prisma.quoter_quotes.findUnique({ where: { id } });
      if (!q) return;

      const tipo = q.kind as CotizadorTipo;
      const cotizador = COTIZADORES_META[tipo].titulo.toLowerCase();
      const calc = (q.snapshot as unknown as { calc: CalculoCotizacion }).calc;
      const conceptos = (calc?.renglones ?? [])
        .filter((r) => r.clase !== 'flete')
        .map((r) => `${r.concepto} · ${r.cantidad} ${r.unidad}`);

      // 1. Al equipo. Va al buzón desde el que sale el correo de la plataforma:
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
            // Directo a la solicitud, que es donde se revisa y se responde.
            url: servicio?.quoteId ? `${panel}/cotizaciones?ver=${servicio.quoteId}` : `${panel}/cotizador/historial/${q.id}`,
          }),
        });
      }

      // 2. Al cliente: que se recibió y dónde seguirla. Sin precio.
      if (q.email) {
        const sitio = (process.env.SITE_URL ?? 'https://maqser24.com').replace(/\/+$/, '');
        await this.mailer.enviar({
          kind: 'quoter_request_ack',
          to: q.email,
          toName: q.client_name,
          ...correoAcuseSolicitud({
            nombre: q.client_name,
            folio: q.folio,
            cotizador,
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
  async enviarAlCliente(id: number, adminNombre: string | null = null): Promise<{ ok: true; estado: string; correo: string; respondidas: string[] }> {
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

    /**
     * El botón "Acepto" (2026-10-22): solo en las que armó el panel y no son la
     * respuesta a una solicitud del sitio (esas el cliente las acepta desde su
     * cuenta, con su propio camino). Sin llave para firmar, sale sin botón.
     */
    let aceptarUrl: string | null = null;
    /**
     * LA RESPUESTA DE UNA SOLICITUD (2026-10-23). Si el documento es de una
     * solicitud, mandarlo ES responderla: antes solo salía el correo y en su
     * cuenta seguía "Precio en revisión", sin la cotización. Ahora sus partes
     * pasan a cotizadas (como con "Mandar precio") y el botón del correo lleva
     * a su cuenta, donde la ve y la acepta.
     */
    const partes = await prisma.quotes.findMany({
      where: { requirements: { path: '$.folio', equals: q.folio }, accepted_at: null, status: { in: ['pending', 'completed'] } },
      orderBy: { id: 'asc' },
    });
    const sitio = (process.env.SITE_URL ?? 'https://maqser24.com').replace(/\/+$/, '');
    if (partes[0]?.user_id) aceptarUrl = sitio + '/cuenta/cotizaciones/' + encodeURIComponent(partes[0].quote_number);
    if (q.origin === 'panel' && q.state !== 'aceptada' && q.state !== 'cancelada' && !aceptarUrl) {
      const ligada = await prisma.quotes.count({ where: { requirements: { path: '$.folio', equals: q.folio } } });
      if (ligada === 0) {
        try {
          aceptarUrl = `${sitio}${rutaAceptar(await firmarAceptacion(q.id))}`;
        } catch (e) {
          this.log.warn(`Cotización ${q.folio} sin botón para aceptar: ${(e as Error).message}`);
        }
      }
    }

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
        aceptarUrl,
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

    // Las partes que seguían por cotizar quedan respondidas, con la vigencia de siempre.
    const ahora = new Date();
    const respondidas: string[] = [];
    for (const p of partes.filter((x) => x.status === 'pending')) {
      await prisma.quotes.update({
        where: { id: p.id },
        data: {
          status: 'completed',
          responded_at: ahora,
          responded_by: adminNombre,
          valid_until: p.valid_until ?? new Date(vigenciaPorDefecto() + 'T00:00:00Z'),
          ...(p.first_contact_at ? {} : { first_contact_at: ahora, first_contact_via: 'cotizacion' }),
          updated_at: ahora,
        },
      });
      await sincronizarReserva(Number(p.id));
      respondidas.push(p.quote_number);
    }
    if (respondidas.length && partes[0]?.user_id) {
      await this.notifications.push({
        userId: Number(partes[0].user_id),
        type: 'quote_answered',
        title: 'Ya tienes precio: ' + q.folio,
        body: 'Total: ' + Number(q.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + '. Revísala y acéptala en tu cuenta.',
        link: '/cuenta/cotizaciones/' + partes[0].quote_number,
      });
    }

    return { ok: true, estado: 'enviada', correo: q.email, respondidas };
  }

  private static readonly ESTADOS = ['solicitada', 'borrador', 'enviada', 'aceptada', 'cancelada'];

  /**
   * A mano solo quedan dos cosas (2026-10-26); lo demás lo pone el flujo:
   *  - "aceptada": el cliente dijo que sí por teléfono o WhatsApp. Solo las que
   *    armó el panel sin solicitud: las otras las acepta el cliente en su cuenta.
   *  - "cancelada": deja de valer, y su solicitud, si seguía pendiente, se descarta.
   */
  async cambiarEstado(id: number, estado: string) {
    if (!QuoterService.ESTADOS.includes(estado)) throw new BadRequestException('Estado desconocido');
    const doc = await prisma.quoter_quotes.findUnique({ where: { id }, select: { state: true, folio: true } });
    if (!doc) throw new NotFoundException('Cotización no encontrada');
    if (estado === 'aceptada') {
      if (!['borrador', 'enviada'].includes(doc.state)) throw new BadRequestException('Solo se marca aceptada una cotización en borrador o enviada.');
      if (await tieneSolicitud(doc.folio)) throw new BadRequestException('Esta salió de una solicitud: la acepta el cliente desde su cuenta o desde el correo.');
    } else if (estado === 'cancelada') {
      if (!['solicitada', 'borrador', 'enviada'].includes(doc.state)) {
        throw new BadRequestException(doc.state === 'aceptada' ? 'Ya está aceptada: para cancelarla, cancela su servicio en Servicios en curso.' : 'Ya está cancelada.');
      }
      // Su solicitud, si seguía esperando, se descarta con ella.
      const pendientes = await prisma.quotes.findMany({
        where: { requirements: { path: '$.folio', equals: doc.folio }, accepted_at: null, status: { in: ['pending', 'completed'] } },
        select: { id: true },
      });
      if (pendientes.length) {
        await prisma.quotes.updateMany({ where: { id: { in: pendientes.map((p) => p.id) } }, data: { status: 'rejected', updated_at: new Date() } });
        for (const p of pendientes) await sincronizarReserva(Number(p.id));
      }
    } else {
      throw new BadRequestException('Ese estado lo pone el sistema solo: al mandar el precio, cuando el cliente acepta o al volver a cotizar.');
    }
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
