'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, IconBtn, StatusText } from '@/components/ui';

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
      <StatusText tone="ok" title={`Primer contacto: ${cuando}${medio ? ` · ${medio}` : ''}`}>Contactado</StatusText>
    );
  }

  if (!abierto) {
    return (
      <Btn
        size="sm"
        variant="ghost"
        icon="ph-phone-call"
        onClick={() => setAbierto(true)}
        title="Registra que ya le hablaste, aunque todavía no tengas el precio"
      >
        Ya le hablé
      </Btn>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {MEDIOS.map((m) => (
        <Btn key={m.clave} size="sm" onClick={() => marcar(m.clave)} disabled={busy}>
          {m.label}
        </Btn>
      ))}
      <IconBtn icon="ph-x" label="Cancelar" plain onClick={() => setAbierto(false)} />
    </span>
  );
}
