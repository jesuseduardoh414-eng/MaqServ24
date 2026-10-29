import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { DIAS_AVISO, DOC_LABEL, papelesQueFaltan } from '../catalog/provider-trust';
import { documentosQueAvisan, textoAviso } from '../catalog/document-alerts';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { MailerService } from './mailer.service';
import { correoRecordatorioAliado } from './email-templates';

/**
 * RECORDATORIOS AUTOMÁTICOS (documento institucional, sección 18).
 *
 * "Recordatorios automáticos para confirmar disponibilidad."
 *
 * SOLO PAPELES (2026-10-26). Antes también le pedía al aliado confirmar sus
 * equipos cada 14 días. El dueño lo quitó: la confirmación de verdad es cuando
 * el aliado acepta o rechaza un servicio, y el mantenimiento lo marca él desde
 * su portal. Queda el aviso de los papeles por vencer o que faltan.
 *
 * CUATRO DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. UN correo, no dos. Si al mismo aliado hay que pedirle que confirme tres
 *    máquinas Y avisarle que se le vence una póliza, va todo junto. Dos correos
 *    el mismo día por cosas del mismo expediente enseñan a archivar sin leer.
 *
 * 2. No se le escribe más de una vez cada `DIAS_ENTRE_AVISOS`. Sin ese freno,
 *    cada corrida volvería a escribirle a los mismos, y un aliado que recibe el
 *    mismo correo cinco veces deja de leer los correos — incluidos los que sí
 *    importan.
 *
 * 3. El correo trae su ENLACE, no una instrucción. "Entra al portal y busca tus
 *    equipos" es una tarea; un botón que abre directo lo suyo es un clic. La
 *    diferencia entre las dos es si el recordatorio sirve o no.
 *
 * 4. Se puede correr en seco. Antes de mandarle correo a la red entera conviene
 *    ver a quién le tocaría y por qué, y eso no debería requerir mandar nada.
 */

/** Días mínimos entre dos recordatorios al mismo aliado. */
export const DIAS_ENTRE_AVISOS = 7;

export interface CandidatoRecordatorio {
  providerId: number;
  name: string;
  email: string | null;
  contactName: string | null;
  /** Papeles suyos por vencer o vencidos. */
  documentos: Array<{ texto: string; nombre: string }>;
  /** Por qué se le escribe, o por qué no. */
  motivo: string;
  seLeEscribe: boolean;
}

@Injectable()
export class RemindersService {
  private readonly log = new Logger(RemindersService.name);

  constructor(private readonly mailer: MailerService) {}

  /** A quién le tocaría un recordatorio hoy y por qué. */
  async candidatos(hoy: Date = new Date()): Promise<CandidatoRecordatorio[]> {
    const limiteAviso = new Date(hoy.getTime() + DIAS_AVISO * 86400000);
    const desdeUltimo = new Date(hoy.getTime() - DIAS_ENTRE_AVISOS * 86400000);

    const aliados = await prisma.providers.findMany({
      where: { status: 1 },
      include: {
        provider_documents: { select: { id: true, kind: true, name: true, expires_at: true } },
      },
    });
    if (aliados.length === 0) return [];

    return aliados
      .map((a) => {
        const avisos = [
          ...documentosQueAvisan(a.provider_documents, hoy).map((d) => ({
            texto: textoAviso(d),
            nombre: d.name || d.kind,
          })),
          // Los obligatorios que nunca subió (2026-10-22, Fase B): sin ellos no
          // tiene sello y no se le pedían. Los vencidos ya van arriba.
          ...papelesQueFaltan(a.provider_documents, hoy)
            .filter((k) => !a.provider_documents.some((d) => d.kind === k))
            .map((k) => ({ texto: 'Falta', nombre: DOC_LABEL[k] })),
        ];

        const hayQueDecirle = avisos.length > 0;
        const reciente = a.reminder_sent_at !== null && a.reminder_sent_at > desdeUltimo;

        let motivo: string;
        let seLeEscribe: boolean;
        if (!hayQueDecirle) {
          motivo = 'Sus papeles están al día.';
          seLeEscribe = false;
        } else if (!a.email?.trim()) {
          // Se dice, no se calla: un aliado sin correo es un dato a corregir,
          // no una fila que desaparece de la lista.
          motivo = 'Habría que avisarle, pero no tiene correo registrado.';
          seLeEscribe = false;
        } else if (reciente) {
          motivo = `Ya se le escribió hace menos de ${DIAS_ENTRE_AVISOS} días.`;
          seLeEscribe = false;
        } else {
          motivo = `${avisos.length} papel(es) por atender`;
          seLeEscribe = true;
        }

        return {
          providerId: a.id,
          name: a.name,
          email: a.email,
          contactName: a.contact_name,
          documentos: avisos,
          motivo,
          seLeEscribe,
        };
      })
      .sort((x, y) => {
        // Primero los que sí reciben, y dentro de esos, los que más deben.
        if (x.seLeEscribe !== y.seLeEscribe) return x.seLeEscribe ? -1 : 1;
        return y.documentos.length - x.documentos.length;
      });
  }

  /**
   * Manda los recordatorios. Con `soloVer` no manda nada: devuelve a quién le
   * tocaría, que es lo que hace falta antes de escribirle a la red entera.
   */
  async enviar(opts: { soloVer?: boolean } = {}) {
    const hoy = new Date();
    const todos = await this.candidatos(hoy);
    const tocan = todos.filter((c) => c.seLeEscribe);

    if (opts.soloVer) {
      return {
        soloVer: true,
        alcanzados: tocan.length,
        omitidos: todos.length - tocan.length,
        candidatos: todos,
        mensaje:
          tocan.length === 0
            ? 'Nadie necesita recordatorio hoy.'
            : `Se le escribiría a ${tocan.length} aliado(s). Nada se ha mandado todavía.`,
      };
    }

    let enviados = 0;
    let fallidos = 0;

    for (const c of tocan) {
      // El enlace va DENTRO del correo: "entra al portal y busca tus equipos"
      // es una tarea; un botón que abre lo suyo es un clic.
      const p = await prisma.providers.findUnique({
        where: { id: c.providerId },
        select: { access_version: true },
      });
      const url = urlDeAcceso(await firmarAcceso(c.providerId, p?.access_version ?? 1));

      const plantilla = correoRecordatorioAliado({
        aliado: c.name,
        contacto: c.contactName,
        url,
        documentos: c.documentos,
      });

      const estado = await this.mailer.enviar({
        kind: 'availability_reminder',
        to: c.email!,
        toName: c.contactName,
        providerId: c.providerId,
        ...plantilla,
      });

      if (estado === 'enviado') enviados++;
      else if (estado === 'fallido') fallidos++;

      /**
       * Se marca aunque el correo no haya salido de verdad.
       *
       * Con el envío apagado, no marcarlo haría que cada corrida repitiera los
       * mismos y el registro se llenara de simulados idénticos. Lo que importa
       * es que ya se intentó; si falló, el registro de correo lo dice y desde
       * ahí se decide.
       */
      await prisma.providers.update({
        where: { id: c.providerId },
        data: { reminder_sent_at: hoy },
      });
    }

    this.log.log(`Recordatorios: ${enviados} enviados, ${fallidos} fallidos, ${tocan.length} en total`);

    return {
      soloVer: false,
      alcanzados: tocan.length,
      enviados,
      fallidos,
      omitidos: todos.length - tocan.length,
      mensaje:
        tocan.length === 0
          ? 'Nadie necesitaba recordatorio hoy.'
          : this.mailer.habilitado
            ? `Se le escribió a ${tocan.length} aliado(s): ${enviados} salieron y ${fallidos} fallaron.`
            : `Se prepararon ${tocan.length} recordatorio(s), pero el envío está apagado: quedaron registrados como simulados.`,
    };
  }
}
