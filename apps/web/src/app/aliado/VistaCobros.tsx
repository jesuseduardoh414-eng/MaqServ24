'use client';

import { useState } from 'react';
import { CobrosAliado, type CobroAliado } from './CobrosAliado';
import { AMBAR, Encabezado, GRIS, Insignia, VERDE, Vacio, dinero } from './comun';
import type { DatosPortal } from './tipos';

/**
 * COBROS (2026-10-27): qué facturar y cuándo se le paga, con los totales
 * arriba y la lista filtrable. Lo único que hace aquí es subir su factura
 * (CobrosAliado): el pago se programa solo en cuanto el cliente pagó.
 *
 * Orden: primero lo que depende de él (sin factura), luego lo que ya tiene
 * fecha de pago (la más próxima arriba), luego lo que espera al cliente y al
 * final lo pagado (lo más reciente arriba).
 */

type Estado = CobroAliado['estado'];
type Filtro = 'todos' | Estado;

const ETIQUETA: Record<Estado, string> = {
  'falta-factura': 'Sin factura',
  programado: 'Pago programado',
  'esperando-cliente': 'Esperando al cliente',
  pagado: 'Pagados',
};
const PESO: Record<Estado, number> = { 'falta-factura': 0, programado: 1, 'esperando-cliente': 2, pagado: 3 };

function ordenar(a: CobroAliado, b: CobroAliado): number {
  if (PESO[a.estado] !== PESO[b.estado]) return PESO[a.estado] - PESO[b.estado];
  if (a.estado === 'programado') return (a.pagarEl ?? '').localeCompare(b.pagarEl ?? '');
  if (a.estado === 'pagado') return (b.pagadoAt ?? '').localeCompare(a.pagadoAt ?? '');
  return 0;
}

export function VistaCobros({ datos }: { datos: DatosPortal }) {
  const cobros = datos.cobros ?? [];
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const de = (estado: Estado) => cobros.filter((c) => c.estado === estado);
  const suma = (xs: CobroAliado[]) => xs.reduce((t, c) => t + c.monto, 0);

  const cifras: Array<{ label: string; n: number; color: string; ayuda: string }> = [
    // Las sumas van CON IVA y lo dicen (2026-10-28): cada renglón enseña la cifra + IVA y su total.
    { label: 'Por facturar', n: suma(de('falta-factura')), color: de('falta-factura').length ? AMBAR : GRIS, ayuda: de('falta-factura').length ? 'Con IVA · sube tu factura para que te paguemos' : 'Nada pendiente de tu parte' },
    { label: 'Pago programado', n: suma(de('programado')), color: de('programado').length ? VERDE : GRIS, ayuda: 'Con IVA · ya tiene fecha' },
    { label: 'Esperando al cliente', n: suma(de('esperando-cliente')), color: GRIS, ayuda: 'Con IVA · tu factura ya está' },
    { label: 'Pagado', n: suma(de('pagado')), color: 'var(--color-text)', ayuda: 'Con IVA · lo que ya te llegó' },
  ];

  const pestanas: Array<[Filtro, string, number]> = [
    ['todos', 'Todos', cobros.length],
    ...(Object.keys(ETIQUETA) as Estado[]).map((e): [Filtro, string, number] => [e, ETIQUETA[e], de(e).length]),
  ];
  const visibles = (filtro === 'todos' ? cobros : de(filtro)).slice().sort(ordenar);

  return (
    <>
      <Encabezado titulo="Tus cobros" desc="Sube tu factura de cada servicio terminado. Te pagamos en cuanto el cliente pague, y aquí ves la fecha." />

      {cobros.length === 0 ? (
        <Vacio icono="calculator" titulo="Todavía no tienes nada por cobrar" texto="Cuando termines un servicio, aquí aparece lo que te toca facturar, cuándo te pagamos y lo que ya te pagamos." tono="muted" />
      ) : (
        <>
          <div className="al-cifras">
            {cifras.map((c) => (
              <div key={c.label} className="al-cifra">
                <span className="ms-stat-l">{c.label}</span>
                <span className="ms-stat-n" style={{ color: c.color }}>{dinero(c.n) ?? '$0'}</span>
                <span className="ms-hint" style={{ display: 'block', marginTop: 4 }}>{c.ayuda}</span>
              </div>
            ))}
          </div>

          <div className="al-sub" role="tablist" aria-label="Qué cobros ver">
            {pestanas.filter(([f, , n]) => f === 'todos' || n > 0).map(([f, texto, n]) => (
              <button key={f} type="button" role="tab" className="ms-tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}>
                {texto}<Insignia n={n} tono={f === 'falta-factura' ? 'warn' : 'muted'} />
              </button>
            ))}
          </div>

          <CobrosAliado cobros={visibles} />
        </>
      )}
    </>
  );
}
