'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Btn } from '@/components/ui';

/**
 * MANDARLE LA COTIZACIÓN AL CLIENTE.
 *
 * Es un botón, no un efecto de guardar: una cotización se captura, se revisa
 * en el documento de abajo y luego se manda. Si saliera sola al guardar,
 * cualquier error de captura —o una cotización hecha solo para dejar registro—
 * ya estaría en el buzón del cliente.
 *
 * Sin correo capturado NO se deshabilita en silencio: se dice por qué. Un
 * botón apagado sin explicación manda a la gente a recargar la página.
 *
 * Cuando el envío sale, el estado pasa a "Enviada" solo (lo hace la API) y se
 * refresca la pantalla para que el historial no siga diciendo "Por atender"
 * una cotización que ya se contestó.
 */
export function BotonEnviarCliente({
  id,
  correo,
  estado,
}: {
  id: number;
  correo: string | null;
  estado: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ tono: 'ok' | 'bad'; texto: string } | null>(null);

  const sinCorreo = !correo?.trim();

  async function enviar() {
    // Reenviar es legítimo —el cliente pide que se la manden otra vez—, pero
    // hacerlo sin querer no: el segundo envío se confirma.
    if (estado === 'enviada' && !window.confirm(`Esta cotización ya se envió. ¿Volver a mandarla a ${correo}?`)) {
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/admin/quoter/quotes/${id}/enviar`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar.');
      setResultado({ tono: 'ok', texto: `Enviada a ${body.correo}.` });
      router.refresh();
    } catch (e) {
      setResultado({ tono: 'bad', texto: e instanceof Error ? e.message : 'No se pudo enviar.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Btn
        icon="ph-paper-plane-tilt"
        onClick={enviar}
        disabled={enviando || sinCorreo}
        title={sinCorreo ? 'Esta cotización no tiene correo del cliente' : `Enviar a ${correo}`}
      >
        {enviando ? 'Enviando…' : estado === 'enviada' ? 'Reenviar al cliente' : 'Enviar al cliente'}
      </Btn>

      {sinCorreo ? (
        <span style={{ fontSize: 13, color: 'var(--adm-muted)', alignSelf: 'center' }}>
          Sin correo del cliente: captúralo para poder enviarla.
        </span>
      ) : null}

      {resultado ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            alignSelf: 'center',
            color: resultado.tono === 'ok' ? 'var(--adm-ok)' : 'var(--adm-bad)',
          }}
        >
          <i className={`ph ${resultado.tono === 'ok' ? 'ph-check-circle' : 'ph-warning-circle'}`} aria-hidden />
          {resultado.texto}
        </span>
      ) : null}
    </>
  );
}
