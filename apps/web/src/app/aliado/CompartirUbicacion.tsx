'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

type Estado = 'inicio' | 'pidiendo' | 'activo' | 'negado' | 'error' | 'sin-gps' | 'detenido';

/** El servidor guarda un punto cada 20 s como mucho; mandar más seguido no aporta. */
const ENTRE_ENVIOS_MS = 25_000;

const hace = (d: Date) => {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  return s < 60 ? 'hace un momento' : `hace ${Math.round(s / 60)} min`;
};

/**
 * COMPARTIR DÓNDE VA LA UNIDAD (2026-10-14).
 *
 * Mientras el servicio está "en traslado", el teléfono del aliado manda su
 * ubicación: MAQSER24 la ve en un mapa y el cliente, a cuántos km va. Solo
 * mientras esta página está abierta (el navegador no deja leer la ubicación
 * con la pantalla apagada), y se detiene sola al marcar "Ya llegué".
 *
 * Arranca solo si el teléfono ya había dado permiso; si no, con un botón: un
 * permiso que se pide sin que la persona lo haya buscado se rechaza por reflejo.
 */
export function CompartirUbicacion({
  quoteNumber,
  endpoint,
}: {
  quoteNumber: string;
  /** A dónde se manda (2026-10-15): el portal del aliado o el enlace del operador. */
  endpoint?: string;
}) {
  const destino = endpoint ?? `/api/proxy/aliado/servicios/${encodeURIComponent(quoteNumber)}/ubicacion`;
  const [estado, setEstado] = useState<Estado>('inicio');
  const [ultima, setUltima] = useState<Date | null>(null);
  const [, setReloj] = useState(0);
  const watch = useRef<number | null>(null);
  const latido = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimoEnvio = useRef(0);
  const despierta = useRef<{ release: () => Promise<void> } | null>(null);

  function detener(final = false) {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    if (latido.current) clearInterval(latido.current);
    latido.current = null;
    void despierta.current?.release().catch(() => undefined);
    despierta.current = null;
    if (final) setEstado('detenido');
  }

  async function enviar(pos: GeolocationPosition) {
    const ahora = Date.now();
    if (ahora - ultimoEnvio.current < ENTRE_ENVIOS_MS) return;
    ultimoEnvio.current = ahora;
    try {
      const r = await fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
      });
      const d = await r.json().catch(() => null);
      // El servicio ya no está en traslado (llegó o se canceló): dejar de mandar.
      if (d?.detener) { detener(true); return; }
      if (r.ok) setUltima(new Date());
    } catch {
      // Sin señal: el siguiente punto lo vuelve a intentar.
    }
  }

  function empezar() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) { setEstado('sin-gps'); return; }
    setEstado('pidiendo');
    watch.current = navigator.geolocation.watchPosition(
      (pos) => { setEstado('activo'); void enviar(pos); },
      (err) => { setEstado(err.code === err.PERMISSION_DENIED ? 'negado' : 'error'); },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 60_000 },
    );
    // El teléfono avisa al MOVERSE; parado (un semáforo, una fila en la caseta)
    // se queda callado y el panel diría "sin señal". Cada minuto confirma dónde está.
    latido.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => void enviar(pos), () => undefined, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 });
    }, 60_000);
    // Que la pantalla no se apague sola mientras va en camino (si el teléfono lo permite).
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    wl?.request('screen').then((w) => { despierta.current = w; }).catch(() => undefined);
  }

  useEffect(() => {
    // Si ya había dado permiso, arranca solo.
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((p) => { if (p.state === 'granted') empezar(); })
      .catch(() => undefined);
    const t = setInterval(() => setReloj((n) => n + 1), 30_000);
    return () => { clearInterval(t); detener(); };
    // Una sola vez por servicio en traslado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteNumber]);

  const caja: React.CSSProperties = {
    marginTop: 14, padding: '12px 14px', borderRadius: 12, display: 'grid', gap: 8,
    border: '1px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))',
  };
  const fila: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.45 };

  if (estado === 'activo') {
    return (
      <div style={caja} role="status">
        <div style={fila}>
          <span style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}><Icon name="mapPin" size={17} /></span>
          <span><strong>Compartiendo tu ubicación</strong>{ultima ? ` · última ${hace(ultima)}` : ''}. El cliente ve cuánto te falta.</span>
        </div>
        <span className="ms-hint">Deja esta página abierta hasta que llegues. Se detiene sola al marcar «Ya llegué a la obra».</span>
      </div>
    );
  }
  if (estado === 'detenido') return null;

  const texto: Record<Exclude<Estado, 'activo' | 'detenido'>, string> = {
    inicio: 'Comparte tu ubicación mientras vas en camino: el cliente ve cuánto te falta y MAQSER24 no tiene que llamarte.',
    pidiendo: 'Acepta el permiso de ubicación que te pide el teléfono.',
    negado: 'No se dio permiso de ubicación. Actívalo en los ajustes del navegador (Ubicación → Permitir) y vuelve a intentarlo.',
    error: 'No se pudo leer tu ubicación. Revisa que el GPS esté prendido y vuelve a intentarlo.',
    'sin-gps': 'Este navegador no puede compartir ubicación. Ábrelo en el navegador de tu teléfono (Chrome o Safari).',
  };
  return (
    <div style={caja}>
      <div style={fila}>
        <span style={{ color: estado === 'negado' || estado === 'error' ? 'var(--color-error)' : 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>
          <Icon name={estado === 'negado' || estado === 'error' ? 'warning' : 'mapPin'} size={17} />
        </span>
        <span>{texto[estado]}</span>
      </div>
      {estado !== 'pidiendo' && estado !== 'sin-gps' ? (
        <button type="button" className="ms-btn ms-btn-sec ms-btn-block" onClick={empezar}>
          <Icon name="mapPin" size={16} />{estado === 'inicio' ? 'Compartir mi ubicación' : 'Intentar de nuevo'}
        </button>
      ) : null}
    </div>
  );
}
