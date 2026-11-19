'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DatosDocumento } from '@maqserv/ui';
import { Btn } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';
import { useBranding } from '@/components/branding';
import { pdfDeDatos } from '@/lib/pdf-cotizacion';

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
 *
 * CON EL PDF ADJUNTO (2026-11-18, el dueño: «en el correo debe llevar el PDF
 * con la cotización con el precio, además del botón para ir a la página»):
 * antes de mandar se arma el mismo PDF de «Mandar por WhatsApp» y viaja con el
 * envío. Si no se pudo armar, se pregunta antes de mandarla sin él.
 */
export function BotonEnviarCliente({
  id,
  correo,
  estado,
  datos,
}: {
  id: number;
  correo: string | null;
  estado: string;
  /** El documento, para armar el PDF que va adjunto. */
  datos: Omit<DatosDocumento, 'logo'>;
}) {
  const router = useRouter();
  const branding = useBranding();
  const [enviando, setEnviando] = useState<false | 'pdf' | 'correo'>(false);
  const [resultado, setResultado] = useState<{ tono: 'ok' | 'bad'; texto: string } | null>(null);

  const sinCorreo = !correo?.trim();

  async function enviar() {
    // Reenviar es legítimo —el cliente pide que se la manden otra vez—, pero
    // hacerlo sin querer no: el segundo envío se confirma.
    if (estado === 'enviada' && !(await confirmar({ titulo: '¿Volver a mandar la cotización?', mensaje: `Ya se envió antes. Le llegará otra vez a ${correo}.`, confirmar: 'Volver a mandar' }))) {
      return;
    }
    setEnviando('pdf');
    setResultado(null);
    try {
      const pdf = await pdfDeDatos(datos, branding.logoLight || branding.logoAlt || null);
      if (!pdf && !(await confirmar({ titulo: 'No se pudo armar el PDF', mensaje: `¿La mando a ${correo} sin el PDF adjunto? El correo lleva el detalle y el botón igual.`, confirmar: 'Mandar sin PDF' }))) {
        return;
      }
      setEnviando('correo');
      const form = new FormData();
      if (pdf) form.append('pdf', pdf);
      const res = await fetch(`/api/admin/quoter/quotes/${id}/enviar`, { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar.');
      setResultado({ tono: 'ok', texto: `Enviada a ${body.correo}${pdf ? ', con el PDF' : ''}.` });
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
        disabled={Boolean(enviando) || sinCorreo}
        title={sinCorreo ? 'Esta cotización no tiene correo del cliente' : `Enviar a ${correo}, con el PDF adjunto`}
      >
        {enviando === 'pdf' ? 'Preparando el PDF…' : enviando ? 'Enviando…' : estado === 'enviada' ? 'Reenviar al cliente' : 'Enviar al cliente'}
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
