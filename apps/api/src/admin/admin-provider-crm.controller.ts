import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';

/**
 * CRM DE PROVEEDORES (2026-10-06).
 *
 * Pedido del cliente: "un CRM dentro del panel, no uno externo". Junta en una
 * sola vista a todos los proveedores —solicitudes del sitio (status 2), red
 * activa (1) y bajas (0)— con su contacto, la ubicación de su taller y su
 * maquinaria. Los costos por hora son SOLO un dato de referencia de lo que
 * cobra cada proveedor: no los lee el cotizador ni ningún precio.
 *
 * El alta y la edición de la ficha del proveedor siguen en
 * `admin/providers` (mismo módulo); aquí solo viven las máquinas.
 */

/** Pesos por hora. Vacío = no se sabe (null); ausente = no se toca. */
const costo = z
  .preprocess((v) => (v === '' ? null : v), z.coerce.number().min(0, 'El costo no puede ser negativo').max(10_000_000).nullable())
  .optional();

const maquinaSchema = z.object({
  tipo: z.string().trim().min(2, 'Escribe el tipo de máquina').max(120),
  marca: z.string().trim().max(120).optional().nullable(),
  modelo: z.string().trim().max(120).optional().nullable(),
  caracteristicas: z.string().trim().max(2000).optional().nullable(),
  costoSinOp: costo,
  costoConOp: costo,
  costoTodo: costo,
  notas: z.string().trim().max(2000).optional().nullable(),
});

const vacio = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const num = (v: unknown) => (v == null ? null : Number(v));

function fila(m: {
  id: number; tipo: string; marca: string | null; modelo: string | null; caracteristicas: string | null;
  costo_hora_sin_op: unknown; costo_hora_con_op: unknown; costo_hora_todo: unknown; notas: string | null; updated_at: Date;
}) {
  return {
    id: m.id,
    tipo: m.tipo,
    marca: m.marca,
    modelo: m.modelo,
    caracteristicas: m.caracteristicas,
    costoSinOp: num(m.costo_hora_sin_op),
    costoConOp: num(m.costo_hora_con_op),
    costoTodo: num(m.costo_hora_todo),
    notas: m.notas,
    actualizado: m.updated_at.toISOString(),
  };
}

@Modulo('proveedores')
@Controller('admin/proveedores-crm')
@UseGuards(AdminGuard)
export class AdminProviderCrmController {
  /** Todos los proveedores con su maquinaria, para la vista y para descargar en Excel. */
  @Get()
  async lista() {
    const provs = await prisma.providers.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true, name: true, status: true, contact_name: true, email: true, phone: true,
        city: true, state: true, address: true, notes: true, categories: true, created_at: true,
        provider_machines: { orderBy: { id: 'asc' } },
      },
    });
    return provs.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      contactName: p.contact_name,
      email: p.email,
      phone: p.phone,
      city: p.city,
      state: p.state,
      address: p.address,
      notes: p.notes,
      registrado: p.created_at.toISOString(),
      maquinas: p.provider_machines.map(fila),
    }));
  }

  @Post(':providerId/maquinas')
  async crear(@Param('providerId', ParseIntPipe) providerId: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const r = maquinaSchema.safeParse(body);
    if (!r.success) throw new BadRequestException(r.error.issues[0]?.message ?? 'Datos inválidos');
    const prov = await prisma.providers.findUnique({ where: { id: providerId }, select: { id: true, name: true } });
    if (!prov) throw new NotFoundException('Proveedor no encontrado');
    const d = r.data;
    const m = await prisma.provider_machines.create({
      data: {
        provider_id: providerId,
        tipo: d.tipo,
        marca: vacio(d.marca),
        modelo: vacio(d.modelo),
        caracteristicas: vacio(d.caracteristicas),
        costo_hora_sin_op: d.costoSinOp ?? null,
        costo_hora_con_op: d.costoConOp ?? null,
        costo_hora_todo: d.costoTodo ?? null,
        notas: vacio(d.notas),
      },
    });
    void registrarAccion(req, 'proveedores', 'crm.maquina.alta', prov.name, d.tipo);
    return fila(m);
  }

  @Patch('maquinas/:id')
  async editar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const r = maquinaSchema.partial().safeParse(body);
    if (!r.success) throw new BadRequestException(r.error.issues[0]?.message ?? 'Datos inválidos');
    const antes = await prisma.provider_machines.findUnique({ where: { id }, select: { id: true, tipo: true } });
    if (!antes) throw new NotFoundException('Máquina no encontrada');
    const d = r.data;
    const m = await prisma.provider_machines.update({
      where: { id },
      data: {
        ...(d.tipo !== undefined ? { tipo: d.tipo } : {}),
        ...(d.marca !== undefined ? { marca: vacio(d.marca) } : {}),
        ...(d.modelo !== undefined ? { modelo: vacio(d.modelo) } : {}),
        ...(d.caracteristicas !== undefined ? { caracteristicas: vacio(d.caracteristicas) } : {}),
        ...(d.costoSinOp !== undefined ? { costo_hora_sin_op: d.costoSinOp } : {}),
        ...(d.costoConOp !== undefined ? { costo_hora_con_op: d.costoConOp } : {}),
        ...(d.costoTodo !== undefined ? { costo_hora_todo: d.costoTodo } : {}),
        ...(d.notas !== undefined ? { notas: vacio(d.notas) } : {}),
        updated_at: new Date(),
      },
    });
    void registrarAccion(req, 'proveedores', 'crm.maquina.edicion', String(id), m.tipo);
    return fila(m);
  }

  @Delete('maquinas/:id')
  async borrar(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const m = await prisma.provider_machines.findUnique({ where: { id }, select: { id: true, tipo: true } });
    if (!m) throw new NotFoundException('Máquina no encontrada');
    await prisma.provider_machines.delete({ where: { id } });
    void registrarAccion(req, 'proveedores', 'crm.maquina.baja', String(id), m.tipo);
    return { ok: true };
  }
}
