import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { separarTextoSector } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { ponerTextosDeSector } from './videos-sectores';

/**
 * LOS TEXTOS NUEVOS DE LOS SECTORES (2026-11-16, el dueño: «cambia ese texto,
 * es el que va en sectores»). Mandó cuatro documentos: Infraestructura,
 * Construcción industrial, Desarrollos inmobiliarios y Urbanización y vialidad.
 *
 * Desde aquí no se puede entrar al panel de producción, así que se cargan al
 * arrancar la API, UNA vez (marca en `contenido_cambios`), con el mismo
 * acomodo que «Pegar el texto completo» (separarTextoSector). Van sobre los
 * cuatro sectores que salen en el inicio, en el orden de los documentos (I a
 * IV), conservando su imagen o video: Infraestructura sigue siendo
 * Infraestructura y Residencial, Transporte de Material y Excavación pasan a
 * ser los otros tres. Solo se toca un sector si todavía tiene su nombre de
 * antes (o ya el nuevo): si el dueño lo cambió a mano, se respeta.
 */
const NOMBRE = 'sectores-textos-2026-11-16';
const AJUSTE = 'contenido_cambios';

interface TextoSector { id: number; titulo: string; antes: string[]; texto: string }

const TEXTOS: TextoSector[] = [
  {
    id: 7,
    titulo: "Infraestructura",
    antes: ["infraestructura"],
    texto: "I.Infraestructura\n\nConectamos maquinaria, equipos y servicios especializados con los proyectos que construyen el futuro.\n\nMAQSER24 facilita el acceso a soluciones para obras de infraestructura, urbanización, carreteras, terracerías y construcción civil, integrando proveedores, maquinaria pesada, materiales y servicios de apoyo a través de una plataforma digital.\n\nSobre este sector\n\nLos proyectos de infraestructura requieren maquinaria adecuada, suministros oportunos y una coordinación eficiente de los recursos disponibles.\n\nEn MAQSER24 conectamos las necesidades de cada obra con proveedores de excavadoras, retroexcavadoras, motoconformadoras, vibrocompactadores, camiones de volteo, pipas de agua y materiales para construcción.\n\nNuestro objetivo es simplificar la búsqueda y cotización de los recursos necesarios para ejecutar proyectos con mayor eficiencia operativa.\n\nTrayectoria\n\nMAQSER24 nace del conocimiento y la experiencia en el sector de la construcción, particularmente en movimientos de tierra, urbanización, infraestructura vial, obras hidráulicas y proyectos industriales.\n\nEsta experiencia nos permite comprender las necesidades técnicas y logísticas de cada proyecto, desde la selección de maquinaria hasta la coordinación de materiales, transportes y servicios especializados.\n\nCombinamos conocimiento de campo con herramientas digitales para facilitar soluciones acordes con las necesidades reales de la industria.\n\nNuestra esencia\n\nLa infraestructura del futuro necesita maquinaria, capacidad operativa y tecnología conectadas.\n\nEn MAQSER24 trabajamos para transformar la manera en que las empresas constructoras encuentran y contratan maquinaria y servicios.\n\nNuestra propuesta integra una red de proveedores y soluciones digitales orientadas a reducir tiempos de búsqueda, agilizar cotizaciones y facilitar la coordinación operativa de los proyectos.\n\nMAQSER24 — Conectamos la capacidad que mueve la construcción.\n\nServicios\n\nEn MAQSER24 conectamos proyectos de infraestructura con maquinaria pesada, materiales y servicios especializados para la ejecución de obras civiles, urbanización, carreteras, terracerías y desarrollos industriales.\n\nFacilitamos el acceso a excavadoras, retroexcavadoras, motoconformadoras, vibrocompactadores y otros equipos necesarios para excavación, nivelación, compactación y movimiento de tierras.\n\nComplementamos nuestra oferta con servicios de acarreo en camiones de volteo, suministro de agua en pipas y entrega de materiales para construcción.\n\nUna sola plataforma para encontrar, solicitar y cotizar los recursos que necesita tu obra.\n\nNuestro diferencial\n\nEn MAQSER24 combinamos conocimiento técnico del sector de la construcción con herramientas digitales para simplificar la contratación de maquinaria y servicios.\n\nNuestra propuesta se fundamenta en tres principios: rapidez de respuesta, soluciones técnicamente adecuadas y coordinación confiable.\n\nConsideramos las características del proyecto, el tipo de maquinaria, la capacidad requerida, la ubicación y el periodo de contratación para facilitar la búsqueda de alternativas y la gestión de cotizaciones con nuestros proveedores.\n\nBuscamos reducir tiempos de búsqueda y mejorar la coordinación de recursos para que cada proyecto avance con mayor eficiencia.\n\nSoluciones para infraestructura\n\n* Maquinaria para nivelación de terrenos.\n* Maquinaria para excavaciones profundas.\n* Equipos para compactación de suelos.\n* Maquinaria para movimientos de tierra.\n* Camiones de volteo para acarreo de materiales.\n* Pipas para suministro de agua en obra.\n* Suministro de materiales pétreos y bases hidráulicas.",
  },
  {
    id: 8,
    titulo: "Construcción industrial",
    antes: ["residencial","construccion industrial"],
    texto: "CONSTRUCCIÓN INDUSTRIAL\n\nSoluciones para el desarrollo de naves y parques industriales\n\n1. SOBRE ESTE SECTOR\n\nMAQSER24 conecta proyectos de construcción industrial con maquinaria pesada, materiales y servicios especializados para la preparación de terrenos y conformación de plataformas de naves industriales, centros logísticos y plantas de producción.\n\nFacilitamos soluciones para cada etapa de los trabajos de terracerías, nivelación, compactación y urbanización industrial.\n\n2. TRAYECTORIA\n\nExperiencia que impulsa la construcción industrial.\n\nMAQSER24 integra conocimiento técnico del sector de la construcción con una red de proveedores de maquinaria, materiales y servicios.\n\nNuestro enfoque responde a las necesidades de contratistas y desarrolladores industriales que requieren capacidad operativa, coordinación logística y soluciones para ejecutar sus proyectos.\n\n3. ESENCIA\n\nConstruimos conexiones que impulsan la industria.\n\nNuestra esencia es conectar las necesidades de cada proyecto con maquinaria, materiales y servicios adecuados, simplificando los procesos de búsqueda, cotización y contratación.\n\nBuscamos reducir tiempos improductivos y facilitar el acceso a recursos para que cada proyecto continúe avanzando.\n\n4. SERVICIOS\n\nSoluciones integrales para plataformas industriales.\n\nFacilitamos maquinaria y servicios para despalmes, cortes, excavaciones, rellenos, conformación de plataformas, nivelación, compactación y preparación de terrenos industriales.\n\nComplementamos estas operaciones con suministro de materiales pétreos, acarreos, pipas de agua y otros recursos necesarios para el desarrollo de infraestructura industrial.\n\n5. EXCELENCIA\n\nPrecisión, capacidad y eficiencia en cada proyecto.\n\nEn MAQSER24 promovemos la eficiencia operativa mediante atención técnica, coordinación de proveedores y soluciones adaptadas a los requerimientos de cada obra.\n\nNuestro compromiso es facilitar recursos confiables, especificaciones claras y respuestas comerciales oportunas, contribuyendo a la productividad de los proyectos industriales.\n\n6. SERVICIOS INCLUIDOS\n\n* Despalme y preparación de terrenos: maquinaria para limpieza, retiro de material superficial y acondicionamiento del terreno.\n* Cortes y excavaciones: excavadoras y equipos para movimientos de tierra y preparación de plataformas.\n* Rellenos y terraplenes: suministro de materiales y maquinaria para conformación de plataformas industriales.\n* Nivelación y compactación: motoconformadoras, vibrocompactadores y equipos para preparación de superficies.\n* Suministro de triturados: base hidráulica, subbase, grava, arena y materiales pétreos.\n* Acarreos de materiales: camiones de volteo y tolvas para transporte de materiales y retiro de excavaciones.\n* Suministro de agua: pipas para humectación de terracerías y apoyo a procesos de compactación.\n* Concreto premezclado: suministro para elementos y obras civiles industriales.\n* Carpeta asfáltica: suministro y aplicación para vialidades y áreas de circulación industrial.\n* Renta de maquinaria pesada: excavadoras, retroexcavadoras, motoconformadoras, vibrocompactadores y equipos",
  },
  {
    id: 9,
    titulo: "Desarrollos inmobiliarios",
    antes: ["transporte de material","desarrollos inmobiliarios"],
    texto: "MAQSER24 | Soluciones para proyectos inmobiliarios\n\nConectamos maquinaria, materiales y servicios para impulsar la construcción de desarrollos inmobiliarios.\n\n1. SOBRE ESTE SECTOR\n\nSoluciones que impulsan el crecimiento inmobiliario.\n\nEl desarrollo inmobiliario requiere coordinación, disponibilidad de maquinaria, suministro oportuno de materiales y servicios especializados en cada etapa de construcción.\n\nMAQSER24 facilita el acceso a estos recursos mediante una plataforma digital que conecta desarrolladores, constructoras y contratistas con proveedores de maquinaria y servicios para proyectos residenciales, comerciales, verticales y de usos mixtos.\n\nUna plataforma. Múltiples soluciones para construir.\n\n2. TRAYECTORIA\n\nExperiencia en construcción respaldada por tecnología.\n\nMAQSER24 surge del conocimiento operativo del sector de la construcción, donde la disponibilidad de maquinaria, materiales y transporte resulta determinante para el cumplimiento de los programas de obra.\n\nNuestra propuesta integra experiencia técnica y una red de proveedores para simplificar la contratación y coordinación de recursos utilizados en desarrollos inmobiliarios.\n\n3. ESENCIA\n\nConectamos necesidades con soluciones reales.\n\nNuestra esencia es facilitar el trabajo de quienes construyen.\n\nMediante tecnología, conocimiento técnico y coordinación comercial, buscamos reducir tiempos de búsqueda, simplificar cotizaciones y conectar cada proyecto con los recursos adecuados.\n\nMAQSER24 convierte las necesidades de obra en oportunidades de solución.\n\n4. SERVICIOS\n\nTodo lo que tu desarrollo necesita, desde un solo lugar.\n\nMAQSER24 facilita el suministro y la contratación de maquinaria pesada, materiales de construcción y servicios logísticos para diferentes etapas de un desarrollo inmobiliario.\n\nDesde excavaciones, preparación del terreno y cimentaciones hasta urbanización, pavimentación y obras exteriores, conectamos a nuestros clientes con proveedores que pueden atender sus requerimientos técnicos y operativos.\n\n5. EXCELENCIA\n\nEficiencia, coordinación y confianza en cada proyecto.\n\nEn los desarrollos inmobiliarios, la productividad depende de contar con los recursos adecuados en el momento requerido.\n\nMAQSER24 promueve una operación basada en información técnica, tiempos de respuesta, condiciones comerciales claras y coordinación con proveedores.\n\nNuestro objetivo es contribuir a reducir tiempos improductivos, optimizar la logística y facilitar el suministro continuo de recursos para la construcción.\n\nMenos complicaciones. Mayor capacidad de respuesta.\n\n⸻\n\n6. SERVICIOS INCLUIDOS\n\nMaquinaria para excavación y cimentaciones\n\n* Excavadoras hidráulicas.\n* Retroexcavadoras.\n* Minicargadores Bobcat.\n* Equipo para movimiento de tierras.\n\nMaquinaria para terracerías y urbanización\n\n* Motoconformadoras.\n* Vibrocompactadores.\n* Bulldozers.\n* Equipos de nivelación y compactación.\n\nSuministro de materiales\n\n* Materiales triturados y pétreos.\n* Bases hidráulicas y sub-bases.\n* Arena y grava.\n* Concreto premezclado.\n* Block para construcción.\n\nServicios de transporte y logística\n\n* Camiones de volteo.\n* Acarreo y retiro de materiales.\n* Servicios de pipas de agua.\n* Transporte de maquinaria pesada, sujeto a disponibilidad del proveedor.\n\nPavimentación y obras exteriores\n\n* Suministro de carpeta asfáltica.\n* Aplicación de carpeta asfáltica.\n* Materiales para vialidades y estacionamientos.\n* Servicios complementarios de urbanización sujetos a cotización.\n\nAtención y coordinación comercial\n\n* Recepción de requerimientos técnicos.\n* Búsqueda de proveedores compatibles.\n* Solicitudes de cotización.\n* Coordinación de suministro y entregas.\n* Seguimiento comercial y operativo.\n\nTodos los servicios están sujetos a cobertura, cotización y confirmación de disponibilidad.",
  },
  {
    id: 10,
    titulo: "Urbanización y vialidad",
    antes: ["excavacion","escavacion","urbanizacion y vialidad"],
    texto: "URBANIZACIÓN Y VIALIDAD\n\nMAQSER24 | Soluciones integrales para el desarrollo urbano\n\n1. SOBRE ESTE SECTOR\n\nLa urbanización y la infraestructura vial son fundamentales para el crecimiento ordenado de las ciudades, los desarrollos habitacionales, comerciales e industriales.\n\nEn MAQSER24 conectamos proyectos de urbanización y vialidad con maquinaria pesada, materiales y servicios especializados para ejecutar trabajos de terracerías, pavimentación, construcción de vialidades y acondicionamiento de superficies.\n\nFacilitamos el acceso a recursos esenciales para desarrollar infraestructura urbana con eficiencia, continuidad operativa y soluciones adaptadas a las necesidades de cada obra.\n\n2. TRAYECTORIA\n\nExperiencia técnica que impulsa el desarrollo urbano.\n\nMAQSER24 nace del conocimiento operativo del sector de la construcción, particularmente de las necesidades de maquinaria, materiales, transporte y servicios que demandan los proyectos de urbanización.\n\nNuestra propuesta integra experiencia técnica y una red de proveedores para facilitar la atención de obras viales, desarrollos urbanos y proyectos de infraestructura, desde la preparación del terreno hasta las etapas de pavimentación.\n\n3. ESENCIA\n\nConectamos recursos. Impulsamos proyectos. Construimos posibilidades.\n\nEntendemos que una obra de urbanización requiere coordinación, suministro oportuno y equipos adecuados para mantener la productividad.\n\nNuestra esencia consiste en simplificar el acceso a maquinaria pesada, materiales y servicios mediante una plataforma que conecta las necesidades reales de cada proyecto con soluciones técnicas y operativas.\n\n4. SERVICIOS\n\nSoluciones para cada etapa de urbanización y vialidad.\n\nMAQSER24 facilita la contratación y coordinación de recursos para trabajos de preparación de terrenos, formación de plataformas, terracerías, construcción de bases, pavimentación asfáltica y suministro de materiales.\n\nIntegramos maquinaria especializada, transporte, agregados pétreos, concreto y servicios complementarios para atender proyectos de calles, avenidas, accesos industriales y desarrollos inmobiliarios.\n\nNuestro enfoque es reducir los tiempos de búsqueda y cotización, ofreciendo alternativas adecuadas a las características técnicas y logísticas de cada obra.\n\n5. EXCELENCIA\n\nPrecisión, capacidad operativa y compromiso con cada proyecto.\n\nEn MAQSER24 entendemos que la calidad de una obra comienza con la selección correcta de maquinaria, materiales y proveedores.\n\nPromovemos soluciones respaldadas por criterios técnicos, especificaciones de los materiales, coordinación logística y seguimiento comercial.\n\nBuscamos contribuir a la productividad de nuestros clientes mediante procesos ágiles de cotización, atención especializada y una red de suministro confiable.\n\n6. SERVICIOS INCLUIDOS\n\nSoluciones disponibles mediante suministro, renta y coordinación especializada:\n\n* Terracerías y movimiento de tierras: maquinaria para excavaciones, cortes, rellenos, nivelaciones y conformación de plataformas.\n* Preparación de superficies: equipos para trabajos de subrasante, nivelación y compactación.\n* Bases y subbases: suministro de materiales pétreos para estructuras de pavimento.\n* Pavimentación asfáltica: suministro y aplicación de carpeta asfáltica.\n* Materiales triturados: arena, grava, base hidráulica, sello y agregados para construcción.\n* Concreto premezclado: suministro para elementos de infraestructura urbana y obras civiles.\n* Renta de maquinaria pesada: excavadoras, retroexcavadoras, motoconformadoras, vibrocompactadores y minicargadores.\n* Acarreos en camiones de volteo: transporte de materiales pétreos, productos de excavación y retiro de escombro.\n* Suministro de agua en pipas: abastecimiento para riego de terracerías, compactación y actividades de construcción.\n* Suministro de block: materiales para obras complementarias de urbanización",
  },
];

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

@Injectable()
export class SectoresTextos20261116 implements OnApplicationBootstrap {
  private readonly log = new Logger('SectoresTextos20261116');

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 30_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;
      const puestos: string[] = [];
      for (const t of TEXTOS) {
        const s = await prisma.strategic_sectors.findUnique({ where: { id: t.id }, select: { title: true } });
        if (!s || !t.antes.includes(normal(s.title))) {
          this.log.warn(`Sector ${t.id} («${s?.title ?? 'no existe'}»): no es el esperado, no se toca.`);
          continue;
        }
        const r = separarTextoSector(t.texto, s.title);
        await prisma.strategic_sectors.update({
          where: { id: t.id },
          data: {
            title: t.titulo,
            description: r.textos.sobre,
            trayectoria: r.textos.trayectoria,
            esencia: r.textos.esencia,
            servicios: r.textos.servicios,
            excelencia: r.textos.excelencia,
            servicios_lista: r.textos.lista,
            status: 1,
            updated_at: new Date(),
          },
        });
        await ponerTextosDeSector(t.id, { frase: r.frase, titulos: r.titulos, destacados: r.destacados }, 'arranque de la API');
        puestos.push(`${t.titulo} (${r.reconocidos}/6)`);
      }
      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (puestos.length) await revalidarSitio();
      this.log.log(puestos.length ? `Textos nuevos de los sectores: ${puestos.join(', ')}.` : 'Sectores: ninguno se tocó.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los textos de los sectores: ${(e as Error).message}`);
      return false;
    }
  }
}
