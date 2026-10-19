'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';
import { confirmar } from '@/components/Dialogos';
import { CompartirUbicacion } from '../aliado/CompartirUbicacion';

export interface ServicioOperador {
  folio: string;
  estado: string | null;
  etapa: string;
  siguiente: string[];
  operador: string | null;
  aliado: string | null;
  llegada: string | null;
  obra: { nombre: string | null; direccion: string | null; lat: number; lng: number; aproximada: boolean } | null;
  contacto: { nombre: string | null; telefono: string | null };
  requisitos: string[];
  equipo: string[];
  pedido: Array<{ label: string; valor: string }>;
  notas: string | null;
}

/** Un botón a la vez: en la cabina no hay tiempo para menús. */
const PASO: Record<string, { texto: string; ayuda: string; icono: IconName; confirmar: string }> = {
  en_traslado: { texto: 'Ya salí a la obra', ayuda: 'El cliente recibe "tu unidad va en camino" y empieza a verte en el mapa.', icono: 'truck', confirmar: '¿Ya saliste con la unidad?' },
  en_sitio: { texto: 'Ya llegué a la obra', ayuda: 'Queda la hora real de llegada y se deja de compartir tu ubicación.', icono: 'mapPin', confirmar: '¿Ya estás en la obra?' },
  en_curso: { texto: 'Empecé el trabajo', ayuda: 'Desde aquí corre el servicio.', icono: 'clock', confirmar: '¿Ya empezaste el trabajo?' },
  terminado: { texto: 'Terminé el trabajo', ayuda: 'MAQSER24 registra horas o viajes y cierra el servicio.', icono: 'check', confirmar: '¿Ya terminaste el trabajo?' },
};

const FECHA_HORA = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' });
const tel = (t: string) => t.replace(/[^\d+]/g, '');

const CSS = `
.op-wrap{ max-width:560px; margin:0 auto; padding:18px 16px 40px; display:grid; gap:14px; }
.op-card{ background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; padding:16px; }
.op-k{ font-size:12px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--color-text-muted); margin:0 0 6px; }
.op-v{ font-size:16px; font-weight:600; color:var(--color-text); margin:0; line-height:1.4; }
.op-s{ font-size:14px; color:var(--color-text-muted); margin:4px 0 0; line-height:1.5; }
.op-acts{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
.op-big{ width:100%; min-height:56px; font-size:17px; justify-content:center; }
.op-list{ margin:0; padding:0; list-style:none; display:grid; gap:6px; }
.op-list li{ display:flex; gap:8px; font-size:14.5px; line-height:1.45; }
.op-chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:12.5px; font-weight:600; background:color-mix(in srgb, var(--color-primary) 14%, transparent); color:var(--color-primary); }
`;

/**
 * Lo que ve el operador (2026-10-15, ver page.tsx). Arriba lo que necesita en
 * la cabina: cuándo tiene que llegar, a dónde (con botón para la ruta) y el
 * botón del paso que sigue. Debajo, lo de la obra.
 */
export function PortalOperador({ servicio: s, telefonoMaqser }: { servicio: ServicioOperador; telefonoMaqser: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paso = s.siguiente[0] ? PASO[s.siguiente[0]] : null;
  const destino = s.obra && !s.obra.aproximada ? `${s.obra.lat},${s.obra.lng}` : s.obra?.direccion ?? null;

  async function avanzar() {
    const siguiente = s.siguiente[0];
    if (!siguiente || !paso) return;
    if (!(await confirmar({ titulo: paso.confirmar, mensaje: paso.ayuda, confirmar: paso.texto }))) return;
    setOcupado(true);
    setError(null);
    const r = await fetch('/api/proxy/operador/avance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: siguiente }) }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) {
      const b = await r?.json().catch(() => null);
      setError(b?.message ?? 'No se pudo guardar. Revisa tu señal e inténtalo otra vez.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="op-wrap">
      <style>{CSS}</style>

      <div>
        <span className="op-chip"><Icon name="truck" size={14} />{s.etapa}</span>
        <h1 className="ms-title" style={{ margin: '10px 0 2px', fontSize: 24 }}>{s.operador ? `Hola, ${s.operador.split(' ')[0]}` : 'Tu servicio'}</h1>
        <p className="op-s" style={{ marginTop: 0 }}>Servicio {s.folio}{s.aliado ? ` · ${s.aliado}` : ''}</p>
      </div>

      {s.llegada && (s.estado === 'asignado' || s.estado === 'en_traslado') ? (
        <section className="op-card" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 45%, var(--color-border))' }}>
          <p className="op-k">Tienes que llegar</p>
          <p className="op-v" style={{ fontSize: 19 }}>{FECHA_HORA.format(new Date(s.llegada))}</p>
        </section>
      ) : null}

      {s.obra ? (
        <section className="op-card">
          <p className="op-k">A dónde vas</p>
          <p className="op-v">{s.obra.nombre ?? 'Obra'}</p>
          {s.obra.direccion && s.obra.direccion !== s.obra.nombre ? <p className="op-s">{s.obra.direccion}</p> : null}
          {s.obra.aproximada ? <p className="op-s" style={{ color: 'var(--color-warning)' }}>La ubicación exacta no está en el mapa: confirma la dirección con el contacto de la obra.</p> : null}
          {destino ? (
            <div className="op-acts">
              <a className="ms-btn" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`} target="_blank" rel="noopener">
                <Icon name="mapPin" size={16} />Google Maps
              </a>
              <a className="ms-btn ms-btn-sec" href={s.obra.aproximada ? `https://waze.com/ul?q=${encodeURIComponent(destino)}&navigate=yes` : `https://waze.com/ul?ll=${encodeURIComponent(destino)}&navigate=yes`} target="_blank" rel="noopener">
                <Icon name="arrowRight" size={16} />Waze
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* El paso que sigue, grande. */}
      {paso ? (
        <section style={{ display: 'grid', gap: 6 }}>
          <button type="button" className="ms-btn op-big" onClick={avanzar} disabled={ocupado}>
            <Icon name={paso.icono} size={20} />{ocupado ? 'Guardando…' : paso.texto}
          </button>
          <p className="op-s" style={{ textAlign: 'center', margin: 0 }}>{paso.ayuda}</p>
          {error ? <p className="op-s" role="alert" style={{ color: 'var(--color-error)', textAlign: 'center' }}>{error}</p> : null}
        </section>
      ) : s.estado === 'terminado' ? (
        <section className="op-card"><p className="op-v">Listo, gracias.</p><p className="op-s">MAQSER24 registra horas o viajes y cierra el servicio.</p></section>
      ) : null}

      {/* Mientras va en camino, su teléfono es el que se ve en el mapa. */}
      {s.estado === 'en_traslado' ? <CompartirUbicacion quoteNumber={s.folio} endpoint="/api/proxy/operador/ubicacion" /> : null}

      {s.contacto.nombre || s.contacto.telefono ? (
        <section className="op-card">
          <p className="op-k">En la obra pregunta por</p>
          <p className="op-v">{s.contacto.nombre ?? 'El encargado de la obra'}</p>
          {s.contacto.telefono ? (
            <div className="op-acts" style={{ gridTemplateColumns: '1fr' }}>
              <a className="ms-btn ms-btn-sec" href={`tel:${tel(s.contacto.telefono)}`}><Icon name="phone" size={16} />Llamar · {s.contacto.telefono}</a>
            </div>
          ) : null}
        </section>
      ) : null}

      {s.requisitos.length ? (
        <section className="op-card" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 45%, var(--color-border))' }}>
          <p className="op-k" style={{ color: 'var(--color-warning)' }}>Esta obra exige</p>
          <ul className="op-list">
            {s.requisitos.map((r) => <li key={r}><span style={{ color: 'var(--color-warning)' }}><Icon name="warning" size={15} /></span>{r}</li>)}
          </ul>
          <p className="op-s">Sin esto no dejan entrar la unidad.</p>
        </section>
      ) : null}

      {s.equipo.length ? (
        <section className="op-card">
          <p className="op-k">Qué llevas</p>
          <ul className="op-list">{s.equipo.map((e) => <li key={e}><Icon name="truck" size={15} />{e}</li>)}</ul>
        </section>
      ) : null}

      {s.pedido.length || s.notas ? (
        <section className="op-card">
          <p className="op-k">Lo que pidió el cliente</p>
          <ul className="op-list">
            {s.pedido.map((p) => <li key={p.label}><span style={{ color: 'var(--color-text-muted)', minWidth: 0 }}>{p.label}:</span><span>{p.valor}</span></li>)}
          </ul>
          {s.notas ? <p className="op-s" style={{ whiteSpace: 'pre-wrap' }}>{s.notas}</p> : null}
        </section>
      ) : null}

      {telefonoMaqser ? (
        <a className="ms-btn ms-btn-sec" href={`tel:${tel(telefonoMaqser)}`} style={{ justifyContent: 'center' }}>
          <Icon name="phone" size={16} />¿Algún problema? Llama a MAQSER24
        </a>
      ) : null}
    </div>
  );
}
