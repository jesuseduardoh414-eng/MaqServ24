'use client';

import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { precioZona, zonaDe, type CatalogoTriturados } from '@maqserv/config';
import { money, money2 } from './formato';
import { Campo, Chip, Contador, NumeroTexto } from './piezas';
import { IconoCotizador } from './iconos';
import { ShInput } from '../shadcn/input';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '../shadcn/select';
import { num, type LineaBanco, type LineaMaterial, type LineaTriturados, type LineaZona } from './estado';

/*
 * COTIZADOR DE TRITURADOS (rediseño 2026-10-15).
 *
 * "No entiendo el flujo de cotización, es muy confuso." Antes eran cinco
 * pasos y cuatro maneras distintas de hacer lo mismo:
 *   - un paso "Modalidad" que preguntaba algo abstracto antes de elegir nada;
 *   - en "Materiales", tarjetas que se encendían y apagaban (por tonelada) junto
 *     a tarjetas que sumaban un contador (zona y banco);
 *   - las cantidades, en un bloque "Partidas" aparte, lejos de donde se eligió;
 *   - y un paso "Entrega" con OTRO flete (el de por tonelada) que se confundía
 *     con la "entrega por viaje".
 *
 * Ahora es un solo paso, "Material", con tres secciones —una por cada forma
 * de vender— que funcionan IGUAL: un botón "Agregar", y cada renglón trae ahí
 * mismo lo que hay que capturar (qué, cuánto, precio) y su importe. El flete
 * por tonelada vive dentro de su sección, una sola vez para todo su material:
 * una cotización va a una obra. La factura pasa al resumen, junto al total que
 * mueve.
 *
 * Los datos no cambiaron (mismas partidas y mismo cálculo de
 * `calcularTriturados`): solo cómo se capturan.
 */

/* ── Sección ───────────────────────────────────────────────────────────── */

function Bloque({
  icono,
  titulo,
  desc,
  textoAgregar,
  onAgregar,
  vacio,
  pie,
  children,
}: {
  icono: string;
  titulo: string;
  desc: string;
  textoAgregar: string;
  onAgregar: () => void;
  vacio: boolean;
  pie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cz-card cz-bloque" data-vacio={vacio || undefined}>
      <header className="cz-bloque-h">
        <span className="ico" aria-hidden><IconoCotizador nombre={icono} size={26} /></span>
        <div>
          <h2 className="cz-card-h">{titulo}</h2>
          <p className="cz-card-s">{desc}</p>
        </div>
      </header>
      {vacio ? null : <div className="cz-filas">{children}</div>}
      <button type="button" className="cz-agregar" onClick={onAgregar}>
        <Plus className="size-4" aria-hidden />
        {textoAgregar}
      </button>
      {pie}
    </section>
  );
}

/** Quitar un renglón: arriba a la derecha, como en el resto de las tarjetas. */
function Quitar({ onClick, que }: { onClick: () => void; que: string }) {
  return (
    <button type="button" className="cz-rm cz-fila-rm" aria-label={`Quitar ${que}`} title="Quitar" onClick={onClick}>
      <X className="size-4" />
    </button>
  );
}

/** Lo que suma el renglón, a la derecha. */
function Importe({ texto, valor }: { texto: string; valor: string }) {
  return (
    <div className="cz-fila-imp">
      <span>{texto}</span>
      <b>{valor}</b>
    </div>
  );
}

/* ── El paso ───────────────────────────────────────────────────────────── */

export function PasoPedido({
  cat,
  lineas,
  agregarMaterial,
  agregarZona,
  agregarBanco,
  actualizar,
  quitar,
  mostrarPrecios,
  preciosAlFinal,
  permitirOtro = true,
  nuevo,
  tocado,
}: {
  cat: CatalogoTriturados;
  lineas: LineaTriturados[];
  agregarMaterial: () => void;
  agregarZona: () => void;
  agregarBanco: () => void;
  /** Parche genérico: cada renglón recibe el suyo ya estrechado a su tipo. */
  actualizar: (uid: number, patch: Record<string, unknown>) => void;
  quitar: (uid: number) => void;
  /** Importes junto a la captura (el panel). */
  mostrarPrecios: boolean;
  /** Hay costo, pero se enseña al final (el sitio con tabulador público). */
  preciosAlFinal?: boolean;
  /** "Otro material" (nombre y precio a mano): solo en el panel. */
  permitirOtro?: boolean;
  /** El renglón recién agregado: su selector de material se abre solo. */
  nuevo?: number | null;
  /** Ya se intentó continuar: los renglones incompletos se marcan. */
  tocado?: boolean;
}) {
  const materiales = lineas.filter((l): l is LineaMaterial => l.tipo === 'material');
  const zonas = lineas.filter((l): l is LineaZona => l.tipo === 'zona');
  const bancos = lineas.filter((l): l is LineaBanco => l.tipo === 'banco');
  const b = cat.material_banco;

  return (
    <>
      <Bloque
        icono="material"
        titulo="En planta, por tonelada"
        desc="Material cargado en planta. Si MAQSER24 lo lleva a obra, el flete se suma por tonelada (abajo)."
        textoAgregar={materiales.length ? 'Agregar otro material' : 'Agregar material por tonelada'}
        onAgregar={agregarMaterial}
        vacio={materiales.length === 0}
        pie={
          materiales.length > 0 ? (
            <FleteTonelada cat={cat} materiales={materiales} actualizar={actualizar} mostrarPrecios={mostrarPrecios} preciosAlFinal={preciosAlFinal} />
          ) : null
        }
      >
        {materiales.map((l) => (
          <FilaMaterial key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} permitirOtro={permitirOtro} abrir={l.uid === nuevo} tocado={tocado} />
        ))}
      </Bloque>

      <Bloque
        icono="zona"
        titulo="Puesto en obra, por viaje"
        desc={`${cat.nota_zona}. El precio del viaje ya incluye material y flete; depende de la zona.`}
        textoAgregar={zonas.length ? 'Agregar otro viaje' : 'Agregar viaje por zona'}
        onAgregar={agregarZona}
        vacio={zonas.length === 0}
      >
        {zonas.map((l) => (
          <FilaZona key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} />
        ))}
      </Bloque>

      <Bloque
        icono="banco"
        titulo={`${b.nombre}, por m³`}
        desc={`Se cotiza por volumen, en camión de ${b.camion_m3} m³. El precio incluye el flete a obra.`}
        textoAgregar={bancos.length ? `Agregar otra partida de ${b.nombre.toLowerCase()}` : `Agregar ${b.nombre.toLowerCase()}`}
        onAgregar={agregarBanco}
        vacio={bancos.length === 0}
      >
        {bancos.map((l) => (
          <FilaBanco key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} tocado={tocado} />
        ))}
      </Bloque>
    </>
  );
}

/* ── Renglones ─────────────────────────────────────────────────────────── */

const OTRO = 'custom';

function FilaMaterial({
  cat, l, actualizar, quitar, mostrarPrecios, permitirOtro, abrir, tocado,
}: {
  cat: CatalogoTriturados;
  l: LineaMaterial;
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
  permitirOtro: boolean;
  abrir: boolean;
  tocado?: boolean;
}) {
  const esOtro = l.id === OTRO;
  const prod = cat.productos.find((p) => p.id === l.id);
  const precio = num(l.precio) || prod?.precio_ton || 0;
  const ton = num(l.toneladas);

  function elegir(id: string) {
    const p = cat.productos.find((x) => x.id === id);
    actualizar(l.uid, id === OTRO
      ? { id, nombre: '', precio: '' }
      : { id, nombre: p?.nombre ?? '', precio: p ? String(p.precio_ton) : '' });
  }

  return (
    <div className="cz-fila">
      <Campo label="Material" req error={tocado && !l.id ? 'Elige el material' : null}>
        {(id) => (
          <ShSelect value={l.id} onValueChange={elegir} defaultOpen={abrir && !l.id}>
            <ShSelectTrigger id={id} aria-label="Material">
              <ShSelectValue placeholder="Elige el material" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.productos.map((p) => (
                <ShSelectItem key={p.id} value={p.id}>
                  {mostrarPrecios ? `${p.nombre} · ${money(p.precio_ton)}/ton` : p.nombre}
                </ShSelectItem>
              ))}
              {permitirOtro ? <ShSelectItem value={OTRO}>Otro material…</ShSelectItem> : null}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      {esOtro ? (
        <Campo label="Nombre del material" req error={tocado && !l.nombre.trim() ? 'Escribe el nombre' : null}>
          {(id) => (
            <ShInput id={id} placeholder="Ej. Grava 3/4" maxLength={120} value={l.nombre} onChange={(e) => actualizar(l.uid, { nombre: e.target.value })} />
          )}
        </Campo>
      ) : null}
      <Campo label="Toneladas" req error={tocado && ton <= 0 ? 'Captura las toneladas' : null}>
        <NumeroTexto decimal ariaLabel="toneladas" placeholder="Ej. 30" valor={l.toneladas} onChange={(v) => actualizar(l.uid, { toneladas: v })} />
      </Campo>
      {mostrarPrecios ? (
        <Campo
          label="Precio / ton"
          req={esOtro}
          help={prod ? `Tabulador: ${money(prod.precio_ton)}` : esOtro ? 'Precio acordado' : undefined}
          error={tocado && esOtro && num(l.precio) <= 0 ? 'Captura el precio' : null}
        >
          <NumeroTexto decimal ariaLabel="precio por tonelada" valor={l.precio} onChange={(v) => actualizar(l.uid, { precio: v })} />
        </Campo>
      ) : null}
      {mostrarPrecios ? <Importe texto={`${ton.toLocaleString('es-MX')} ton × ${money2(precio)}`} valor={money(precio * ton)} /> : null}
      <Quitar onClick={() => quitar(l.uid)} que={l.nombre || 'material'} />
    </div>
  );
}

function FilaZona({
  cat, l, actualizar, quitar, mostrarPrecios,
}: {
  cat: CatalogoTriturados;
  l: LineaZona;
  actualizar: (uid: number, patch: Partial<LineaZona>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const z = zonaDe(cat, l.zonaId);
  const precio = precioZona(cat, z, l.productoId) ?? 0;
  return (
    <div className="cz-fila">
      <Campo label="Zona de entrega" req>
        {(id) => (
          <ShSelect value={l.zonaId} onValueChange={(v) => actualizar(l.uid, { zonaId: v })}>
            <ShSelectTrigger id={id} aria-label="Zona de entrega">
              <ShSelectValue placeholder="Elige la zona" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.zonas.map((zz) => (
                <ShSelectItem key={zz.id} value={zz.id}>{zz.nombre}</ShSelectItem>
              ))}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      <Campo label="Material" req>
        {(id) => (
          <ShSelect value={l.productoId} onValueChange={(v) => actualizar(l.uid, { productoId: v })}>
            <ShSelectTrigger id={id} aria-label="Material del viaje">
              <ShSelectValue placeholder="Elige el material" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.productos.map((p) => {
                // En el panel, el precio del viaje a ESA zona junto a cada material.
                const pv = mostrarPrecios ? precioZona(cat, z, p.id) : null;
                return (
                  <ShSelectItem key={p.id} value={p.id}>
                    {pv ? `${p.nombre} · ${money(pv)}/viaje` : p.nombre}
                  </ShSelectItem>
                );
              })}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      <div className="cz-qty">
        <span className="cz-lbl">Viajes</span>
        <Contador valor={l.viajes} min={1} ariaLabel="viajes" onChange={(v) => actualizar(l.uid, { viajes: v })} />
      </div>
      {mostrarPrecios ? <Importe texto={`${l.viajes} × ${money(precio)} por viaje`} valor={money(precio * l.viajes)} /> : null}
      <Quitar onClick={() => quitar(l.uid)} que="viaje" />
    </div>
  );
}

function FilaBanco({
  cat, l, actualizar, quitar, mostrarPrecios, tocado,
}: {
  cat: CatalogoTriturados;
  l: LineaBanco;
  actualizar: (uid: number, patch: Partial<LineaBanco>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
  tocado?: boolean;
}) {
  const b = cat.material_banco;
  const m3 = num(l.m3);
  const precio = num(l.precioM3) || b.precio_m3_default;
  const viajes = b.camion_m3 > 0 && m3 > 0 ? Math.ceil(m3 / b.camion_m3) : 0;
  return (
    <div className="cz-fila">
      <Campo
        label="Metros cúbicos"
        req
        help={viajes ? `≈ ${viajes} ${viajes === 1 ? 'camión' : 'camiones'} de ${b.camion_m3} m³` : undefined}
        error={tocado && m3 <= 0 ? 'Captura los m³' : null}
      >
        <NumeroTexto decimal ariaLabel="metros cúbicos" placeholder={`Ej. ${b.camion_m3 || 14}`} valor={l.m3} onChange={(v) => actualizar(l.uid, { m3: v })} />
      </Campo>
      {mostrarPrecios ? (
        <Campo label="Precio / m³" help="Material y flete">
          <NumeroTexto decimal ariaLabel="precio por metro cúbico" valor={l.precioM3} onChange={(v) => actualizar(l.uid, { precioM3: v })} />
        </Campo>
      ) : null}
      {mostrarPrecios ? <Importe texto={`${m3.toLocaleString('es-MX')} m³ × ${money2(precio)}`} valor={money(precio * m3)} /> : null}
      <Quitar onClick={() => quitar(l.uid)} que={b.nombre.toLowerCase()} />
    </div>
  );
}

/* ── Flete del material por tonelada ───────────────────────────────────── */

/**
 * Una sola vez para todo el material por tonelada: una cotización va a UNA
 * obra. Lo que se elige aquí se aplica a cada renglón (el cálculo y el
 * documento siguen llevando el flete por partida, como siempre).
 */
function FleteTonelada({
  cat, materiales, actualizar, mostrarPrecios, preciosAlFinal,
}: {
  cat: CatalogoTriturados;
  materiales: LineaMaterial[];
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  mostrarPrecios: boolean;
  preciosAlFinal?: boolean;
}) {
  const primero = materiales[0];
  const distintos = materiales.some((l) => l.fleteTon !== primero.fleteTon);
  const ton = materiales.reduce((s, l) => s + num(l.toneladas), 0);
  const aTodos = (patch: Partial<LineaMaterial>) => materiales.forEach((l) => actualizar(l.uid, patch));

  return (
    <div className="cz-flete">
      <div className="cz-flete-h">
        <b>¿Lo llevamos a obra?</b>
        <span>
          {mostrarPrecios
            ? `El flete se cobra por tonelada${ton > 0 ? ` (${ton.toLocaleString('es-MX')} ton en total)` : ''}. Vacío = el cliente recoge en planta.`
            : preciosAlFinal
              ? 'Dinos a qué área. La tarifa del flete se elige en el último paso, junto con el costo.'
              : 'Dinos a qué área y un asesor te cotiza el flete, que se cobra por tonelada.'}
        </span>
      </div>
      {mostrarPrecios ? (
        <TarifaFlete cat={cat} valor={distintos ? null : primero.fleteTon} elegir={(fleteTon) => aTodos({ fleteTon })} />
      ) : null}
      {distintos && mostrarPrecios ? (
        <p className="cz-help">Los materiales traían fletes distintos; al elegir uno se aplica a todos.</p>
      ) : null}
      {mostrarPrecios && primero.fleteTon === 0 && !distintos ? null : (
        <Campo label="Área de entrega" help="Sale impresa en el concepto del flete">
          {(id) => (
            <ShInput id={id} placeholder="Ej. área El Uro" maxLength={80} value={primero.fleteZona} onChange={(e) => aTodos({ fleteZona: e.target.value })} />
          )}
        </Campo>
      )}
      {mostrarPrecios && primero.fleteTon > 0 && !distintos ? (
        <Importe texto={`Flete · ${ton.toLocaleString('es-MX')} ton × ${money(primero.fleteTon)}`} valor={money(primero.fleteTon * ton)} />
      ) : null}
    </div>
  );
}

/**
 * La tarifa del flete por tonelada. Con pocas tarifas, botones (un toque); con
 * muchas —el tabulador trae once, de $50 a $300— un desplegable: once botones
 * ocupaban dos renglones y se leían como ruido.
 */
function TarifaFlete({ cat, valor, elegir }: { cat: CatalogoTriturados; valor: number | null; elegir: (v: number) => void }) {
  if (cat.fletes_ton.length <= 5) {
    return (
      <div className="cz-chips" role="group" aria-label="Flete por tonelada">
        <Chip on={valor === 0} onClick={() => elegir(0)}>Sin flete · recoge en planta</Chip>
        {cat.fletes_ton.map((v) => (
          <Chip key={v} on={valor === v} onClick={() => elegir(v)}>{money(v)} / ton</Chip>
        ))}
      </div>
    );
  }
  return (
    <Campo label="Flete por tonelada">
      {(id) => (
        <ShSelect value={valor === null ? '' : String(valor)} onValueChange={(v) => elegir(Number(v))}>
          <ShSelectTrigger id={id} aria-label="Flete por tonelada" className="max-w-sm">
            <ShSelectValue placeholder="Distinto en cada material" />
          </ShSelectTrigger>
          <ShSelectContent>
            <ShSelectItem value="0">Sin flete · el cliente recoge en planta</ShSelectItem>
            {cat.fletes_ton.map((v) => (
              <ShSelectItem key={v} value={String(v)}>{money(v)} por tonelada</ShSelectItem>
            ))}
          </ShSelectContent>
        </ShSelect>
      )}
    </Campo>
  );
}

/* ── Facturación (resumen) ─────────────────────────────────────────────── */

/** Con o sin factura: cambia el total y las condiciones del documento. */
export function Facturacion({
  cat,
  conIva,
  setConIva,
}: {
  cat: CatalogoTriturados;
  conIva: boolean;
  setConIva: (v: boolean) => void;
}) {
  return (
    <div className="cz-chips" role="group" aria-label="Facturación">
      <Chip on={conIva} onClick={() => setConIva(true)}>Con factura · IVA {Math.round(cat.iva * 100)}%</Chip>
      <Chip on={!conIva} onClick={() => setConIva(false)}>Remisionado · sin IVA</Chip>
    </div>
  );
}

/**
 * LO QUE MUEVE EL TOTAL, EN EL ÚLTIMO PASO (el sitio).
 *
 * Cuando los importes no acompañan la captura, la tarifa del flete y la
 * factura no pueden elegirse antes: serían precios a ciegas. Se piden aquí,
 * pegadas al documento, donde cada toque se ve reflejado en el total.
 */
export function AjustesDelTotal({
  cat,
  lineas,
  actualizar,
  conIva,
  setConIva,
}: {
  cat: CatalogoTriturados;
  lineas: LineaTriturados[];
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  conIva: boolean;
  setConIva: (v: boolean) => void;
}) {
  const materiales = lineas.filter((l): l is LineaMaterial => l.tipo === 'material');
  const primero = materiales[0];
  const distintos = materiales.some((l) => l.fleteTon !== primero?.fleteTon);
  const ton = materiales.reduce((s, l) => s + num(l.toneladas), 0);
  const aTodos = (fleteTon: number) => materiales.forEach((l) => actualizar(l.uid, { fleteTon }));
  return (
    <div className="cz-ajuste">
      <header>
        <h3>Flete y facturación</h3>
        <p>Es lo último que mueve el total. Cámbialo aquí y el documento de abajo se actualiza solo.</p>
      </header>
      {primero ? (
        <div className="cz-qty wide">
          <span className="cz-lbl">
            Flete del material por tonelada · {ton.toLocaleString('es-MX')} ton{primero.fleteZona ? ` · ${primero.fleteZona}` : ''}
          </span>
          <TarifaFlete cat={cat} valor={distintos ? null : primero.fleteTon} elegir={aTodos} />
        </div>
      ) : null}
      <div className="cz-qty wide">
        <span className="cz-lbl">Facturación</span>
        <Facturacion cat={cat} conIva={conIva} setConIva={setConIva} />
      </div>
    </div>
  );
}
