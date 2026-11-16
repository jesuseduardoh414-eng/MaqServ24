import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * TITULARES EN MONTSERRAT (2026-11-16, rediseño parte 4). El diseño que mandó
 * el dueño («¿Por qué MAQSER24?») usa una letra geométrica y gruesa tipo
 * Montserrat; pidió darle ese diseño a todo el sitio. Los titulares y las
 * cifras (`fontHeading` y `fontDisplay` del tema) pasan de Inter Tight a
 * Montserrat; el texto corrido sigue en Inter, que se lee mejor en tamaño chico.
 *
 * La letra vive en el tema guardado, así que se cambia al arrancar, UNA vez
 * (marca en `contenido_cambios`), y solo si seguía en Inter Tight: si alguien
 * eligió otra en Temas y colores, se respeta.
 */
const NOMBRE = 'letra-montserrat-2026-11-16';
const AJUSTE = 'contenido_cambios';
export const LETRA_ANTES = 'Inter Tight';
export const LETRA_NUEVA = 'Montserrat';

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function conMontserrat(tokens: unknown): Obj | null {
  if (!esObj(tokens) || !esObj(tokens.typography)) return null;
  const ty: Obj = { ...tokens.typography };
  let cambio = false;
  for (const k of ['fontHeading', 'fontDisplay']) {
    if (ty[k] === LETRA_ANTES) { ty[k] = LETRA_NUEVA; cambio = true; }
  }
  return cambio ? { ...tokens, typography: ty } : null;
}

@Injectable()
export class LetraMontserrat20261116 implements OnApplicationBootstrap {
  private readonly log = new Logger('LetraMontserrat20261116');

  onApplicationBootstrap(): void {
    // Después de los otros cambios del 16 (30 y 38 s): no se pisan la marca.
    setTimeout(() => void this.poner(), 46_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;
      let temas = 0;
      for (const th of await prisma.theme.findMany({ select: { id: true, tokens: true, draftTokens: true } })) {
        const tokens = conMontserrat(th.tokens);
        const draft = th.draftTokens === null ? null : conMontserrat(th.draftTokens);
        if (!tokens && !draft) continue;
        await prisma.theme.update({
          where: { id: th.id },
          data: {
            ...(tokens ? { tokens: tokens as Prisma.InputJsonValue } : {}),
            ...(draft ? { draftTokens: draft as Prisma.InputJsonValue } : {}),
          },
        });
        temas++;
      }
      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (temas) await revalidarSitio();
      this.log.log(temas ? `Titulares en Montserrat en ${temas} tema(s).` : 'Titulares: ningún tema seguía en Inter Tight.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudo poner Montserrat: ${(e as Error).message}`);
      return false;
    }
  }
}
