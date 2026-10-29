'use client';

import {
  calcularEquipo,
  cobraFlete,
  minimoHorasDe,
  porZona,
  precioDeServicio,
  precioHoraDe,
  zonaDeMunicipio,
  zonaPrecioDe,
  zonasDelServicio,
  type CatalogoMaquinaria,
} from '@maqserv/config';
import { money, money2 } from './formato';
import { Campo, Chip, Contador, Linea, NumeroTexto, Renglon, Tarjeta } from './piezas';
import { num, type LineaEquipo, type LineaMaquinaria, type LineaServicio } from './estado';

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
}) {
  const servicios = lineas.filter((l): l is LineaServicio => l.tipo === 'servicio');
  const cuenta = (id: string) => servicios.filter((l) => l.id === id).length;
  const zonaObra = zonaDeMunicipio(cat, municipio);
  /** El servicio no se ofrece en ese municipio: en el sitio no se puede elegir. */
  const fueraDeZona = (s: CatalogoMaquinaria['servicios'][number]) =>
    porZona(s) && !!municipio.trim() && !zonasDelServicio(cat, s).some((z) => z.id === zonaObra?.id);

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Servicios adicionales</h2>
      <p className="cz-card-s">
        Agua en pipas y retiro de material. Se cobran según la zona de la obra
        {zonaObra ? ` (${municipio}: ${zonaObra.nombre})` : ''}.
        {lineas.some((l) => l.tipo === 'equipo') ? ' Este paso es opcional: si no hace falta ninguno, continúa.' : ''}
      </p>
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

      {servicios.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          {servicios.map((l) => {
            const sv = cat.servicios.find((s) => s.id === l.id);
            if (!sv) return null;
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
    </div>
  );
}
