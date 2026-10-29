'use client';

import { useEffect, useState } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import { Btn, Chip, FormField, Note, Panel } from '@/components/ui';

/**
 * CATEGORÍAS NUEVAS QUE PROPONEN LOS ALIADOS (2026-10-28, revisión de
 * Inventario y Categorías).
 *
 * "Cuando se agregue un aliado y no aparezcan las opciones de categorías ni
 * servicios, que pueda agregar otro, que aparezca que intentó agregar uno
 * nuevo y el administrador decida si lo autoriza o no." Los servicios nuevos se
 * deciden en Inventario; las categorías, aquí. Sin ninguna, no se pinta.
 *
 * Una categoría autorizada nace APAGADA y es de productos: las 5 líneas de
 * servicio (lo que se cotiza por obra) están fijas. Lo que se cotiza por obra
 * se junta con una de ellas con "Es la misma que…".
 */

interface Categoria { id: number; nombre: string; activa: boolean }
interface Nueva {
  id: number;
  nombre: string;
  desde: string | null;
  aliados: Array<{ id: number; nombre: string }>;
  equipos: Array<{ id: number; nombre: string; unidades: number | null }>;
  parecidas: Categoria[];
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export function CategoriasNuevas({ onCambio }: { onCambio: () => void }) {
  const [datos, setDatos] = useState<{ nuevas: Nueva[]; categorias: Categoria[] } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [abierto, setAbierto] = useState<{ n: Nueva; que: 'misma' | 'autorizar' | 'quitar' } | null>(null);
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/catalog/categorias-nuevas', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [vuelta]);

  const nuevas = datos?.nuevas ?? [];
  if (nuevas.length === 0) return null;

  function abrir(n: Nueva, que: 'misma' | 'autorizar' | 'quitar', categoriaId?: number) {
    setAbierto({ n, que });
    setDestino(categoriaId ? String(categoriaId) : '');
    setMotivo('');
    setError(null);
  }

  async function confirmar() {
    if (!abierto) return;
    const { n, que } = abierto;
    const url = que === 'misma' ? 'es-la-misma' : que === 'autorizar' ? 'autorizar' : 'no-la-manejamos';
    const cuerpo = que === 'misma' ? { categoriaId: Number(destino) } : que === 'quitar' ? { motivo: motivo.trim() } : {};
    setOcupado(true); setError(null);
    const r = await fetch(`/api/admin/catalog/categories/${n.id}/${url}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo. Inténtalo de nuevo.'); return; }
    const eq = n.equipos.length;
    mostrarResultado(
      que === 'misma'
        ? `«${n.nombre}» quedó como «${d.destino}».${eq ? ` ${eq === 1 ? 'Su equipo sale' : `Sus ${eq} equipos salen`} como Nuevo en Inventario.` : ''}`
        : que === 'autorizar'
          ? `«${n.nombre}» quedó como categoría, apagada. Préndela cuando quieras que salga en el sitio.${eq ? ' Sus equipos salen como Nuevo en Inventario › Productos.' : ''}`
          : `Se quitó «${n.nombre}». A ${n.aliados.length === 1 ? n.aliados[0].nombre : 'sus aliados'} le llegó el motivo.`,
      'ok',
    );
    setAbierto(null);
    setVuelta((v) => v + 1);
    onCambio();
  }

  const listo = abierto ? (abierto.que === 'misma' ? Boolean(destino) : abierto.que === 'quitar' ? motivo.trim().length >= 4 : true) : false;

  return (
    <>
      <style>{`
        .cn-row { display: flex; align-items: center; gap: 10px 18px; flex-wrap: wrap; }
        .cn-row .cn-que { flex: 1 1 300px; min-width: 0; }
        .cn-acc { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .cn-par { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px; font-size: 12.5px; color: var(--adm-muted); }
        .cn-par button { border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text-2); border-radius: 999px; padding: 1px 9px; font: inherit; font-size: 12.5px; cursor: pointer; }
        .cn-par button:hover { border-color: var(--adm-text-2); color: var(--adm-text); }
      `}</style>
      <Panel
        flush
        clip
        style={{ marginBottom: 24 }}
        icon="ph-sparkle"
        title="Categorías nuevas que proponen los aliados"
        desc="No están en tu lista. Decide si es la misma que una que ya tienes, si la autorizas (nace apagada) o si no la manejas."
        action={<Chip tone="warn">{nuevas.length}</Chip>}
      >
        {nuevas.map((n) => (
          <div key={n.id} className="adm-trow cn-row">
            <div className="cn-que">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="adm-cell-title">{n.nombre}</span>
                <Chip tone="warn">Nueva</Chip>
              </div>
              <div className="adm-cell-sub">
                {n.aliados.map((a) => a.nombre).join(', ')}
                {n.equipos.length ? ` · ${n.equipos.map((e) => e.nombre).join(', ')}` : ''}
                {n.desde ? ` · desde el ${fechaCorta(n.desde)}` : ''}
              </div>
              {n.parecidas.length ? (
                <div className="cn-par">
                  Se parece a
                  {n.parecidas.map((c) => (
                    <button key={c.id} type="button" onClick={() => abrir(n, 'misma', c.id)} title={`Es la misma que ${c.nombre}`}>{c.nombre}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="cn-acc">
              <Btn size="sm" variant="ghost" onClick={() => abrir(n, 'quitar')}>No la manejamos</Btn>
              <Btn size="sm" onClick={() => abrir(n, 'misma')}>Es la misma que…</Btn>
              <Btn size="sm" variant="primary" icon="ph-check" onClick={() => abrir(n, 'autorizar')}>Autorizar</Btn>
            </div>
          </div>
        ))}
      </Panel>

      {abierto ? (
        <Modal
          abierto
          titulo={abierto.que === 'misma' ? `${abierto.n.nombre}: ¿es la misma que…?` : abierto.que === 'autorizar' ? `Autorizar «${abierto.n.nombre}»` : `No la manejamos: ${abierto.n.nombre}`}
          subtitulo={
            abierto.que === 'misma'
              ? 'Sus equipos pasan a esa categoría y salen como Nuevo en Inventario, donde decides cada uno.'
              : abierto.que === 'autorizar'
                ? 'Queda como categoría de MAQSER24, apagada: préndela cuando quieras que salga en el sitio. Será de productos (precio fijo); lo que se cotiza por obra va mejor en una de las 5 líneas con «Es la misma que…».'
                : `Se quitan la categoría y sus equipos, y a ${abierto.n.aliados.map((a) => a.nombre).join(', ')} le llega este motivo por correo.`
          }
          onCerrar={() => setAbierto(null)}
          ancho={580}
          pie={
            <>
              <Btn variant="ghost" onClick={() => setAbierto(null)}>Cancelar</Btn>
              <Btn variant={abierto.que === 'quitar' ? 'danger' : 'primary'} onClick={() => void confirmar()} disabled={!listo || ocupado}>
                {abierto.que === 'misma' ? 'Es la misma' : abierto.que === 'autorizar' ? 'Autorizar' : 'Quitar y avisarle'}
              </Btn>
            </>
          }
        >
          {error ? <div role="alert" style={{ marginBottom: 14 }}><Note tone="bad">{error}</Note></div> : null}
          {abierto.que === 'misma' ? (
            <div className="adm-field">
              <span className="adm-label">Categoría</span>
              <AdminSelect
                ariaLabel="Categoría"
                value={destino}
                onChange={setDestino}
                placeholder="Elige la categoría"
                options={(datos?.categorias ?? []).map((c) => ({ value: String(c.id), label: c.activa ? c.nombre : `${c.nombre} (apagada)` }))}
              />
            </div>
          ) : abierto.que === 'quitar' ? (
            <FormField label="Motivo" help="Le llega por correo al aliado.">
              <textarea className="adm-textarea" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} placeholder="Por ahora MAQSER24 no ofrece andamios." autoFocus />
            </FormField>
          ) : (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--adm-text-2)', lineHeight: 1.6 }}>
              {abierto.n.equipos.length
                ? <>Trae {abierto.n.equipos.length === 1 ? 'un equipo' : `${abierto.n.equipos.length} equipos`}: {abierto.n.equipos.map((e) => e.nombre).join(', ')}. Siguen como Nuevo en Inventario › Productos.</>
                : 'Todavía no trae equipos.'}
            </p>
          )}
        </Modal>
      ) : null}
    </>
  );
}
