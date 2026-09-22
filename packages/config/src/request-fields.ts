/**
 * QUÉ PREGUNTAR EN CADA SERVICIO.
 *
 * Sale del documento institucional, secciones 8 a 13, donde cada categoría trae
 * su lista de "información mínima que la plataforma debe capturar". No es una
 * lista de campos bonita: el documento explica por qué existe cada uno —"una
 * solicitud profesional no puede reducirse a 'necesito una excavadora'"— y
 * advierte que sin estas variables las cotizaciones salen incompletas o cambian
 * después.
 *
 * Hasta ahora el formulario preguntaba lo mismo para una excavadora que para una
 * pipa, y por eso quien cotiza tiene que llamar de vuelta a preguntar lo básico.
 *
 * Los campos son DATOS, no código: viven aquí para poder moverlos sin tocar el
 * formulario, y el día que se editen desde el panel esto es lo que se edita.
 *
 * CINCO LÍNEAS desde el 2026-09-21 (antes seis). Equipo menor y plataformas de
 * elevación pasaron a ser subcategorías de maquinaria pesada, y agua en pipas +
 * volteos se unieron en "transporte y servicios de obra"; entran dos líneas
 * nuevas: materiales para construcción (concreto, acero, block, cemento) y
 * soluciones asfálticas. Las claves de los campos que ya existían se conservan
 * (`capacidad_pipa`, `viajes`, `material`…) para que las solicitudes viejas y
 * las nuevas se lean igual.
 */

export type RequestFieldType = 'texto' | 'numero' | 'fecha' | 'opcion' | 'si-no' | 'parrafo';

export interface RequestField {
  /** Clave estable. NO se traduce ni se cambia: es lo que queda guardado. */
  key: string;
  label: string;
  type: RequestFieldType;
  /** Solo para `opcion`. */
  options?: string[];
  /** Texto de ayuda cuando la pregunta no se explica sola. */
  hint?: string;
  required?: boolean;
  /** Sufijo visible (t, m³, km…). */
  unit?: string;
}

export interface RequestForm {
  /** Slug de la categoría de servicio. */
  category: string;
  title: string;
  /** Una línea que explique al cliente por qué se le pregunta esto. */
  intro: string;
  fields: RequestField[];
}

const SI_NO = ['Sí', 'No', 'Por definir'];
const QUIEN = ['Nosotros', 'El proveedor', 'Por definir'];

/**
 * Preguntas comunes a todo servicio de obra. Se anteponen a las específicas
 * porque son las que sitúan el trabajo: dónde y cuándo.
 */
const COMUNES: RequestField[] = [
  { key: 'obra_ubicacion', label: 'Ubicación de la obra', type: 'texto', required: true, hint: 'Calle y municipio, o referencia clara' },
  { key: 'fecha_inicio', label: 'Fecha de inicio', type: 'fecha', required: true },
];

export const REQUEST_FORMS: RequestForm[] = [
  {
    category: 'maquinaria-pesada',
    title: 'Renta de maquinaria pesada',
    intro:
      'Estos datos definen qué equipo puede entrar a la obra y cuánto cuesta llevarlo. Sin ellos la cotización cambia después.',
    fields: [
      { key: 'tipo_equipo', label: 'Tipo de equipo', type: 'texto', required: true, hint: 'Excavadora, retroexcavadora, motoconformadora, compactador, bulldozer, plataforma, generador…' },
      { key: 'capacidad', label: 'Capacidad o tonelaje', type: 'texto', unit: 't', hint: 'Si no lo sabes, describe el trabajo' },
      // Plataformas y grúas: la altura es lo que decide si el equipo sirve.
      { key: 'altura', label: 'Altura de trabajo requerida', type: 'numero', unit: 'm', hint: 'Solo para plataformas de elevación o grúas' },
      { key: 'implementos', label: 'Implementos requeridos', type: 'texto', hint: 'Martillo, bote de limpieza, rastrillo…' },
      ...COMUNES,
      { key: 'duracion', label: 'Duración estimada', type: 'texto', required: true, hint: 'Días, semanas o meses' },
      { key: 'turno', label: 'Horas de trabajo o turno', type: 'texto', hint: '8 horas, doble turno, jornada continua…' },
      { key: 'operador', label: '¿Necesitas operador?', type: 'opcion', options: SI_NO, required: true },
      { key: 'acceso', label: 'Condiciones de acceso y terreno', type: 'parrafo', hint: 'Ancho de entrada, pendientes, piso firme o suelto' },
      { key: 'documentacion', label: 'Requisitos documentales o de seguridad', type: 'parrafo', hint: 'Pólizas, DC-3, inducción, permisos de la obra' },
      { key: 'combustible', label: '¿Quién pone el combustible?', type: 'opcion', options: QUIEN },
    ],
  },
  {
    category: 'transporte-y-servicios-de-obra',
    title: 'Transporte y servicios de obra',
    intro:
      'Pipas y volteos no se cotizan por equipo sino por viaje: lo que manda son el recorrido, el volumen y la frecuencia.',
    fields: [
      { key: 'servicio', label: '¿Qué necesitas?', type: 'opcion', options: ['Agua en pipas', 'Acarreo en camión de volteo', 'Ambos'], required: true },
      // --- Pipas ---
      { key: 'uso_agua', label: '¿Para qué es el agua?', type: 'opcion', options: ['Terracerías / compactación', 'Riego y control de polvo', 'Obra general', 'Otro'], hint: 'Solo si pides agua: define el tipo de agua que se puede usar' },
      { key: 'capacidad_pipa', label: 'Capacidad de pipa', type: 'opcion', options: ['10,000 litros', '20,000 litros', 'La que convenga'], hint: 'Solo si pides agua' },
      // --- Volteos ---
      { key: 'material', label: 'Material a acarrear', type: 'texto', hint: 'Solo si pides volteo: producto de excavación, escombro, tierra, arena…' },
      { key: 'trabajo', label: 'Tipo de acarreo', type: 'opcion', options: ['Retiro de material', 'Acarreo', 'Suministro'], hint: 'Solo si pides volteo' },
      { key: 'volumen', label: 'Volumen estimado', type: 'texto', unit: 'm³', hint: 'Si no lo sabes, describe el frente de trabajo' },
      { key: 'capacidad_unidad', label: 'Capacidad de unidad', type: 'opcion', options: ['7 m³', '14 m³', 'La que convenga'], hint: 'Solo si pides volteo' },
      // --- Comunes al viaje ---
      { key: 'origen', label: 'Punto de carga', type: 'texto', hint: 'Si no tienes, el proveedor propone uno' },
      { key: 'destino', label: 'Destino', type: 'texto', required: true, hint: 'La obra, un tiro autorizado o un banco' },
      { key: 'viajes', label: 'Viajes estimados', type: 'numero', required: true, hint: 'Por día, o en total' },
      { key: 'frecuencia', label: 'Frecuencia', type: 'opcion', options: ['Una sola vez', 'Diaria', 'Varias veces por semana', 'Continua durante semanas'], required: true },
      { key: 'fecha_inicio', label: 'Fecha de inicio', type: 'fecha', required: true },
      { key: 'horario', label: 'Horario y restricciones', type: 'texto', hint: 'Si hay horas en que no se puede entrar a la obra o circular' },
      { key: 'acceso', label: 'Acceso y maniobra', type: 'parrafo', hint: 'Si la unidad puede entrar y dónde descarga' },
    ],
  },
  {
    category: 'triturados',
    title: 'Triturados',
    intro:
      'El precio se compone de dos cosas distintas: el material y llevarlo. Por eso se pregunta la especificación y el recorrido por separado.',
    fields: [
      { key: 'material', label: 'Material y especificación', type: 'texto', required: true, hint: 'Arena, grava 3/4", base hidráulica, CNC…' },
      { key: 'cantidad', label: 'Cantidad', type: 'texto', required: true, unit: 'm³ o t', hint: 'Indica si es en metros cúbicos o toneladas' },
      { key: 'banco', label: 'Banco o pedrera de preferencia', type: 'texto', hint: 'Déjalo vacío si quieres que se proponga uno' },
      { key: 'obra_ubicacion', label: 'Destino de obra', type: 'texto', required: true },
      { key: 'fecha_inicio', label: 'Fecha de entrega', type: 'fecha', required: true },
      { key: 'ventana', label: 'Ventana de entrega', type: 'texto', hint: 'Todo de una vez, o por parcialidades' },
      { key: 'acceso_descarga', label: 'Condiciones de acceso y descarga', type: 'parrafo', hint: 'Si entra un camión completo y dónde se tira el material' },
      { key: 'ensayes', label: '¿Necesitas ensayes de laboratorio?', type: 'opcion', options: SI_NO },
    ],
  },
  {
    category: 'materiales-para-construccion',
    title: 'Materiales para construcción',
    intro:
      'Concreto, acero, block y cemento se cotizan por especificación y volumen; la entrega depende de cuánto cabe en cada viaje y de cuándo lo necesitas en obra.',
    fields: [
      { key: 'material', label: 'Material', type: 'opcion', options: ['Concreto premezclado', 'Acero de refuerzo', 'Block', 'Cemento', 'Varios'], required: true },
      { key: 'especificacion', label: 'Especificación', type: 'texto', required: true, hint: 'f\'c 250 y revenimiento, calibre de varilla, medida del block, tipo de cemento…' },
      { key: 'cantidad', label: 'Cantidad', type: 'texto', required: true, unit: 'm³, t, piezas o bultos', hint: 'Indica la unidad' },
      { key: 'bombeo', label: '¿Necesitas bomba para el concreto?', type: 'opcion', options: SI_NO, hint: 'Solo para concreto premezclado' },
      { key: 'obra_ubicacion', label: 'Destino de obra', type: 'texto', required: true },
      { key: 'fecha_inicio', label: 'Fecha de entrega', type: 'fecha', required: true },
      { key: 'ventana', label: 'Entregas', type: 'texto', hint: 'Todo de una vez, o por parcialidades y con qué frecuencia' },
      { key: 'acceso_descarga', label: 'Condiciones de acceso y descarga', type: 'parrafo', hint: 'Si entra la olla o el tráiler, y con qué se descarga' },
      { key: 'certificados', label: '¿Necesitas certificados de calidad?', type: 'opcion', options: SI_NO, hint: 'Pruebas de resistencia, certificados de molino…' },
    ],
  },
  {
    category: 'soluciones-asfalticas',
    title: 'Soluciones asfálticas',
    intro:
      'La carpeta asfáltica se cotiza por superficie y espesor, y cambia mucho si solo es suministro o también aplicación. Con estos datos se puede dar un precio que no se mueva.',
    fields: [
      { key: 'trabajo', label: '¿Qué necesitas?', type: 'opcion', options: ['Suministro de mezcla asfáltica', 'Suministro y aplicación de carpeta', 'Bacheo o reparación', 'Por definir'], required: true },
      { key: 'superficie', label: 'Superficie a cubrir', type: 'numero', unit: 'm²', required: true, hint: 'Si no la sabes, largo por ancho aproximado' },
      { key: 'espesor', label: 'Espesor de carpeta', type: 'numero', unit: 'cm', hint: 'Si no lo sabes, describe el uso: estacionamiento, vialidad, patio de maniobras' },
      { key: 'tipo_mezcla', label: 'Tipo de mezcla', type: 'texto', hint: 'Caliente, tibia o en frío; granulometría si la tienes' },
      { key: 'estado_base', label: 'Estado de la base', type: 'parrafo', hint: 'Base nueva, carpeta existente, requiere fresado o riego de liga' },
      { key: 'obra_ubicacion', label: 'Ubicación de la obra', type: 'texto', required: true },
      { key: 'fecha_inicio', label: 'Fecha de inicio', type: 'fecha', required: true },
      { key: 'ventana', label: 'Horarios y restricciones', type: 'texto', hint: 'Cierres viales, horas permitidas, trabajo nocturno' },
      { key: 'acceso', label: 'Acceso y maniobra', type: 'parrafo', hint: 'Si entran los camiones y la pavimentadora' },
    ],
  },
];

/** Formulario de una categoría. `null` si esa categoría no tiene uno definido. */
export function requestFormFor(categorySlug: string | null | undefined): RequestForm | null {
  if (!categorySlug) return null;
  return REQUEST_FORMS.find((f) => f.category === categorySlug) ?? null;
}

/**
 * Convierte las respuestas en texto legible para quien cotiza.
 *
 * Se guarda ADEMÁS del JSON estructurado: así el equipo lo lee en el correo o en
 * la pantalla de cotizaciones sin depender de que exista una vista nueva.
 */
export function requestAnswersToText(
  form: RequestForm,
  answers: Record<string, string>,
): string {
  const lineas = form.fields
    .map((f) => {
      const v = (answers[f.key] ?? '').trim();
      if (!v) return null;
      return `${f.label}: ${v}${f.unit ? ` ${f.unit}` : ''}`;
    })
    .filter((l): l is string => l !== null);
  if (lineas.length === 0) return '';
  return `${form.title}\n${lineas.map((l) => `· ${l}`).join('\n')}`;
}
