import { prisma } from '@maqserv/db';
import { centroDeMunicipio } from '@maqserv/config';

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

type Ref = { id: number; user_id: number | null };

/**
 * ¿Se puede ligar a esta cuenta un cliente que existía sin cuenta?
 *
 * Solo si el correo del cliente es el de la cuenta (auditoría 2026-10-23).
 * Antes bastaba con escribir el NOMBRE de la empresa en una solicitud: quien
 * pusiera "Constructora Real" se quedaba con ese cliente del panel y veía sus
 * obras, con dirección y teléfono del residente. El correo de la cuenta sí está
 * comprobado (no se entra sin confirmarlo, o lo acreditó Google). Si no
 * coincide, la solicitud se archiva igual bajo esa empresa, sin ligarla.
 */
async function puedeLigar(clientId: number, userId: number): Promise<boolean> {
  const [c, u] = await Promise.all([
    prisma.clients.findUnique({ where: { id: clientId }, select: { email: true, user_id: true } }),
    prisma.users.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  if (!c || !u || c.user_id !== null) return false;
  const correo = (c.email ?? '').trim().toLowerCase();
  return correo !== '' && correo === u.email.trim().toLowerCase();
}

/**
 * El cliente con ese nombre de empresa. La comparación exacta es salvo
 * mayúsculas, así que "Constructora del Norte SA de CV" y "Constructora del
 * Norte" quedarían separadas: se hace una segunda pasada normalizada sobre los
 * candidatos que empiezan parecido, en vez de traerse la tabla entera.
 */
async function porEmpresa(empresa: string, clave: string): Promise<Ref | null> {
  const exacto = await prisma.clients.findFirst({
    where: { name: { equals: empresa } },
    select: { id: true, user_id: true },
  });
  if (exacto) return exacto;
  const primeras = empresa.split(/\s+/).slice(0, 2).join(' ');
  const cercanos = await prisma.clients.findMany({
    where: { name: { startsWith: primeras } },
    select: { id: true, name: true, user_id: true },
    take: 25,
  });
  const igual = cercanos.find((c) => normalizar(c.name) === clave);
  return igual ? { id: igual.id, user_id: igual.user_id } : null;
}

/**
 * EL CLIENTE DE UNA CUENTA DEL SITIO (2026-10-15).
 *
 * Quien se registra también es cliente, aunque todavía no pida nada: el panel
 * lo ve en Clientes y obras desde que confirma su correo. Al registrarse sólo
 * da su nombre, así que el cliente nace con el nombre de la PERSONA; cuando
 * cotiza con el de su empresa, `deLaCuenta` lo corrige.
 *
 * Si antes pidió algo sin cuenta con ese mismo correo, se liga ese cliente en
 * vez de crear otro. Nunca lanza.
 */
export async function clienteDeCuenta(userId: number): Promise<number | null> {
  try {
    const ya = await prisma.clients.findFirst({ where: { user_id: userId }, select: { id: true } });
    if (ya) return ya.id;
    const u = await prisma.users.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } });
    if (!u) return null;
    const correo = u.email.trim().toLowerCase();
    const sinCuenta = await prisma.clients.findFirst({ where: { email: { equals: correo }, user_id: null }, select: { id: true } });
    if (sinCuenta) {
      await prisma.clients.update({ where: { id: sinCuenta.id }, data: { user_id: userId, updated_at: new Date() } });
      return sinCuenta.id;
    }
    const nuevo = await prisma.clients.create({
      data: {
        name: (u.name.trim() || correo).slice(0, 190),
        user_id: userId,
        email: correo,
        phone: u.phone?.trim() || null,
        notes: 'Se registró en el sitio.',
      },
      select: { id: true },
    });
    return nuevo.id;
  } catch {
    return null;
  }
}

/**
 * El cliente de la cuenta que está pidiendo.
 *
 * Sin empresa, o con la misma que ya tiene: ese. Con OTRA empresa, sólo se
 * toca el cliente si sigue siendo el de la cuenta recién creada (el nombre de
 * la persona, sin solicitudes ni obras): ahora se sabe cómo se llama de verdad,
 * así que se renombra, o se junta con esa empresa si ya existía. Un cliente con
 * historia no se renombra nunca: esa cuenta pide para otra empresa, y esa va
 * aparte como siempre.
 */
async function deLaCuenta(userId: number, empresa: string, clave: string): Promise<Ref | null> {
  const suyos = await prisma.clients.findMany({
    where: { user_id: userId },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, user_id: true },
  });
  if (suyos.length === 0) return null;
  if (!clave) return suyos[0];
  const mismo = suyos.find((c) => normalizar(c.name) === clave);
  if (mismo) return mismo;

  const u = await prisma.users.findUnique({ where: { id: userId }, select: { name: true } });
  let provisional: Ref | null = null;
  for (const c of suyos) {
    if (!u || normalizar(c.name) !== normalizar(u.name)) continue;
    const [pedidos, obras] = await Promise.all([
      prisma.quotes.count({ where: { client_id: c.id } }),
      prisma.client_sites.count({ where: { client_id: c.id } }),
    ]);
    if (pedidos === 0 && obras === 0) { provisional = c; break; }
  }
  if (!provisional) return null;

  const existente = await porEmpresa(empresa, clave);
  if (existente && existente.id !== provisional.id) {
    // La empresa ya estaba: el de la cuenta no tenía nada, se va.
    await prisma.clients.deleteMany({ where: { id: provisional.id } });
    if (await puedeLigar(existente.id, userId)) {
      await prisma.clients.update({ where: { id: existente.id }, data: { user_id: userId } });
      return { ...existente, user_id: userId };
    }
    return existente;
  }
  await prisma.clients.update({
    where: { id: provisional.id },
    data: { name: empresa.slice(0, 190), notes: 'Se registró en el sitio; la empresa salió de su primera solicitud.', updated_at: new Date() },
  });
  return provisional;
}

/**
 * Devuelve a qué cliente y obra pertenece, creándolos si hace falta.
 * Nunca lanza: ante cualquier problema devuelve nulls y la cotización sigue.
 */
export async function resolverClienteYObra(d: DatosSolicitud): Promise<Resuelto> {
  try {
    // Si el cliente eligió su obra, no hay nada que adivinar. Tiene que ser
    // SUYA (auditoría 2026-10-23): los id son consecutivos, y con uno ajeno la
    // solicitud quedaba dentro del cliente y la obra de otro. Si no lo es, se
    // ignora y se resuelve como si no hubiera elegido.
    if (d.siteId && d.userId) {
      const obra = await prisma.client_sites.findFirst({
        where: { id: d.siteId, clients: { user_id: d.userId } },
        select: { id: true, client_id: true },
      });
      if (obra) return { clientId: obra.client_id, siteId: obra.id };
    }

    const empresa = (d.companyName ?? '').trim();
    const correo = (d.email ?? '').trim().toLowerCase();
    const claveEmpresa = normalizar(empresa);

    // Quien tiene cuenta ya tiene cliente desde que la confirmó (ver
    // `clienteDeCuenta`): se parte de ese antes que de adivinar por el nombre.
    let cliente = d.userId ? await deLaCuenta(d.userId, empresa, claveEmpresa) : null;
    if (!cliente && !claveEmpresa && !correo) return { clientId: null, siteId: null };

    // Buscar el cliente. Por empresa cuando la hay; si no, por correo.
    if (!cliente) {
      cliente = claveEmpresa
        ? await porEmpresa(empresa, claveEmpresa)
        : await prisma.clients.findFirst({
            where: { email: { equals: correo } },
            select: { id: true, user_id: true },
          });
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
    } else if (cliente.user_id === null && d.userId && (await puedeLigar(cliente.id, d.userId))) {
      // El cliente ya existía sin cuenta y ahora cotiza desde una con SU
      // correo: se enlazan, que es lo que permite ofrecerle sus obras la
      // próxima vez. Con otro correo no (ver `puedeLigar`).
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
        // El municipio REAL, si se reconoce (2026-10-15): `region` en el formulario
        // es el ESTADO, y guardarlo como municipio dejaba la obra sin mapa.
        municipality: [d.region, direccion]
          .flatMap((t) => (t ?? '').split(',').map((p) => p.trim()).filter(Boolean).reverse())
          .map((p) => centroDeMunicipio(p)?.nombre)
          .find(Boolean) ?? null,
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
