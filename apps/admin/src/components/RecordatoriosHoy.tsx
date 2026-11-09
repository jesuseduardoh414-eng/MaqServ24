'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import Link from '@/components/Enlace';
import { IconBtn, Panel } from '@/components/ui';
import { CANAL, RESULTADO, type Canal, type ConQuien, type Resultado } from '@/lib/trato';

/** Un recordatorio del trato que ya toca (lo arma `GET /admin/trato/recordatorios`). */
export interface RecordatorioHoy {
  id: number;
  recordar: string;
  atrasado: boolean;
  canal: Canal;
  con: ConQuien;
  a: string | null;
  nota: string | null;
  res: Resultado | null;
  folio: string | null;
  href: string;
  anotado: string;
}

const TZ = 'America/Monterrey';

/** Cuántos días lleva atrasado, contados en días de Monterrey. */
function diasAtraso(ymd: string): number {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  return Math.round((new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${ymd}T12:00:00Z`).getTime()) / 86_400_000);
}

/**
 * RECORDATORIOS DEL TRATO EN EL INICIO (2026-11-09).
 *
 * "Quedó de confirmar" con fecha: ese día le sale aquí a quien lo anotó, y
 * solo a él. Se va solo cuando alguien vuelve a tener contacto con esa persona
 * (una llamada, un WhatsApp abierto desde el panel); la palomita es para
 * cuando ya no hace falta. Sin recordatorios, no se pinta nada.
 */
export function RecordatoriosHoy({ items }: { items: RecordatorioHoy[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<number | null>(null);
  if (!items.length) return null;

  async function listo(r: RecordatorioHoy) {
    setOcupado(r.id);
    const resp = await fetch(`/api/admin/trato/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hecho: true }),
    }).catch(() => null);
    setOcupado(null);
    if (resp?.ok) {
      mostrarResultado('Listo: ya no te lo recuerdo.', 'ok');
      router.refresh();
    }
  }

  return (
    <Panel title="Te toca volver a buscar" icon="ph-bell-ringing" flush clip action={<span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Tus recordatorios</span>}>
      <div style={{ paddingBottom: 6 }}>
        {items.map((r) => {
          const atraso = r.atrasado ? diasAtraso(r.recordar) : 0;
          const detalle = [r.res ? RESULTADO[r.res] : null, r.nota ? `«${r.nota}»` : null, r.folio].filter(Boolean).join(' · ');
          return (
            <div key={r.id} className="in-task" style={{ paddingRight: 12 }}>
              <i className={`ph ${CANAL[r.canal].icon}`} aria-hidden style={{ color: r.atrasado ? 'var(--adm-warn)' : 'var(--adm-accent)' }} />
              <Link href={r.href} style={{ minWidth: 0, flex: 1, color: 'inherit', textDecoration: 'none' }}>
                <span className="adm-cell-title adm-ellipsis" style={{ display: 'block' }}>
                  {r.con === 'aliado' ? 'Aliado' : 'Cliente'}: {r.a ?? 'sin nombre'}
                </span>
                <span className="adm-cell-sub adm-ellipsis" style={{ display: 'block' }}>{detalle || `${CANAL[r.canal].label} anotada`}</span>
              </Link>
              <span style={{ fontSize: 12.5, whiteSpace: 'nowrap', color: r.atrasado ? 'var(--adm-warn)' : 'var(--adm-muted)', fontWeight: r.atrasado ? 600 : 400 }}>
                {r.atrasado ? `Atrasado ${atraso} d` : 'Hoy'}
              </span>
              <IconBtn icon="ph-check" label="Ya no hace falta" plain disabled={ocupado === r.id} onClick={() => void listo(r)} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
