import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { SignJWT, jwtVerify } from 'jose';

/**
 * EL OPERADOR DE LA UNIDAD (2026-10-15).
 *
 * "El proveedor no es el que comparte la ubicación, sino el operador." Quien
 * maneja la cama baja o la máquina no es la empresa aliada: es una persona
 * con su teléfono. Darle el enlace del aliado le abriría todo (ofertas con
 * precios, papeles, otros servicios), así que tiene el SUYO: firmado para UN
 * servicio, con lo que necesita para llegar y los botones para ir avisando.
 *
 * Se guarda en la solicitud (\`requirements.operadorAsignado\`: nombre, teléfono
 * y una versión). Cambiar de operador o volver a mandar el enlace sube la
 * versión: el enlace anterior deja de servir. Al cerrar o cancelar el servicio,
 * tampoco. NO va en \`requirements.operador\`: ahí el formulario de /cotizar
 * guarda si el cliente pidió el equipo con operador ("Sí"/"No"), y pisarlo
 * borraba esa respuesta del pedido que ve el aliado.
 */

const DIAS_VIGENCIA = 15;
const EMISOR = 'maqser24/operador';
/** Un servicio en estos estados ya no tiene nada que hacer el operador. */
const TERMINADOS = new Set(['cerrado', 'cancelado']);

function llave(): Uint8Array {
  const s = process.env.PROVIDER_LINK_SECRET ?? process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('Falta PROVIDER_LINK_SECRET (o JWT_SECRET) para firmar el enlace del operador.');
  return new TextEncoder().encode(s);
}

export interface DatosOperador {
  nombre: string;
  telefono: string | null;
  v: number;
}

export function operadorDe(requirements: unknown): DatosOperador | null {
  const o = (requirements as { operadorAsignado?: Partial<DatosOperador> } | null)?.operadorAsignado;
  if (!o || typeof o.nombre !== 'string' || !o.nombre.trim()) return null;
  return { nombre: o.nombre.trim(), telefono: typeof o.telefono === 'string' && o.telefono.trim() ? o.telefono.trim() : null, v: Number(o.v) || 1 };
}

export async function firmarOperador(quoteId: number, version: number): Promise<string> {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(EMISOR)
    .setSubject(String(quoteId))
    .setIssuedAt()
    .setExpirationTime(`${DIAS_VIGENCIA}d`)
    .sign(llave());
}

export async function validarOperador(token: string | null | undefined): Promise<{ quoteId: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, llave(), { issuer: EMISOR, algorithms: ['HS256'] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) return null;
    const q = await prisma.quotes.findUnique({ where: { id: BigInt(id) }, select: { requirements: true, service_state: true } });
    if (!q || !q.service_state || TERMINADOS.has(q.service_state)) return null;
    // La versión revoca los enlaces anteriores (cambio de operador o reenvío).
    if (operadorDe(q.requirements)?.v !== payload.v) return null;
    // El aliado que tomó el servicio tiene que seguir activo (auditoría
    // 2026-10-23): dar de baja a un aliado corta también el enlace de su
    // operador, que si no seguía 15 días viendo la obra y el contacto.
    const aliadoActivo = await prisma.service_assignments.count({
      where: { quote_id: BigInt(id), state: 'aceptado', providers: { status: 1 } },
    });
    if (!aliadoActivo) return null;
    return { quoteId: id };
  } catch {
    return null;
  }
}

export function urlDeOperador(token: string): string {
  const base = process.env.SITE_URL ?? 'https://maqser24.com';
  return `${base}/operador?t=${encodeURIComponent(token)}`;
}

/** wa.me con el número en formato internacional (México: 52 + 10 dígitos). */
export function whatsappDe(telefono: string | null, texto: string): string | null {
  const d = (telefono ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  const n = d.length === 10 ? `52${d}` : d.startsWith('521') && d.length === 13 ? `52${d.slice(3)}` : d;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/**
 * Pone (o cambia) al operador del servicio y le arma su enlace. Cada llamada
 * sube la versión: el enlace que se mande ahora es el único que sirve.
 */
export async function asignarOperador(quoteId: number, datos: { nombre: string; telefono: string | null }) {
  const q = await prisma.quotes.findUnique({ where: { id: BigInt(quoteId) }, select: { quote_number: true, requirements: true } });
  if (!q) throw new Error('Servicio no encontrado');
  const req = (q.requirements ?? {}) as Record<string, unknown>;
  const operador: DatosOperador = { nombre: datos.nombre.trim(), telefono: datos.telefono?.trim() || null, v: (operadorDe(req)?.v ?? 0) + 1 };
  await prisma.quotes.update({
    where: { id: BigInt(quoteId) },
    data: { requirements: { ...req, operadorAsignado: operador } as unknown as Prisma.InputJsonValue, updated_at: new Date() },
  });
  const url = urlDeOperador(await firmarOperador(quoteId, operador.v));
  const whatsapp = whatsappDe(
    operador.telefono,
    `Hola ${operador.nombre}, este es tu enlace del servicio ${q.quote_number} de MAQSER24: ${url}\n\nÁbrelo en tu celular: ahí está la dirección de la obra y los botones para avisar cuando salgas y llegues. Mientras vas en camino, deja la página abierta para compartir tu ubicación.`,
  );
  return { url, whatsapp, operador: { nombre: operador.nombre, telefono: operador.telefono } };
}

export interface OperadorRequest {
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  quoteId: number;
}

/** Guard del enlace del operador: token por cabecera (desde el sitio) o por query (primera carga). */
@Injectable()
export class OperadorGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<OperadorRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.query?.t;
    const acceso = await validarOperador(token);
    if (!acceso) throw new UnauthorizedException('Este enlace ya no sirve. Pídele uno nuevo a tu empresa.');
    req.quoteId = acceso.quoteId;
    return true;
  }
}
