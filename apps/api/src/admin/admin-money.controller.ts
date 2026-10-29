import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query, Req, StreamableFile, UseGuards,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard, type AdminRequest, Modulo } from './admin-auth';
import { registrarAccion } from './audit';
import { MoneyService } from '../money/money.service';
import { aFacturarPorAliado, comoFecha, diaLocal, masDias } from '../money/cuentas';
import { pendientesHoy, resumenDelMes } from '../money/margen';
import { CREDITOS, guardarReglasDinero, reglasDinero } from '../money/reglas';
import { rutaPrivada } from '../common/archivos-privados';

const r2 = (n: number) => Math.round(n * 100) / 100;
const DIAS = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const cobroSchema = z.object({
  monto: z.number().positive().max(100_000_000).optional(),
  forma: z.string().max(40).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referencia: z.string().max(120).optional(),
});
const cuentaSchema = z.object({
  facturaCliente: z.string().max(60).optional(),
  creditoDias: z.number().int().refine((n) => (CREDITOS as readonly number[]).includes(n), 'Crédito inválido').optional(),
});
const reglasSchema = z.object({
  comisionPct: z.number().min(0).max(90),
  comisionPorLinea: z.record(z.string(), z.number().min(0).max(90)),
  diaDePago: z.number().int().min(0).max(6),
  datosPago: z.object({ banco: z.string().max(80), clabe: z.string().max(30), beneficiario: z.string().max(120) }).nullable(),
});

/**
 * COBRAR Y MEDIR (2026-10-22, Fase A): Cobros y pagos y Margen.
 *
 * Cobros y pagos (antes dos pantallas, Cobranza y Pagos a aliados; juntas
 * desde el 2026-10-27): un renglón por servicio cerrado con lo que paga el
 * cliente, la factura del aliado y su pago. Margen: el mes y sus reglas. Ver money/.
 */
@Modulo('administracion')
@Controller('admin/dinero')
@UseGuards(AdminGuard)
export class AdminMoneyController {
  constructor(private readonly money: MoneyService) {}

  // ───────────── Cobros y pagos ─────────────

  /**
   * COBROS Y PAGOS EN UNA SOLA LISTA (2026-10-27). Decisión del dueño: "solo
   * que aparezca el total y diga si pagó o no, además de la factura". Antes
   * eran dos pantallas (Cobranza y Pagos a aliados) con secciones y pasos que
   * se leían como "tanto proceso". Ahora cada servicio cerrado es un renglón:
   * lo que paga el cliente y si pagó, la factura del aliado y si ya se le pagó.
   * Sale todo lo pendiente y lo que se movió en los últimos 60 días.
   */
  @Get('cuentas')
  async cuentas() {
    const hoy = diaLocal();
    const cuentas = await prisma.service_money.findMany({
      where: { OR: [{ cobrado_at: null }, { pagado_at: null, provider_id: { not: null } }, { updated_at: { gte: new Date(Date.now() - 60 * 86_400_000) } }] },
    });
    const quoteIds = cuentas.map((c) => c.quote_id);
    const ids = [...new Set(cuentas.map((c) => c.provider_id).filter((x): x is number => !!x))];
    const enviado = { in: ['enviado', 'simulado'] };
    const [quotes, clientes, aliados, moves, cobrosRecordados, facturasRecordadas, reglas] = await Promise.all([
      prisma.quotes.findMany({
        where: { id: { in: quoteIds } },
        select: { id: true, quote_number: true, name: true, company_name: true, product_interested: true, address: true, service_closed_at: true, phone: true, email: true },
      }),
      prisma.clients.findMany({ where: { id: { in: cuentas.map((c) => c.client_id).filter((x): x is number => !!x) } }, select: { id: true, name: true, credito_dias: true } }),
      prisma.providers.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, email: true } }),
      prisma.money_moves.findMany({ where: { quote_id: { in: quoteIds }, tipo: 'cobro' }, orderBy: { fecha: 'asc' } }),
      // Cuándo se le recordó por última vez: al cliente su pago, al aliado su factura.
      prisma.email_log.groupBy({ by: ['quote_id'], where: { kind: 'cobro_recordatorio', quote_id: { in: quoteIds }, state: enviado }, _max: { created_at: true } }),
      prisma.email_log.groupBy({ by: ['provider_id'], where: { kind: 'factura_aliado_pendiente', provider_id: { in: ids }, state: enviado }, _max: { created_at: true } }),
      reglasDinero(),
    ]);
    const qPor = new Map(quotes.map((q) => [String(q.id), q]));
    const cPor = new Map(clientes.map((c) => [c.id, c]));
    const aPor = new Map(aliados.map((a) => [a.id, a]));
    const cobroRecordado = new Map(cobrosRecordados.map((r) => [String(r.quote_id), r._max.created_at]));
    const facturaRecordada = new Map(facturasRecordadas.map((r) => [r.provider_id, r._max.created_at]));
    const filas = cuentas.map((m) => {
      const q = qPor.get(String(m.quote_id));
      const c = m.client_id ? cPor.get(m.client_id) : undefined;
      const a = m.provider_id ? aPor.get(m.provider_id) : undefined;
      const vence = m.vence.toISOString().slice(0, 10);
      const rc = cobroRecordado.get(String(m.quote_id));
      const rf = a ? facturaRecordada.get(a.id) : null;
      return {
        // El cliente (también lo que usa la ventana "Pagó").
        quoteId: Number(m.quote_id),
        folio: q?.quote_number ?? '',
        cliente: c?.name ?? q?.company_name?.trim() ?? q?.name ?? '',
        contacto: { nombre: q?.name ?? null, telefono: q?.phone ?? null, correo: q?.email ?? null },
        clienteId: m.client_id,
        creditoDias: c?.credito_dias ?? 0,
        servicio: q?.product_interested ?? null,
        obra: q?.address ?? null,
        cerrado: q?.service_closed_at ? diaLocal(q.service_closed_at) : null,
        vence,
        diasVencida: DIAS(vence, hoy),
        total: Number(m.total),
        cobrado: Number(m.cobrado),
        saldo: r2(Number(m.total) - Number(m.cobrado)),
        facturaCliente: m.factura_cliente,
        cobradoAt: m.cobrado_at,
        movimientos: moves.filter((x) => x.quote_id === m.quote_id).map((x) => ({ fecha: x.fecha.toISOString().slice(0, 10), monto: Number(x.monto), forma: x.forma, referencia: x.referencia })),
        clienteCorreo: !!q?.email?.trim(),
        cobroRecordadoEl: rc ? diaLocal(rc) : null,
        // El aliado: su factura y su pago.
        aliado: a ? { id: a.id, nombre: a.name, telefono: a.phone, correo: !!a.email?.trim(), recordadoEl: rf ? diaLocal(rf) : null } : null,
        pagoAliado: aFacturarPorAliado(m),
        facturaPdf: !!m.factura_aliado,
        facturaXml: !!m.factura_aliado_xml,
        pagarEl: m.pagar_el ? m.pagar_el.toISOString().slice(0, 10) : null,
        pagadoAt: m.pagado_at,
        pagoRef: m.pago_ref,
      };
    });
    const p = await pendientesHoy();
    return {
      diaDePago: reglas.diaDePago,
      porCobrar: p.porCobrar,
      vencido: p.vencido,
      porPagar: p.porPagar,
      listoParaPagar: r2(filas.filter((f) => f.pagarEl && !f.pagadoAt).reduce((x, f) => x + f.pagoAliado, 0)),
      cuentas: filas,
    };
  }

  @Post('cobranza/:quoteId/cobro')
  async cobrar(@Param('quoteId', ParseIntPipe) quoteId: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const d = cobroSchema.safeParse(body ?? {});
    if (!d.success) throw new BadRequestException(d.error.issues[0]?.message ?? 'Datos inválidos');
    const r = await this.money.registrarCobro(quoteId, d.data, req.adminId ?? null);
    await registrarAccion(req, 'administracion', 'cobro.registrar', String(quoteId), `${r.monto}${r.saldado ? ' · saldado' : ''}`);
    return r;
  }

  /** "Recordarle" al cliente (2026-10-27): le llega ya el correo de cobro. */
  @Post('cobranza/:quoteId/recordar')
  async recordarCobro(@Param('quoteId', ParseIntPipe) quoteId: number, @Req() req: AdminRequest) {
    const estado = await this.money.recordarCobroA(quoteId);
    await registrarAccion(req, 'administracion', 'cobro.recordar', String(quoteId), estado);
    return { estado };
  }

  @Patch('cobranza/:quoteId')
  async editarCuenta(@Param('quoteId', ParseIntPipe) quoteId: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const d = cuentaSchema.safeParse(body ?? {});
    if (!d.success) throw new BadRequestException(d.error.issues[0]?.message ?? 'Datos inválidos');
    const m = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) } });
    if (!m) throw new NotFoundException();
    if (d.data.facturaCliente !== undefined) {
      await prisma.service_money.update({ where: { quote_id: m.quote_id }, data: { factura_cliente: d.data.facturaCliente.trim() || null, updated_at: new Date() } });
    }
    // El crédito es del CLIENTE: vale para este y sus demás servicios sin pagar.
    if (d.data.creditoDias !== undefined && m.client_id) {
      const dias = d.data.creditoDias;
      await prisma.clients.update({ where: { id: m.client_id }, data: { credito_dias: dias || null } });
      const abiertas = await prisma.service_money.findMany({ where: { client_id: m.client_id, cobrado_at: null }, select: { quote_id: true } });
      const cierres = await prisma.quotes.findMany({ where: { id: { in: abiertas.map((a) => a.quote_id) } }, select: { id: true, service_closed_at: true } });
      for (const c of cierres) {
        await prisma.service_money.update({
          where: { quote_id: c.id },
          data: { vence: comoFecha(masDias(diaLocal(c.service_closed_at ?? new Date()), dias)), updated_at: new Date() },
        });
      }
    }
    await registrarAccion(req, 'administracion', 'cobro.editar', String(quoteId), JSON.stringify(d.data));
    return { ok: true };
  }

  // ───────────── Pagos a aliados ─────────────

  /**
   * Se le pagó al aliado ESTE servicio (2026-10-27: uno por uno, desde su
   * renglón; antes era todo lo listo del aliado de un jalón). Solo si el
   * cliente ya pagó y está su factura. Le llega el aviso con el detalle.
   */
  @Post('cuentas/:quoteId/pagado')
  async pagado(@Param('quoteId', ParseIntPipe) quoteId: number, @Body() body: { referencia?: string }, @Req() req: AdminRequest) {
    const r = await this.money.pagarServicio(quoteId, typeof body?.referencia === 'string' ? body.referencia.slice(0, 120) : null, req.adminId ?? null);
    await registrarAccion(req, 'administracion', 'pago.aliado', r.folio, `${r.aliado} · ${r.total}`);
    return r;
  }

  /** "Recordarle" (2026-10-27): le llega ya el correo con lo que le falta facturar. */
  @Post('pagos/:providerId/recordar')
  async recordar(@Param('providerId', ParseIntPipe) providerId: number, @Req() req: AdminRequest) {
    const estado = await this.money.recordarFacturaA(providerId);
    await registrarAccion(req, 'administracion', 'factura.recordar', String(providerId), estado);
    return { estado };
  }

  /** La factura que subió el aliado (PDF o XML), solo para el panel. */
  @Get('pagos/:quoteId/factura')
  async factura(@Param('quoteId', ParseIntPipe) quoteId: number, @Query('xml') xml?: string) {
    const m = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) }, select: { factura_aliado: true, factura_aliado_xml: true } });
    const rel = xml === '1' ? m?.factura_aliado_xml : m?.factura_aliado ?? m?.factura_aliado_xml;
    if (!rel) throw new NotFoundException('No hay factura.');
    const abs = rutaPrivada(rel);
    if (!existsSync(abs)) throw new NotFoundException('El archivo ya no está.');
    const pdf = rel.endsWith('.pdf');
    // El XML se DESCARGA, nunca se abre (auditoría 2026-10-23): abierto en el
    // panel, un XML con <script> corría con la sesión de quien lo abría. Las
    // subidas de antes del filtro de archivos-privados.ts siguen en disco.
    return new StreamableFile(createReadStream(abs), {
      type: pdf ? 'application/pdf' : 'application/xml',
      disposition: `${pdf ? 'inline' : 'attachment'}; filename="factura-${quoteId}.${pdf ? 'pdf' : 'xml'}"`,
    });
  }

  // ───────────── Margen y reglas ─────────────

  @Get('margen')
  async margen(@Query('mes') mes?: string) {
    const actual = diaLocal().slice(0, 7);
    const m = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : actual;
    // Los últimos 6 meses para la tendencia.
    const meses: string[] = [];
    let [a, n] = m.split('-').map(Number);
    for (let i = 0; i < 6; i++) {
      meses.unshift(`${a}-${String(n).padStart(2, '0')}`);
      n -= 1; if (n === 0) { n = 12; a -= 1; }
    }
    const [resumen, tendencia, pendientes, reglas, lineas] = await Promise.all([
      resumenDelMes(m),
      Promise.all(meses.map(async (x) => { const r = await resumenDelMes(x); return { mes: x, ventas: r.ventas, margen: r.margen, cobrado: r.cobrado }; })),
      pendientesHoy(),
      reglasDinero(),
      prisma.categories.findMany({ where: { status: 1 }, select: { cat_slug: true, cat_name: true }, orderBy: { cat_name: 'asc' } }),
    ]);
    return { ...resumen, tendencia, ...pendientes, reglas, lineas: lineas.map((l) => ({ slug: l.cat_slug, nombre: l.cat_name })) };
  }

  @Put('reglas')
  async guardarReglas(@Body() body: unknown, @Req() req: AdminRequest) {
    const d = reglasSchema.safeParse(body);
    if (!d.success) throw new BadRequestException(d.error.issues[0]?.message ?? 'Reglas inválidas');
    const antes = await reglasDinero();
    await guardarReglasDinero(d.data, req.adminEmail ?? 'panel');
    // La cuenta a la que pagan los clientes es lo que más se querría cambiar a
    // escondidas: queda el antes y el después (auditoría 2026-10-23).
    const cuenta = (x: { datosPago?: { banco: string; clabe: string; beneficiario: string } | null } | null | undefined) =>
      x?.datosPago?.clabe ? `${x.datosPago.banco} · CLABE ${x.datosPago.clabe} · ${x.datosPago.beneficiario}` : 'sin cuenta';
    const cambioCuenta = cuenta(antes) !== cuenta(d.data) ? ` · cuenta de cobro: ${cuenta(antes)} → ${cuenta(d.data)}` : '';
    await registrarAccion(req, 'administracion', 'reglas.dinero', 'reglas', `comisión ${d.data.comisionPct}%${cambioCuenta}`);
    return { ok: true };
  }
}
