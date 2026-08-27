'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/editor-kit';

/**
 * "Ya le hablé al cliente."
 *
 * Sella el primer contacto sin tener que cotizar. Existe porque el tablero de
 * indicadores no podía separar dos cosas distintas: cuánto tarda la operación
 * en dar señales de vida y cuánto tarda en poner precio. Una llamada de veinte
 * minutos diciendo "lo estamos viendo" sostiene a un cliente que si no se va
 * con otro; una cotización impecable a los dos días llega cuando ya se fue.
 *
 * Un solo clic con el medio por defecto (llamada, que es como se contacta de
 * verdad): si registrar costara un formulario, nadie registraría y el indicador
 * seguiría vacío.
 */
const MEDIOS = [
  { clave: 'llamada', label: 'Llamada' },
  { clave: 'whatsapp', label: 'WhatsApp' },
  { clave: 'correo', label: 'Correo' },
  { clave: 'visita', label: 'Visita' },
] as const;

export function QuoteContact({
  quoteId, firstContactAt, firstContactVia,
}: {
  quoteId: number;
  firstContactAt: string | null;
  firstContactVia: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);

  async function marcar(via: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/quotes/${quoteId}/contacto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ via }),
      });
      setAbierto(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Ya contactado: se dice cuándo y por dónde, y no se ofrece volver a marcar.
  // El primer contacto ocurrió una vez; registrar la tercera llamada no puede
  // reescribir cuándo fue la primera.
  if (firstContactAt) {
    const cuando = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      .format(new Date(firstContactAt));
    const medio = MEDIOS.find((m) => m.clave === firstContactVia)?.label
      ?? (firstContactVia === 'cotizacion' ? 'al cotizar' : firstContactVia ?? '');
    return (
      <span
        title={`Primer contacto: ${cuando}${medio ? ` · ${medio}` : ''}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#3fbf8f', whiteSpace: 'nowrap' }}
      >
        <i className="ph ph-phone-call" style={{ fontSize: 13 }} /> Contactado
      </span>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Registra que ya le hablaste, aunque todavía no tengas el precio"
        style={{ background: 'transparent', color: '#B4B4B9', border: `1px solid ${D.inputBorder}`, fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        Ya le hablé
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {MEDIOS.map((m) => (
        <button
          key={m.clave}
          type="button"
          onClick={() => marcar(m.clave)}
          disabled={busy}
          style={{ background: 'transparent', color: '#B4B4B9', border: `1px solid ${D.inputBorder}`, fontFamily: 'inherit', fontWeight: 600, fontSize: 11.5, padding: '5px 9px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer' }}
        >
          {m.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setAbierto(false)}
        aria-label="Cancelar"
        style={{ background: 'transparent', color: '#6B6B71', border: 'none', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', padding: '5px 4px' }}
      >
        ✕
      </button>
    </span>
  );
}
