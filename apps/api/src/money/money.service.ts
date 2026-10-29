import { promises as fs } from 'node:fs';
import { rutaPrivada } from '../common/archivos-privados';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { rolDeAdmin } from '@maqserv/config';
import { MailerService } from '../notifications/mailer.service';
import { avisarPanel } from '../notifications/panel';
import {
  correoCierreMes, correoCobroRecordatorio, correoFacturaAliadoPendiente, correoPagoAliado,
} from '../notifications/email-templates';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { aFacturarPorAliado, asegurarCuentas, comoFecha, diaLocal, masDias, programarPago } from './cuentas';
import { mesAnterior, pendientesHoy, resumenDelMes } from './margen';
import { reglasDinero } from './reglas';

const SITIO = () => (process.env.SITE_URL ?? 'https://maqser24.com').replace(/\/+$/, '');
const PANEL = () => (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
const r2 = (n: number) => Math.round(n * 100) / 100;
const FECHA = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DIAS = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * EL DINERO DE CADA SERVICIO (2026-10-22, Fase A).
 *
 * Lo único que hace una persona: marcar "cobrado" y "pagado". Todo lo demás
 * pasa solo: la cuenta nace al cerrar el servicio (cuentas.ts), el pago al
 * aliado se programa en cuanto el cliente pagó y él subió su factura, y la
 * corrida diaria recuerda al cliente que debe, al aliado que no ha facturado y,
 * el día 1, le manda a Dirección el cierre del mes.
 */
@Injectable()
export class MoneyService {
  private readonly log = new Logger('Dinero');

  constructor(private readonly mailer: MailerService) {}

  // ───────────── Acciones ─────────────

  /** Entró dinero del cliente. Sin monto = el saldo completo, con fecha de hoy. */
  async registrarCobro(quoteId: number, d: { monto?: number; forma?: string; fecha?: string; referencia?: string }, adminId: number | null) {
    const m = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) } });
    if (!m) throw new NotFoundException('Ese servicio no tiene cuenta.');
    const saldo = r2(Number(m.total) - Number(m.cobrado));
    if (saldo <= 0) throw new BadRequestException('Este servicio ya está cobrado.');
    const monto = r2(d.monto && d.monto > 0 ? Math.min(d.monto, saldo) : saldo);
    const fecha = d.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) ? d.fecha : diaLocal();
    const cobrado = r2(Number(m.cobrado) + monto);
    const saldado = cobrado >= Number(m.total) - 0.01;
    await prisma.$transaction([
      prisma.money_moves.create({
        data: { quote_id: m.quote_id, tipo: 'cobro', monto: new Prisma.Decimal(monto), forma: d.forma?.trim() || 'Transferencia', referencia: d.referencia?.trim() || null, fecha: comoFecha(fecha), admin_id: adminId },
      }),
      prisma.service_money.update({
        where: { quote_id: m.quote_id },
        data: { cobrado: new Prisma.Decimal(cobrado), ...(saldado ? { cobrado_at: new Date() } : {}), updated_at: new Date() },
      }),
    ]);
    const pagarEl = saldado ? await programarPago(quoteId) : null;
    // Qué sigue (2026-10-27): el panel le dice a quien cobró si al aliado ya se
    // le puede pagar o si falta su factura. Sin esto, cobrar "no cambiaba nada".
    const p = m.provider_id ? await prisma.providers.findUnique({ where: { id: m.provider_id }, select: { id: true, name: true, email: true, phone: true } }) : null;
    return {
      ok: true, monto, saldado, saldo: r2(Number(m.total) - cobrado), pagarEl,
      diaDePago: (await reglasDinero()).diaDePago,
      aliado: p ? { id: p.id, nombre: p.name, factura: !!(m.factura_aliado || m.factura_aliado_xml), correo: !!p.email?.trim(), telefono: p.phone } : null,
    };
  }

  /**
   * Se le pagó al aliado UN servicio (2026-10-27, desde su renglón de Cobros y
   * pagos). Solo si ya se puede: el cliente pagó y está la factura del aliado.
   */
  async pagarServicio(quoteId: number, referencia: string | null, adminId: number | null) {
    const m = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) }, select: { provider_id: true, pagado_at: true, pagar_el: true } });
    if (!m?.provider_id) throw new NotFoundException('Ese servicio no tiene aliado.');
    if (m.pagado_at) throw new BadRequestException('A este aliado ya se le pagó este servicio.');
    if (!m.pagar_el) throw new BadRequestException('Todavía no se le puede pagar: falta que pague el cliente o la factura del aliado.');
    const r = await this.marcarPagado(m.provider_id, referencia, adminId, [quoteId]);
    const p = await prisma.providers.findUnique({ where: { id: m.provider_id }, select: { name: true } });
    return { ...r, folio: r.folios[0] ?? String(quoteId), aliado: p?.name ?? '' };
  }

  /** Se le pagó a un aliado lo que tenía listo (o solo esos servicios). Le llega el aviso con el detalle. */
  async marcarPagado(providerId: number, referencia: string | null, adminId: number | null, soloServicios?: number[]) {
    const listas = await prisma.service_money.findMany({
      where: {
        provider_id: providerId, pagado_at: null, pagar_el: { not: null },
        ...(soloServicios ? { quote_id: { in: soloServicios.map((id) => BigInt(id)) } } : {}),
      },
    });
    if (listas.length === 0) throw new BadRequestException('Este aliado no tiene pagos listos.');
    const hoy = diaLocal();
    const folios = await prisma.quotes.findMany({ where: { id: { in: listas.map((l) => l.quote_id) } }, select: { id: true, quote_number: true } });
    const folio = new Map(folios.map((f) => [String(f.id), f.quote_number]));
    const servicios = listas.map((l) => ({ folio: folio.get(String(l.quote_id)) ?? String(l.quote_id), monto: aFacturarPorAliado(l) }));
    await prisma.$transaction([
      ...listas.map((l) => prisma.money_moves.create({
        data: { quote_id: l.quote_id, tipo: 'pago', monto: new Prisma.Decimal(aFacturarPorAliado(l)), forma: 'Transferencia', referencia: referencia?.trim() || null, fecha: comoFecha(hoy), admin_id: adminId },
      })),
      prisma.service_money.updateMany({
        where: { quote_id: { in: listas.map((l) => l.quote_id) } },
        data: { pagado_at: new Date(), pago_ref: referencia?.trim() || null, updated_at: new Date() },
      }),
    ]);
    const p = await prisma.providers.findUnique({ where: { id: providerId }, select: { email: true, contact_name: true } });
    if (p?.email) {
      void this.mailer.enviar({
        kind: 'pago_aliado', to: p.email, toName: p.contact_name, providerId,
        ...(await correoPagoAliado({ contacto: p.contact_name, servicios, referencia: referencia?.trim() || null, fecha: FECHA(hoy) })),
      });
    }
    return { ok: true, servicios: servicios.length, folios: servicios.map((s) => s.folio), total: r2(servicios.reduce((a, s) => a + s.monto, 0)) };
  }

  /** El aliado subió su factura (PDF y/o XML) de un servicio suyo. */
  async recibirFactura(providerId: number, quoteNumber: string, archivos: { pdf?: string; xml?: string }) {
    if (!archivos.pdf && !archivos.xml) throw new BadRequestException('Sube el PDF o el XML de tu factura.');
    const q = await prisma.quotes.findFirst({ where: { quote_number: quoteNumber }, select: { id: true } });
    const m = q ? await prisma.service_money.findUnique({ where: { quote_id: q.id } }) : null;
    if (!m || m.provider_id !== providerId) throw new NotFoundException('Ese servicio no es tuyo o todavía no se cierra.');
    if (m.pagado_at) throw new BadRequestException('Este servicio ya se te pagó.');
    await prisma.service_money.update({
      where: { quote_id: m.quote_id },
      data: {
        ...(archivos.pdf ? { factura_aliado: archivos.pdf } : {}),
        ...(archivos.xml ? { factura_aliado_xml: archivos.xml } : {}),
        factura_aliado_at: new Date(),
        updated_at: new Date(),
      },
    });
    // La que se reemplazó ya no la abre nadie: fuera del disco.
    const viejas = [archivos.pdf ? m.factura_aliado : null, archivos.xml ? m.factura_aliado_xml : null];
    await Promise.all(viejas.filter((r): r is string => Boolean(r)).map((r) => fs.unlink(rutaPrivada(r)).catch(() => undefined)));
    const pagarEl = await programarPago(Number(m.quote_id));
    return { ok: true, pagarEl };
  }

  // ───────────── Corrida diaria (8:00) ─────────────

  async revisarDiario(ahora: Date = new Date()) {
    const resultado = { cuentasNuevas: 0, recordatoriosCliente: 0, recordatoriosAliado: 0, cierreMes: false };
    try {
      resultado.cuentasNuevas = await asegurarCuentas();
      resultado.recordatoriosCliente = await this.recordarCobros(ahora);
      resultado.recordatoriosAliado = await this.recordarFacturas(ahora);
      resultado.cierreMes = await this.cierreDelMes(ahora);
    } catch (e) {
      this.log.warn(`Corrida de cobros y pagos: ${(e as Error).message}`);
    }
    return resultado;
  }

  /**
   * Al cliente que debe: el primero el día después de cerrar (de contado) o 3
   * días antes de vencer (con crédito), y luego uno por semana mientras siga
   * sin pagar. Con 15 días o más de atraso, suena la campana de Administración
   * una vez por semana.
   */
  private async recordarCobros(ahora: Date): Promise<number> {
    const hoy = diaLocal(ahora);
    const abiertas = await prisma.service_money.findMany({ where: { cobrado_at: null } });
    if (abiertas.length === 0) return 0;
    const reglas = await reglasDinero();
    const quotes = await prisma.quotes.findMany({
      where: { id: { in: abiertas.map((a) => a.quote_id) } },
      select: { id: true, quote_number: true, name: true, email: true, company_name: true, product_interested: true, service_closed_at: true },
    });
    const qPor = new Map(quotes.map((q) => [String(q.id), q]));
    let n = 0;
    for (const m of abiertas) {
      const q = qPor.get(String(m.quote_id));
      if (!q) continue;
      const saldo = r2(Number(m.total) - Number(m.cobrado));
      if (saldo <= 0) continue;
      const vence = m.vence.toISOString().slice(0, 10);
      const dias = DIAS(vence, hoy); // positivo = vencido
      const conCredito = q.service_closed_at ? vence > diaLocal(q.service_closed_at) : false;
      if (dias < (conCredito ? -3 : 1)) continue;
      const reciente = await prisma.email_log.findFirst({
        where: { kind: 'cobro_recordatorio', quote_id: m.quote_id, created_at: { gte: new Date(ahora.getTime() - 6 * 86_400_000) } },
        select: { id: true },
      });
      if (reciente || !q.email?.trim()) continue;
      await this.mandarRecordatorioCobro(m, q, reglas.datosPago, dias);
      n += 1;
      if (dias >= 15) {
        void avisarPanel({
          modulo: 'administracion', evento: 'cobro',
          titulo: `${q.company_name?.trim() || q.name} lleva ${dias} días sin pagar ${q.quote_number}`,
          cuerpo: `Saldo ${saldo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. Ya se le mandó recordatorio; llámale.`,
          link: '/administracion/cobros?f=cobrar',
        });
      }
    }
    return n;
  }

  /**
   * "Recordarle" al cliente desde Cobros y pagos (2026-10-27): el mismo correo
   * de cobro de la corrida diaria, ya. Sin correo, el panel enseña su teléfono.
   */
  async recordarCobroA(quoteId: number): Promise<'enviado' | 'sin_correo'> {
    const m = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) } });
    if (!m) throw new NotFoundException('Ese servicio no tiene cuenta.');
    if (m.cobrado_at || Number(m.total) - Number(m.cobrado) <= 0) throw new BadRequestException('Este servicio ya está cobrado.');
    const q = await prisma.quotes.findUnique({ where: { id: m.quote_id }, select: { name: true, email: true, quote_number: true, product_interested: true } });
    if (!q?.email?.trim()) return 'sin_correo';
    const estado = await this.mandarRecordatorioCobro(m, q, (await reglasDinero()).datosPago, DIAS(m.vence.toISOString().slice(0, 10), diaLocal()));
    if (estado === 'omitido') return 'sin_correo';
    if (estado === 'fallido') throw new BadRequestException('No se pudo mandar el correo. Inténtalo de nuevo.');
    return 'enviado';
  }

  /** El correo "tu pago de COT-… vence / venció", con lo que debe y los datos para pagar. */
  private async mandarRecordatorioCobro(
    m: { quote_id: bigint; total: unknown; cobrado: unknown; vence: Date },
    q: { name: string; email: string | null; quote_number: string; product_interested: string | null },
    datosPago: Awaited<ReturnType<typeof reglasDinero>>['datosPago'],
    dias: number,
  ) {
    const vence = m.vence.toISOString().slice(0, 10);
    return this.mailer.enviar({
      kind: 'cobro_recordatorio', to: q.email as string, toName: q.name, quoteId: Number(m.quote_id),
      ...(await correoCobroRecordatorio({
        nombre: q.name, folio: q.quote_number, servicio: q.product_interested, saldo: r2(Number(m.total) - Number(m.cobrado)), vence: FECHA(vence), dias,
        datosPago, url: `${SITIO()}/cuenta/cotizaciones/${encodeURIComponent(q.quote_number)}`,
      })),
    });
  }

  /** Al aliado que no ha subido su factura: un correo por aliado y por semana, con todos sus servicios. */
  private async recordarFacturas(ahora: Date): Promise<number> {
    const pendientes = await prisma.service_money.findMany({
      where: { pagado_at: null, factura_aliado_at: null, provider_id: { not: null }, created_at: { lte: new Date(ahora.getTime() - 86_400_000) } },
    });
    if (pendientes.length === 0) return 0;
    const porAliado = new Map<number, typeof pendientes>();
    for (const p of pendientes) porAliado.set(p.provider_id as number, [...(porAliado.get(p.provider_id as number) ?? []), p]);
    let n = 0;
    for (const [providerId, suyas] of porAliado) {
      const reciente = await prisma.email_log.findFirst({
        where: { kind: 'factura_aliado_pendiente', provider_id: providerId, created_at: { gte: new Date(ahora.getTime() - 6 * 86_400_000) } },
        select: { id: true },
      });
      if (reciente) continue;
      if ((await this.mandarRecordatorioFactura(providerId, suyas)) === 'enviado') n += 1;
    }
    return n;
  }

  /**
   * "Recordarle" a un aliado desde Cobros y pagos (2026-10-27): el mismo correo de la
   * corrida semanal, ya, con TODO lo que le falta facturar (también lo cerrado
   * hoy). Sin correo, el panel enseña su teléfono para llamarle.
   */
  async recordarFacturaA(providerId: number): Promise<'enviado' | 'sin_correo'> {
    const p = await prisma.providers.findUnique({ where: { id: providerId }, select: { status: true } });
    if (!p) throw new NotFoundException('Aliado no encontrado.');
    if (p.status !== 1) throw new BadRequestException('Este aliado está dado de baja.');
    const suyas = await prisma.service_money.findMany({ where: { provider_id: providerId, pagado_at: null, factura_aliado_at: null } });
    if (suyas.length === 0) throw new BadRequestException('Este aliado ya subió todas sus facturas.');
    const r = await this.mandarRecordatorioFactura(providerId, suyas);
    if (r === 'sin_correo') return r;
    if (r !== 'enviado') throw new BadRequestException('No se pudo mandar el correo. Inténtalo de nuevo.');
    return r;
  }

  /** El correo "sube tu factura" con sus servicios y el botón a su portal. */
  private async mandarRecordatorioFactura(
    providerId: number,
    suyas: Array<{ quote_id: bigint; pago_aliado: unknown; iva: unknown }>,
  ): Promise<'enviado' | 'sin_correo' | 'fallido'> {
    const p = await prisma.providers.findUnique({ where: { id: providerId }, select: { email: true, contact_name: true, access_version: true, status: true } });
    if (!p?.email?.trim() || p.status !== 1) return 'sin_correo';
    const quotes = await prisma.quotes.findMany({ where: { id: { in: suyas.map((s) => s.quote_id) } }, select: { id: true, quote_number: true } });
    const folio = new Map(quotes.map((q) => [String(q.id), q.quote_number]));
    let url: string | null = null;
    try { url = urlDeAcceso(await firmarAcceso(providerId, p.access_version ?? 1)); } catch { /* sin llave: sale sin botón */ }
    const estado = await this.mailer.enviar({
      kind: 'factura_aliado_pendiente', to: p.email, toName: p.contact_name, providerId,
      ...(await correoFacturaAliadoPendiente({
        contacto: p.contact_name,
        servicios: suyas.map((s) => ({ folio: folio.get(String(s.quote_id)) ?? String(s.quote_id), monto: aFacturarPorAliado(s) })),
        url,
      })),
    });
    // "omitido" = su correo no es válido: para el panel es lo mismo que no tenerlo.
    return estado === 'enviado' || estado === 'simulado' ? 'enviado' : estado === 'omitido' ? 'sin_correo' : 'fallido';
  }

  /** El día 1 (o el primer día que corra la tarea en el mes), el cierre del mes anterior a Dirección y Administración. */
  private async cierreDelMes(ahora: Date): Promise<boolean> {
    const hoy = diaLocal(ahora);
    if (Number(hoy.slice(8, 10)) > 5) return false;
    const inicioMes = comoFecha(`${hoy.slice(0, 7)}-01`);
    const ya = await prisma.email_log.findFirst({ where: { kind: 'cierre_mes', created_at: { gte: inicioMes } }, select: { id: true } });
    if (ya) return false;
    const mes = mesAnterior(ahora);
    const [r, p] = await Promise.all([resumenDelMes(mes), pendientesHoy()]);
    if (r.servicios === 0 && p.porCobrar === 0 && p.porPagar === 0) return false;
    const admins = await prisma.admins.findMany({ where: { status: 1 }, select: { email: true, name: true, role: true } });
    const destinos = admins.filter((a) => ['direccion', 'administracion'].includes(rolDeAdmin(a.role)));
    const nombreMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    for (const a of destinos) {
      await this.mailer.enviar({
        kind: 'cierre_mes', to: a.email, toName: a.name,
        ...correoCierreMes({ mes: nombreMes, servicios: r.servicios, ventas: r.ventas, pagoAliados: r.pagoAliados, margen: r.margen, ...p, url: `${PANEL()}/administracion/margen?mes=${mes}` }),
      });
    }
    return destinos.length > 0;
  }

  /** Días entre el cierre y el vencimiento de una cuenta, para "Vence en N días". */
  static diasPara(vence: Date): number {
    return DIAS(diaLocal(), vence.toISOString().slice(0, 10));
  }

  /** Para recalcular el vencimiento si cambia el crédito del cliente. */
  static venceCon(cerrado: Date | null, credito: number): Date {
    return comoFecha(masDias(diaLocal(cerrado ?? new Date()), Math.max(0, credito)));
  }
}
