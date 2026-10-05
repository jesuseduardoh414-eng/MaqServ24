/**
 * Contenido plantilla de las páginas legales (Términos y Privacidad).
 * Fuente única: las páginas públicas lo usan como fallback y el editor del admin
 * lo carga como punto de partida cuando el token `legal` está vacío.
 * `body` admite varios párrafos separados por línea en blanco (\n\n).
 */
export interface LegalDocDefault {
  updated: string;
  intro: string;
  sections: Array<{ h: string; body: string }>;
}

export const LEGAL_DEFAULTS: { terms: LegalDocDefault; privacy: LegalDocDefault } = {
  terms: {
    updated: 'Julio 2026',
    intro: 'Estos Términos y Condiciones regulan el uso del sitio y los servicios de renta y venta de maquinaria de MAQSER24. Al usar el sitio, aceptas lo aquí descrito.',
    sections: [
      { h: 'Aceptación de los términos', body: 'Al acceder y utilizar el sitio de MAQSER24 (el "Sitio"), aceptas quedar obligado por estos Términos y Condiciones. Si no estás de acuerdo con ellos, te pedimos no utilizar el Sitio ni contratar nuestros servicios.\n\nEstos términos aplican a todas las personas que naveguen, se registren, coticen, renten o compren a través del Sitio.' },
      { h: 'Uso del sitio', body: 'Te comprometes a usar el Sitio de forma lícita, a no interferir con su funcionamiento y a proporcionar información veraz y actualizada al registrarte o al solicitar una cotización o pedido.\n\nNos reservamos el derecho de suspender o cancelar cuentas que hagan un uso indebido del Sitio o incumplan estos términos.' },
      { h: 'Cuenta de usuario', body: 'Para ciertas funciones (guardar favoritos, dar seguimiento a pedidos, cotizar o comprar) necesitas una cuenta. Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.' },
      { h: 'Cotizaciones, renta y disponibilidad', body: 'Los equipos publicados están sujetos a disponibilidad. Una cotización o solicitud no constituye una reserva confirmada hasta que sea aceptada por nosotros por escrito y, en su caso, se cubra el anticipo correspondiente.\n\nLa renta de maquinaria puede incluir condiciones específicas (periodo, operador, seguro, traslado). El traslado se cotiza según la ubicación de la obra y no está incluido en el precio del equipo salvo que se indique expresamente.' },
      { h: 'Precios y pagos', body: 'Los precios se muestran en pesos mexicanos (MXN). Salvo que se indique lo contrario, no incluyen IVA, el cual se agrega al momento del cobro conforme a la legislación aplicable.\n\nLos pagos se procesan por los medios habilitados en el Sitio. Nos reservamos el derecho de modificar precios y promociones en cualquier momento; los cambios no afectan pedidos ya confirmados.' },
      { h: 'Entrega, devoluciones y cancelaciones', body: 'Las fechas de entrega son estimadas y pueden variar por causas logísticas o de fuerza mayor. Las políticas de cancelación y devolución dependen del tipo de servicio (renta o venta) y se informan al confirmar el pedido.\n\nPara solicitar una cancelación, devolución o aclaración, escríbenos a info@maqserv24.com.' },
      { h: 'Responsabilidad del cliente sobre el equipo', body: 'Durante el periodo de renta, el cliente es responsable del uso adecuado del equipo conforme a su ficha técnica y a las indicaciones de seguridad. Cualquier daño, pérdida o uso negligente podrá generar cargos adicionales conforme al contrato de renta.' },
      { h: 'Propiedad intelectual', body: 'Las marcas, logotipos, textos, imágenes y demás contenidos del Sitio son propiedad de MAQSER24 o de sus titulares y están protegidos por las leyes aplicables. No está permitida su reproducción sin autorización.' },
      { h: 'Limitación de responsabilidad', body: 'MAQSER24 no será responsable por daños indirectos o incidentales derivados del uso del Sitio, salvo lo que la legislación aplicable disponga. La información técnica es orientativa y puede variar según el modelo específico entregado.' },
      { h: 'Modificaciones', body: 'Podemos actualizar estos Términos en cualquier momento. La versión vigente será la publicada en esta página. El uso continuado del Sitio implica la aceptación de los cambios.' },
      { h: 'Legislación y jurisdicción', body: 'Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes del domicilio de la empresa, renunciando a cualquier otro fuero.' },
      { h: 'Contacto', body: 'Si tienes dudas sobre estos Términos, contáctanos en info@maqserv24.com.' },
    ],
  },
  privacy: {
    updated: 'Julio 2026',
    intro: 'En MAQSER24 valoramos tu privacidad. Este Aviso explica qué datos personales recabamos, para qué los usamos y cómo puedes ejercer tus derechos.',
    sections: [
      { h: 'Responsable del tratamiento', body: 'MAQSER24 (el "Responsable") es responsable del uso y protección de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su reglamento.\n\nPara cualquier asunto relacionado con este Aviso, puedes contactarnos en info@maqserv24.com.' },
      { h: 'Datos personales que recabamos', body: 'Podemos recabar datos de identificación y contacto (nombre, correo electrónico, teléfono, empresa), datos de facturación y de la dirección de entrega, así como información sobre tus pedidos, cotizaciones y navegación en el sitio.\n\nNo recabamos datos personales sensibles.' },
      { h: 'Finalidades del tratamiento', body: 'Finalidades primarias (necesarias para el servicio): crear y administrar tu cuenta, procesar cotizaciones, rentas, compras y pagos, dar seguimiento y entrega de pedidos, y brindar atención al cliente.\n\nFinalidades secundarias (opcionales): enviarte novedades, promociones y encuestas. Puedes oponerte a estas en cualquier momento sin afectar el servicio principal.' },
      { h: 'Transferencias de datos', body: 'Tus datos pueden compartirse con proveedores que nos apoyan en la operación (procesadores de pago, mensajería, alojamiento y CRM), quienes están obligados a mantener su confidencialidad. No vendemos tus datos personales a terceros.' },
      { h: 'Derechos ARCO', body: 'Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus datos (derechos ARCO), así como a revocar tu consentimiento. Para ejercerlos, envía tu solicitud a info@maqserv24.com indicando tu nombre y el derecho que deseas ejercer.\n\nDaremos respuesta a tu solicitud en los plazos que marca la ley.' },
      { h: 'Uso de cookies y tecnologías similares', body: 'El sitio utiliza cookies y tecnologías similares para recordar tus preferencias (por ejemplo, el contenido de tu carrito o el modo de color) y para mejorar tu experiencia. Puedes deshabilitarlas desde la configuración de tu navegador, aunque algunas funciones podrían verse afectadas.' },
      { h: 'Cambios al Aviso de Privacidad', body: 'Este Aviso puede actualizarse para reflejar cambios en nuestras prácticas o en la legislación. La versión vigente siempre estará disponible en esta página.' },
    ],
  },
};
