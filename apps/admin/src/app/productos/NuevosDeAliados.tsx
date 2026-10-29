'use client';

import { useEffect, useState } from 'react';
import { esLineaServicio, type TipoCatalogo } from '@maqserv/config';
import { mostrarResultado } from '@maqserv/ui';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import { Btn, Chip, FormField, Note, Panel } from '@/components/ui';

/**
 * NUEVOS QUE OFRECEN LOS ALIADOS (2026-10-28, revisión de Proveedores).
 *
 * "Quita publicar; cuando sea nuevo, solo la etiqueta de nuevo. Si existe un
 * volteo de 10 t y el proveedor tiene uno de 20, a lo mejor el flete cambia:
 * se agrega como nuevo, y ese sí se puede publicar, pero no lo deciden desde
 * ahí." Lo que un aliado ofrece y no está en la lista de tipos llega aquí, a
 * Inventario, donde viven los servicios de MAQSER24. Con los parecidos al
 * lado: o es el mismo que uno que ya existe, o se vuelve un servicio nuevo
 * (nace apagado: sale en el sitio con su precio). Sin ninguno, no se pinta.
 */

interface Tipo { id: number; nombre: string; activo: boolean }
interface Nuevo {
  id: number;
  nombre: string;
  unidades: number | null;
  donde: string | null;
  desde: string;
  categoryId: number;
  linea: string;
  aliado: { id: number; nombre: string };
  parecidos: Tipo[];
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export function NuevosDeAliados({ tipo, categorias, onCambio }: {
  tipo: TipoCatalogo;
  /** Para separar servicios de productos: el slug de cada categoría. */
  categorias: Array<{ id: number; slug: string }>;
  /** Tras decidir: la lista de abajo se vuelve a pedir (puede haber una ficha nueva). */
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<{ nuevos: Nuevo[]; tipos: Record<string, Tipo[]> } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [ocupado, setOcupado] = useState<number | null>(null);
  /** Lo que se abrió: "es el mismo que…", "crear servicio" o "no lo manejamos". */
  const [abierto, setAbierto] = useState<{ n: Nuevo; que: 'mismo' | 'crear' | 'quitar' } | null>(null);
  const [tipoSel, setTipoSel] = useState('');
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/catalog/nuevos-de-aliados', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [vuelta]);

  // Todos juntos, servicios y productos, como la lista de Inventario (2026-10-28).
  const slugDe = new Map(categorias.map((c) => [c.id, c.slug]));
  const esServicio = (n: Nuevo) => esLineaServicio(slugDe.get(n.categoryId));
  void tipo;
  const nuevos = datos?.nuevos ?? [];
  if (nuevos.length === 0) return null;

  function abrir(n: Nuevo, que: 'mismo' | 'crear' | 'quitar', tipoId?: number) {
    setAbierto({ n, que });
    setTipoSel(tipoId ? String(tipoId) : '');
    // Para crear, el nombre que escribió el aliado, ya sin marca ni modelo si se puede corregir a mano.
    setTexto(que === 'crear' ? n.nombre : '');
    setError(null);
  }

  async function confirmar() {
    if (!abierto) return;
    const { n, que } = abierto;
    const url = que === 'mismo' ? 'es-tipo' : que === 'crear' ? 'crear-tipo' : 'no-lo-manejamos';
    const cuerpo = que === 'mismo' ? { tipoId: Number(tipoSel) } : que === 'crear' ? { nombre: texto.trim() } : { motivo: texto.trim() };
    setOcupado(n.id); setError(null);
    const r = await fetch(`/api/admin/catalog/products/${n.id}/${url}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    const d = await r.json().catch(() => null);
    setOcupado(null);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo. Inténtalo de nuevo.'); return; }
    mostrarResultado(
      que === 'mismo'
        ? `${n.nombre} quedó como «${d.tipo}». A ${n.aliado.nombre} ya le llegan las solicitudes de ese tipo.`
        : que === 'crear'
          ? d.yaExistia
            ? `Ya existía «${d.nombre}»: ${n.nombre} quedó ligado a ese tipo.`
            : `Se creó «${d.nombre}», apagado. Ponle su precio y préndelo para que salga en el sitio. A ${n.aliado.nombre} ya le llegan sus solicitudes.`
          : `Se quitó ${n.nombre}. A ${n.aliado.nombre} le llegó el motivo.`,
      'ok',
    );
    setAbierto(null);
    setVuelta((v) => v + 1);
    onCambio();
  }

  const tiposDe = (n: Nuevo) => datos?.tipos[String(n.categoryId)] ?? [];
  const listo = abierto
    ? abierto.que === 'mismo' ? Boolean(tipoSel) : texto.trim().length >= (abierto.que === 'crear' ? 3 : 4)
    : false;

  return (
    <>
      <style>{`
        .nv-row { display: flex; align-items: center; gap: 10px 18px; flex-wrap: wrap; }
        .nv-row .nv-que { flex: 1 1 280px; min-width: 0; }
        .nv-acc { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .nv-par { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px; font-size: 12.5px; color: var(--adm-muted); }
        .nv-par button { border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text-2); border-radius: 999px; padding: 1px 9px; font: inherit; font-size: 12.5px; cursor: pointer; }
        .nv-par button:hover { border-color: var(--adm-text-2); color: var(--adm-text); }
      `}</style>
      <Panel
        flush
        clip
        style={{ marginBottom: 24 }}
        icon="ph-sparkle"
        title="Nuevos que ofrecen los aliados"
        desc="No están en tu lista. Decide si es el mismo que uno que ya tienes o si se vuelve un servicio de MAQSER24. Mientras, no les llegan solicitudes."
        action={<Chip tone="warn">{nuevos.length}</Chip>}
      >
        {nuevos.map((n) => (
          <div key={n.id} className="adm-trow nv-row">
            <div className="nv-que">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="adm-cell-title">{n.nombre}</span>
                <Chip tone="warn">Nuevo</Chip>
              </div>
              <div className="adm-cell-sub">
                {n.aliado.nombre} · {n.linea}{n.unidades && n.unidades > 1 ? ` · ${n.unidades} unidades` : ''} · desde el {fechaCorta(n.desde)}
              </div>
              {n.parecidos.length ? (
                <div className="nv-par">
                  Se parece a
                  {n.parecidos.map((t) => (
                    <button key={t.id} type="button" onClick={() => abrir(n, 'mismo', t.id)} title={`Es el mismo que ${t.nombre}`}>{t.nombre}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="nv-acc">
              <Btn size="sm" variant="ghost" onClick={() => abrir(n, 'quitar')} disabled={ocupado === n.id}>No lo manejamos</Btn>
              <Btn size="sm" onClick={() => abrir(n, 'mismo')} disabled={ocupado === n.id}>Es el mismo que…</Btn>
              <Btn size="sm" variant="primary" icon="ph-plus" onClick={() => abrir(n, 'crear')} disabled={ocupado === n.id}>{esServicio(n) ? 'Crear servicio nuevo' : 'Crear producto nuevo'}</Btn>
            </div>
          </div>
        ))}
      </Panel>

      {abierto ? (
        <Modal
          abierto
          titulo={abierto.que === 'mismo' ? `${abierto.n.nombre}: ¿es el mismo que…?` : abierto.que === 'crear' ? (esServicio(abierto.n) ? 'Crear servicio nuevo' : 'Crear producto nuevo') : `No lo manejamos: ${abierto.n.nombre}`}
          subtitulo={
            abierto.que === 'mismo'
              ? `Queda contado en ese tipo y a ${abierto.n.aliado.nombre} le llegan sus solicitudes.`
              : abierto.que === 'crear'
                ? `Nace en ${abierto.n.linea}, apagado y sin precio: sale en el sitio cuando le pongas su precio y lo prendas. El equipo de ${abierto.n.aliado.nombre} queda ligado.`
                : `Se quita de su inventario y a ${abierto.n.aliado.nombre} le llega este motivo por correo.`
          }
          onCerrar={() => setAbierto(null)}
          ancho={560}
          pie={
            <>
              <Btn variant="ghost" onClick={() => setAbierto(null)}>Cancelar</Btn>
              <Btn variant={abierto.que === 'quitar' ? 'danger' : 'primary'} onClick={() => void confirmar()} disabled={!listo || ocupado !== null}>
                {abierto.que === 'mismo' ? 'Es el mismo' : abierto.que === 'crear' ? 'Crear' : 'Quitar y avisarle'}
              </Btn>
            </>
          }
        >
          {error ? <div role="alert" style={{ marginBottom: 14 }}><Note tone="bad">{error}</Note></div> : null}
          {abierto.que === 'mismo' ? (
            <div className="adm-field">
              <span className="adm-label">Tipo de {abierto.n.linea}</span>
              <AdminSelect
                ariaLabel="Tipo"
                value={tipoSel}
                onChange={setTipoSel}
                placeholder="Elige el tipo"
                options={tiposDe(abierto.n).map((t) => ({ value: String(t.id), label: t.activo ? t.nombre : `${t.nombre} (apagado)` }))}
              />
            </div>
          ) : abierto.que === 'crear' ? (
            <FormField label={esServicio(abierto.n) ? 'Nombre del servicio' : 'Nombre del producto'} help="Como lo verá el cliente. Sin marca ni modelo: «Volteo 20 t», no «Volteo 20 t Kenworth».">
              <input className="adm-input" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={190} autoFocus />
            </FormField>
          ) : (
            <FormField label="Motivo" help="Le llega por correo al aliado.">
              <textarea className="adm-textarea" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} placeholder="Por ahora MAQSER24 no ofrece grúas." autoFocus />
            </FormField>
          )}
        </Modal>
      ) : null}
    </>
  );
}
