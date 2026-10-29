'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Btn } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

/**
 * LO ÚNICO QUE SE CAMBIA A MANO (2026-10-26). El estado lo pone el flujo;
 * aquí quedan dos acciones con sentido:
 *  - "El cliente aceptó": dijo que sí por teléfono o WhatsApp. Abre su
 *    servicio, por asignar. Solo en las que armó el panel sin solicitud: las
 *    que vienen de una solicitud las acepta el cliente en su cuenta o el correo.
 *  - "Cancelar cotización": deja de valer; su solicitud, si seguía esperando,
 *    se descarta con ella.
 */
export function AccionesEstado({ id, folio, estado, ligada }: { id: number; folio: string; estado: string; ligada: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ tono: 'ok' | 'bad'; texto: string } | null>(null);

  const puedeAceptar = !ligada && ['borrador', 'enviada'].includes(estado);
  const puedeCancelar = ['solicitada', 'borrador', 'enviada'].includes(estado);
  // El aviso se queda aunque ya no haya botones (al aceptar, el estado cambia y se esconden).
  if (!puedeAceptar && !puedeCancelar && !resultado) return null;

  async function cambiar(nuevo: 'aceptada' | 'cancelada') {
    const ok = nuevo === 'aceptada'
      ? await confirmar({
          titulo: `¿El cliente aceptó ${folio}?`,
          mensaje: 'Se crea su servicio en Servicios › Por asignar y ahí eliges a quién dárselo: a un aliado o a todos los que llegan a la obra.',
          confirmar: 'Sí, aceptó',
        })
      : await confirmar({
          titulo: `¿Cancelar ${folio}?`,
          mensaje: ligada
            ? 'Deja de valer, y su solicitud, si seguía esperando respuesta, queda descartada.'
            : 'Deja de valer. Queda en el historial como cancelada.',
          confirmar: 'Cancelar cotización',
          peligro: true,
        });
    if (!ok) return;
    setOcupado(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/admin/quoter/quotes/${id}/state`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevo }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo.');
      setResultado({
        tono: 'ok',
        texto: body?.servicio ? `Se creó el servicio ${body.servicio.quoteNumber}: elige a quién dárselo en Servicios.` : nuevo === 'aceptada' ? 'Marcada como aceptada.' : 'Cotización cancelada.',
      });
      router.refresh();
    } catch (e) {
      setResultado({ tono: 'bad', texto: e instanceof Error ? e.message : 'No se pudo.' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {puedeAceptar ? (
        <Btn icon="ph-handshake" onClick={() => cambiar('aceptada')} disabled={ocupado}>El cliente aceptó</Btn>
      ) : null}
      {puedeCancelar ? (
        <Btn variant="ghost" icon="ph-x-circle" onClick={() => cambiar('cancelada')} disabled={ocupado} style={{ color: 'var(--adm-muted)' }}>
          Cancelar cotización
        </Btn>
      ) : null}
      {resultado ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, alignSelf: 'center', color: resultado.tono === 'ok' ? 'var(--adm-ok)' : 'var(--adm-bad)' }}>
          <i className={`ph ${resultado.tono === 'ok' ? 'ph-check-circle' : 'ph-warning-circle'}`} aria-hidden />
          {resultado.texto}
        </span>
      ) : null}
    </>
  );
}
