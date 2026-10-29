import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { kmCarretera } from '@maqserv/config';
import { MailerService } from './mailer.service';
import { correoHoraDeSalir, correoRecordatorioServicio } from './email-templates';
import { lista } from '../common/json-list';
import { avisarPanel } from './panel';
import { obraDe } from '../quotes/rastreo';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';

/** Para estimar el camino: una cama baja con equipo en tráfico de ciudad (la misma del tablero "En camino"). */
const VELOCIDAD_KMH = 35;
/** Cargar la máquina y arrancar. */
const MARGEN_MIN = 15;
/** Sin ubicación del patio o de la obra se supone una hora de camino. */
const CAMINO_SIN_DATOS_MIN = 60;
/** El aviso llega este tiempo antes de la hora de salida, para alcanzar a prepararse. */
const ANTICIPO_MIN = 30;
/** Pasado este tiempo de la hora de salida sin marcarla, se pregunta y se avisa al panel. */
const TOLERANCIA_MIN = 20;
/** Cada cuánto se revisa mientras la API está despierta. */
const CADA_MS = 5 * 60_000;

const MIN = 60_000;
const ZONA = 'America/Monterrey';
const HORA = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: ZONA });
const FECHA_HORA = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: ZONA });
/** "2026-10-16" en la hora de Monterrey. */
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const HORA_24 = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' });
/** A esta hora (Monterrey) del día anterior sale el recordatorio. */
const HORA_RECORDATORIO = 18;
const SITIO = process.env.SITE_URL ?? 'https://maqser24.com';

/**
 * AVISO DE HORA DE SALIDA (2026-10-15).
 *
 * "Debe avisar cuándo es la hora de salida para marcar en tránsito." El
 * aliado promete una hora de llegada al aceptar; con la distancia de su patio
 * a la obra se calcula a qué hora debe salir, y:
 *
 *   1. 30 min antes de esa hora le llega "Ya casi es hora de salir", con el
 *      botón a su portal para marcar "Ya salió la unidad".
 *   2. Si 20 min después de esa hora sigue sin marcarla, le llega "¿Ya salió
 *      la unidad?" y suena la campana del panel para que alguien le llame.
 *
 * Solo para servicios ASIGNADOS con hora comprometida: en cuanto marca la
 * salida el servicio pasa a traslado y aquí ya no aparece. Cada aviso sale
 * una vez por servicio y aliado (el registro de correos es la constancia).
 *
 * CUÁNDO CORRE: en producción la API vive en cPanel (Passenger) y se duerme
 * sin visitas, así que un reloj interno no basta. El reloj de aquí cubre
 * mientras está despierta, y el cron "Avisos de salida" de GitHub la despierta
 * cada 15 min y llama POST /tareas/salidas.
 */
@Injectable()
export class AvisoSalidaService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('AvisoSalida');
  private reloj: ReturnType<typeof setInterval> | null = null;
  private corriendo = false;

  constructor(private readonly mailer: MailerService) {}

  onModuleInit() {
    this.reloj = setInterval(() => void this.revisar().catch((e) => this.log.warn((e as Error).message)), CADA_MS);
    this.reloj.unref?.();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  async revisar(ahora: Date = new Date()) {
    const resultado = { revisados: 0, avisos: 0, tarde: 0, recordatorios: 0 };
    if (this.corriendo) return resultado; // el reloj y el cron pueden coincidir
    this.corriendo = true;
    try {
      const asignaciones = await prisma.service_assignments.findMany({
        where: {
          state: 'aceptado',
          // Las que llegan dentro de las próximas 36 h (el recordatorio de un día
          // antes) o debieron llegar hace poco (el aviso de "¿ya salió?").
          committed_at: { gte: new Date(ahora.getTime() - 12 * 60 * MIN), lte: new Date(ahora.getTime() + 36 * 60 * MIN) },
          quotes: { service_state: 'asignado' },
        },
        select: {
          provider_id: true,
          committed_at: true,
          providers: { select: { id: true, name: true, contact_name: true, email: true, lat: true, lng: true, access_version: true } },
          quotes: {
            select: {
              id: true, quote_number: true, address: true, region: true, requirements: true, name: true, email: true,
              client_sites: { select: { name: true, address: true, municipality: true, state: true, lat: true, lng: true, requirements: true } },
            },
          },
        },
      });

      for (const a of asignaciones) {
        resultado.revisados += 1;
        const llegada = a.committed_at as Date;
        const q = a.quotes;
        const p = a.providers;
        const obra = obraDe(q);
        const base = p.lat != null && p.lng != null ? { lat: Number(p.lat), lng: Number(p.lng) } : null;
        const camino = base && obra ? Math.max(10, Math.round((kmCarretera(base, obra) / VELOCIDAD_KMH) * 60)) : null;
        const salida = new Date(llegada.getTime() - ((camino ?? CAMINO_SIN_DATOS_MIN) + MARGEN_MIN) * MIN);

        // ── Un día antes, desde las 6 pm: "mañana es el servicio", al cliente y al aliado ──
        const manana = DIA.format(new Date(ahora.getTime() + 24 * 60 * MIN));
        if (DIA.format(llegada) === manana && Number(HORA_24.format(ahora)) >= HORA_RECORDATORIO) {
          resultado.recordatorios += await this.recordarDiaAntes(a, obra, llegada);
        }

        // Lo de la hora de salida solo el día del servicio.
        if (ahora.getTime() < llegada.getTime() - 12 * 60 * MIN) continue;
        const tarde = ahora.getTime() >= salida.getTime() + TOLERANCIA_MIN * MIN;
        const toca = ahora.getTime() >= salida.getTime() - ANTICIPO_MIN * MIN;
        if (!toca) continue;
        // Ya de salida tarde: solo el segundo aviso (el primero ya no sirve de nada).
        const kind = tarde ? 'provider_departure_late' : 'provider_departure';
        // El primero no se manda si ya pasó la hora de llegada: para eso está el segundo.
        if (!tarde && ahora.getTime() >= llegada.getTime()) continue;

        const yaSalio = await prisma.email_log.findFirst({
          where: { kind, quote_id: q.id, provider_id: p.id },
          select: { id: true },
        });
        if (yaSalio) continue;

        const datos = {
          contacto: p.contact_name,
          folio: q.quote_number,
          obra: obra?.nombre ?? null,
          direccion: obra?.direccion ?? q.address,
          llegada: HORA.format(llegada),
          salida: HORA.format(salida),
          minutos: camino,
          tarde,
        };

        if (p.email) {
          const url = urlDeAcceso(await firmarAcceso(p.id, p.access_version ?? 1));
          await this.mailer.enviar({
            kind,
            to: p.email,
            toName: p.contact_name ?? p.name,
            quoteId: Number(q.id),
            providerId: p.id,
            ...(await correoHoraDeSalir({ ...datos, url })),
          });
        }

        if (tarde) {
          resultado.tarde += 1;
          await avisarPanel({
            modulo: 'servicios',
            evento: 'avance',
            titulo: `${p.name} no ha marcado la salida · ${q.quote_number}`,
            cuerpo: `Debía salir a las ${datos.salida} para llegar a las ${datos.llegada}${obra?.nombre ? ` a ${obra.nombre}` : ''}. Llámale.`,
            link: '/servicios',
          });
        } else {
          resultado.avisos += 1;
          // Sin correo el aliado no se entera solo: que alguien le llame a tiempo.
          if (!p.email) {
            await avisarPanel({
              modulo: 'servicios',
              evento: 'avance',
              titulo: `Avísale a ${p.name} que salga a las ${datos.salida} · ${q.quote_number}`,
              cuerpo: 'No tiene correo registrado: el aviso de salida no le llegó.',
              link: '/servicios',
            });
          }
        }
        // Sin correo no queda constancia en el registro: se deja una para no repetir el aviso.
        if (!p.email) {
          await prisma.email_log.create({
            data: { kind, to_email: '', subject: `Aviso por el panel · ${q.quote_number}`, state: 'omitido', detail: 'El aliado no tiene correo', quote_id: q.id, provider_id: p.id },
          });
        }
      }
      return resultado;
    } finally {
      this.corriendo = false;
    }
  }

  /** El recordatorio de un día antes. Una vez por servicio y destinatario. Devuelve cuántos salieron. */
  private async recordarDiaAntes(
    a: { committed_at: Date | null; providers: { id: number; name: string; contact_name: string | null; email: string | null; access_version: number | null }; quotes: { id: bigint; quote_number: string; address: string | null; name: string; email: string; client_sites: { requirements: unknown } | null } },
    obra: ReturnType<typeof obraDe>,
    llegada: Date,
  ): Promise<number> {
    const q = a.quotes;
    const p = a.providers;
    let n = 0;
    const comun = { folio: q.quote_number, llegada: FECHA_HORA.format(llegada), aliado: p.name, obra: obra?.nombre ?? null, direccion: obra?.direccion ?? q.address };

    const yaCliente = await prisma.email_log.findFirst({ where: { kind: 'service_day_before', quote_id: q.id }, select: { id: true } });
    if (!yaCliente && q.email?.trim()) {
      await this.mailer.enviar({
        kind: 'service_day_before',
        to: q.email,
        toName: q.name,
        quoteId: Number(q.id),
        ...correoRecordatorioServicio({ ...comun, para: 'cliente', nombre: q.name, url: `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(q.quote_number)}` }),
      });
      n += 1;
    }

    const yaAliado = await prisma.email_log.findFirst({ where: { kind: 'provider_day_before', quote_id: q.id, provider_id: p.id }, select: { id: true } });
    if (!yaAliado && p.email) {
      const url = urlDeAcceso(await firmarAcceso(p.id, p.access_version ?? 1));
      await this.mailer.enviar({
        kind: 'provider_day_before',
        to: p.email,
        toName: p.contact_name ?? p.name,
        quoteId: Number(q.id),
        providerId: p.id,
        ...correoRecordatorioServicio({ ...comun, para: 'aliado', nombre: p.contact_name, requisitos: lista(q.client_sites?.requirements), url }),
      });
      n += 1;
    }
    return n;
  }
}
