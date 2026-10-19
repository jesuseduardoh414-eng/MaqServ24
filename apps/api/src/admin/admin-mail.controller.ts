import {
  BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { MODULOS_CON_CORREO, puedeVerCon, tiposDeCorreoDe } from '@maqserv/config';
import { z } from 'zod';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { permisosVigentes } from './permisos';
import { ENLACE_OCULTO, MailerService, type TipoCorreo } from '../notifications/mailer.service';
import { RemindersService } from '../notifications/reminders.service';
import { correoDePrueba } from '../notifications/email-templates';

/**
 * Los tipos de correo que este administrador puede ver; `null` son todos.
 *
 * "Solo deben ver los correos de ellos" (2026-10-12): quien tiene
 * Configuración (Dirección) ve todos; los demás, los de sus módulos
 * (ver `MODULO_DE_CORREO` en @maqserv/config). Sin ninguno, no entra.
 */
async function tiposVisibles(req: AdminRequest): Promise<string[] | null> {
  const permisos = await permisosVigentes();
  if (puedeVerCon(req.adminRol, 'configuracion', permisos)) return null;
  const tipos = tiposDeCorreoDe(MODULOS_CON_CORREO.filter((m) => puedeVerCon(req.adminRol, m, permisos)));
  if (tipos.length === 0) throw new ForbiddenException('Tu rol no tiene correos que ver.');
  return tipos;
}

/**
 * De estos fallos, cuáles ya se resolvieron: después salió uno igual (mismo
 * tipo, destinatario y asunto), sea porque alguien lo reenvió o porque se
 * repitió la acción. Un fallo resuelto que sigue en rojo hace creer que
 * alguien se quedó sin su correo (2026-10-12).
 */
async function resueltos(fallos: Array<{ id: number; to_email: string; kind: string; subject: string }>): Promise<Set<number>> {
  const ok = new Set<number>();
  if (fallos.length === 0) return ok;
  const despues = await prisma.email_log.findMany({
    where: {
      state: 'enviado',
      id: { gt: Math.min(...fallos.map((f) => f.id)) },
      to_email: { in: [...new Set(fallos.map((f) => f.to_email))] },
    },
    select: { id: true, to_email: true, kind: true, subject: true },
  });
  for (const f of fallos) {
    if (despues.some((e) => e.id > f.id && e.to_email === f.to_email && e.kind === f.kind && e.subject === f.subject)) ok.add(f.id);
  }
  return ok;
}

/**
 * CORREO — estado, registro y prueba.
 *
 * "Notificaciones, recordatorios y trazabilidad de interacciones"
 * (documento institucional, sección 17). El registro es la mitad del
 * requisito: un correo que no sale y no avisa es peor que no tener correos,
 * porque la operación cree que informó y nadie informó.
 */
@Modulo('configuracion')
@Controller('admin/mail')
@UseGuards(AdminGuard)
export class AdminMailController {
  constructor(
    private readonly mailer: MailerService,
    private readonly reminders: RemindersService,
  ) {}

  /** Cómo está la configuración y qué ha pasado últimamente. */
  @Get('status')
  async status() {
    const [porEstado, fallos] = await Promise.all([
      prisma.email_log.groupBy({ by: ['state'], _count: { _all: true } }),
      // Los últimos 50 bastan: lo que importa es si hay algo reciente pendiente.
      prisma.email_log.findMany({
        where: { state: 'fallido' },
        orderBy: { id: 'desc' },
        take: 50,
        select: { id: true, created_at: true, to_email: true, kind: true, subject: true, detail: true },
      }),
    ]);
    const conteo: Record<string, number> = {};
    for (const r of porEstado) conteo[r.state] = r._count._all;
    // Solo los que nadie ha vuelto a mandar: los resueltos ya no son un problema.
    const yaSalieron = await resueltos(fallos);
    const pendientes = fallos.filter((f) => !yaSalieron.has(f.id));
    const ultimo = pendientes[0];

    // Un servidor en esta misma máquina es el buzón falso de pruebas (Mailpit):
    // decir "salen de verdad" ahí hace creer que alguien los recibió.
    const local = /^(localhost|127\.0\.0\.1|::1)$/i.test(process.env.SMTP_HOST?.trim() ?? '');

    return {
      configurado: this.mailer.configurado,
      habilitado: this.mailer.habilitado,
      local,
      // El texto explica qué falta, no sólo que falta: es la diferencia entre
      // un aviso accionable y uno decorativo.
      resumen: !this.mailer.configurado
        ? 'Sin servidor de correo. Faltan SMTP_HOST, SMTP_USER y SMTP_PASS en la API.'
        : !this.mailer.habilitado
          ? 'Configurado, pero apagado: MAIL_ENABLED no está en "true", así que nada sale todavía. Todo se registra como simulado.'
          : local
            ? 'Modo prueba: los correos van al buzón falso de esta máquina (Mailpit, se ven en localhost:8025). Nada sale a internet.'
            : 'Encendido. Los correos salen de verdad.',
      conteo,
      ultimoFallo: ultimo ? { id: ultimo.id, created_at: ultimo.created_at, to_email: ultimo.to_email, detail: ultimo.detail } : null,
      fallosPendientes: pendientes.length,
    };
  }

  /**
   * Los últimos envíos. Es lo que se mira cuando alguien dice "no me llegó".
   * Lo abre cualquier rol con correos (`inicio` deja pasar a todos; el filtro
   * real es `tiposVisibles`).
   */
  @Modulo('inicio')
  @Get('log')
  async log(@Req() req: AdminRequest, @Query('estado') estado?: string, @Query('page') page?: string) {
    const tipos = await tiposVisibles(req);
    const p = Math.max(1, Number(page ?? 1) || 1);
    const deSusModulos = tipos ? { kind: { in: tipos } } : {};
    const where = { ...deSusModulos, ...(estado ? { state: estado } : {}) };
    const [total, rows, porEstado] = await Promise.all([
      prisma.email_log.count({ where }),
      prisma.email_log.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (p - 1) * 40,
        take: 40,
        // Sin el contenido: pesa, y la lista no lo enseña (está en el detalle).
        select: {
          id: true, kind: true, to_email: true, to_name: true, subject: true, state: true, detail: true,
          quote_id: true, provider_id: true, created_at: true,
        },
      }),
      prisma.email_log.groupBy({ by: ['state'], where: deSusModulos, _count: { _all: true } }),
    ]);
    const conteo: Record<string, number> = {};
    for (const r of porEstado) conteo[r.state] = r._count._all;
    const yaSalieron = await resueltos(rows.filter((r) => r.state === 'fallido'));
    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / 40)),
      conteo,
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        to: r.to_email,
        toName: r.to_name,
        subject: r.subject,
        state: r.state,
        detail: r.detail,
        resuelto: yaSalieron.has(r.id),
        quoteId: r.quote_id ? Number(r.quote_id) : null,
        providerId: r.provider_id,
        createdAt: r.created_at,
      })),
    };
  }

  /**
   * Un correo completo: el contenido tal como salió (con los enlaces
   * personales tachados) y a qué solicitud o aliado pertenece.
   */
  @Modulo('inicio')
  @Get('log/:id')
  async detalle(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const r = await this.correoVisible(req, id);
    const [html, solicitud, aliado] = await Promise.all([
      this.contenido(id),
      r.quote_id
        ? prisma.quotes.findUnique({ where: { id: r.quote_id }, select: { quote_number: true } }).catch(() => null)
        : null,
      r.provider_id
        ? prisma.providers.findUnique({ where: { id: r.provider_id }, select: { name: true } }).catch(() => null)
        : null,
    ]);
    const conEnlacePersonal = html?.includes(ENLACE_OCULTO) ?? false;
    return {
      id: r.id,
      kind: r.kind,
      to: r.to_email,
      toName: r.to_name,
      subject: r.subject,
      state: r.state,
      detail: r.detail,
      createdAt: r.created_at,
      html,
      conEnlacePersonal,
      // Sin contenido no hay qué reenviar; con un enlace personal tachado el
      // reenvío llegaría roto (se repite la acción que lo manda, no el correo).
      reenviable: Boolean(html) && !conEnlacePersonal && r.state !== 'omitido',
      solicitud: r.quote_id ? { id: Number(r.quote_id), numero: solicitud?.quote_number ?? null } : null,
      aliado: r.provider_id ? { id: r.provider_id, nombre: aliado?.name ?? null } : null,
    };
  }

  /** Lo vuelve a mandar igual, al mismo destinatario. Queda como un envío nuevo en el registro. */
  @Modulo('inicio')
  @Post('log/:id/reenviar')
  async reenviar(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const r = await this.correoVisible(req, id);
    const html = await this.contenido(id);
    if (!html) throw new BadRequestException('Este correo no tiene el contenido guardado: se mandó antes de que se guardara.');
    if (html.includes(ENLACE_OCULTO)) {
      throw new BadRequestException('Lleva un enlace personal que no se guarda. Repite la acción que lo manda (por ejemplo, "Enviar acceso" en Proveedores).');
    }
    if (r.state === 'omitido') throw new BadRequestException('La dirección no es válida: corrígela antes de volver a mandarlo.');
    const estado = await this.mailer.enviar({
      kind: r.kind as TipoCorreo,
      to: r.to_email,
      toName: r.to_name,
      subject: r.subject,
      html,
      quoteId: r.quote_id ? Number(r.quote_id) : null,
      providerId: r.provider_id,
    });
    return {
      estado,
      mensaje:
        estado === 'enviado' ? 'Se volvió a mandar.'
          : estado === 'simulado' ? 'No salió: el envío sigue apagado.'
            : 'Volvió a fallar. El detalle está en el registro.',
    };
  }

  /** El renglón del registro, si es de los módulos de quien pregunta. */
  private async correoVisible(req: AdminRequest, id: number) {
    const tipos = await tiposVisibles(req);
    const r = await prisma.email_log.findUnique({
      where: { id },
      select: {
        id: true, kind: true, to_email: true, to_name: true, subject: true, state: true, detail: true,
        quote_id: true, provider_id: true, created_at: true,
      },
    });
    // Uno ajeno responde igual que uno que no existe: no se confirma qué hay.
    if (!r || (tipos && !tipos.includes(r.kind))) throw new NotFoundException('No encontramos ese correo.');
    return r;
  }

  /** El contenido, o null si no se guardó (o si falta la columna: sql/correo-contenido.sql). */
  private async contenido(id: number): Promise<string | null> {
    try {
      return (await prisma.email_log.findUnique({ where: { id }, select: { body_html: true } }))?.body_html ?? null;
    } catch {
      return null;
    }
  }

  /**
   * A quien le tocaria un recordatorio hoy. NO manda nada.
   *
   * Antes de escribirle a la red entera conviene ver a quien le toca y por
   * que, y eso no deberia requerir mandar nada.
   */
  @Get('recordatorios')
  verRecordatorios() {
    return this.reminders.enviar({ soloVer: true });
  }

  /** Manda los recordatorios de disponibilidad y papeles. */
  @Post('recordatorios')
  mandarRecordatorios() {
    return this.reminders.enviar();
  }

  /** ¿El servidor de correo contesta? Antes de encenderlo conviene saberlo. */
  @Get('probar')
  probar() {
    return this.mailer.probarConexion();
  }

  /**
   * Manda un correo de prueba a donde se le diga.
   *
   * A una dirección ESCRITA a mano y nunca a un cliente de la base: probar el
   * correo no puede ser la forma accidental de escribirle a alguien real.
   */
  @Post('prueba')
  async prueba(@Body() body: unknown) {
    const p = z.object({ to: z.string().email() }).safeParse(body);
    if (!p.success) throw new BadRequestException('Escribe un correo válido.');
    const plantilla = correoDePrueba(p.data.to);
    const estado = await this.mailer.enviar({
      kind: 'prueba',
      to: p.data.to,
      ...plantilla,
    });
    return {
      estado,
      mensaje:
        estado === 'enviado'
          ? 'Salió. Revisa la bandeja, y también la carpeta de no deseados.'
          : estado === 'simulado'
            ? 'No salió: el envío sigue apagado. Se registró como simulado para que veas el contenido.'
            : estado === 'omitido'
              ? 'No salió: la dirección no es válida.'
              : 'Falló. Revisa el detalle en el registro de abajo.',
    };
  }
}
