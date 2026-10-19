'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { Btn, FormField, Note } from '@/components/ui';

type Operador = { name: string; phone: string | null } | null;

/**
 * EL OPERADOR DE LA UNIDAD, desde Servicios (2026-10-15).
 *
 * Normalmente lo pone el aliado en su portal. Aquí, para cuando no lo hizo o
 * lo dicta por teléfono: nombre y celular, y el enlace que solo abre este
 * servicio (dirección, contacto, botones "salí/llegué" y su ubicación).
 * Mandarlo otra vez invalida el anterior.
 */
export function OperadorServicio({ servicioId, operador }: { servicioId: number; operador: Operador }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(operador?.name ?? '');
  const [telefono, setTelefono] = useState(operador?.phone ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<{ url: string; whatsapp: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function guardar() {
    setOcupado(true);
    setError(null);
    const r = await fetch(`/api/admin/services/${servicioId}/operador`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono: telefono || null }),
    }).catch(() => null);
    setOcupado(false);
    const b = await r?.json().catch(() => null);
    if (!r?.ok) { setError(b?.message ?? 'No se pudo guardar.'); return; }
    setEnlace({ url: b.url, whatsapp: b.whatsapp });
  }

  function cerrar() {
    if (ocupado) return;
    setAbierto(false);
    if (enlace) { setEnlace(null); setCopiado(false); router.refresh(); }
  }

  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--adm-muted)' }}>
        <i className="ph ph-steering-wheel" aria-hidden />
        {operador ? <>Operador: <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{operador.name}</span>{operador.phone ? ` · ${operador.phone}` : ''}</> : 'Sin operador'}
        <button type="button" className="adm-link" onClick={() => setAbierto(true)} style={{ fontSize: 13 }}>{operador ? 'Cambiar o reenviar' : 'Ponerle operador'}</button>
      </span>
      <Modal
        abierto={abierto}
        titulo="Operador de la unidad"
        subtitulo="Le llega un enlace solo para este servicio: dirección, contacto en obra, botones para avisar que salió y llegó, y desde ahí comparte su ubicación."
        onCerrar={cerrar}
        ancho={440}
        pie={
          enlace ? (
            <Btn variant="primary" onClick={cerrar}>Listo</Btn>
          ) : (
            <>
              <Btn variant="ghost" onClick={cerrar} disabled={ocupado}>Cancelar</Btn>
              <Btn variant="primary" onClick={guardar} disabled={ocupado || nombre.trim().length < 2}>{ocupado ? 'Guardando…' : 'Guardar y armar su enlace'}</Btn>
            </>
          )
        }
      >
        {enlace ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <Note tone="ok" icon="ph-check-circle">Listo. Mándale el enlace: el anterior, si había, ya no sirve.</Note>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {enlace.whatsapp ? <Btn href={enlace.whatsapp} icon="ph-whatsapp-logo" variant="primary">Mandar por WhatsApp</Btn> : null}
              <Btn icon="ph-link" onClick={async () => { try { await navigator.clipboard.writeText(enlace.url); setCopiado(true); } catch { setCopiado(false); } }}>{copiado ? 'Copiado' : 'Copiar enlace'}</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <FormField label="Nombre del operador"><input className="adm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Juan Pérez" /></FormField>
            <FormField label="Celular (WhatsApp)"><input className="adm-input" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={20} placeholder="81 1234 5678" /></FormField>
            {error ? <Note tone="bad" icon="ph-warning">{error}</Note> : null}
          </div>
        )}
      </Modal>
    </>
  );
}
