'use client';

import { useState } from 'react';
import { COTIZADOR_CSS } from './estilos';
import { DOCUMENTO_CSS, documentoCuerpo, imprimirDocumento, type DatosDocumento } from './documento';

/**
 * Una cotización YA EMITIDA, tal como se imprimió.
 *
 * Se alimenta del cálculo congelado que se guardó con ella (`snapshot`), no del
 * tabulador de hoy: reabrir una cotización de hace tres meses tiene que
 * enseñar los precios de hace tres meses. Es el mismo generador que usa el
 * cotizador, así que no hay dos versiones del documento.
 */
export function VistaDocumento({ datos, acciones }: { datos: DatosDocumento; acciones?: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="cz" data-variante="panel">
      <style>{COTIZADOR_CSS}</style>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button
          type="button"
          className="cz-btn primary sm"
          onClick={() => {
            if (!imprimirDocumento(datos)) {
              setError('El navegador bloqueó la ventana del documento. Permite las ventanas emergentes e inténtalo otra vez.');
            }
          }}
        >
          Imprimir / Guardar PDF
        </button>
        {acciones}
      </div>
      {error ? <div className="cz-note bad" style={{ marginBottom: 14 }}>{error}</div> : null}
      <div className="cz-preview">
        <div dangerouslySetInnerHTML={{ __html: `<style>${DOCUMENTO_CSS}</style>${documentoCuerpo(datos)}` }} />
      </div>
    </div>
  );
}
