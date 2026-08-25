/**
 * QUÉ PREGUNTAR EN CADA SERVICIO.
 *
 * Sale literal del documento institucional, secciones 8 a 13, donde cada
 * categoría trae su lista de "información mínima que la plataforma debe
 * capturar". No es una lista de campos bonita: el documento explica por qué
 * existe cada uno —"una solicitud profesional no puede reducirse a 'necesito una
 * excavadora'"— y advierte que sin estas variables las cotizaciones salen
 * incompletas o cambian después.
 *
 * Hasta ahora el formulario preguntaba lo mismo para una excavadora que para una
 * pipa, y por eso quien cotiza tiene que llamar de vuelta a preguntar lo básico.
 *
 * Los campos son DATOS, no código: viven aquí para poder moverlos sin tocar el
 * formulario, y el día que se editen desde el panel esto es lo que se edita.
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
    title: 'Maquinaria pesada',
    intro:
      'Estos datos definen qué equipo puede entrar a la obra y cuánto cuesta llevarlo. Sin ellos la cotización cambia después.',
    fields: [
      { key: 'tipo_equipo', label: 'Tipo de equipo', type: 'texto', required: true, hint: 'Excavadora, retroexcavadora, motoconformadora…' },
      { key: 'capacidad', label: 'Capacidad o tonelaje', type: 'texto', unit: 't', hint: 'Si no lo sabes, describe el trabajo' },
      { key: 'implementos', label: 'Implementos requeridos', type: 'texto', hint: 'Martillo, bote de limpieza, rastrillo…' },
      ...COMUNES,
      { key: 'duracion', label: 'Duración estimada', type: 'texto', required: true, hint: 'Días, semanas o meses' },
      { key: 'turno', label: 'Horas de trabajo o turno', type: 'texto', hint: '8 horas, doble turno, jornada continua…' },
      { key: 'operador', label: '¿Necesitas operador?', type: 'opcion', options: SI_NO, required: true },
      { key: 'acceso', label: 'Condiciones de acceso y terreno', type: 'parrafo', hint: 'Ancho de entrada, pendientes, piso firme o suelto' },
      { key: 'documentacion', label: 'Requisitos documentales o de seguridad', type: 'parrafo', hint: 'Pólizas, DC-3, inducción, permisos de la obra' },
      { key: 'combustible', label: '¿Quién pone el combustible?', type: 'opcion', options: ['Nosotros', 'El proveedor', 'Por definir'] },
    ],
  },
  {
    category: 'equipo-menor',
    title: 'Equipo menor',
    intro: 'Equipo compacto para trabajos puntuales. Lo que define el precio es cuántos, cuánto tiempo y a dónde llegan.',
    fields: [
      { key: 'tipo_equipo', label: 'Tipo de equipo o herramienta', type: 'texto', required: true },
      { key: 'cantidad', label: 'Cantidad', type: 'numero', required: true },
      ...COMUNES,
      { key: 'periodo', label: 'Periodo de renta', type: 'texto', required: true, hint: 'Días, semanas o meses' },
      { key: 'accesorios', label: 'Accesorios y consumibles', type: 'texto', hint: 'Mangueras, brocas, discos, extensiones…' },
      { key: 'traslado', label: '¿Quién lleva y recoge el equipo?', type: 'opcion', options: ['Nosotros', 'El proveedor', 'Por definir'] },
    ],
  },
  {
    category: 'plataformas-de-elevacion',
    title: 'Plataformas de elevación',
    intro:
      'Aquí lo importante es que la plataforma sea técnicamente compatible con la tarea: de nada sirve cotizar una que no alcanza o no entra.',
    fields: [
      { key: 'tipo_plataforma', label: 'Tipo de plataforma', type: 'opcion', options: ['Tijera', 'Brazo articulado', 'Brazo telescópico', 'No estoy seguro'], required: true },
      { key: 'altura', label: 'Altura de trabajo requerida', type: 'numero', unit: 'm', required: true },
      { key: 'alcance', label: 'Alcance horizontal', type: 'numero', unit: 'm' },
      { key: 'carga', label: 'Capacidad de carga', type: 'texto', hint: 'Cuántas personas y cuánta herramienta suben' },
      { key: 'interior_exterior', label: '¿Uso interior o exterior?', type: 'opcion', options: ['Interior', 'Exterior', 'Ambos'], required: true },
      { key: 'superficie', label: 'Superficie y pendientes', type: 'texto', hint: 'Piso terminado, terracería, desnivel' },
      { key: 'acceso_dimensiones', label: 'Dimensiones de acceso', type: 'texto', hint: 'Ancho de puerta o pasillo por donde debe entrar' },
      { key: 'energia', label: 'Energía requerida', type: 'opcion', options: ['Eléctrica', 'Combustión', 'Indistinto'] },
      ...COMUNES,
      { key: 'duracion', label: 'Duración estimada', type: 'texto', required: true },
      { key: 'certificaciones', label: 'Certificaciones o requisitos de seguridad', type: 'parrafo' },
    ],
  },
  {
    category: 'agua-en-pipas',
    title: 'Agua en pipas',
    intro:
      'Este servicio no se cotiza por equipo sino por viaje: lo que manda son el recorrido, el volumen y la frecuencia.',
    fields: [
      { key: 'uso_agua', label: '¿Para qué es el agua?', type: 'opcion', options: ['Terracerías / compactación', 'Riego y control de polvo', 'Obra general', 'Otro'], required: true, hint: 'Define el tipo de agua que se puede usar' },
      { key: 'capacidad_pipa', label: 'Capacidad de pipa', type: 'opcion', options: ['10,000 litros', '20,000 litros', 'La que convenga'], required: true },
      { key: 'origen', label: 'Punto de carga', type: 'texto', hint: 'Si no tienes, el proveedor propone uno' },
      { key: 'destino', label: 'Destino', type: 'texto', required: true },
      { key: 'viajes', label: 'Viajes estimados', type: 'numero', required: true, hint: 'Por día, o en total' },
      { key: 'frecuencia', label: 'Frecuencia', type: 'opcion', options: ['Una sola vez', 'Diaria', 'Varias veces por semana', 'Continua durante semanas'], required: true },
      { key: 'fecha_inicio', label: 'Fecha de inicio', type: 'fecha', required: true },
      { key: 'horario', label: 'Horario de servicio', type: 'texto', hint: 'Si hay restricción de horas para entrar a la obra' },
      { key: 'acceso', label: 'Acceso y maniobra', type: 'parrafo', hint: 'Si la pipa puede entrar y dónde descarga' },
    ],
  },
  {
    category: 'volteos',
    title: 'Volteos',
    intro:
      'Un volteo es capacidad logística, no un vehículo: lo que define el costo es el material, la distancia y cuántos viajes.',
    fields: [
      { key: 'material', label: 'Tipo de material', type: 'texto', required: true, hint: 'Producto de excavación, escombro, tierra, arena…' },
      { key: 'trabajo', label: '¿Qué se necesita?', type: 'opcion', options: ['Retiro de material', 'Acarreo', 'Suministro'], required: true },
      { key: 'origen', label: 'Punto de carga', type: 'texto', required: true },
      { key: 'destino', label: 'Destino', type: 'texto', required: true, hint: 'Tiro autorizado, banco o la propia obra' },
      { key: 'volumen', label: 'Volumen estimado', type: 'texto', unit: 'm³', hint: 'Si no lo sabes, describe el frente de trabajo' },
      { key: 'capacidad_unidad', label: 'Capacidad de unidad', type: 'opcion', options: ['7 m³', '14 m³', 'La que convenga'] },
      { key: 'viajes', label: 'Viajes requeridos', type: 'numero' },
      { key: 'fecha_inicio', label: 'Fecha de inicio', type: 'fecha', required: true },
      { key: 'horarios', label: 'Horarios y restricciones viales', type: 'parrafo', hint: 'Si hay horas en que no se puede circular o entrar' },
    ],
  },
  {
    category: 'triturados',
    title: 'Triturados',
    intro:
      'El precio se compone de dos cosas distintas: el material y llevarlo. Por eso se pregunta la especificación y el recorrido por separado.',
    fields: [
      { key: 'material', label: 'Material y especificación', type: 'texto', required: true, hint: 'Base hidráulica, sello, grava 3/4", arena…' },
      { key: 'cantidad', label: 'Cantidad', type: 'texto', required: true, unit: 'm³ o t', hint: 'Indica si es en metros cúbicos o toneladas' },
      { key: 'banco', label: 'Banco o pedrera de preferencia', type: 'texto', hint: 'Déjalo vacío si quieres que se proponga uno' },
      { key: 'obra_ubicacion', label: 'Destino de obra', type: 'texto', required: true },
      { key: 'fecha_inicio', label: 'Fecha de entrega', type: 'fecha', required: true },
      { key: 'ventana', label: 'Ventana de entrega', type: 'texto', hint: 'Todo de una vez, o por parcialidades' },
      { key: 'acceso_descarga', label: 'Condiciones de acceso y descarga', type: 'parrafo', hint: 'Si entra un camión completo y dónde se tira el material' },
      { key: 'ensayes', label: '¿Necesitas ensayes de laboratorio?', type: 'opcion', options: SI_NO },
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
