'use client';

import { ShSelectCampo } from '@maqserv/ui';
import { Icon } from '@/components/Icon';

/**
 * "¿PARA QUÉ EMPRESA Y PARA CUÁL OBRA?"
 *
 * A quien ya nos dijo dónde trabaja no se le vuelve a preguntar. El documento
 * lo pide de los dos lados: para el proveedor, "la información que ya está
 * validada no debería solicitarse de nuevo"; y para el cliente, la sección 19
 * advierte que "si para solicitar una máquina el usuario tiene que llenar un
 * formulario interminable, la digitalización habrá sustituido una fricción por
 * otra".
 *
 * TODA SOLICITUD LLEVA EMPRESA Y OBRA (2026-10-23). "Cada vez que cotice, si ya
 * tiene obras, que le salgan con un seleccionador y si es nueva que la anote."
 * Una cuenta puede tener varias empresas y cada empresa varias obras: primero
 * se elige la empresa (o se escribe otra) y luego una de SUS obras (o "Obra
 * nueva", con su nombre; la dirección se pide abajo, en el mismo paso). Antes,
 * sin obras no se pintaba nada y la solicitud podía llegar sin obra.
 *
 * Elegir una obra NO bloquea la dirección, la rellena. Una obra grande tiene
 * varios accesos, y el cliente tiene que poder escribir "por la puerta 4" sin
 * salirse a editar su expediente.
 */

export interface ObraCliente {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  address: string | null;
  municipality: string | null;
  contactName: string | null;
  contactPhone: string | null;
  requirements: string[];
}

export interface EmpresaCliente {
  id: number;
  name: string;
  sites: ObraCliente[];
}

/** Valor del selector cuando la empresa no es ninguna de las suyas. */
export const OTRA_EMPRESA = 'otra';

/** Lo que se lleva elegido en el paso. */
export interface Destino {
  /** Id de la empresa elegida, `OTRA_EMPRESA`, o '' si la cuenta no tiene empresas. */
  empresa: string;
  /** Nombre de la empresa que no es de las suyas. */
  empresaNueva: string;
  obra: ObraCliente | null;
  /** Tocó "Obra nueva". */
  nueva: boolean;
  /** Nombre de la obra nueva. */
  obraNueva: string;
}

export const DESTINO_VACIO: Destino = { empresa: '', empresaNueva: '', obra: null, nueva: false, obraNueva: '' };

/** La empresa elegida de las suyas, o null (otra empresa, o no tiene). */
export function empresaElegida(empresas: EmpresaCliente[], d: Destino): EmpresaCliente | null {
  return empresas.find((e) => String(e.id) === d.empresa) ?? null;
}

/** Va a una obra nueva: la eligió, o su empresa no tiene obras todavía. */
export function esObraNueva(empresas: EmpresaCliente[], d: Destino): boolean {
  if (d.obra) return false;
  return d.nueva || (empresaElegida(empresas, d)?.sites.length ?? 0) === 0;
}

/**
 * Qué falta para seguir, o null. Los campos de texto los revisa el navegador
 * (son `required`); esto cubre lo que no es un campo: no haber elegido obra.
 */
export function faltaEnDestino(empresas: EmpresaCliente[], d: Destino): string | null {
  const emp = empresaElegida(empresas, d);
  if (!emp && d.empresaNueva.trim().length < 2) return 'Escribe para qué empresa es, o tu nombre si es para ti.';
  if (!d.obra && !esObraNueva(empresas, d)) return 'Elige la obra, o toca «Obra nueva» si es otra.';
  if (esObraNueva(empresas, d) && d.obraNueva.trim().length < 2) return 'Escribe el nombre de la obra nueva.';
  return null;
}

export function SitePicker({
  empresas,
  destino,
  onCambio,
  falta,
}: {
  empresas: EmpresaCliente[];
  destino: Destino;
  onCambio: (d: Destino) => void;
  /** Lo que falta, cuando intentó seguir sin elegir. */
  falta?: string | null;
}) {
  const emp = empresaElegida(empresas, destino);
  const obras = emp?.sites ?? [];
  const nueva = esObraNueva(empresas, destino);
  const set = (patch: Partial<Destino>) => onCambio({ ...destino, ...patch });

  // Opciones como tarjetas seleccionables (radio 8, borde 1 px); la elegida
  // se marca con borde y fondo azul tenue más una palomita, no solo con color.
  return (
    <section className="ms-panel">
      <style>{`
        .sp-list{ display:grid; gap:10px; margin-top:10px; }
        .sp-opc{ display:flex; gap:12px; align-items:flex-start; width:100%; text-align:left; padding:13px 14px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text); font:inherit; cursor:pointer; transition:border-color .18s ease, background-color .18s ease; }
        .sp-opc:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
        .sp-opc[aria-pressed="true"]{ border-color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 8%, transparent); }
        .sp-opc:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
        .sp-marca{ width:20px; height:20px; flex-shrink:0; margin-top:1px; border-radius:50%; border:1.5px solid var(--color-border); display:grid; place-items:center; color:var(--color-primary-fg); }
        .sp-opc[aria-pressed="true"] .sp-marca{ background:var(--color-primary); border-color:var(--color-primary); }
        .sp-txt{ min-width:0; display:grid; gap:3px; }
        .sp-nom{ font-size:14.5px; font-weight:600; }
        .sp-sub{ font-size:13px; line-height:1.45; color:var(--color-text-muted); overflow-wrap:anywhere; }
        .sp-bloque{ display:grid; gap:6px; margin-top:18px; }
      `}</style>
      <h2 className="ms-h2">¿Para qué empresa y para cuál obra?</h2>
      <p className="ms-h2-desc">Cada solicitud va a una obra. Si ya nos pediste antes, elige la tuya; si es otra, anótala y queda guardada.</p>

      {/* La empresa: las suyas en un selector, o el nombre escrito. */}
      <div className="sp-bloque">
        {empresas.length > 0 ? (
          <div className="ms-field">
            <label htmlFor="sp-empresa" className="ms-label">Empresa<span className="ms-req" aria-hidden>*</span></label>
            <ShSelectCampo
              id="sp-empresa"
              name="sp-empresa"
              value={destino.empresa}
              required
              aria-label="Empresa"
              onChange={(v) => {
                const otra = empresas.find((e) => String(e.id) === v);
                // Otra empresa: sus obras son otras, se empieza de cero.
                onCambio({ ...destino, empresa: v, obra: null, nueva: (otra?.sites.length ?? 0) === 0 });
              }}
              options={[
                ...empresas.map((e) => ({ value: String(e.id), label: e.name })),
                { value: OTRA_EMPRESA, label: 'Otra empresa…' },
              ]}
            />
            <p className="ms-hint">Si es para ti y no para una empresa, elige tu nombre.</p>
          </div>
        ) : null}
        {!emp ? (
          <div className="ms-field">
            <label htmlFor="sp-empresa-nueva" className="ms-label">
              {empresas.length > 0 ? 'Nombre de la otra empresa' : 'Empresa'}<span className="ms-req" aria-hidden>*</span>
            </label>
            <input
              id="sp-empresa-nueva"
              className="ms-input"
              value={destino.empresaNueva}
              required
              minLength={2}
              maxLength={190}
              placeholder="Ej. Constructora del Norte, o tu nombre si es para ti"
              onChange={(e) => set({ empresaNueva: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      {/* La obra: las de esa empresa como tarjetas, o una nueva con su nombre. */}
      <div className="sp-bloque">
        <span className="ms-label">Obra<span className="ms-req" aria-hidden>*</span></span>
        {obras.length > 0 ? (
          <div className="sp-list">
            {obras.map((o) => {
              const activo = destino.obra?.id === o.id;
              return (
                <button key={o.id} type="button" onClick={() => set({ obra: o, nueva: false })} aria-pressed={activo} className="sp-opc">
                  <span className="sp-marca" aria-hidden>{activo ? <Icon name="check" size={12} /> : null}</span>
                  <span className="sp-txt">
                    <span className="sp-nom">{o.name}</span>
                    {o.address ? <span className="sp-sub">{o.address}</span> : null}
                    {o.requirements.length > 0 ? (
                      // Se le recuerdan sus propios requisitos: es lo que evita la
                      // llamada de "¿y traen inducción?" con la máquina en la puerta.
                      <span className="sp-sub">Pide: {o.requirements.join(' · ')}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}

            <button type="button" onClick={() => set({ obra: null, nueva: true })} aria-pressed={nueva} className="sp-opc">
              <span className="sp-marca" aria-hidden>{nueva ? <Icon name="check" size={12} /> : null}</span>
              <span className="sp-txt">
                <span className="sp-nom">Obra nueva</span>
                <span className="sp-sub">Le pones nombre, escribes la dirección abajo y queda guardada para la próxima.</span>
              </span>
            </button>
          </div>
        ) : null}
        {nueva ? (
          <div className="ms-field" style={{ marginTop: obras.length > 0 ? 8 : 0 }}>
            <label htmlFor="sp-obra-nueva" className="ms-label">Nombre de la obra<span className="ms-req" aria-hidden>*</span></label>
            <input
              id="sp-obra-nueva"
              className="ms-input"
              value={destino.obraNueva}
              required
              minLength={2}
              maxLength={190}
              placeholder="Ej. Bodega Escobedo, Torre Valle Oriente"
              onChange={(e) => set({ obraNueva: e.target.value })}
            />
            <p className="ms-hint">Como le dicen en tu equipo: así la reconoces la próxima vez que cotices.</p>
          </div>
        ) : null}
        {falta ? (
          <div role="alert" className="ms-alert ms-alert-bad" style={{ marginTop: 8 }}>
            <Icon name="warning" size={18} style={{ color: 'var(--color-error)', marginTop: 2 }} />
            <span>{falta}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
