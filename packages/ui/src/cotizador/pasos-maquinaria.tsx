'use client';

import { calcularEquipo, type CatalogoMaquinaria } from '@maqserv/config';
import { money, money2 } from './formato';
import { Campo, Chip, Contador, Linea, NumeroTexto, Renglon, Tarjeta } from './piezas';
import { num, type LineaEquipo, type LineaMaquinaria, type LineaServicio } from './estado';

/** PASO 2 · qué equipo. Solo elegir; el tiempo se pide en el siguiente. */
export function PasoEquipos({
  cat,
  lineas,
  agregar,
  mostrarPrecios,
}: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  agregar: (id: string) => void;
  mostrarPrecios: boolean;
}) {
  const cuenta = (id: string) => lineas.filter((l) => l.tipo === 'equipo' && l.id === id).length;
  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Equipos disponibles</h2>
      <p className="cz-card-s">
        Toca un equipo para agregarlo. Todos incluyen operador con DC3, diésel, IMSS y seguro; el flete
        a obra se suma solo.
      </p>
      <div className="cz-cards">
        {cat.equipos.map((e) => (
          <Tarjeta
            key={e.id}
            icono={e.icono}
            titulo={e.nombre}
            nota={mostrarPrecios ? `desde ${money(e.tarifas.mes)} / día` : `flete ${e.flete_tipo}`}
            n={cuenta(e.id)}
            onClick={() => agregar(e.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Duraciones sugeridas: los bordes de cada tramo tarifario, que es lo que de
 *  verdad cambia el precio (y no una lista redonda de horas). */
function sugerencias(cat: CatalogoMaquinaria): number[] {
  const bordes = new Set<number>([1]);
  for (const t of cat.tiers) {
    bordes.add(t.desde_dias);
    if (t.hasta_dias !== null) bordes.add(t.hasta_dias);
  }
  bordes.add(30);
  return [...bordes].sort((a, b) => a - b).slice(0, 6);
}

/** PASO 3 · cuánto tiempo. Aquí se resuelve la tarifa (día/semana/mes). */
export function PasoDuracion({
  cat,
  lineas,
  actualizar,
  quitar,
  mostrarPrecios,
}: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  actualizar: (uid: number, patch: Partial<LineaEquipo>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const equipos = lineas.filter((l): l is LineaEquipo => l.tipo === 'equipo');
  const chips = sugerencias(cat);

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Tiempo de renta</h2>
      <p className="cz-card-s">
        La jornada es de {cat.jornada_horas} horas. Los días definen el tramo tarifario:{' '}
        {cat.tiers.map((t) => `${t.desde_dias}${t.hasta_dias ? `-${t.hasta_dias}` : '+'} ${t.label.toLowerCase()}`).join(' · ')}.
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
            nota={`Flete ${c.eq.flete_tipo} · operador y diésel incluidos`}
            insignia={mostrarPrecios ? c.tier.label : null}
            onQuitar={() => quitar(l.uid)}
            dinero={
              mostrarPrecios ? (
                <>
                  <Renglon
                    texto={`Renta · ${c.horasTotales} h${l.cantidad > 1 ? ` (${l.cantidad} equipos)` : ''} a ${money2(c.tarifaHora)}/h`}
                    valor={money(c.tiempo)}
                  />
                  <Renglon
                    texto={`Flete ida y vuelta${l.cantidad > 1 ? ` × ${l.cantidad}` : ''}`}
                    valor={money(c.flete)}
                  />
                  <Renglon texto="Subtotal" valor={money(c.tiempo + c.flete)} fuerte />
                </>
              ) : (
                <Renglon texto="Tiempo solicitado" valor={`${c.horasTotales} h`} fuerte />
              )
            }
          >
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
            {mostrarPrecios ? (
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
                {chips.map((d) => (
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
        <p className="cz-help">Regresa al paso anterior y elige al menos un equipo.</p>
      ) : null}
    </div>
  );
}

/** PASO 4 · servicios sueltos (pipas, retiro). Opcional a propósito. */
export function PasoServicios({
  cat,
  lineas,
  agregar,
  actualizar,
  quitar,
  mostrarPrecios,
}: {
  cat: CatalogoMaquinaria;
  lineas: LineaMaquinaria[];
  agregar: (id: string) => void;
  actualizar: (uid: number, patch: Partial<LineaServicio>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const servicios = lineas.filter((l): l is LineaServicio => l.tipo === 'servicio');
  const cuenta = (id: string) => servicios.filter((l) => l.id === id).length;

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Servicios adicionales</h2>
      <p className="cz-card-s">
        Agua en pipas y retiro de material. Este paso es opcional: si no hace falta ninguno, continúa.
      </p>
      <div className="cz-cards">
        {cat.servicios.map((s) => (
          <Tarjeta
            key={s.id}
            icono={s.icono}
            titulo={s.nombre}
            nota={mostrarPrecios ? `${money(s.precio)} / ${s.unidad}` : `por ${s.unidad}`}
            n={cuenta(s.id)}
            onClick={() => agregar(s.id)}
          />
        ))}
      </div>

      {servicios.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          {servicios.map((l) => {
            const sv = cat.servicios.find((s) => s.id === l.id);
            if (!sv) return null;
            const total = num(l.precio) * l.cantidad;
            return (
              <Linea
                key={l.uid}
                icono={sv.icono}
                titulo={sv.nombre}
                nota={`Precio por ${sv.unidad}`}
                onQuitar={() => quitar(l.uid)}
                dinero={
                  mostrarPrecios ? (
                    <Renglon texto={`${l.cantidad} × ${money(num(l.precio))}`} valor={money(total)} fuerte />
                  ) : (
                    <Renglon texto="Cantidad solicitada" valor={`${l.cantidad} ${sv.unidad}(s)`} fuerte />
                  )
                }
              >
                {mostrarPrecios ? (
                  <Campo label="Precio unitario">
                    <NumeroTexto
                      ariaLabel="precio unitario"
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
                {mostrarPrecios && sv.presets.length > 1 ? (
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
    </div>
  );
}
