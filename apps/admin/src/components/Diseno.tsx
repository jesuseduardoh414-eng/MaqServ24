'use client';

import { avisar } from '@/components/Dialogos';
import { Note } from '@/components/ui';

/**
 * VISTAS DE DISEÑO (2026-10-09).
 *
 * "Construye solo el diseño, aún no te metas con funcionalidades." Los módulos
 * que el menú tenía en "Pronto" se diseñan primero como muestra con datos de
 * ejemplo, para revisarlos uno por uno antes de construirlos. Cada pantalla
 * lleva este aviso arriba, para que nadie tome los números por reales, y sus
 * botones de acción responden con `accionDeDiseno` en vez de hacer algo.
 *
 * El menú las marca con la etiqueta "Diseño" (ver `diseno` en SidebarNav).
 */
export function AvisoDiseno({ falta }: { falta?: string }) {
  return (
    <Note tone="info" icon="ph-paint-brush" style={{ marginBottom: 24 }}>
      <b style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Vista de diseño con datos de ejemplo.</b> Nada de esta pantalla está
      conectado todavía: nombres, montos y fechas son inventados. Sirve para decidir cómo se va a ver antes de construirla.
      {falta ? <> <span style={{ color: 'var(--adm-text-2)' }}>{falta}</span></> : null}
    </Note>
  );
}

/** Lo que hacen los botones de acción mientras la pantalla sea solo diseño. */
export function accionDeDiseno(nombre: string, motivo = 'Se conecta cuando se apruebe el diseño de esta pantalla.') {
  void avisar({ titulo: 'Esto todavía es un diseño', mensaje: `«${nombre}» aún no hace nada. ${motivo}` });
}
