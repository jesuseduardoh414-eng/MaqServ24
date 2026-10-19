'use client';

import { useEffect, useRef, useState } from 'react';
import { Btn, EmptyState, Panel, SearchBox } from '@/components/ui';

export interface FilaBitacora {
  id: number;
  quien: string;
  rol: string;
  modulo: string;
  accion: string;
  objetivo: string | null;
  detalle: string | null;
  cuando: string;
}

export const BITACORA_POR_PAGINA = 25;

async function pedir(q: string, antes: number | null, signal?: AbortSignal) {
  const sp = new URLSearchParams({ limite: String(BITACORA_POR_PAGINA) });
  if (q) sp.set('q', q);
  if (antes) sp.set('antes', String(antes));
  const r = await fetch(`/api/admin/admins/bitacora?${sp}`, { cache: 'no-store', signal });
  if (!r.ok) throw new Error('No se pudo cargar la actividad');
  return (await r.json()) as { filas: FilaBitacora[]; hayMas: boolean };
}

/**
 * Actividad reciente con buscador y "Ver más" (2026-10-15). Antes eran las
 * últimas 60 filas fijas: lo de hace dos semanas ya no había forma de verlo, y
 * encontrar "¿quién cambió las tarifas?" era leer fila por fila.
 *
 * La primera página llega del servidor con la pantalla; buscar y "Ver más"
 * piden a la API (busca palabra por palabra en quién, acción, objetivo y
 * detalle; ver `bitacora` en admin-admins.controller.ts).
 */
export function Bitacora({ inicial, hayMasInicial }: { inicial: FilaBitacora[]; hayMasInicial: boolean }) {
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState(inicial);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState<'buscar' | 'mas' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** La búsqueda que corresponde a lo que hay en pantalla (q va por delante mientras se teclea). */
  const aplicada = useRef('');
  /** Ya se pidieron páginas con "Ver más" sobre la lista sin búsqueda. */
  const conMas = useRef(false);

  /*
   * Tras un cambio en la página (rol, alta, baja…) el servidor manda la primera
   * página otra vez: se ponen las filas nuevas arriba sin perder las que ya se
   * habían cargado con "Ver más". Con una búsqueda activa manda la búsqueda.
   */
  useEffect(() => {
    if (aplicada.current) return;
    if (!conMas.current) {
      setFilas(inicial);
      setHayMas(hayMasInicial);
      return;
    }
    const minimo = inicial.length ? inicial[inicial.length - 1].id : Infinity;
    setFilas((f) => [...inicial, ...f.filter((x) => x.id < minimo)]);
  }, [inicial, hayMasInicial]);

  // Busca mientras se escribe, con una pausa para no pedir en cada tecla.
  useEffect(() => {
    const texto = q.trim();
    if (texto === aplicada.current) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCargando('buscar');
      setError(null);
      try {
        const d = await pedir(texto, null, ctrl.signal);
        aplicada.current = texto;
        conMas.current = false;
        setFilas(d.filas);
        setHayMas(d.hayMas);
      } catch {
        if (!ctrl.signal.aborted) setError('No se pudo buscar. Intenta de nuevo.');
      } finally {
        if (!ctrl.signal.aborted) setCargando(null);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  async function verMas() {
    const ultima = filas[filas.length - 1];
    if (!ultima) return;
    setCargando('mas');
    setError(null);
    try {
      const d = await pedir(aplicada.current, ultima.id);
      conMas.current = true;
      setFilas((f) => [...f, ...d.filas]);
      setHayMas(d.hayMas);
    } catch {
      setError('No se pudo cargar más. Intenta de nuevo.');
    } finally {
      setCargando(null);
    }
  }

  const buscando = aplicada.current !== '';
  const pie =
    filas.length > 0 || error ? (
      <>
        <span>
          {error ? (
            <span role="alert" style={{ color: 'var(--adm-bad)', fontWeight: 500 }}>{error}</span>
          ) : (
            <>
              {filas.length} {filas.length === 1 ? 'acción' : 'acciones'}
              {buscando ? <> que coinciden con «{aplicada.current}»</> : null}
              {!hayMas && filas.length > BITACORA_POR_PAGINA ? ' · no hay más' : null}
            </>
          )}
        </span>
        {hayMas ? (
          <Btn size="sm" icon="ph-caret-down" disabled={cargando !== null} onClick={() => void verMas()}>
            {cargando === 'mas' ? 'Cargando…' : 'Ver más'}
          </Btn>
        ) : null}
      </>
    ) : undefined;

  return (
    <Panel
      flush
      clip
      title="Actividad reciente"
      icon="ph-clock-counter-clockwise"
      desc="Las acciones que cambian permisos, dinero o lo que ve el público. No se puede borrar desde el panel."
      style={{ marginTop: 28 }}
      footer={pie}
    >
      <div className="am-log-bar">
        <SearchBox
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por persona, acción o cuenta…"
          aria-label="Buscar en la actividad"
        />
        <span className="am-log-hint">
          {cargando === 'buscar' ? 'Buscando…' : 'Más recientes primero'}
        </span>
      </div>

      <div style={{ opacity: cargando === 'buscar' ? 0.55 : 1, transition: 'opacity .15s ease' }} aria-busy={cargando === 'buscar'}>
        {filas.length === 0 ? (
          buscando ? (
            <EmptyState
              icon="ph-magnifying-glass"
              title={`Nada coincide con «${aplicada.current}»`}
              sub="Prueba con otra palabra: un correo, «rol», «tarifas», «eliminar», «contraseña»…"
            />
          ) : (
            <EmptyState
              icon="ph-notebook"
              title="Todavía no hay nada anotado"
              sub="Aquí irán apareciendo las altas y bajas de cuentas, los cambios de rol, los métodos de pago, los retiros pagados y las publicaciones de diseño."
            />
          )
        ) : (
          filas.map((b) => (
            <div key={b.id} className="adm-trow am-log">
              <span className="adm-mono adm-num" style={{ fontSize: 12, color: 'var(--adm-faint)', whiteSpace: 'nowrap' }}>
                {new Date(b.cuando).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>{b.accion}</span>
              {b.objetivo ? <span style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{b.objetivo}</span> : null}
              {/* El detalle (versión, a quién se envió, el monto…) ya se guardaba, pero no se veía. */}
              {b.detalle ? <span className="am-log-detalle" title={b.detalle}>{b.detalle}</span> : null}
              <span style={{ fontSize: 12.5, color: 'var(--adm-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {b.quien} · {b.rol}
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
