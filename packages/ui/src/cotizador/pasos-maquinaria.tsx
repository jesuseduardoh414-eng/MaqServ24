'use client';

import {
  calcularEquipo,
  cobraFlete,
  minimoHorasDe,
  porZona,
  precioDeServicio,
  precioHoraDe,
  SERVICIO_A_MANO,
  zonaDeMunicipio,
  zonaPrecioDe,
  zonasDelServicio,
  type CatalogoMaquinaria,
} from '@maqserv/config';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { money, money2 } from './formato';
import { Campo, Chip, Contador, Linea, NumeroTexto, Renglon, Tarjeta } from './piezas';
import { ShInput } from '../shadcn/input';
import { num, type LineaEquipo, type LineaMaquinaria, type LineaServicio } from './estado';

/**
 * Las horas en total (2026-10-30, pedido del dueño: "ventana para cantidad de
 * horas"). Se cobra por hora: se escribe cuántas y los días y las horas extra
 * se acomodan solos (20 h con jornada de 8 = 2 días y 4 h). Los botones de
 * días y horas extra siguen ahí.
 *
 * Mientras se escribe, el campo guarda su propio texto: si mostrara el total
 * calculado, borrar para teclear otro número lo regresaría a "0" a media
 * captura.
 */
function HorasEnTotal({ total, jornada, poner }: { total: number; jornada: number; poner: (dias: number, horas: number) => void }) {
  const [texto, setTexto] = useState(String(total));
  const [escribiendo, setEscribiendo] = useState(false);
  useEffect(() => {
    if (!escribiendo) setTexto(String(total));
  }, [total, escribiendo]);
  return (
    <Campo label="Horas en total" help={`Jornada de ${jornada} h: se reparte en días y horas extra`}>
      {(id) => (
        <ShInput
          id={id}
          inputMode="numeric"
          value={texto}
          onFocus={() => setEscribiendo(true)}
          onBlur={() => setEscribiendo(false)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 5);
            setTexto(v);
            const h = Number(v) || 0;
            poner(Math.floor(h / jornada), h % jornada);
          }}
        />
      )}
    </Campo>
  );
}

/** PASO 2 · qué equipo. Solo elegir; el tiempo se pide en el siguiente. */
export function PasoEquipos({
  cat,
  lineas,
  alternar,
  agregarOtra,
  mostrarPrecios,
}: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  /** Elige el equipo o, si ya estaba elegido, lo quita. */
  alternar: (id: string) => void;
  /** Añade OTRA partida del mismo equipo (para cotizarla con otra duración). */
  agregarOtra: (id: string) => void;
  mostrarPrecios: boolean;
}) {
  const cuenta = (id: string) => lineas.filter((l) => l.tipo === 'equipo' && l.id === id).length;
  const conFlete = cobraFlete(cat);
  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Equipos disponibles</h2>
      <p className="cz-card-s">
        Toca un equipo para elegirlo y tócalo otra vez para quitarlo. Todos incluyen operador con DC3,
        diésel, IMSS y seguro{conFlete ? '; el flete a obra se suma solo' : ''}.
      </p>
      <div className="cz-cards">
        {cat.equipos.map((e) => (
          <Tarjeta
            key={e.id}
            icono={e.icono}
            titulo={e.nombre}
            nota={mostrarPrecios ? `${money(precioHoraDe(cat, e))} / hora` : conFlete ? `flete ${e.flete_tipo}` : 'Por hora de trabajo'}
            n={cuenta(e.id)}
            onClick={() => alternar(e.id)}
            onAgregarOtra={() => agregarOtra(e.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Duraciones sugeridas, en días. Con precio por hora ya no hay tramos que marquen bordes (2026-10-29). */
const SUGERENCIAS = [1, 2, 3, 5, 15, 30];

/**
 * PASO 3 · cuánto tiempo. Se cobra por hora (2026-10-29): días × jornada +
 * horas extra, con un mínimo por equipo.
 *
 * Las horas que se cobran se enseñan SIEMPRE, también cuando los importes no
 * acompañan la captura: si pidió 3 horas y el mínimo es 8, tiene que verlo
 * aquí y no en la cotización.
 */
export function PasoDuracion({
  cat,
  lineas,
  actualizar,
  quitar,
  mostrarPrecios,
  editarPrecios = false,
}: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  actualizar: (uid: number, patch: Partial<LineaEquipo>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
  /** Solo el panel cambia el costo/hora de una cotización (2026-10-29); el sitio lo ve. */
  editarPrecios?: boolean;
}) {
  const equipos = lineas.filter((l): l is LineaEquipo => l.tipo === 'equipo');
  const minimo = minimoHorasDe(cat);
  const conFlete = cobraFlete(cat);

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Tiempo de renta</h2>
      <p className="cz-card-s">
        Se cobra por hora de trabajo. Cada día es una jornada de {cat.jornada_horas} horas
        {minimo > 0 ? ` y el mínimo es de ${minimo} horas por equipo` : ''}.
      </p>

      {equipos.map((l) => {
        const c = calcularEquipo(cat, {
          tipo: 'equipo', id: l.id, dias: l.dias, horas: l.horas,
          cantidad: l.cantidad, precio_hora: num(l.precioHora) || null,
        });
        if (!c.eq) return null;
        return (
          <Linea
            key={l.uid}
            icono={c.eq.icono}
            titulo={c.eq.nombre}
            nota={conFlete ? `Flete ${c.eq.flete_tipo} · operador y diésel incluidos` : 'Operador y diésel incluidos'}
            insignia={c.activo ? `${c.horasTotales} h` : null}
            onQuitar={() => quitar(l.uid)}
            dinero={
              mostrarPrecios ? (
                <>
                  <Renglon
                    texto={`Renta · ${c.horasTotales} h${l.cantidad > 1 ? ` (${l.cantidad} equipos)` : ''} a ${money2(c.tarifaHora)}/h`}
                    valor={money(c.tiempo)}
                  />
                  {c.notaMinimo ? <Renglon texto={c.notaMinimo} valor="" /> : null}
                  {conFlete ? (
                    <Renglon
                      texto={`Flete ida y vuelta${l.cantidad > 1 ? ` × ${l.cantidad}` : ''}`}
                      valor={money(c.flete)}
                    />
                  ) : null}
                  <Renglon texto="Subtotal" valor={money(c.tiempo + c.flete)} fuerte />
                </>
              ) : (
                <>
                  {c.notaMinimo ? <Renglon texto={c.notaMinimo} valor="" /> : null}
                  <Renglon texto="Tiempo que se cobra" valor={`${c.horasTotales} h`} fuerte />
                </>
              )
            }
          >
            <HorasEnTotal
              total={l.dias * cat.jornada_horas + l.horas}
              jornada={cat.jornada_horas}
              poner={(dias, horas) => actualizar(l.uid, { dias, horas })}
            />
            <div className="cz-qty">
              <span className="cz-lbl">Días</span>
              <Contador valor={l.dias} min={0} ariaLabel="días" onChange={(v) => actualizar(l.uid, { dias: v })} />
            </div>
            <div className="cz-qty">
              <span className="cz-lbl">Horas extra</span>
              <Contador
                valor={l.horas}
                min={0}
                max={cat.jornada_horas - 1}
                ariaLabel="horas extra"
                onChange={(v) => actualizar(l.uid, { horas: v })}
              />
            </div>
            <div className="cz-qty">
              <span className="cz-lbl">Equipos</span>
              <Contador valor={l.cantidad} min={1} ariaLabel="equipos" onChange={(v) => actualizar(l.uid, { cantidad: v })} />
            </div>
            {editarPrecios ? (
              <Campo
                label="Costo / hora"
                help={c.negociado ? 'Precio negociado' : 'Del tabulador vigente'}
              >
                <NumeroTexto
                  decimal
                  ariaLabel="costo por hora"
                  placeholder={String(Math.round(c.tarifaHora * 100) / 100)}
                  valor={l.precioHora}
                  onChange={(v) => actualizar(l.uid, { precioHora: v })}
                />
              </Campo>
            ) : null}
            <div className="cz-qty wide">
              <span className="cz-lbl">Duraciones frecuentes</span>
              <div className="cz-chips">
                {SUGERENCIAS.map((d) => (
                  <Chip
                    key={d}
                    on={l.dias === d && l.horas === 0}
                    onClick={() => actualizar(l.uid, { dias: d, horas: 0 })}
                  >
                    {d} {d === 1 ? 'día' : 'días'}
                  </Chip>
                ))}
              </div>
            </div>
          </Linea>
        );
      })}

      {equipos.length === 0 ? (
        <p className="cz-help">No elegiste maquinaria: continúa si solo necesitas agua o retiro de material.</p>
      ) : null}
    </div>
  );
}

/** PASO 4 · servicios sueltos (pipas, retiro). Opcional a propósito. */
export function PasoServicios({
  cat,
  lineas,
  alternar,
  actualizar,
  quitar,
  mostrarPrecios,
  editarPrecios = false,
  municipio,
  elegirZona,
  agregarOtro,
}: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  alternar: (id: string) => void;
  actualizar: (uid: number, patch: Partial<LineaServicio>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
  /** Solo el panel cambia el precio de un servicio en la cotización (2026-10-29). */
  editarPrecios?: boolean;
  /** El municipio de la obra: el agua se cobra según su zona (2026-10-29). */
  municipio: string;
  /** Panel: la zona se puede cambiar a mano. En el sitio sale sola del municipio. */
  elegirZona: boolean;
  /** Panel: «Otro servicio (nombre y precio a mano)», para lo que no está en el tabulador (2026-10-30). */
  agregarOtro?: () => void;
}) {
  const servicios = lineas.filter((l): l is LineaServicio => l.tipo === 'servicio');
  const zonaObra = zonaDeMunicipio(cat, municipio);

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Servicios adicionales</h2>
      <p className="cz-card-s">
        Agua en pipas y retiro de material. Se cobran según la zona de la obra
        {zonaObra ? ` (${municipio}: ${zonaObra.nombre})` : ''}.
        {lineas.some((l) => l.tipo === 'equipo') ? ' Este paso es opcional: si no hace falta ninguno, continúa.' : ''}
      </p>
      <TarjetasServicios cat={cat} lineas={lineas} alternar={alternar} mostrarPrecios={mostrarPrecios} municipio={municipio} elegirZona={elegirZona} />

      {servicios.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          {servicios.map((l) => {
            const sv = cat.servicios.find((s) => s.id === l.id);
            if (!sv) return l.id === SERVICIO_A_MANO ? <ServicioAMano key={l.uid} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} /> : null;
            // Por zona (el agua): la elegida a mano o la del municipio de la obra.
            const zonas = porZona(sv) ? zonasDelServicio(cat, sv) : [];
            const zona = porZona(sv) ? zonaPrecioDe(cat, l.zona) ?? zonaObra : null;
            const deZona = porZona(sv) ? precioDeServicio(cat, sv, zona?.id) : null;
            const unitario = num(l.precio) || deZona || 0;
            const total = unitario * l.cantidad;
            const nota = !porZona(sv)
              ? `Precio por ${sv.unidad}`
              : zona && deZona
                ? `${zona.nombre}${l.zona ? '' : ' · por el municipio de la obra'}`
                : municipio.trim() ? `No se ofrece en ${municipio}` : 'Elige el municipio de la obra para saber su zona';
            return (
              <Linea
                key={l.uid}
                icono={sv.icono}
                titulo={sv.nombre}
                nota={nota}
                onQuitar={() => quitar(l.uid)}
                dinero={
                  mostrarPrecios ? (
                    <Renglon texto={`${l.cantidad} × ${money(unitario)}`} valor={money(total)} fuerte />
                  ) : (
                    <Renglon texto="Cantidad solicitada" valor={`${l.cantidad} ${sv.unidad}(s)`} fuerte />
                  )
                }
              >
                {elegirZona && zonas.length > 0 ? (
                  <div className="cz-qty wide">
                    <span className="cz-lbl">Zona de la obra</span>
                    <div className="cz-chips">
                      {zonas.map((z) => (
                        <Chip key={z.id} on={zona?.id === z.id} onClick={() => actualizar(l.uid, { zona: z.id === zonaObra?.id ? '' : z.id })}>
                          {z.nombre}{mostrarPrecios ? ` · ${money(sv.precios_zona?.[z.id] ?? 0)}` : ''}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
                {editarPrecios ? (
                  <Campo label="Precio unitario" help={porZona(sv) ? 'Vacío = el de la zona' : undefined}>
                    <NumeroTexto
                      decimal
                      ariaLabel="precio unitario"
                      placeholder={deZona ? String(deZona) : undefined}
                      valor={l.precio}
                      onChange={(v) => actualizar(l.uid, { precio: v })}
                    />
                  </Campo>
                ) : null}
                <div className="cz-qty">
                  <span className="cz-lbl">Viajes</span>
                  <Contador
                    valor={l.cantidad}
                    min={1}
                    ariaLabel="viajes"
                    onChange={(v) => actualizar(l.uid, { cantidad: v })}
                  />
                </div>
                {editarPrecios && sv.presets.length > 1 ? (
                  <div className="cz-qty wide">
                    <span className="cz-lbl">Precios sugeridos</span>
                    <div className="cz-chips">
                      {sv.presets.map((p) => (
                        <Chip key={p} on={num(l.precio) === p} onClick={() => actualizar(l.uid, { precio: String(p) })}>
                          {money(p)}
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

      {agregarOtro ? (
        <button type="button" className="cz-agregar" onClick={agregarOtro} style={{ marginTop: 14 }}>
          <Plus className="size-4" aria-hidden />
          Otro servicio (nombre y precio a mano)
        </button>
      ) : null}
    </div>
  );
}

/** Las tarjetas de los servicios (agua, retiro…): las usan el paso de Servicios y la primera pantalla. */
function TarjetasServicios({ cat, lineas, alternar, mostrarPrecios, municipio, elegirZona }: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  alternar: (id: string) => void;
  mostrarPrecios: boolean;
  municipio: string;
  elegirZona: boolean;
}) {
  const cuenta = (id: string) => lineas.filter((l) => l.tipo === 'servicio' && l.id === id).length;
  const zonaObra = zonaDeMunicipio(cat, municipio);
  /** El servicio no se ofrece en ese municipio: en el sitio no se puede elegir. */
  const fueraDeZona = (s: CatalogoMaquinaria['servicios'][number]) =>
    porZona(s) && !!municipio.trim() && !zonasDelServicio(cat, s).some((z) => z.id === zonaObra?.id);
  return (
    <div className="cz-cards">
      {cat.servicios.map((s) => {
        const fuera = fueraDeZona(s);
        const precio = porZona(s) ? precioDeServicio(cat, s, zonaObra?.id) : s.precio;
        const nota = fuera
          ? `No se ofrece en ${municipio}`
          : mostrarPrecios && precio
            ? `${money(precio)} / ${s.unidad}${porZona(s) && zonaObra ? ` · ${zonaObra.nombre}` : ''}`
            : porZona(s) && zonaObra ? `por ${s.unidad} · ${zonaObra.nombre}` : `por ${s.unidad}`;
        return (
          <Tarjeta
            key={s.id}
            icono={s.icono}
            titulo={s.nombre}
            nota={nota}
            n={cuenta(s.id)}
            deshabilitada={fuera && !elegirZona && cuenta(s.id) === 0}
            onClick={() => alternar(s.id)}
          />
        );
      })}
    </div>
  );
}

/**
 * LOS SERVICIOS TAMBIÉN EN LA PRIMERA PANTALLA (2026-10-30, pedido del dueño:
 * "ponlos como principal, para no tener que avanzar para seleccionarlos si
 * solo quieren ese servicio"). Debajo de los equipos: quien solo quiere agua o
 * retiro lo elige aquí. Los viajes y la zona se ajustan en el paso de Servicios.
 */
export function ServiciosDelInicio(props: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  alternar: (id: string) => void;
  mostrarPrecios: boolean;
  municipio: string;
  elegirZona: boolean;
}) {
  if (!props.cat.servicios.length) return null;
  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Servicios</h2>
      <p className="cz-card-s">
        Agua en pipas y retiro de material. Si solo necesitas uno de estos, elígelo aquí; los viajes se
        ajustan en el paso de Servicios.
      </p>
      <TarjetasServicios {...props} />
    </div>
  );
}

const UNIDADES_A_MANO = ['servicio', 'viaje', 'hora', 'día', 'pieza'];

/** El servicio escrito a mano: nombre, unidad, cantidad y precio (solo el panel). */
function ServicioAMano({ l, actualizar, quitar, mostrarPrecios }: {
  l: LineaServicio;
  actualizar: (uid: number, patch: Partial<LineaServicio>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const unitario = num(l.precio);
  const unidad = l.unidad || 'servicio';
  return (
    <Linea
      icono="personalizado"
      titulo={l.nombre.trim() || 'Servicio escrito a mano'}
      nota="No está en el tabulador: nombre y precio a mano"
      onQuitar={() => quitar(l.uid)}
      dinero={mostrarPrecios ? <Renglon texto={`${l.cantidad} × ${money(unitario)}`} valor={money(unitario * l.cantidad)} fuerte /> : null}
    >
      <Campo label="Nombre del servicio" req>
        {(id) => (
          <ShInput id={id} placeholder="Ej. Arena 8" maxLength={120} value={l.nombre} onChange={(e) => actualizar(l.uid, { nombre: e.target.value })} />
        )}
      </Campo>
      <div className="cz-qty wide">
        <span className="cz-lbl">Se cobra por</span>
        <div className="cz-chips">
          {UNIDADES_A_MANO.map((u) => (
            <Chip key={u} on={unidad === u} onClick={() => actualizar(l.uid, { unidad: u })}>{u}</Chip>
          ))}
        </div>
      </div>
      <div className="cz-qty">
        <span className="cz-lbl">Cantidad</span>
        <Contador valor={l.cantidad} min={1} ariaLabel="cantidad" onChange={(v) => actualizar(l.uid, { cantidad: v })} />
      </div>
      <Campo label={`Precio por ${unidad}`} req>
        <NumeroTexto decimal ariaLabel="precio unitario" placeholder="Ej. 3500" valor={l.precio} onChange={(v) => actualizar(l.uid, { precio: v })} />
      </Campo>
    </Linea>
  );
}
