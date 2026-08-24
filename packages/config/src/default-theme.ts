import type { Theme } from './schema';

/**
 * Tema por defecto: "maquinaria" (el sector activo del sitio actual).
 * Sirve como semilla de la tabla `themes` y como fallback si la API no responde.
 * TODOS los valores son editables desde el admin — esto es solo el punto de partida.
 */
export const defaultTheme: Theme = {
  slug: 'maquinaria',
  name: 'MAQSER24',
  active: true,
  tokens: {
    // Identidad MAQSER24 (Manual de Identidad v1.0, 2026 — sección 11 / PALETA
    // PRINCIPAL). Negro tecnológico #07090C · Grafito #11161C · Gunmetal #2B333D
    // · Acero #A9B0B7 · Plata #D8DDE2 · Azul eléctrico #008CFF · Blanco #F5F7FA.
    //
    // REGLA DURA DEL MANUAL (12 / COLOR FUNCIONAL): el azul eléctrico significa
    // ACCIÓN. Se reserva para CTA, enlaces, datos activos, mapas y estados
    // interactivos. No rellena la marca ni decora superficies.
    //
    // El manual es DARK-FIRST (08 / FONDOS AUTORIZADOS: "negro tecnológico, uso
    // prioritario"), por eso `defaultMode` es 'dark' más abajo. La paleta clara
    // no desaparece: es la "variante específica para fondos claros" que el mismo
    // manual autoriza para documentos y cotizaciones (29 / DOCUMENTOS).
    colors: {
      // Variante clara: blanco técnico. Documentos, cotizaciones impresas y
      // usuarios que fuercen el modo claro.
      light: {
        // Azul más profundo que el #008CFF de marca: sobre blanco, el azul
        // eléctrico da 3.07:1 y reprueba AA. Este da 5.03:1.
        primary: '#0066CC',
        primaryFg: '#FFFFFF', // 5.03:1 sobre #0066CC — AA
        secondary: '#11161C', // grafito: bandas oscuras sobre fondo claro
        accent: '#2B333D', // gunmetal: eyebrows y etiquetas discretas
        background: '#F5F7FA', // blanco técnico
        surface: '#FFFFFF',
        text: '#07090C', // negro tecnológico
        textMuted: '#4A545F', // 6.97:1 sobre el fondo — AA
        border: '#D8DDE2', // plata
        success: '#15803D', // disponible
        warning: '#B45309', // disponibilidad limitada / por confirmar
        error: '#C81E1E', // no disponible
      },
      // Variante oscura: la identidad principal de MAQSER24.
      dark: {
        primary: '#008CFF', // azul eléctrico — acción
        // Texto NEGRO sobre el azul, no blanco: blanco sobre #008CFF da 3.39:1
        // y reprueba AA; el negro tecnológico da 5.79:1.
        primaryFg: '#07090C',
        secondary: '#2B333D', // gunmetal: botones secundarios y bandas
        accent: '#A9B0B7', // acero: eyebrows, etiquetas, metadatos
        background: '#07090C', // negro tecnológico
        surface: '#11161C', // grafito: tarjetas y paneles
        text: '#F5F7FA', // blanco técnico
        textMuted: '#A9B0B7', // acero
        border: '#2B333D', // gunmetal
        // Estados de disponibilidad (21 / ESTADOS). El color SIEMPRE acompaña
        // al texto, nunca lo sustituye — regla de accesibilidad del manual.
        success: '#22C55E', // DISPONIBLE
        warning: '#F59E0B', // LIMITADA / POR CONFIRMAR
        error: '#F87171', // NO DISPONIBLE
      },
    },
    // 13 / TIPOGRAFÍA: "Inter es la familia operativa recomendada. Titulares:
    // Inter Tight/Inter Display cuando esté disponible; cuerpo y datos: Inter."
    typography: {
      fontSans: 'Inter',
      fontHeading: 'Inter Tight',
      fontDisplay: 'Inter Tight',
      baseSizePx: 16,
      scaleRatio: 1.25,
    },
    // 14 / RETÍCULA: "esquinas discretas". Radios más cerrados que los del tema
    // anterior — la retícula debe sentirse como ingeniería, no como decoración.
    shape: {
      radiusSm: '2px',
      radiusMd: '4px',
      radiusLg: '6px',
      buttonStyle: 'solid',
      buttonRadius: '4px',
    },
    // Orden de la home según el diseño SEGAshop. services y blog quedan
    // implementadas pero desactivadas por defecto (el admin puede reactivarlas):
    // el diseño de referencia no las incluye. banners y success-cases se retiraron
    // en jul 2026 (legacy y decisión del cliente, respectivamente).
    sections: [
      { key: 'home.hero', enabled: true, order: 0 },
      { key: 'home.categories', enabled: true, order: 1 },
      { key: 'home.featured-products', enabled: true, order: 2 },
      { key: 'home.why-choose-us', enabled: true, order: 3 },
      { key: 'home.strategic-sectors', enabled: true, order: 4 },
      { key: 'home.offer', enabled: true, order: 5 },
      { key: 'home.reviews', enabled: true, order: 6 },
      { key: 'home.brands', enabled: true, order: 7 },
      { key: 'home.faq', enabled: true, order: 8 },
      { key: 'home.services', enabled: false, order: 9 },
      { key: 'home.blog', enabled: false, order: 11 },
    ],
    // Identidad de marca. Estos archivos se generan desde el activo oficial que
    // entregó el cliente con `node _build-brand.cjs` y viven en el `public/` de
    // cada app — no se redibuja el logo, solo se recompone el lockup horizontal
    // (el vertical original mide 1.35:1 y en la cabecera de 46 px el wordmark
    // quedaría ilegible). Siguen siendo sustituibles desde el admin
    // (Diseño del sitio → Identidad de marca).
    branding: {
      // El logo es metálico claro: la MISMA pieza sirve en ambos modos, pero en
      // fondo claro pierde contraste. Mientras el cliente no entregue la
      // variante para fondos claros que pide el manual (08 / FONDOS
      // AUTORIZADOS), se usa el mismo archivo en los dos.
      logoLight: '/brand/maqser24-logo.png',
      logoDark: '/brand/maqser24-logo.png',
      logoAlt: '/brand/maqser24-logo-vertical.png',
      icon: '/brand/app-icon.png',
      favicon: '/brand/favicon.png',
    },
    // Ajustes de la Sección 1 · Hero (editables en Diseño del sitio → Hero).
    hero: {
      showBadge: true,
      showTrust: true,
      showStats: true,
      overlay: 100,
      // Cotizar es ahora el camino principal; el catálogo queda de secundario.
      primaryLink: '/cotizar',
      secondaryLink: '/productos',
      // OJO: el hero pinta SIEMPRE sobre fotografía oscura, así que estos
      // colores son literales y no siguen la paleta claro/oscuro. Eran los
      // ámbar de SEGAshop (#FFC107) — sin cambiarlos el hero seguía amarillo
      // aunque el resto del sitio ya fuera MAQSER24.
      accentColor: '#008CFF', // azul eléctrico
      titleColor: '#F5F7FA', // blanco técnico
      subtitleColor: '#A9B0B7', // acero
      primaryBg: '#008CFF',
      primaryText: '#07090C', // negro sobre azul: 5.79:1 (blanco da 3.39:1)
      secondaryBorder: '#2B333D', // gunmetal
    },
    // Ajustes de la Sección 2 · Categorías (adelanto en el home).
    categories: {
      show: true,
      perView: 4,
      cardRadius: '8px',
      imageHeight: 260,
      eyebrowColor: null,
      titleColor: null,
      cardAccentColor: null,
    },
    // Ajustes de la página/vista de categorías (/categorias).
    categoriesView: {
      columns: 3,
      cardRadius: '8px',
      imageHeight: 300,
      eyebrowColor: null,
      titleColor: null,
      cardAccentColor: null,
      featuredSlug: null,
      // Banda superior (hero de la página).
      hero: {
        enabled: true,
        eyebrow: 'Categorías de servicio',
        title: 'Seis categorías. Una sola marca.',
        subtitle:
          'Maquinaria pesada, equipo menor, plataformas de elevación, agua en pipas, volteos y triturados. Una misma solicitud, una misma cotización.',
        cta: 'Ver catálogo',
        ctaLink: '/productos',
        image: null,
        bg: null,
        textColor: null,
        accentColor: null,
      },
      // Banda inferior (anuncio/promo).
      promo: {
        enabled: true,
        eyebrow: '',
        title: '¿No encuentras lo que buscas?',
        subtitle: 'Cotiza con nosotros y te ayudamos a conseguir el equipo exacto que necesita tu proyecto.',
        cta: 'Solicitar cotización',
        ctaLink: '/contacto',
        image: null,
        bg: null,
        textColor: null,
        accentColor: null,
      },
    },
    // Sección 3 · Productos destacados (home).
    featured: {
      limit: 8,
      showTabs: true,
      align: 'left',
      eyebrowColor: null,
      titleColor: null,
    },
    // Banner + anuncio + promo de la página de catálogo (/productos).
    catalog: {
      banner: {
        enabled: true,
        eyebrow: 'Catálogo completo',
        title: 'Todo el equipo, en un solo lugar',
        subtitle:
          'Renta o compra equipo con especificaciones, ubicación y disponibilidad a la vista. Lo que no está en catálogo se cotiza.',
        cta: 'Cotizar',
        ctaLink: '/cotizar',
        image: null,
        bg: null,
        textColor: null,
        accentColor: null,
      },
      mid: {
        enabled: true,
        eyebrow: 'Mejora tu operación',
        title: 'Equipo listo para trabajar hoy',
        subtitle: 'Máquinas revisadas y con mantenimiento al día. Entrega en obra en 24–48 h.',
        cta: 'Ver disponibilidad',
        ctaLink: '/productos',
        image: null,
        bg: null,
        textColor: null,
        accentColor: null,
      },
      promo: {
        enabled: true,
        eyebrow: 'Promoción',
        title: 'Renta por temporada con descuento',
        subtitle: 'Pregunta por nuestros paquetes de renta mensual para proyectos de larga duración.',
        cta: 'Solicitar cotización',
        ctaLink: '/contacto',
        image: null,
        bg: null,
        textColor: null,
        accentColor: null,
      },
    },
    // Sección 4 · Quiénes somos ("¿Por qué elegirnos?" del home). Imagen null ⇒
    // usa la foto de la 1ª razón; colores null ⇒ heredan del tema.
    whyChooseUs: {
      show: true,
      image: null,
      showYearsBadge: true,
      showStats: true,
      eyebrowColor: null,
      titleColor: null,
      accentColor: null,
      statsBg: null,
      statsFg: null,
    },
    // Página /quienes-somos: contenido estructurado (la prosa sale de inf_sitio).
    quienesSomos: {
      heroCta: 'Ver catálogo',
      heroCtaLink: '/productos',
      heroCta2: 'Contáctanos',
      heroCta2Link: '/contacto',
      // Ver el comentario en `quienesSomosSchema`: las cifras anteriores eran
      // inventadas y la línea de tiempo era una historia de empresa que no
      // ocurrió. Se quedan solo hechos verificables.
      stats: [
        { num: '6', label: 'Categorías de servicio' },
        { num: 'MTY', label: 'Monterrey y zona metro' },
        { num: '1', label: 'Marca, una experiencia' },
      ],
      propositoEyebrow: 'Nuestro propósito',
      propositoTitle: 'Lo que nos mueve',
      values: [
        { title: 'Disponibilidad', desc: 'Basada en información, no en suposiciones' },
        { title: 'Velocidad', desc: 'Rapidez con control' },
        { title: 'Confianza', desc: 'Proveedores y documentos verificables' },
        { title: 'Trazabilidad', desc: 'De principio a fin' },
      ],
      timelineEyebrow: 'Nuestra trayectoria',
      timelineTitle: 'De un patio de equipos a una red de renta',
      timeline: [],
      ventajasEyebrow: 'Ventajas',
      ventajasTitle: 'Por qué elegirnos',
      ctaTitle: '¿Listo para poner tu obra en marcha?',
      ctaSubtitle:
        'Dinos qué necesitas, dónde y para cuándo. Te devolvemos opciones con disponibilidad, condiciones y costo de traslado.',
      ctaPrimary: 'Cotizar',
      ctaPrimaryLink: '/cotizar',
      ctaSecondary: 'Contactar',
      ctaSecondaryLink: '/contacto',
    },
    // Sección 5 · Sectores estratégicos (home). Colores null ⇒ heredan del tema.
    sectors: {
      show: true,
      limit: 4,
      cardHeight: 340,
      eyebrowColor: null,
      titleColor: null,
      ctaColor: null,
    },
    // Sección Blog del home. Las entradas se gestionan en el módulo Blog.
    blog: { limit: 3 },
    // Banda de marcas del home + el listado de /quienes-somos: UNA sola lista.
    // (Antes el home leía el copy `home.brands.list` y /quienes-somos su propio
    // token, y ya se habían despegado.)
    brands: {
      title: 'Marcas presentes en la red',
      // Decía "Trabajamos con las marcas líderes de la industria": afirma una
      // relación comercial con CAT, Komatsu y demás que no está documentada.
      eyebrow: 'Equipo de marcas reconocidas dentro de la red',
      list: ['CAT', 'Komatsu', 'Volvo CE', 'JCB', 'Yale', 'Bobcat'],
    },
    // Sección 6 · Oferta / Promoción (home). Colores null ⇒ heredan del tema.
    offer: {
      show: true,
      image: null,
      ctaLink: '/productos',
      bg: null,
      accentColor: null,
      titleColor: null,
    },
    // Sección 7 · Reseñas (home). Colores null ⇒ heredan del tema.
    reviews: {
      show: true,
      limit: 8,
      eyebrowColor: null,
      titleColor: null,
      accentColor: null,
    },
    // Sección 8 · Preguntas frecuentes (home). Colores null ⇒ heredan del tema.
    faq: {
      show: true,
      eyebrowColor: null,
      titleColor: null,
      accentColor: null,
    },
    // Página de Contacto (/contacto). Los canales alimentan barra superior + footer.
    contact: {
      eyebrow: 'Atención a clientes',
      title: 'Hablemos de tu obra',
      subtitle: 'Cotizaciones, disponibilidad de equipo o soporte técnico. Elige el canal que más te acomode.',
      stats: [
        { value: '<24h', label: 'Tiempo de respuesta' },
        { value: '32', label: 'Estados de cobertura' },
        { value: '3', label: 'Sucursales' },
        { value: '+15 años', label: 'De experiencia' },
      ],
      phone: '833 224 56 78',
      whatsapp: '833 224 56 78',
      email: 'info@maqserv24.com',
      hours: 'Lun–Sáb · 8:00–18:00',
      address: '',
      urgent: { show: true, eyebrow: 'Renta urgente', title: '¿Necesitas equipo hoy mismo?', ctaLabel: 'Llamar ahora' },
      needs: ['Rentar equipo', 'Cotización', 'Soporte técnico', 'Otro'],
      branches: [
        { city: 'Tampico', address: 'Av. Hidalgo 2450, Col. Centro, Tampico, Tamps. — Matriz', phone: '833 224 56 78', isNew: false, image: null },
        { city: 'Monterrey', address: 'Blvd. Díaz Ordaz 1200, San Pedro Garza García, N.L.', phone: '81 1122 3344', isNew: true, image: null },
        { city: 'Guadalajara', address: 'Periférico Norte 850, Zapopan, Jal.', phone: '33 4455 6677', isNew: false, image: null },
      ],
    },
    // Pie de página (footer). copyright vacío ⇒ "© {año} {marca}. Todos los derechos reservados."
    footer: {
      tagline: 'Plataforma especializada en renta y venta de maquinaria industrial para proyectos de construcción.',
      showNewsletter: true,
      newsletterTitle: 'Recibe nuestras novedades',
      newsletterSubtitle: 'Novedades, disponibilidad de equipo y guías directo a tu correo.',
      columns: [
        { title: 'Empresa', links: [
          { label: 'Quiénes somos', href: '/quienes-somos' },
          { label: 'Blog', href: '/blog' },
        ] },
        { title: 'Catálogo', links: [
          { label: 'Productos', href: '/productos' },
          { label: 'Categorías', href: '/categorias' },
        ] },
        { title: 'Ayuda', links: [
          { label: 'Rastrear pedido', href: '/rastreo' },
          { label: 'Contacto', href: '/contacto' },
        ] },
      ],
      social: [
        { label: 'f', href: '' },
        { label: 'in', href: '' },
        { label: 'ig', href: '' },
        { label: 'wa', href: '' },
      ],
      copyright: '',
    },
    // Legal: vacío por defecto ⇒ el sitio usa LEGAL_DEFAULTS (plantilla) hasta que se edite.
    legal: {
      terms: { updated: '', intro: '', sections: [] },
      privacy: { updated: '', intro: '', sections: [] },
    },
    // Cobro del checkout (Panel → Pagos). IVA apagado por defecto: se activa cuando el
    // cliente lo decida; así lo que muestra el carrito = lo que cobra la orden.
    checkout: {
      tax: { enabled: false, rate: 16, label: 'IVA', included: false },
      operator: { enabled: true, amount: 8000, label: 'Incluir operador certificado', help: 'Operador con seguro y viáticos por equipo.' },
      // Traslado (Panel → Traslado). Arranca en 'quote' ("A cotizar", sin cobro) para no
      // cobrar una tarifa inventada: el cliente define la suya y cambia a 'km'.
      freight: {
        enabled: true,
        mode: 'quote',
        ratePerKm: 35,
        base: 0,
        freeKm: 0,
        minCharge: 0,
        maxKm: 300,
        roundTrip: true,
        perUnit: false,
        rentalOnly: true,
        flatAmount: 0,
        label: 'Traslado',
        help: 'Se calcula por la distancia desde nuestra base hasta tu ubicación.',
        quoteText: 'A cotizar',
        origin: '',
      },
      note: 'El traslado se cotiza según ubicación.',
    },
    quoteMode: false,
    // DARK-FIRST. El manual pone el negro tecnológico como fondo prioritario
    // (08 / FONDOS AUTORIZADOS), así que el sitio abre en oscuro aunque el
    // sistema del visitante esté en claro. El toggle sigue funcionando y su
    // elección se guarda en localStorage.
    defaultMode: 'dark',
  },
  copys: {
    es: {
      'site.name': 'MAQSER24',
      // Descriptor institucional del manual (04 / ARQUITECTURA DE MARCA). El
      // logo entregado trae uno distinto ("del mercado de renta de maquinaria");
      // manda el del manual hasta que el cliente confirme cuál es el oficial.
      'site.tagline': 'Infraestructura digital para maquinaria y servicios de construcción',
      // Mensaje de marca del manual (32 / MENSAJES DE MARCA).
      'home.hero.title': 'Encuentra maquinaria',
      'home.hero.titleAccent': 'disponible para tu obra',
      'home.hero.subtitle':
        'Maquinaria pesada, equipo menor, plataformas de elevación, agua en pipas, volteos y triturados. Consulta disponibilidad y recibe opciones de proveedores desde una sola plataforma.',
      'home.hero.badge': 'Monterrey y zona metropolitana',
      'home.hero.cta': 'Contactar',
      // 19 / BOTONES: etiquetas directas — COTIZAR, VER DISPONIBILIDAD,
      // CONFIRMAR, CONTACTAR. Cotizar es el camino principal.
      'home.hero.ctaPrimary': 'Cotizar',
      'home.hero.ctaSecondary': 'Ver disponibilidad',
      // 18 / PRINCIPIOS DE PRODUCTO: toda pantalla responde qué hay disponible,
      // qué tan rápido se resuelve y quién lo suministra. Estos cuatro bloques
      // decían "Equipo certificado", "Pago seguro", "Entrega en 24-48 horas" y
      // "Soporte 24/7 · Siempre disponible" — promesas que la red todavía no
      // puede garantizar, y "siempre disponible" es el ejemplo EXACTO que el
      // manual prohíbe en 27 / IDENTIDAD Y COMUNICACIÓN.
      'home.hero.trust1.title': 'Disponibilidad',
      'home.hero.trust1.text': 'Con fecha y ubicación',
      'home.hero.trust2.title': 'Velocidad',
      'home.hero.trust2.text': 'Respuesta y cotización',
      'home.hero.trust3.title': 'Confianza',
      'home.hero.trust3.text': 'Proveedores verificados',
      'home.hero.trust4.title': 'Cobertura',
      'home.hero.trust4.text': 'Monterrey y zona metro',
      // Las cifras anteriores ("500+ equipos disponibles", "+5,000 proyectos")
      // no correspondían a nada: la plataforma tiene 27 productos activos. Se
      // sustituyen por datos verificables de la arquitectura de marca.
      'home.hero.stat1.num': '6',
      'home.hero.stat1.label': 'categorías de servicio',
      'home.hero.stat2.num': 'MTY',
      'home.hero.stat2.label': 'y zona metropolitana',
      'home.hero.stat3.num': '',
      'home.hero.stat3.label': '',
      'product.cta.buy': 'Comprar ahora',
      'product.cta.addToCart': 'Añadir al carrito',
      'product.cta.quote': 'Solicitar cotización',
      'product.cta.inquiry': 'Solicitar información',
      'product.price.onQuote': 'Precio bajo cotización',
      'product.rental.badge': 'Disponible en renta',
      'product.outOfStock': 'Agotado',
      'product.category': 'Categoría',
      'product.medical.title': 'Información técnica',
      'product.medical.lote': 'Lote',
      'product.medical.caducidad': 'Fecha de caducidad',
      'product.medical.ficha': 'Descargar ficha técnica (PDF)',
      'product.medical.dc3': 'Certificación DC-3',
      'home.categories.eyebrow': 'Ecosistema de servicios',
      'home.categories.title': 'Seis categorías. Una sola marca.',
      'home.categories.unit': 'equipos',
      'home.featured.eyebrow': 'Equipos',
      'home.featured.title': 'Equipo destacado y disponible',
      // "en tiempo real" era falso: la disponibilidad hoy es un entero de stock,
      // no un estado con fecha y ubicación (eso llega con el modelo de red).
      'home.featured.subtitle':
        'Especificaciones, ubicación y condición a la vista. Los datos deciden; la foto ayuda.',
      'home.featured.filterAll': 'Todos',
      'home.featured.viewAll': 'Ver todo el catálogo',
      'home.sectors.eyebrow': 'Industrias que servimos',
      'home.sectors.title': 'Sectores estratégicos',
      'home.sectors.cta': 'Explorar equipos',
      'home.whyChooseUs.eyebrow': 'Posicionamiento',
      // 02 / POSICIONAMIENTO del manual, textual.
      'home.whyChooseUs.title': 'No somos una rentadora digital.',
      'home.whyChooseUs.subtitle':
        'Somos la infraestructura digital que conecta maquinaria y servicios de construcción con proyectos que necesitan respuesta rápida, trazabilidad y confianza.',
      // Mismo caso que el hero: "12+ años", "500+ equipos", "5,000+ proyectos"
      // y "98% clientes satisfechos" no correspondían a ningún dato real.
      'home.whyChooseUs.years.num': '6',
      'home.whyChooseUs.years.label': 'Categorías de servicio',
      'home.whyChooseUs.stat1.num': 'Red',
      'home.whyChooseUs.stat1.label': 'Capacidad propia y de aliados',
      'home.whyChooseUs.stat2.num': 'MTY',
      'home.whyChooseUs.stat2.label': 'Monterrey y zona metro',
      'home.whyChooseUs.stat3.num': '',
      'home.whyChooseUs.stat3.label': '',
      'home.offer.badge': 'Oferta de temporada',
      'home.offer.title': 'Renta 3 meses y el 4.º con 50% de descuento',
      'home.offer.subtitle':
        'Aplica en equipo seleccionado de excavación y volteo. Tiempo limitado, sujeto a disponibilidad.',
      'home.offer.cta': 'Ver la oferta',
      'home.reviews.eyebrow': 'Opiniones verificadas por compra',
      'home.reviews.title': 'Lo que dicen nuestros clientes',
      'home.brands.title': 'Marcas presentes en la red',
      'home.brands.list': 'CAT, Komatsu, Volvo CE, JCB, Yale, Bobcat',
      'home.faq.eyebrow': 'Resolvemos tus dudas',
      'home.services.eyebrow': 'Qué hacemos',
      'home.services.title': 'Nuestros servicios',
      // El eyebrow va aparte del título: pasarle el mismo texto a los dos hacía que
      // `CenterHead` lo pintara duplicado (chiquito arriba y grande abajo).
      'home.blog.eyebrow': 'Bitácora',
      'home.blog.title': 'Últimas noticias',
      'home.blog.readMore': 'Leer más',
      'blog.hero.eyebrow': 'Diario de obra · Nº 24',
      'blog.hero.title': 'Bitácora',
      'blog.hero.subtitle': 'Noticias, guías y buenas prácticas sobre maquinaria pesada — directo desde el terreno.',
      'home.faq.title': 'Preguntas frecuentes',
      'product.card.from': 'Desde',
      'product.card.add': 'Agregar',
      'product.card.view': 'Ver',
      'product.badge.new': 'Nuevo',
      'product.badge.top': 'Más rentado',
      'product.badge.rental': 'Renta',
      'product.spec.brand': 'Marca',
      'product.spec.mode': 'Modalidad',
      'product.mode.rental': 'Renta',
      'product.mode.sale': 'Venta',
      'home.reviews.role': 'Cliente verificado',
      'rental.start': 'Fecha de inicio',
      'rental.end': 'Fecha de retorno',
      'rental.days': 'día(s)',
      'rental.freight': 'flete',
      'catalog.title': 'Catálogo de productos',
      'catalog.filter.all': 'Todos',
      'catalog.search.placeholder': 'Buscar equipo, marca…',
      'catalog.search.button': 'Buscar',
      'catalog.empty': 'No encontramos productos para tu búsqueda.',
      'pagination.prev': '← Anterior',
      'pagination.next': 'Siguiente →',
      'auth.login.title': 'Iniciar sesión',
      'auth.login.submit': 'Entrar',
      'auth.login.noAccount': '¿No tienes cuenta? Regístrate',
      'auth.register.title': 'Crear cuenta',
      'auth.register.submit': 'Registrarme',
      'auth.register.haveAccount': '¿Ya tienes cuenta? Inicia sesión',
      'auth.field.name': 'Nombre completo',
      'auth.field.email': 'Correo electrónico',
      'auth.field.password': 'Contraseña',
      'auth.logout': 'Salir',
      'auth.greeting': 'Hola',
      'cart.title': 'Tu carrito',
      'cart.empty': 'Tu carrito está vacío.',
      'cart.browse': 'Explorar productos',
      'cart.qty': 'Cantidad',
      'cart.remove': 'Quitar',
      'cart.total': 'Total',
      'cart.checkout': 'Proceder al pago',
      'cart.added': 'Añadido al carrito',
      'checkout.title': 'Finalizar compra',
      'checkout.contact.title': 'Datos de contacto y envío',
      'checkout.field.phone': 'Teléfono',
      'checkout.field.address': 'Dirección',
      'checkout.field.city': 'Ciudad',
      'checkout.field.zip': 'Código postal',
      'checkout.field.note': 'Notas del pedido (opcional)',
      'checkout.method.title': 'Método de pago',
      'checkout.summary.title': 'Resumen del pedido',
      'checkout.submit': 'Confirmar pedido',
      'checkout.loginRequired': 'Inicia sesión para completar tu compra',
      'order.title': 'Pedido',
      'order.thanks': '¡Gracias por tu pedido!',
      'order.number': 'Número de pedido',
      'order.status.pending': 'Pendiente',
      'order.paymentStatus': 'Estado del pago',
      'order.method': 'Método de pago',
      'order.instructions.title': 'Instrucciones de pago',
      'order.items.title': 'Productos',
      'quote.form.title': 'Solicitar cotización',
      'quote.form.subtitle': 'Cuéntanos qué necesitas y te enviaremos una cotización a la medida.',
      'quote.form.company': 'Empresa (opcional)',
      'quote.form.region': 'Región / Estado',
      'quote.form.industry': 'Industria',
      'quote.form.address': 'Dirección de entrega (para calcular flete)',
      'quote.form.comments': 'Comentarios adicionales',
      'quote.form.days': 'Días de renta',
      'quote.form.qty': 'Cantidad',
      'quote.form.submit': 'Enviar solicitud',
      'quote.form.success.title': '¡Solicitud recibida!',
      'quote.form.success.body': 'Nuestro equipo te contactará con tu cotización.',
      'quote.form.number': 'Número de cotización',
      'quote.status.pending': 'Pendiente',
      'quote.status.completed': 'Cotizada',
      'account.title': 'Mi cuenta',
      'account.profile.title': 'Mis datos',
      'account.profile.save': 'Guardar cambios',
      'account.profile.saved': 'Datos actualizados',
      'account.password.title': 'Cambiar contraseña',
      'account.password.current': 'Contraseña actual',
      'account.password.new': 'Contraseña nueva (mínimo 8 caracteres)',
      'account.password.submit': 'Actualizar contraseña',
      'account.password.changed': 'Contraseña actualizada',
      'account.wishlist.title': 'Mis favoritos',
      'account.wishlist.empty': 'Aún no tienes favoritos.',
      'wishlist.add': 'Guardar en favoritos',
      'wishlist.remove': 'Quitar de favoritos',
      'comments.title': 'Opiniones del producto',
      'comments.empty': 'Sé el primero en opinar.',
      'comments.form.title': 'Escribe tu opinión',
      'comments.form.rating': 'Calificación',
      'comments.form.text': 'Tu opinión',
      'comments.form.submit': 'Publicar opinión',
      'comments.loginToComment': 'Inicia sesión para opinar',
      'checkout.coupon.label': 'Cupón de descuento',
      'checkout.coupon.apply': 'Aplicar',
      'checkout.coupon.applied': 'Cupón aplicado',
      'checkout.coupon.invalid': 'El cupón no es válido o expiró',
      'checkout.discount': 'Descuento',
      'vendors.title': 'Nuestros vendedores',
      'vendors.empty': 'Aún no hay vendedores registrados.',
      'vendors.products': 'productos',
      'vendors.visit': 'Ver tienda',
      'vendor.store.title': 'Tienda',
      'vendor.panel.title': 'Panel de vendedor',
      'vendor.panel.balance': 'Saldo disponible',
      'vendor.panel.products': 'Mis productos',
      'vendor.panel.orders': 'Mis ventas',
      'vendor.panel.withdraws': 'Retiros',
      'vendor.apply.title': 'Conviértete en vendedor',
      'vendor.apply.subtitle': 'Envía tu solicitud y nuestro equipo la revisará.',
      'vendor.apply.shopName': 'Nombre de la tienda',
      'vendor.apply.shopNumber': 'Teléfono de la tienda',
      'vendor.apply.shopAddress': 'Dirección de la tienda',
      'vendor.apply.regNumber': 'RFC / Registro',
      'vendor.apply.message': 'Cuéntanos de tu negocio',
      'vendor.apply.submit': 'Enviar solicitud',
      'vendor.apply.pending': 'Tu solicitud está en revisión. Te avisaremos cuando sea aprobada.',
      'vendor.apply.pendingTitle': 'Solicitud enviada',
      'vendor.apply.sent': 'Lo que nos enviaste',
      // Estado "sin acceso" de quien SÍ solicitó (rechazado o revocado). Antes a esta
      // persona el sitio le mostraba el formulario vacío, sin explicación.
      'vendor.apply.inactiveTitle': 'Tu cuenta de vendedor no está activa',
      'vendor.apply.inactive': 'Puede que tu solicitud no haya sido aprobada o que se haya retirado tu acceso. Si crees que es un error, contáctanos.',
      'vendor.apply.reapply': 'Volver a solicitar',
      'vendor.apply.reapplyHint': 'Puedes actualizar tus datos y enviar la solicitud de nuevo.',
      'vendor.panel.eyebrow': 'Vender con nosotros',
      'vendor.panel.shop': 'Tu tienda',
      'vendor.panel.productsHint': 'Publica y administra el equipo que rentas o vendes.',
      'vendor.panel.ordersHint': 'Lo que te han comprado en el sitio.',
      'vendor.panel.withdrawsHint': 'Pide tu dinero y revisa el estado de tus retiros.',
      'vendor.panel.balanceHint': 'Al solicitar un retiro se descuenta de tu saldo. Si se rechaza, se te regresa.',
      'vendor.orders.title': 'Mis ventas',
      'vendor.withdraws.title': 'Retiros',
      'vendor.withdraws.available': 'Disponible',
      'vendor.back': 'Volver al panel',
      'vendor.products.new': 'Nuevo producto',
      'vendor.products.name': 'Nombre del producto',
      'vendor.products.category': 'Categoría',
      'vendor.products.price': 'Precio',
      'vendor.products.oldPrice': 'Precio anterior (tachado)',
      'vendor.products.stock': 'Existencias',
      'vendor.products.brand': 'Marca',
      'vendor.products.description': 'Descripción',
      'vendor.products.photo': 'Foto del producto',
      'vendor.products.isRental': 'Disponible en renta',
      'vendor.products.rentalFreight': 'Tarifa de flete por km (renta)',
      'vendor.products.create': 'Publicar producto',
      'vendor.products.created': 'Producto publicado',
      'vendor.products.deactivate': 'Desactivar',
      'vendor.products.empty': 'Aún no tienes productos.',
      'vendor.orders.empty': 'Aún no tienes ventas.',
      'vendor.withdraws.request': 'Solicitar retiro',
      'vendor.withdraws.amount': 'Monto',
      'vendor.withdraws.method': 'Método (transferencia, PayPal…)',
      'vendor.withdraws.reference': 'Referencia / datos de cuenta',
      'vendor.withdraws.submit': 'Solicitar',
      'vendor.withdraws.empty': 'No tienes retiros registrados.',
      'about.mision': 'Misión',
      'about.vision': 'Visión',
      'about.objetivos': 'Objetivos',
      'contact.title': 'Contacto',
      'contact.subtitle': 'Estamos para ayudarte. Escríbenos o llámanos.',
      'contact.email': 'Correo',
      'contact.phone': 'Teléfono',
      'contact.address': 'Dirección',
      'newsletter.title': 'Recibe nuestras novedades',
      'newsletter.placeholder': 'Tu correo electrónico',
      'newsletter.submit': 'Suscribirme',
      'newsletter.success': '¡Listo! Te avisaremos de las novedades.',
      'newsletter.error': 'No pudimos registrar tu correo.',
      'nav.about': 'Quiénes somos',
      'nav.vendors': 'Vendedores',
      'track.title': 'Rastrear pedido',
      'track.subtitle': 'Ingresa tu número de pedido y el correo con el que compraste.',
      'track.field.number': 'Número de pedido',
      'track.submit': 'Rastrear',
      'track.notFound': 'No encontramos un pedido con esos datos.',
      'track.entries.title': 'Historial de envío',
      'track.noEntries': 'Tu pedido aún no tiene eventos de envío.',
      'nav.track': 'Rastrear pedido',
      'account.quotes.title': 'Mis cotizaciones',
      'account.quotes.empty': 'Aún no tienes cotizaciones.',
      'account.orders.title': 'Mis pedidos',
      'account.orders.empty': 'Aún no tienes pedidos.',
      'account.orders.view': 'Ver detalle',
      'nav.myOrders': 'Mis pedidos',
      'nav.cart': 'Carrito',
      'nav.login': 'Iniciar sesión',
      'nav.register': 'Registrarse',
      'nav.home': 'Inicio',
      'nav.products': 'Productos',
      'nav.categories': 'Categorías',
      'nav.blog': 'Blog',
      'nav.contact': 'Contacto',
      'nav.wishlist': 'Favoritos',
      'nav.search': 'Buscar',
      'nav.menu': 'Menú',
      'topbar.hours': 'Lun–Sáb · 8:00–18:00',
      'topbar.track': 'Rastrear pedido',
      'topbar.sell': 'Vender con nosotros',
      'topbar.locale': 'MXN $ · ES',
      'footer.tagline':
        'Plataforma especializada en renta y venta de maquinaria industrial para proyectos de construcción.',
      'footer.col.company': 'Empresa',
      'footer.link.about': 'Quiénes somos',
      'footer.link.blog': 'Blog',
      'footer.link.jobs': 'Vacantes',
      'footer.link.press': 'Prensa',
      'footer.col.products': 'Productos',
      'footer.col.help': 'Ayuda',
      'footer.link.helpCenter': 'Centro de ayuda',
      'footer.link.track': 'Rastrear pedido',
      'footer.link.returns': 'Devoluciones',
      'footer.link.warranty': 'Garantías',
      'footer.link.contact': 'Contacto',
      'footer.terms': 'Términos',
      'footer.privacy': 'Privacidad',
      'footer.rights': 'Todos los derechos reservados',
    },
  },
};
