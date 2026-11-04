'use client';

import { useState } from 'react';
import { descargarArchivo, documentoPdf, type DatosDocumento } from '@maqserv/ui';
import { Btn } from '@/components/ui';
import { useBranding } from '@/components/branding';
import { pestanaParaChat, waDe } from '@/app/proveedores/wa';

/**
 * MANDAR LA COTIZACIÓN POR WHATSAPP (2026-11-04).
 *
 * El número de MAQSER24 está en el celular y en Wabee a la vez: lo que se
 * manda desde la app también queda en la bandeja de Wabee. Este botón deja el
 * envío a dos toques: descarga el PDF —el mismo documento de "Imprimir", hecho
 * archivo— y abre el chat del cliente con el mensaje ya escrito. Falta
 * adjuntar el PDF y mandar: una página no le puede pasar un archivo a un chat.
 *
 * No cambia el estado a "Enviada": desde aquí no se sabe si de verdad se mandó.
 */
export function BotonWhatsApp({
  datos,
  telefono,
  contacto,
}: {
  datos: Omit<DatosDocumento, 'logo'>;
  telefono: string | null;
  /** A quién se saluda: la persona de "Atención" o, si no hay, el cliente. */
  contacto: string | null;
}) {
  const branding = useBranding();
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ tono: 'ok' | 'bad'; texto: string; chat?: string } | null>(null);

  const wa = waDe(telefono);
  const nombre = contacto?.trim();
  const texto = `Hola${nombre ? ` ${nombre}` : ''}, te mando tu cotización ${datos.folio} de ${datos.empresa.nombre}. Cualquier duda, o si quieres confirmarla, contéstame por aquí.`;
  const archivo = `Cotizacion-${datos.folio.replace(/[^A-Za-z0-9-]+/g, '')}.pdf`;

  async function mandar() {
    if (!wa) return;
    // La pestaña se abre en el clic: si se abre después de armar el PDF, el navegador la bloquea.
    const ventana = pestanaParaChat();
    setOcupado(true);
    setResultado(null);
    let conPdf = true;
    try {
      const blob = await documentoPdf({ ...datos, logo: branding.logoLight || branding.logoAlt || null });
      descargarArchivo(new File([blob], archivo, { type: 'application/pdf' }));
    } catch {
      conPdf = false;
    }
    const chat = `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`;
    if (ventana) ventana.location.href = chat;
    setResultado({
      tono: conPdf ? 'ok' : 'bad',
      texto: conPdf
        ? `Se descargó ${archivo}: adjúntalo en el chat y mándalo.`
        : 'No se pudo armar el PDF: sácalo con "Imprimir / Guardar PDF" y adjúntalo en el chat.',
      // Sin pestaña (la bloqueó el navegador), el chat se abre a mano.
      ...(ventana ? {} : { chat }),
    });
    setOcupado(false);
  }

  return (
    <>
      <Btn
        icon="ph-whatsapp-logo"
        onClick={() => void mandar()}
        disabled={ocupado || !wa}
        title={wa ? `Abre el chat con ${telefono} y descarga el PDF` : 'Esta cotización no tiene un WhatsApp de 10 dígitos'}
      >
        {ocupado ? 'Preparando el PDF…' : 'Mandar por WhatsApp'}
      </Btn>

      {!wa ? (
        <span style={{ fontSize: 13, color: 'var(--adm-muted)', alignSelf: 'center' }}>
          Sin WhatsApp del cliente: su teléfono tiene que ser de 10 dígitos.
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
          {resultado.chat ? (
            <a href={resultado.chat} target="_blank" rel="noopener noreferrer" className="adm-link">Abrir el chat</a>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
