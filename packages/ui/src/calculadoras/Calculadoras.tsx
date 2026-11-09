'use client';

import { useState, type ReactNode } from 'react';
import { COTIZADOR_CSS } from '../cotizador/estilos';
import { CALCULADORAS_CSS } from './estilos';
import {
  MATERIALES_CONVERSION,
  cifra,
  convertir,
  dato,
  materialesCalle,
  numeroDe,
  type MaterialConversion,
} from './calculos';

/**
 * Las dos calculadoras de material (2026-11-09). Por ahora solo las monta el
 * enlace de los cotizadores; usan las piezas del cotizador (`.cz-*`) para
 * verse igual que él en el panel y, el día que se quiera, en el sitio.
 */
export interface PropsCalculadora {
  /** A dónde lleva «Cotizar …» de cada material (en el enlace, su cotizador con la llave). */
  cotizarHref: (material: MaterialConversion) => string;
  /**
   * Enlace de «Mandar por WhatsApp» con el resumen. Sin él, WhatsApp abre
   * pidiendo a quién mandarlo (en el enlace: a un cliente).
   */
  whatsappHref?: (resumen: string) => string;
  /** Nombre que encabeza el resumen. */
  marca?: string;
  /** `panel` en el admin (paleta fija), como el cotizador. */
  variante?: 'panel' | 'sitio';
}

const whatsappLibre = (resumen: string) => `https://wa.me/?text=${encodeURIComponent(resumen)}`;

function Marco({ variante, titulo, sub, children }: { variante?: string; titulo: string; sub: string; children: ReactNode }) {
  return (
    <div className="cz" data-variante={variante ?? 'panel'}>
      <style>{COTIZADOR_CSS + CALCULADORAS_CSS}</style>
      <div className="cz-head">
        <div>
          <h1 className="cz-title">{titulo}</h1>
          <p className="cz-sub">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Cotizar, mandar por WhatsApp y copiar el resumen. */
function Acciones({ resumen, cotizar, whatsappHref, vacio }: {
  resumen: string;
  cotizar: Array<{ href: string; texto: string }>;
  whatsappHref?: (resumen: string) => string;
  vacio: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumen);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt('Copia el resumen:', resumen);
    }
  }
  return (
    <div className="cm-acciones">
      {cotizar.map((c, i) => (
        <a key={c.href} href={c.href} className={`cz-btn ${i === 0 ? 'primary' : 'ghost'}`}>{c.texto}{i === 0 ? ' →' : ''}</a>
      ))}
      {vacio ? null : (
        <a href={(whatsappHref ?? whatsappLibre)(resumen)} target="_blank" rel="noopener noreferrer" className="cz-btn ghost">
          Mandar por WhatsApp
        </a>
      )}
      <button type="button" className="cz-btn ghost" onClick={copiar} disabled={vacio}>
        <span aria-live="polite">{copiado ? '✓ Resumen copiado' : 'Copiar resumen'}</span>
      </button>
    </div>
  );
}

/** Un campo numérico con su unidad pegada a la derecha. */
function CampoNumero({ id, etiqueta, unidad, ayuda, valor, alCambiar, placeholder }: {
  id: string;
  etiqueta: string;
  unidad: string;
  ayuda?: string;
  valor: string;
  alCambiar: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="cz-field">
      <label className="cz-lbl" htmlFor={id}>{etiqueta}</label>
      <div className="cm-unidad">
        <input
          id={id}
          className="cz-input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={valor}
          placeholder={placeholder ?? '0'}
          aria-describedby={ayuda ? `${id}-h` : undefined}
          onChange={(e) => alCambiar(e.target.value)}
        />
        <span aria-hidden>{unidad}</span>
      </div>
      {ayuda ? <span id={`${id}-h`} className="cz-help">{ayuda}</span> : null}
    </div>
  );
}

/* ── Calculadora de pavimento ──────────────────────────── */

type Capa = 'area' | 'subrasante' | 'subbase' | 'base' | 'carpeta';

const CAMPOS: Array<{ clave: Capa; etiqueta: string; unidad: string; ayuda: string }> = [
  { clave: 'area', etiqueta: 'Superficie de la calle', unidad: 'm²', ayuda: 'Área total a pavimentar' },
  { clave: 'subrasante', etiqueta: 'Espesor de subrasante', unidad: 'cm', ayuda: 'Tierra de banco' },
  { clave: 'subbase', etiqueta: 'Espesor de subbase', unidad: 'cm', ayuda: 'Subbase hidráulica' },
  { clave: 'base', etiqueta: 'Espesor de base', unidad: 'cm', ayuda: 'Base hidráulica' },
  { clave: 'carpeta', etiqueta: 'Espesor de carpeta', unidad: 'cm', ayuda: 'Carpeta asfáltica' },
];

/** Abre con un ejemplo (1,000 m² y espesores comunes) para que se entienda al llegar, como la de PUCSA. */
const EJEMPLO: Record<Capa, string> = { area: '1000', subrasante: '20', subbase: '20', base: '20', carpeta: '5' };
const VACIO: Record<Capa, string> = { area: '', subrasante: '', subbase: '', base: '', carpeta: '' };

export function CalculadoraPavimento({ cotizarHref, whatsappHref, marca = 'MAQSER24', variante }: PropsCalculadora) {
  const [v, setV] = useState<Record<Capa, string>>(EJEMPLO);
  const d = { area: numeroDe(v.area), subrasante: numeroDe(v.subrasante), subbase: numeroDe(v.subbase), base: numeroDe(v.base), carpeta: numeroDe(v.carpeta) };
  const m = materialesCalle(d);

  const materiales = [
    { nombre: 'Subrasante', tipo: 'Tierra de banco', cant: m.subrasante.m3, unidad: 'm³', sec: `Volumen compacto: ${cifra(m.subrasante.compacto)} m³`, formula: 'Área × (espesor ÷ 100) × 1.30 de abundamiento' },
    { nombre: 'Subbase hidráulica', tipo: 'Triturado', cant: m.subbase.t, unidad: 't', sec: `Volumen: ${cifra(m.subbase.m3)} m³`, formula: 'Área × (espesor ÷ 100) × 1.65 × 1.30' },
    { nombre: 'Base hidráulica', tipo: 'Triturado', cant: m.base.t, unidad: 't', sec: `Volumen: ${cifra(m.base.m3)} m³`, formula: 'Área × (espesor ÷ 100) × 1.65 × 1.30' },
    { nombre: 'Carpeta asfáltica', tipo: 'Mezcla asfáltica', cant: m.carpeta.t, unidad: 't', sec: `Volumen: ${cifra(m.carpeta.m3)} m³`, formula: 'Área × (espesor ÷ 100) × 1.30 × 1.80' },
  ];

  const resumen = [
    `${marca} · Material para una calle`,
    `Superficie: ${dato(d.area)} m²`,
    `Subrasante (tierra de banco, ${dato(d.subrasante)} cm): ${cifra(m.subrasante.m3)} m³`,
    `Subbase hidráulica (${dato(d.subbase)} cm): ${cifra(m.subbase.t)} t`,
    `Base hidráulica (${dato(d.base)} cm): ${cifra(m.base.t)} t`,
    `Carpeta asfáltica (${dato(d.carpeta)} cm): ${cifra(m.carpeta.t)} t`,
    `Total en toneladas: ${cifra(m.totalT)} t`,
  ].join('\n');

  return (
    <Marco variante={variante} titulo="Calculadora de pavimento" sub="Escribe la superficie y el espesor de cada capa: el material sale al momento. Es una estimación por volumen, sin precio.">
      <section className="cz-card" aria-labelledby="cm-datos-t">
        <div className="cm-cabeza">
          <div>
            <h2 id="cm-datos-t" className="cz-card-h">Datos de la calle</h2>
            <p className="cz-card-s">Superficie en m² y espesores en centímetros.</p>
          </div>
          <button type="button" className="cm-borrar" onClick={() => setV(VACIO)}>Borrar todo</button>
        </div>
        <div className="cm-campos">
          {CAMPOS.map((c) => (
            <CampoNumero
              key={c.clave}
              id={`cm-${c.clave}`}
              etiqueta={c.etiqueta}
              unidad={c.unidad}
              ayuda={c.ayuda}
              valor={v[c.clave]}
              alCambiar={(x) => setV((prev) => ({ ...prev, [c.clave]: x }))}
            />
          ))}
        </div>
      </section>

      <section className="cz-card" aria-labelledby="cm-res-t">
        <h2 id="cm-res-t" className="cz-card-h">Material que necesitas</h2>
        <p className="cz-card-s">Cambia mientras escribes.</p>
        <div className="cm-res" aria-live="polite">
          {materiales.map((x) => (
            <article key={x.nombre} className="cm-mat">
              <div className="cm-mat-h"><b>{x.nombre}</b><span className="cm-tag">{x.tipo}</span></div>
              <p className="cm-cant">{cifra(x.cant)}<small>{x.unidad}</small></p>
              <p className="cm-sec">{x.sec}</p>
              <p className="cm-formula">{x.formula}</p>
            </article>
          ))}
        </div>
        <div className="cz-total cm-total">
          <div className="n">
            <span>Total en toneladas</span>
            <b>{cifra(m.totalT)}<small>t</small></b>
          </div>
          <p className="d">Subbase + base + carpeta asfáltica<br />(la subrasante va en m³)</p>
        </div>
        <Acciones
          resumen={resumen}
          cotizar={[
            { href: cotizarHref('triturados'), texto: 'Cotizar triturados' },
            { href: cotizarHref('carpeta'), texto: 'Cotizar carpeta asfáltica' },
          ]}
          whatsappHref={whatsappHref}
          vacio={d.area === 0}
        />
        <ul className="cm-como">
          <li>El espesor en centímetros se pasa a metros (÷ 100) antes de aplicar los factores.</li>
          <li><b>Subrasante:</b> × 1.30 de abundamiento, en m³ (la tierra de banco se pide por volumen).</li>
          <li><b>Subbase y base:</b> × 1.65 × 1.30, en toneladas. <b>Carpeta:</b> × 1.30 × 1.80, en toneladas.</li>
        </ul>
      </section>
    </Marco>
  );
}

/* ── Conversor de m³ a toneladas ───────────────────────── */

export function ConversorM3Ton({ cotizarHref, whatsappHref, marca = 'MAQSER24', variante }: PropsCalculadora) {
  const [material, setMaterial] = useState<MaterialConversion>('triturados');
  const [aToneladas, setAToneladas] = useState(true);
  const [valor, setValor] = useState('');

  const mat = MATERIALES_CONVERSION[material];
  const n = numeroDe(valor);
  const resultado = convertir(material, aToneladas, n);
  const de = aToneladas ? 'm³' : 't';
  const a = aToneladas ? 't' : 'm³';
  const resumen = `${marca} · ${mat.nombre}\n${dato(n)} ${de} = ${cifra(resultado)} ${a}`;

  return (
    <Marco variante={variante} titulo="Conversor de m³ a toneladas" sub="Triturados o carpeta asfáltica: escribe el volumen y salen las toneladas al momento. También al revés.">
      <section className="cz-card cm-angosto" aria-labelledby="cm-conv-t">
        <h2 id="cm-conv-t" className="cz-card-h">{aToneladas ? 'De metros cúbicos a toneladas' : 'De toneladas a metros cúbicos'}</h2>
        <p className="cz-card-s">Elige el material y escribe la cantidad.</p>
        <div className="cm-conv-top">
          <span className="cz-lbl" id="cm-material-l">Material</span>
          <div className="cz-chips" role="radiogroup" aria-labelledby="cm-material-l">
            {(Object.keys(MATERIALES_CONVERSION) as MaterialConversion[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={material === k}
                className="cz-chip"
                data-on={material === k ? '1' : undefined}
                onClick={() => setMaterial(k)}
              >
                {MATERIALES_CONVERSION[k].nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Invertir (como «Convertir de TON a M³» en la de PUCSA): los dos sentidos a la vista, el elegido en azul. */}
        <div className="cm-conv-top">
          <span className="cz-lbl" id="cm-sentido-l">Convertir</span>
          <div className="cm-sentido" role="radiogroup" aria-labelledby="cm-sentido-l">
            {[true, false].map((haciaT) => (
              <button
                key={String(haciaT)}
                type="button"
                role="radio"
                aria-checked={aToneladas === haciaT}
                data-on={aToneladas === haciaT ? '1' : undefined}
                onClick={() => setAToneladas(haciaT)}
              >
                {haciaT ? 'De m³ a toneladas' : 'De toneladas a m³'}
              </button>
            ))}
          </div>
        </div>

        <CampoNumero
          id="cm-valor"
          etiqueta={aToneladas ? '¿Cuántos m³?' : '¿Cuántas toneladas?'}
          unidad={de}
          ayuda={`Escribe ${aToneladas ? 'el volumen' : 'las toneladas'} de ${material === 'triturados' ? 'triturado' : 'carpeta asfáltica'}.`}
          valor={valor}
          alCambiar={setValor}
          placeholder={aToneladas ? 'Ej. 25' : 'Ej. 41.25'}
        />

        <div className="cz-total cm-total" aria-live="polite">
          <div className="n">
            <span>Resultado estimado</span>
            <b>{cifra(resultado)}<small>{a}</small></b>
          </div>
          <p className="d">{dato(n)} {de} {aToneladas ? '×' : '÷'} {mat.formula} = {cifra(resultado)} {a}</p>
        </div>
        <p className="cz-note" style={{ marginTop: 12 }}>
          {aToneladas ? mat.explicacion : `${mat.nombre}: las toneladas se dividen entre ${mat.formula}.`}
        </p>

        <Acciones
          resumen={resumen}
          cotizar={[{ href: cotizarHref(material), texto: material === 'triturados' ? 'Cotizar triturados' : 'Cotizar carpeta asfáltica' }]}
          whatsappHref={whatsappHref}
          vacio={n === 0}
        />
      </section>
    </Marco>
  );
}
