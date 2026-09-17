'use client';

import { precioZona, zonaDe, type CatalogoTriturados } from '@maqserv/config';
import { money, money2 } from './formato';
import { Campo, Chip, Contador, Linea, NumeroTexto, Renglon, Tarjeta } from './piezas';
import { ShInput } from '../shadcn/input';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '../shadcn/select';
import {
  num,
  type LineaBanco,
  type LineaMaterial,
  type LineaTriturados,
  type LineaZona,
} from './estado';

/** Las tres formas de cotizar triturados. Se pueden combinar en un documento. */
export type Modalidad = 'material' | 'zona' | 'banco';

export const MODALIDADES: Array<{ clave: Modalidad; titulo: string; nota: string; icono: string }> = [
  {
    clave: 'material',
    titulo: 'Por tonelada',
    nota: 'Material cargado en planta. El flete se cotiza aparte, por tonelada.',
    icono: 'material',
  },
  {
    clave: 'zona',
    titulo: 'Por viaje (zona)',
    nota: 'Volteo puesto en obra. El precio ya incluye material y flete.',
    icono: 'zona',
  },
  {
    clave: 'banco',
    titulo: 'Material de banco',
    nota: 'Se cotiza por m³ (no se pesa). El precio incluye el flete.',
    icono: 'banco',
  },
];

/** PASO 2 · cómo se va a cotizar. Define qué se pregunta después. */
export function PasoModalidad({
  seleccion,
  alternar,
}: {
  seleccion: Modalidad[];
  alternar: (m: Modalidad) => void;
}) {
  return (
    <div className="cz-card">
      <h2 className="cz-card-h">¿Cómo se entrega el material?</h2>
      <p className="cz-card-s">
        Elige una o varias. La diferencia no es cosmética: por tonelada el flete se cobra aparte y por
        viaje ya viene incluido, así que el documento sale distinto.
      </p>
      <div className="cz-cards">
        {MODALIDADES.map((m) => (
          <Tarjeta
            key={m.clave}
            icono={m.icono}
            titulo={m.titulo}
            nota={m.nota}
            n={seleccion.includes(m.clave) ? 1 : 0}
            onClick={() => alternar(m.clave)}
          />
        ))}
      </div>
    </div>
  );
}

/** PASO 3 · qué material y cuánto. */
export function PasoMateriales({
  cat,
  lineas,
  modalidades,
  alternarMaterial,
  agregarZona,
  agregarBanco,
  actualizar,
  quitar,
  mostrarPrecios,
}: {
  cat: CatalogoTriturados;
  lineas: LineaTriturados[];
  modalidades: Modalidad[];
  /** Elige el material o, si ya estaba, lo quita. */
  alternarMaterial: (id: string) => void;
  agregarZona: () => void;
  agregarBanco: () => void;
  /** Parche genérico: las tres líneas de triturados tienen campos distintos y
   *  la intersección de sus tipos no existe. Cada sub-componente lo recibe ya
   *  estrechado a SU línea. */
  actualizar: (uid: number, patch: Record<string, unknown>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const cuenta = (id: string) => lineas.filter((l) => l.tipo === 'material' && l.id === id).length;

  return (
    <>
      {modalidades.includes('material') ? (
        <div className="cz-card">
          <h2 className="cz-card-h">Materiales por tonelada</h2>
          <p className="cz-card-s">Toca un material para elegirlo y tócalo otra vez para quitarlo. Luego captura las toneladas.</p>
          <div className="cz-cards">
            {cat.productos.map((p) => (
              <Tarjeta
                key={p.id}
                icono="material"
                titulo={p.nombre}
                nota={mostrarPrecios ? `${money(p.precio_ton)} / ton` : 'por tonelada'}
                n={cuenta(p.id)}
                onClick={() => alternarMaterial(p.id)}
              />
            ))}
            <Tarjeta
              icono="personalizado"
              titulo="Otro material"
              nota="Escribe el nombre y el precio"
              n={cuenta('custom')}
              onClick={() => alternarMaterial('custom')}
            />
          </div>
        </div>
      ) : null}

      {modalidades.includes('zona') ? (
        <div className="cz-card">
          <h2 className="cz-card-h">Entrega por viaje</h2>
          <p className="cz-card-s">{cat.nota_zona}. Agrega una línea por cada combinación de zona y material.</p>
          <div className="cz-cards">
            <Tarjeta
              icono="zona"
              titulo="Agregar entrega por zona"
              nota={cat.nota_zona}
              n={lineas.filter((l) => l.tipo === 'zona').length}
              modo="agregar"
              onClick={agregarZona}
            />
          </div>
        </div>
      ) : null}

      {modalidades.includes('banco') ? (
        <div className="cz-card">
          <h2 className="cz-card-h">{cat.material_banco.nombre}</h2>
          <p className="cz-card-s">
            Por m³, en camión de {cat.material_banco.camion_m3} m³. El precio incluye el flete puesto en obra.
          </p>
          <div className="cz-cards">
            <Tarjeta
              icono="banco"
              titulo={`Agregar ${cat.material_banco.nombre.toLowerCase()}`}
              nota={`por ${cat.material_banco.unidad.toLowerCase()}`}
              n={lineas.filter((l) => l.tipo === 'banco').length}
              modo="agregar"
              onClick={agregarBanco}
            />
          </div>
        </div>
      ) : null}

      {lineas.length > 0 ? (
        <div className="cz-card">
          <h2 className="cz-card-h">Partidas</h2>
          <p className="cz-card-s">Captura las cantidades. Una partida sin cantidad no se cobra.</p>
          {lineas.map((l) =>
            l.tipo === 'material' ? (
              <LineaMaterialUI key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} />
            ) : l.tipo === 'banco' ? (
              <LineaBancoUI key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} />
            ) : (
              <LineaZonaUI key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} />
            ),
          )}
        </div>
      ) : null}
    </>
  );
}

function LineaMaterialUI({
  cat, l, actualizar, quitar, mostrarPrecios,
}: {
  cat: CatalogoTriturados;
  l: LineaMaterial;
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const esCustom = l.id === 'custom';
  const prod = cat.productos.find((p) => p.id === l.id);
  const precio = num(l.precio) || prod?.precio_ton || 0;
  const ton = num(l.toneladas);

  return (
    <Linea
      icono="material"
      titulo={
        esCustom ? (
          <ShInput
            className="h-9 text-[13.5px]"
            placeholder="Nombre del material"
            aria-label="Nombre del material"
            value={l.nombre}
            onChange={(e) => actualizar(l.uid, { nombre: e.target.value })}
          />
        ) : (
          l.nombre || prod?.nombre || 'Material'
        )
      }
      nota="Suministro por tonelada · cargado en planta"
      onQuitar={() => quitar(l.uid)}
      dinero={
        mostrarPrecios ? (
          <Renglon texto={`${ton.toLocaleString('es-MX')} ton a ${money2(precio)}`} valor={money(precio * ton)} fuerte />
        ) : (
          <Renglon texto="Cantidad solicitada" valor={`${ton.toLocaleString('es-MX')} ton`} fuerte />
        )
      }
    >
      <Campo label="Toneladas" req>
        <NumeroTexto decimal ariaLabel="toneladas" placeholder="0" valor={l.toneladas} onChange={(v) => actualizar(l.uid, { toneladas: v })} />
      </Campo>
      {mostrarPrecios ? (
        <Campo label="Precio / ton" help={prod ? `Tabulador: ${money(prod.precio_ton)}` : 'Captura el precio'}>
          <NumeroTexto ariaLabel="precio por tonelada" valor={l.precio} onChange={(v) => actualizar(l.uid, { precio: v })} />
        </Campo>
      ) : null}
    </Linea>
  );
}

function LineaBancoUI({
  cat, l, actualizar, quitar, mostrarPrecios,
}: {
  cat: CatalogoTriturados;
  l: LineaBanco;
  actualizar: (uid: number, patch: Partial<LineaBanco>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const b = cat.material_banco;
  const m3 = num(l.m3);
  const precio = num(l.precioM3) || b.precio_m3_default;
  return (
    <Linea
      icono="banco"
      titulo={b.nombre}
      nota={`Por ${b.unidad.toLowerCase()} · camión de ${b.camion_m3} m³ · precio con flete incluido`}
      onQuitar={() => quitar(l.uid)}
      dinero={
        mostrarPrecios ? (
          <Renglon texto={`${m3.toLocaleString('es-MX')} m³ a ${money2(precio)}`} valor={money(precio * m3)} fuerte />
        ) : (
          <Renglon texto="Volumen solicitado" valor={`${m3.toLocaleString('es-MX')} m³`} fuerte />
        )
      }
    >
      <Campo label="Metros cúbicos" req>
        <NumeroTexto decimal ariaLabel="metros cúbicos" placeholder="0" valor={l.m3} onChange={(v) => actualizar(l.uid, { m3: v })} />
      </Campo>
      {mostrarPrecios ? (
        <Campo label="Precio / m³" help="Incluye material y flete">
          <NumeroTexto ariaLabel="precio por metro cúbico" valor={l.precioM3} onChange={(v) => actualizar(l.uid, { precioM3: v })} />
        </Campo>
      ) : null}
    </Linea>
  );
}

function LineaZonaUI({
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
    <Linea
      icono="zona"
      titulo="Entrega por zona"
      nota={cat.nota_zona}
      onQuitar={() => quitar(l.uid)}
      dinero={
        mostrarPrecios ? (
          <>
            <Renglon texto="Precio por viaje" valor={money(precio)} />
            <Renglon texto={`${l.viajes} viaje${l.viajes === 1 ? '' : 's'}`} valor={money(precio * l.viajes)} fuerte />
          </>
        ) : (
          <Renglon texto="Viajes solicitados" valor={String(l.viajes)} fuerte />
        )
      }
    >
      <Campo label="Zona de entrega" ancho="full">
        {(id) => (
          <ShSelect value={l.zonaId} onValueChange={(v) => actualizar(l.uid, { zonaId: v })}>
            <ShSelectTrigger id={id} aria-label="Zona de entrega">
              <ShSelectValue placeholder="Elige la zona" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.zonas.map((zz) => (
                <ShSelectItem key={zz.id} value={zz.id}>
                  {zz.nombre}
                </ShSelectItem>
              ))}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      <Campo label="Material">
        {(id) => (
          <ShSelect value={l.productoId} onValueChange={(v) => actualizar(l.uid, { productoId: v })}>
            <ShSelectTrigger id={id} aria-label="Material">
              <ShSelectValue placeholder="Elige el material" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.productos.map((p) => (
                <ShSelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </ShSelectItem>
              ))}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      <div className="cz-qty">
        <span className="cz-lbl">Viajes</span>
        <Contador valor={l.viajes} min={1} ariaLabel="viajes" onChange={(v) => actualizar(l.uid, { viajes: v })} />
      </div>
    </Linea>
  );
}

/** PASO 4 · cómo llega y si lleva factura. */
export function PasoEntrega({
  cat,
  lineas,
  actualizar,
  conIva,
  setConIva,
  mostrarPrecios,
}: {
  cat: CatalogoTriturados;
  lineas: LineaTriturados[];
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  conIva: boolean;
  setConIva: (v: boolean) => void;
  mostrarPrecios: boolean;
}) {
  const materiales = lineas.filter((l): l is LineaMaterial => l.tipo === 'material');
  const hayIncluido = lineas.some((l) => l.tipo === 'zona' || l.tipo === 'banco');

  return (
    <>
      {materiales.length > 0 ? (
        <div className="cz-card">
          <h2 className="cz-card-h">Flete del material por tonelada</h2>
          <p className="cz-card-s">
            El material por tonelada sale cargado en planta. Si MAQSER24 lo lleva a obra, agrega el flete:
            se cobra por tonelada, según el área de entrega.
          </p>
          {materiales.map((l) => {
            const ton = num(l.toneladas);
            return (
              <Linea
                key={l.uid}
                icono="material"
                titulo={l.nombre || 'Material'}
                nota={`${ton.toLocaleString('es-MX')} ton`}
                onQuitar={() => actualizar(l.uid, { fleteTon: 0, fleteZona: '' })}
                dinero={
                  l.fleteTon > 0 && mostrarPrecios ? (
                    <Renglon texto={`Flete · ${ton.toLocaleString('es-MX')} ton a ${money2(l.fleteTon)}`} valor={money(l.fleteTon * ton)} fuerte />
                  ) : (
                    <Renglon texto={l.fleteTon > 0 ? 'Con flete a obra' : 'Sin flete · recoge el cliente'} valor="" fuerte />
                  )
                }
              >
                <Campo label="Área de entrega (opcional)" help="Sale impresa en el concepto del flete">
                  <ShInput
                    aria-label="área de entrega"
                    placeholder="Ej. área El Uro"
                    value={l.fleteZona}
                    onChange={(e) => actualizar(l.uid, { fleteZona: e.target.value })}
                  />
                </Campo>
                {mostrarPrecios ? (
                  <div className="cz-qty wide">
                    <span className="cz-lbl">Flete por tonelada</span>
                    <div className="cz-chips">
                      <Chip on={l.fleteTon === 0} onClick={() => actualizar(l.uid, { fleteTon: 0 })}>
                        Sin flete
                      </Chip>
                      {cat.fletes_ton.map((v) => (
                        <Chip key={v} on={l.fleteTon === v} onClick={() => actualizar(l.uid, { fleteTon: v })}>
                          {money(v)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Linea>
            );
          })}
        </div>
      ) : null}

      {hayIncluido ? (
        <div className="cz-card">
          <div className="cz-note">
            Las partidas por viaje y el material de banco ya llevan el flete incluido en su precio: no se
            les agrega nada en este paso.
          </div>
        </div>
      ) : null}

      {mostrarPrecios ? (
        <div className="cz-card">
          <h2 className="cz-card-h">Facturación</h2>
          <p className="cz-card-s">
            Cambia el total y también el texto de las condiciones del documento.
          </p>
          <div className="cz-chips">
            <Chip on={conIva} onClick={() => setConIva(true)}>
              Con factura · IVA {Math.round(cat.iva * 100)}%
            </Chip>
            <Chip on={!conIva} onClick={() => setConIva(false)}>
              Remisionado · sin IVA
            </Chip>
          </div>
        </div>
      ) : null}
    </>
  );
}
