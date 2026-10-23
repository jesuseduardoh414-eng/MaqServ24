import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { avisarPanel } from '../notifications/panel';
import { prisma } from '@maqserv/db';
import { CRM_ACTIVO, productSlug, slugify, problemaEmail, problemaTelefono, ESTADO_SOLICITUD_PROVEEDOR, OFERTAS_PROVEEDOR, TIPOS_PROVEEDOR } from '@maqserv/config';
import type {
  BlogCard,
  BlogDetail,
  FaqItem,
  HomeHero,
  SiteReview,
  StrategicSector,
  StrategicSectorDetail,
  WhyChooseUsItem,
} from '@maqserv/types';
import { imageUrl, normLegacyText } from '../catalog/images';
import { sanitizeRichHtml, sanitizeUserHtml } from '../common/sanitize';
import { nombreCorto } from '../common/nombre-corto';
import { PerfexService } from '../integrations/integrations.module';
import { MailerService } from '../notifications/mailer.service';
import { correoAcuseContacto, correoAcuseProveedor, correoContactoInterno, correoSolicitudProveedorInterno } from '../notifications/email-templates';
import { ubicarAliado } from '../providers/cobertura-aliado';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tiempo de lectura estimado a partir del contenido (~200 palabras/min). */
function readTimeOf(html: string): string {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} MIN`;
}

/**
 * Extracto limpio: quita el título si el contenido empieza repitiéndolo y
 * corta en límite de palabra con puntos suspensivos (evita "…recursos má").
 */
function excerptOf(html: string, title: string): string {
  let text = stripHtml(html);
  const t = (title ?? '').trim();
  if (t && text.toLowerCase().startsWith(t.toLowerCase())) {
    text = text.slice(t.length).replace(/^[\s:–—-]+/, '').trim();
  }
  if (text.length > 180) {
    const cut = text.slice(0, 180);
    const sp = cut.lastIndexOf(' ');
    text = `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}…`;
  }
  return text;
}

/** Quita un encabezado inicial (h1–h3) que repita el título del artículo. */
function stripLeadingTitleHeading(html: string, title: string): string {
  const t = (title ?? '').trim().toLowerCase();
  if (!t) return html;
  return html.replace(/^\s*(?:<p>\s*)?<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>\s*(?:<\/p>)?/i, (m, inner) => {
    const clean = String(inner).replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return clean === t ? '' : m;
  });
}

@Injectable()
export class ContentService {
  constructor(
    private readonly perfex: PerfexService,
    private readonly mailer: MailerService,
  ) {}

  async hero(): Promise<HomeHero | null> {
    const h = await prisma.hero_sections.findFirst({ orderBy: { id: 'desc' } });
    if (!h) return null;
    return {
      badge: h.badge,
      title: h.title,
      subtitle: h.subtitle,
      feature1: h.feature1,
      feature2: h.feature2,
      image: imageUrl(h.image),
    };
  }

  async sectors(): Promise<StrategicSector[]> {
    const rows = await prisma.strategic_sectors.findMany({
      where: { status: 1 },
      orderBy: { id: 'asc' },
    });
    return rows.map((s) => ({
      id: Number(s.id), // BigInt legacy → number
      slug: productSlug(s.title, Number(s.id)),
      title: s.title,
      description: s.description ? stripHtml(s.description).slice(0, 200) : null,
      image: imageUrl(s.image),
    }));
  }

  async sectorById(id: number): Promise<StrategicSectorDetail> {
    const s = await prisma.strategic_sectors.findFirst({ where: { id, status: 1 } });
    if (!s) throw new NotFoundException(`Sector ${id} no encontrado`);
    let serviciosLista: string[] = [];
    if (s.servicios_lista) {
      // legacy: JSON array o texto separado por saltos de línea
      try {
        const parsed = JSON.parse(s.servicios_lista);
        if (Array.isArray(parsed)) serviciosLista = parsed.map(String);
      } catch {
        serviciosLista = s.servicios_lista.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      }
    }
    return {
      id: Number(s.id),
      slug: productSlug(s.title, Number(s.id)),
      title: s.title,
      // El sitio pinta estos campos como HTML: se limpian al servir (auditoría
      // 2026-10-23), así cubre también lo guardado antes.
      description: sanitizeRichHtml(s.description),
      image: imageUrl(s.image),
      trayectoria: sanitizeRichHtml(s.trayectoria),
      esencia: sanitizeRichHtml(s.esencia),
      servicios: sanitizeRichHtml(s.servicios),
      excelencia: sanitizeRichHtml(s.excelencia),
      serviciosLista,
    };
  }

  async whyChooseUs(): Promise<WhyChooseUsItem[]> {
    const rows = await prisma.why_choose_us.findMany({
      where: { status: true },
      orderBy: { order: 'asc' },
    });
    return rows.map((w) => ({
      id: Number(w.id),
      title: w.title,
      description: stripHtml(w.description),
      icon: w.icon,
      photo: imageUrl(w.photo),
      placement: (w.placement === 'home' || w.placement === 'about' ? w.placement : 'both') as 'both' | 'home' | 'about',
    }));
  }

  private toBlogCard(b: {
    id: number; title: string; details: string; photo: string | null;
    created_at: Date | null; category?: string | null; source?: string | null; views?: number;
  }): BlogCard {
    return {
      id: b.id,
      slug: productSlug(b.title, b.id),
      title: b.title,
      excerpt: excerptOf(b.details, b.title),
      image: imageUrl(b.photo),
      date: b.created_at ? b.created_at.toISOString() : null,
      category: (b.category && b.category.trim()) || 'General',
      author: b.source && b.source.trim() ? b.source.trim() : null,
      readTime: readTimeOf(b.details),
      views: b.views ?? 0,
    };
  }

  async blogs(limit = 3): Promise<BlogCard[]> {
    const rows = await prisma.blogs.findMany({
      where: { status: 1 },
      orderBy: { id: 'desc' },
      take: Math.min(limit, 60),
    });
    return rows.map((b) => this.toBlogCard(b));
  }

  async blogById(id: number): Promise<BlogDetail> {
    const b = await prisma.blogs.findFirst({ where: { id, status: 1 } });
    if (!b) throw new NotFoundException(`Blog ${id} no encontrado`);
    // Contador de lecturas (alimenta "Lo más leído"). Fire-and-forget: no bloquea el render.
    void prisma.blogs.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
    return {
      ...this.toBlogCard(b),
      contentHtml: sanitizeRichHtml(stripLeadingTitleHeading(b.details, b.title)),
      metaTitle: b.meta_tag,
      metaDescription: b.meta_description,
    };
  }

  /** Página Quiénes Somos (tabla legacy inf_sitio, una fila). */
  async infSitio() {
    const r = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
    if (!r) return null;
    let imagenes: string[] = [];
    try {
      const parsed = JSON.parse(r.imagenes ?? '[]');
      if (Array.isArray(parsed)) imagenes = parsed.map((x) => imageUrl(String(x))).filter((u): u is string => u !== null);
    } catch { /* legacy sin JSON */ }
    return {
      frase: r.frase,
      titulo: r.titulo,
      descripcion: sanitizeRichHtml(normLegacyText(r.descripcion)),
      mision: sanitizeRichHtml(normLegacyText(r.mision)),
      vision: sanitizeRichHtml(normLegacyText(r.vision)),
      objetivos: sanitizeRichHtml(normLegacyText(r.objetivos)),
      imagenes,
    };
  }


  /**
   * Mensaje del formulario de Contacto.
   *
   * SE GUARDA PRIMERO, se empuja al CRM después. Antes solo se empujaba a Perfex
   * (fire-and-forget) y no se guardaba nada: con Perfex sin credenciales —el
   * estado real— el mensaje se descartaba en silencio mientras la persona veía
   * un "gracias, te contactamos". El acuse de recibo hacía creer que el canal
   * funcionaba.
   *
   * El orden importa: `create` va con await (si la BD falla, el visitante debe
   * enterarse y volver a intentar), y el lead al CRM queda fuera del camino
   * crítico — que Perfex esté caído no puede tumbar el formulario.
   */
  async contactMessage(data: { name?: string; email?: string; phone?: string; company?: string; need?: string; message?: string }): Promise<{ ok: boolean }> {
    const name = String(data.name ?? '').trim();
    const email = String(data.email ?? '').trim().toLowerCase();
    const message = String(data.message ?? '').trim();
    if (!name || name.length > 120) throw new BadRequestException('Ingresa tu nombre');
    if (!email || email.length > 190 || problemaEmail(email)) throw new BadRequestException(problemaEmail(email) ?? 'Escribe tu correo');
    // Mismo criterio que el formulario (2026-10-15): antes se guardaba lo que viniera.
    const telProblema = problemaTelefono(String(data.phone ?? ''));
    if (telProblema) throw new BadRequestException(telProblema);
    if (message.length < 4) throw new BadRequestException('Cuéntanos brevemente qué necesitas');
    if (message.length > 4000) throw new BadRequestException('El mensaje es muy largo: resúmelo en menos de 4,000 caracteres.');
    const need = String(data.need ?? '').trim();

    const saved = await prisma.contact_messages.create({
      data: {
        name,
        email,
        // El formato ya se revisó arriba; el recorte queda como tope de la columna.
        phone: String(data.phone ?? '').trim().slice(0, 40) || null,
        company: String(data.company ?? '').trim().slice(0, 190) || null,
        need: need.slice(0, 120) || null,
        message,
      },
      select: { id: true },
    });

    void avisarPanel({
      modulo: 'comunidad',
      evento: 'mensaje',
      titulo: `Mensaje de ${name}${need ? ` · ${need}` : ''}`,
      cuerpo: message.slice(0, 180),
      link: '/mensajes',
    });

    // Correos (2026-09-30): antes el mensaje solo quedaba en el panel y nadie se
    // enteraba fuera de él. Van sin await: el visitante no espera al SMTP, y un
    // fallo queda en el registro de Correo del panel (el mailer nunca lanza).
    const phone = String(data.phone ?? '').trim().slice(0, 40) || null;
    const company = String(data.company ?? '').trim().slice(0, 190) || null;
    // Al buzón desde el que sale la plataforma: el único que se sabe que existe
    // (el publicado en el sitio no tiene buzón). Mismo criterio que el cotizador.
    const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
    if (interno) {
      const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
      void this.mailer.enviar({
        kind: 'contact_internal',
        to: interno,
        replyTo: email,
        ...correoContactoInterno({ nombre: name, correo: email, telefono: phone, empresa: company, tema: need || null, mensaje: message, url: panel ? `${panel}/mensajes` : null }),
      });
    }
    /**
     * El acuse va a un correo que nadie comprobó: NO repite lo que se escribió
     * (auditoría 2026-10-23). Repetirlo convertía el formulario en una forma de
     * mandarle a cualquiera un correo con texto libre y remitente de MAQSER24
     * ("tu cuenta será suspendida, entra aquí…"). Del nombre, solo la primera palabra.
     */
    void this.mailer.enviar({
      kind: 'contact_ack',
      to: email,
      toName: name,
      ...correoAcuseContacto({ nombre: name.split(/\s+/)[0].slice(0, 30), mensaje: '', telefono: phone }),
    });

    // `crm_pushed` se sella solo si Perfex confirmó. Los que queden en false son
    // exactamente el atraso que hay que subir cuando el CRM se configure.
    // Con el CRM apagado (CRM_ACTIVO) no sale nada (2026-10-22): antes bastaba
    // con que quedaran las variables de Perfex para mandarle cada contacto.
    if (CRM_ACTIVO) void this.perfex
      .pushLead({ name, email, source: `Contacto web${need ? ` · ${need}` : ''}` })
      .then((sent) =>
        sent ? prisma.contact_messages.update({ where: { id: saved.id }, data: { crm_pushed: true } }) : null,
      )
      .catch(() => null);

    return { ok: true };
  }

  /**
   * "REGÍSTRATE COMO PROVEEDOR" (2026-10-06).
   *
   * La solicitud se guarda como aliado en estado 2 (ver registro-proveedor.ts
   * en @maqserv/config): así el panel la muestra con todos sus datos y, al
   * aceptarla, ya es la ficha del aliado, sin volver a capturar nada. Si la
   * misma persona se registra otra vez mientras sigue por revisar, se agrega a
   * su nota en lugar de duplicarla.
   */
  async providerSignup(data: Record<string, unknown>): Promise<{ ok: boolean }> {
    const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
    // Campo trampa: invisible para personas; si viene lleno es un bot.
    if (txt(data.sitio, 200)) return { ok: true };

    const tipo = TIPOS_PROVEEDOR.find((x) => x.clave === data.tipo);
    const nombre = txt(data.nombre, 190);
    const contacto = txt(data.contacto, 190) || null;
    const telefono = txt(data.telefono, 40);
    const correo = txt(data.correo, 190).toLowerCase() || null;
    const ciudad = txt(data.ciudad, 120);
    const estado = txt(data.estado, 120);
    // Lo mismo que pide el alta del panel (2026-10-09): dirección de su base,
    // municipios que cubre y en cuánto contesta. Con eso, al aceptarlo, queda
    // ubicado y con sus km sin volver a pedirle nada.
    const direccion = txt(data.direccion, 500) || null;
    const municipios = (Array.isArray(data.municipios) ? data.municipios.map(String) : String(data.municipios ?? '').split(','))
      .map((m) => m.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 60);
    const respuesta = Number(data.respuesta);
    const minutos = Number.isInteger(respuesta) && respuesta > 0 && respuesta <= 10080 ? respuesta : null;
    const mensaje = txt(data.mensaje, 2000);
    const claves = Array.isArray(data.ofrece) ? data.ofrece.map(String) : [];
    const ofertas = OFERTAS_PROVEEDOR.filter((o) => claves.includes(o.clave));

    if (!tipo) throw new BadRequestException('Elige si eres empresa o propietario de equipo');
    if (nombre.length < 2) throw new BadRequestException('Escribe el nombre de tu empresa o tu nombre');
    // Antes bastaba con 10 dígitos en cualquier parte ("Tel 81-1234-5678 o 81…" pasaba).
    if (!telefono) throw new BadRequestException('Escribe un teléfono de 10 dígitos');
    const telProblema = problemaTelefono(telefono);
    if (telProblema) throw new BadRequestException(telProblema);
    if (correo && problemaEmail(correo)) throw new BadRequestException(problemaEmail(correo) as string);
    if (!ciudad || !estado) throw new BadRequestException('Escribe tu municipio y estado');
    if (municipios.length === 0) throw new BadRequestException('Escribe al menos un municipio al que llegas');
    if (ofertas.length === 0) throw new BadRequestException('Elige al menos una cosa que ofreces');
    if (mensaje.length < 10) throw new BadRequestException('Cuéntanos brevemente tu maquinaria o servicios');

    const ofrece = ofertas.map((o) => o.nombre).join(', ');
    const categorias = [...new Set(ofertas.map((o) => o.categoria).filter((c): c is NonNullable<typeof c> => Boolean(c)))];
    const fecha = new Date().toISOString().slice(0, 10);
    const nota = `Solicitud desde el sitio (${fecha})\nTipo: ${tipo.nombre}\nOfrece: ${ofrece}\n\n${mensaje}`;

    const tel10 = telefono.replace(/\D/g, '').slice(-10);
    const pendientes = await prisma.providers.findMany({
      where: { status: ESTADO_SOLICITUD_PROVEEDOR },
      select: { id: true, phone: true, email: true, notes: true, categories: true },
    });
    const previa = pendientes.find((p) => (correo && p.email?.trim().toLowerCase() === correo) || (p.phone ?? '').replace(/\D/g, '').slice(-10) === tel10);

    let id: number;
    if (previa) {
      const antes = Array.isArray(previa.categories) ? (previa.categories as string[]) : [];
      // Se registró otra vez: vale su ubicación más reciente.
      await prisma.providers.update({
        where: { id: previa.id },
        data: {
          notes: `${previa.notes ?? ''}\n\n---\n${nota}`.slice(-4000),
          categories: [...new Set([...antes, ...categorias])],
          city: ciudad,
          state: estado,
          ...(direccion ? { address: direccion } : {}),
          coverage: municipios,
          ...(minutos ? { response_minutes: minutos } : {}),
          updated_at: new Date(),
        },
      });
      id = previa.id;
    } else {
      const base = slugify(nombre) || 'proveedor';
      let slug = base;
      for (let i = 2; await prisma.providers.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
      const creado = await prisma.providers.create({
        data: {
          name: nombre,
          slug,
          level: 'registrado',
          contact_name: contacto,
          phone: telefono,
          email: correo,
          city: ciudad,
          state: estado,
          address: direccion,
          coverage: municipios,
          response_minutes: minutos,
          categories: categorias,
          notes: nota,
          status: ESTADO_SOLICITUD_PROVEEDOR,
        },
        select: { id: true },
      });
      id = creado.id;
    }

    // Ubicación aproximada con la tabla de cabeceras (sin consultar el mapa:
    // quien se registra no espera). La exacta, con su dirección, se busca al
    // aceptarlo en la red.
    void ubicarAliado(id, { buscarBase: true }).catch(() => null);

    void avisarPanel({
      modulo: 'proveedores',
      evento: 'registro_proveedor',
      titulo: `Solicitud de proveedor: ${nombre}`,
      cuerpo: `${tipo.nombre} · ${ciudad}, ${estado} · ${ofrece}`.slice(0, 180),
      link: '/proveedores',
    });

    const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
    if (interno) {
      const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
      void this.mailer.enviar({
        kind: 'provider_signup_internal',
        to: interno,
        ...(correo ? { replyTo: correo } : {}),
        ...correoSolicitudProveedorInterno({
          nombre, tipo: tipo.nombre, contacto, telefono, correo,
          ubicacion: `${ciudad}, ${estado}`, ofrece, mensaje,
          url: panel ? `${panel}/proveedores` : null,
        }),
      });
    }
    if (correo) {
      // Del nombre, solo la primera palabra: va a un correo que nadie comprobó y
      // no debe repetir texto libre (auditoría 2026-10-23).
      void this.mailer.enviar({ kind: 'provider_signup_ack', to: correo, toName: contacto ?? nombre, ...correoAcuseProveedor({ nombre: (contacto ?? nombre).split(/\s+/)[0].slice(0, 30) }) });
    }
    return { ok: true };
  }

  /**
   * PREGUNTA DESDE EL SITIO (2026-10-12).
   *
   * Antes solo se podía preguntar sobre un producto y con sesión: quien tenía
   * una duda general ("¿llegan a Santiago?", "¿el precio incluye operador?")
   * no tenía dónde. Ahora pregunta en Preguntas frecuentes con su nombre y su
   * correo; se responde en el panel, se le avisa por correo y, si vale para
   * todos, se publica.
   */
  async siteQuestion(data: Record<string, unknown>): Promise<{ ok: boolean }> {
    const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
    // Campo trampa: invisible para personas; si viene lleno es un bot.
    if (txt(data.sitio, 200)) return { ok: true };
    const nombre = txt(data.nombre, 190);
    const correo = txt(data.correo, 190).toLowerCase();
    const pregunta = txt(data.pregunta, 500);
    if (nombre.length < 2) throw new BadRequestException('Escribe tu nombre');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(correo)) throw new BadRequestException('Escribe un correo válido para avisarte cuando respondamos');
    if (pregunta.length < 10) throw new BadRequestException('Escribe tu pregunta con un poco más de detalle');
    const ahora = new Date();
    await prisma.product_questions.create({
      data: {
        product_id: null, user_id: null, asker_name: nombre, asker_email: correo, source: 'sitio',
        question: pregunta, answer: null, status: 1, featured: 0, created_at: ahora, updated_at: ahora,
      },
    });
    void avisarPanel({ modulo: 'comunidad', evento: 'pregunta', titulo: `Pregunta nueva de ${nombre}`, cuerpo: pregunta.slice(0, 300), link: '/mensajes' });
    return { ok: true };
  }

  /** FAQ del home: preguntas de clientes DESTACADAS por el admin (respondidas + visibles). */
  async faqs(): Promise<FaqItem[]> {
    const rows = await prisma.product_questions.findMany({
      where: { featured: 1, status: 1, answer: { not: null } },
      orderBy: { id: 'desc' },
      // Todas: el home enseña 6 y /preguntas-frecuentes el resto, con buscador.
      take: 500,
    });
    // La respuesta la escribe Operaciones y el sitio la pinta como HTML: limpia
    // al servir (auditoría 2026-10-23), también lo que ya estaba guardado.
    return rows.map((q) => ({ id: q.id, question: q.question, answer: sanitizeUserHtml(q.answer ?? '') }));
  }

  /**
   * Reseñas del home: las de servicio publicadas (2026-10-12) y las de producto
   * aprobadas que quedan de cuando había carrito, las más nuevas primero.
   */
  async reviews(limit = 6): Promise<SiteReview[]> {
    const tope = Math.min(limit, 20);
    const [rows, servicio] = await Promise.all([
      prisma.comments.findMany({ where: { status: 1 }, orderBy: { id: 'desc' }, take: tope }),
      // Sin la tabla (falta sql/resenas-servicio.sql) el home sigue con las de producto.
      prisma.service_reviews.findMany({ where: { status: 1 }, orderBy: { id: 'desc' }, take: tope }).catch(() => []),
    ]);
    const [users, products, quotes] = await Promise.all([
      prisma.users.findMany({ where: { id: { in: rows.map((r) => r.user_id) } }, select: { id: true, name: true } }),
      prisma.products.findMany({ where: { id: { in: rows.map((r) => r.product_id) } }, select: { id: true, name: true } }),
      prisma.quotes.findMany({ where: { id: { in: servicio.map((r) => r.quote_id) } }, select: { id: true, product_interested: true, service_category: true } }),
    ]);
    const names = new Map(users.map((u) => [u.id, u.name]));
    const prods = new Map(products.map((p) => [p.id, p.name]));
    // Solo la línea: lo que sigue a " · " es interno ("cotizador de maquinaria · MQ-…").
    const servs = new Map(quotes.map((x) => [x.id, x.product_interested?.split(' · ')[0] || x.service_category || null]));
    const deProducto: SiteReview[] = rows.map((r) => ({
      id: r.id,
      rating: Math.max(1, Math.min(5, r.rating ?? 5)),
      review: r.text,
      author: nombreCorto(names.get(r.user_id)),
      product: prods.get(r.product_id) ?? null,
      date: r.created_at ? r.created_at.toISOString() : null,
    }));
    const deServicio: SiteReview[] = servicio
      .filter((r) => (r.comment ?? '').trim())
      .map((r) => ({
        // Negativo: el id no choca con el de una reseña de producto en la lista del sitio.
        id: -r.id,
        rating: Math.max(1, Math.min(5, r.rating)),
        review: r.comment ?? '',
        author: nombreCorto(r.author),
        product: servs.get(r.quote_id) ?? null,
        date: r.created_at.toISOString(),
      }));
    return [...deServicio, ...deProducto]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, tope);
  }
}

