import { prisma } from '@maqserv/db';

/**
 * A QUÉ CLIENTE Y A QUÉ OBRA PERTENECE UNA SOLICITUD NUEVA.
 *
 * El respaldo ya se agrupó una vez (migrate/28), pero eso resuelve el pasado.
 * Si las solicitudes nuevas siguen entrando sueltas, en tres meses el módulo de
 * clientes vuelve a estar vacío y alguien tiene que reagrupar a mano — que es
 * exactamente el costo que el documento advierte en la sección 25.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. La identidad del cliente es la EMPRESA, y sólo el correo cuando no hay
 *    empresa. El nombre de la persona no sirve: dos residentes de la misma
 *    constructora crearían dos clientes, que es el problema al revés.
 *
 * 2. Ante la duda NO se inventa. Si la dirección no se parece a ninguna obra
 *    conocida, se crea una obra nueva en vez de meterla a la fuerza en la más
 *    cercana. Una obra de más la corrige el admin en diez segundos; una
 *    solicitud archivada en la obra equivocada envenena el historial y nadie
 *    se entera.
 *
 * 3. Esto NUNCA tumba la cotización. Si algo falla al resolver el cliente, la
 *    solicitud se guarda igual sin ligar: perder una cotización real por no
 *    poder clasificarla sería cambiar lo importante por lo ordenado.
 */

/** Compara ignorando acentos, mayúsculas, y la forma societaria. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?a\.?\s*de\s*c\.?v\.?|s\.?\s*de\s*r\.?l\.?|sapi|sc)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Nombre provisional de una obra deducida.
 *
 * Sale del PRIMER pedazo de la dirección —la calle o la colonia— y no del
 * municipio: los tres frentes de una constructora comparten municipio, así que
 * nombrarlos por ahí los deja llamándose igual, que es justo lo que las obras
 * vienen a evitar. Es un nombre para reconocer y corregir, no uno definitivo.
 */
export function nombrarObra(direccion: string | null, region?: string | null): string {
  const trozo = (direccion ?? '').split(',')[0].trim();
  if (trozo.length > 2 && !/^\d+$/.test(trozo)) return trozo.slice(0, 190);
  const segundo = (direccion ?? '').split(',')[1]?.trim();
  if (segundo && segundo.length > 2) return segundo.slice(0, 190);
  return (region || 'Obra').trim().slice(0, 190);
}

export interface DatosSolicitud {
  companyName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  address?: string | null;
  region?: string | null;
  userId?: number | null;
  /** Obra que el cliente eligió en el formulario. Si viene, manda sobre todo. */
  siteId?: number | null;
}

export interface Resuelto {
  clientId: number | null;
  siteId: number | null;
}

/**
 * Devuelve a qué cliente y obra pertenece, creándolos si hace falta.
 * Nunca lanza: ante cualquier problema devuelve nulls y la cotización sigue.
 */
export async function resolverClienteYObra(d: DatosSolicitud): Promise<Resuelto> {
  try {
    // Si el cliente eligió su obra, no hay nada que adivinar.
    if (d.siteId) {
      const obra = await prisma.client_sites.findUnique({
        where: { id: d.siteId },
        select: { id: true, client_id: true },
      });
      if (obra) return { clientId: obra.client_id, siteId: obra.id };
    }

    const empresa = (d.companyName ?? '').trim();
    const correo = (d.email ?? '').trim().toLowerCase();
    const claveEmpresa = normalizar(empresa);
    if (!claveEmpresa && !correo) return { clientId: null, siteId: null };

    // Buscar el cliente. Por empresa cuando la hay; si no, por correo.
    let cliente = claveEmpresa
      ? await prisma.clients.findFirst({
          where: { name: { equals: empresa, mode: 'insensitive' } },
          select: { id: true, user_id: true },
        })
      : await prisma.clients.findFirst({
          where: { email: { equals: correo, mode: 'insensitive' } },
          select: { id: true, user_id: true },
        });

    /**
     * La comparación de arriba es exacta salvo mayúsculas, así que "Constructora
     * del Norte SA de CV" y "Constructora del Norte" quedarían separadas. Se
     * hace una segunda pasada normalizada sobre los candidatos que empiezan
     * parecido, en vez de traerse la tabla entera.
     */
    if (!cliente && claveEmpresa) {
      const primeras = empresa.split(/\s+/).slice(0, 2).join(' ');
      const cercanos = await prisma.clients.findMany({
        where: { name: { startsWith: primeras, mode: 'insensitive' } },
        select: { id: true, name: true, user_id: true },
        take: 25,
      });
      const igual = cercanos.find((c) => normalizar(c.name) === claveEmpresa);
      if (igual) cliente = { id: igual.id, user_id: igual.user_id };
    }

    if (!cliente) {
      const creado = await prisma.clients.create({
        data: {
          name: (empresa || d.contactName || correo).slice(0, 190),
          user_id: d.userId ?? null,
          email: correo || null,
          phone: d.phone ?? null,
          industry: d.industry ?? null,
          notes: 'Creado automáticamente desde una solicitud.',
        },
        select: { id: true, user_id: true },
      });
      cliente = creado;
    } else if (cliente.user_id === null && d.userId) {
      // El cliente ya existía sin cuenta y ahora cotiza desde una: se enlazan,
      // que es lo que permite ofrecerle sus obras la próxima vez.
      await prisma.clients.update({ where: { id: cliente.id }, data: { user_id: d.userId } });
    }

    const direccion = (d.address ?? '').trim();
    if (!direccion) return { clientId: cliente.id, siteId: null };

    // ¿Ya conoce esa dirección? Se comparan normalizadas: "Av. Vasconcelos
    // 1500" y "av vasconcelos 1500" son la misma obra.
    const obras = await prisma.client_sites.findMany({
      where: { client_id: cliente.id },
      select: { id: true, address: true },
    });
    const clave = normalizar(direccion);
    const ya = obras.find((o) => normalizar(o.address) === clave);
    if (ya) return { clientId: cliente.id, siteId: ya.id };

    const nueva = await prisma.client_sites.create({
      data: {
        client_id: cliente.id,
        name: nombrarObra(direccion, d.region),
        address: direccion,
        municipality: d.region ?? null,
        contact_name: d.contactName ?? null,
        contact_phone: d.phone ?? null,
        notes: 'Obra deducida de una solicitud. Conviene revisar el nombre.',
      },
      select: { id: true },
    });
    return { clientId: cliente.id, siteId: nueva.id };
  } catch {
    // Ver decisión 3: clasificar es deseable, guardar la cotización es
    // obligatorio.
    return { clientId: null, siteId: null };
  }
}
