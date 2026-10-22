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
 * COBRAR Y MEDIR (2026-10-22, Fase A): Cobranza, Pagos a aliados y Margen.
 *
 * Las pantallas enseñan solo lo que pide una acción. Cobranza: lo que falta
 * cobrar, lo vencido primero. Pagos: lo que ya se puede pagar, por aliado.
 * Margen: el mes y sus reglas. Ver money/.
 */
@Modulo('administracion')
@Controller('admin/dinero')
@UseGuards(AdminGuard)
export class AdminMoneyController {
  constructor(private readonly money: MoneyService) {}

  // ───────────── Cobranza ─────────────

  @Get('cobranza')
  async cobranza(@Query('cobradas') cobradas?: string) {
    const hoy = diaLocal();
    const cuentas = await prisma.service_money.findMany({
      where: cobradas === '1' ? { cobrado_at: { gte: new Date(Date.now() - 60 * 86_400_000) } } : { cobrado_at: null },
      orderBy: { vence: 'asc' },
    });
    const [quotes, clientes, moves] = await Promise.all([
      prisma.quotes.findMany({
        where: { id: { in: cuentas.map((c) => c.quote_id) } },
        select: { id: true, quote_number: true, name: true, company_name: true, product_interested: true, address: true, service_closed_at: true, phone: true, email: true },
      }),
      prisma.clients.findMany({ where: { id: { in: cuentas.map((c) => c.client_id).filter((x): x is number => !!x) } }, select: { id: true, name: true, credito_dias: true } }),
      prisma.money_moves.findMany({ where: { quote_id: { in: cuentas.map((c) => c.quote_id) }, tipo: 'cobro' }, orderBy: { fecha: 'asc' } }),
    ]);
    const qPor = new Map(quotes.map((q) => [String(q.id), q]));
    const cPor = new Map(clientes.map((c) => [c.id, c]));
    const filas = cuentas.map((m) => {
      const q = qPor.get(String(m.quote_id));
      const c = m.client_id ? cPor.get(m.client_id) : undefined;
      const vence = m.vence.toISOString().slice(0, 10);
      return {
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
      };
    });
    // Vencidas primero (más atraso arriba), luego por fecha.
    filas.sort((a, b) => b.diasVencida - a.diasVencida);
    const p = await pendientesHoy();
    return { porCobrar: p.porCobrar, vencido: p.vencido, cuentas: filas };
  }

  @Post('cobranza/:quoteId/cobro')
  async cobrar(@Param('quoteId', ParseIntPipe) quoteId: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const d = cobroSchema.safeParse(body ?? {});
    if (!d.success) throw new BadRequestException(d.error.issues[0]?.message ?? 'Datos inválidos');
    const r = await this.money.registrarCobro(quoteId, d.data, req.adminId ?? null);
    await registrarAccion(req, 'administracion', 'cobro.registrar', String(quoteId), `${r.monto}${r.saldado ? ' · saldado' : ''}`);
    return r;
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

  @Get('pagos')
  async pagos(@Query('pagados') pagados?: string) {
    const cuentas = await prisma.service_money.findMany({
      where: pagados === '1'
        ? { pagado_at: { gte: new Date(Date.now() - 60 * 86_400_000) } }
        : { pagado_at: null, provider_id: { not: null } },
      orderBy: { pagar_el: 'asc' },
    });
    const [quotes, aliados] = await Promise.all([
      prisma.quotes.findMany({ where: { id: { in: cuentas.map((c) => c.quote_id) } }, select: { id: true, quote_number: true, product_interested: true } }),
      prisma.providers.findMany({ where: { id: { in: [...new Set(cuentas.map((c) => c.provider_id).filter((x): x is number => !!x))] } }, select: { id: true, name: true, contact_name: true, phone: true } }),
    ]);
    const qPor = new Map(quotes.map((q) => [String(q.id), q]));
    const fila = (m: (typeof cuentas)[number]) => ({
      quoteId: Number(m.quote_id),
      folio: qPor.get(String(m.quote_id))?.quote_number ?? '',
      servicio: qPor.get(String(m.quote_id))?.product_interested ?? null,
      monto: aFacturarPorAliado(m),
      factura: !!(m.factura_aliado || m.factura_aliado_xml),
      clientePago: !!m.cobrado_at,
      pagarEl: m.pagar_el ? m.pagar_el.toISOString().slice(0, 10) : null,
      pagadoAt: m.pagado_at,
      referencia: m.pago_ref,
    });
    const porAliado = aliados.map((a) => {
      const suyas = cuentas.filter((c) => c.provider_id === a.id).map(fila);
      const listas = suyas.filter((s) => s.pagarEl && !s.pagadoAt);
      return {
        providerId: a.id,
        aliado: a.name,
        contacto: a.contact_name,
        telefono: a.phone,
        listas,
        totalListo: r2(listas.reduce((x, s) => x + s.monto, 0)),
        pagarEl: listas.map((s) => s.pagarEl as string).sort()[0] ?? null,
        esperandoFactura: suyas.filter((s) => !s.factura && !s.pagadoAt),
        esperandoCliente: suyas.filter((s) => s.factura && !s.clientePago && !s.pagadoAt),
        pagadas: suyas.filter((s) => s.pagadoAt),
      };
    });
    return {
      paraPagar: porAliado.filter((a) => a.listas.length).sort((a, b) => (a.pagarEl ?? '').localeCompare(b.pagarEl ?? '')),
      esperando: porAliado.filter((a) => a.esperandoFactura.length || a.esperandoCliente.length),
      pagados: pagados === '1' ? porAliado.filter((a) => a.pagadas.length) : [],
    };
  }

  @Post('pagos/:providerId/pagado')
  async pagado(@Param('providerId', ParseIntPipe) providerId: number, @Body() body: { referencia?: string }, @Req() req: AdminRequest) {
    const r = await this.money.marcarPagado(providerId, typeof body?.referencia === 'string' ? body.referencia.slice(0, 120) : null, req.adminId ?? null);
    await registrarAccion(req, 'administracion', 'pago.aliado', String(providerId), `${r.servicios} servicio(s) · ${r.total}`);
    return r;
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
    return new StreamableFile(createReadStream(abs), {
      type: pdf ? 'application/pdf' : 'application/xml',
      disposition: `inline; filename="factura-${quoteId}.${pdf ? 'pdf' : 'xml'}"`,
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
      Promise.all(meses.map(async (x) => { const r = await resumenDelMes(x); return { mes: x, ventas: r.ventas, margen: r.margen }; })),
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
    await guardarReglasDinero(d.data, req.adminEmail ?? 'panel');
    await registrarAccion(req, 'administracion', 'reglas.dinero', 'reglas', `comisión ${d.data.comisionPct}%`);
    return { ok: true };
  }
}
