'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PISTA_CAMPO,
  TELEFONO_MAX_DIGITOS,
  limpiarPara,
  problemaCp,
  problemaEmail,
  problemaNombre,
  problemaRfc,
  problemaTelefono,
  soloDigitos,
  type TipoCampo,
} from '@maqserv/config';

/**
 * QUÉ ENTRA EN CADA CAMPO (2026-10-15). Montado UNA vez por app (layout raíz).
 *
 * Cuatro trabajos, todos con un solo manejador en el documento —vale para los
 * formularios que ya existen y para los que se escriban mañana, sin tocarlos
 * (el cuarto, la validez nativa, está explicado junto a `revisar`):
 *
 * 1. FILTRAR POR TIPO al teclear y al pegar: en un teléfono no entra una letra,
 *    en un código postal solo dígitos (y no más de 5), en un correo ningún
 *    espacio, el RFC sube solo a mayúsculas. Cuando se rechaza algo aparece una
 *    pista debajo del campo ("Solo números"): sin ella, la tecla "no hace nada"
 *    y la persona no sabe por qué.
 * 2. RECORTAR AL PEGAR: lo copiado de un correo o un PDF trae un espacio o un
 *    salto de línea en las orillas; se pega ya limpio.
 * 3. RECORTAR AL SALIR del campo lo que se haya tecleado de más.
 *
 * EL TIPO sale de lo que el campo ya declara, en este orden:
 *   - `data-campo="telefono|cp|entero|decimal|rfc|email|nombre"` (explícito;
 *     `data-campo="libre"` lo deja sin filtro),
 *   - `type="tel"` / `inputMode="tel"` / autocomplete de teléfono → telefono,
 *   - autocomplete `postal-code` → cp,
 *   - `type="email"` / `inputMode="email"` → email,
 *   - `inputMode="numeric"` → entero, `inputMode="decimal"` → decimal,
 *   - `type="number"` → entero o decimal según su `step`,
 *   - autocomplete `name` / `given-name` / `family-name` → nombre.
 * El signo menos solo entra si el campo lo pide (`min` negativo, o un
 * `type="number"` sin `min`, o `data-negativo`): las longitudes de México lo
 * necesitan.
 *
 * Esto evita que entre basura; que el valor esté COMPLETO (10 dígitos, 5 del
 * código postal…) lo revisa el formulario al enviar y la API, con las mismas
 * reglas (`problemaTelefono`, `problemaCp`… en @maqserv/config).
 *
 * Los valores se escriben con `insertText` (o el setter nativo + `input`): un
 * `el.value = …` a secas deja a React con el valor viejo y el campo revuelve.
 * Se excluye cualquier campo marcado `data-no-trim`.
 */
const TIPOS_DE_TEXTO = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', '']);
const TIPOS = new Set<string>(Object.keys(PISTA_CAMPO));

function tipoDe(el: HTMLInputElement): TipoCampo | null {
  const explicito = el.dataset.campo;
  if (explicito === 'libre') return null;
  if (explicito && TIPOS.has(explicito)) return explicito as TipoCampo;
  const tp = (el.type || '').toLowerCase();
  const im = (el.inputMode || '').toLowerCase();
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (tp === 'tel' || im === 'tel' || /(^|\s)tel(-national)?$/.test(ac)) return 'telefono';
  if (/(^|\s)postal-code$/.test(ac)) return 'cp';
  if (tp === 'email' || im === 'email' || /(^|\s)email$/.test(ac)) return 'email';
  if (im === 'numeric') return 'entero';
  if (im === 'decimal') return 'decimal';
  if (tp === 'number') return el.step === 'any' || !Number.isInteger(Number(el.step || '1')) ? 'decimal' : 'entero';
  if (/(^|\s)(name|given-name|family-name)$/.test(ac)) return 'nombre';
  return null;
}

function admiteNegativo(el: HTMLInputElement): boolean {
  if (el.dataset.negativo !== undefined) return true;
  if (el.min !== '') return Number(el.min) < 0;
  return el.type === 'number';
}

function esCampo(el: EventTarget | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.dataset.noTrim === undefined && TIPOS_DE_TEXTO.has((el.type || '').toLowerCase());
}

/** El valor que quedaría si `texto` reemplaza la selección actual (null si el campo no expone selección). */
function valorCon(el: HTMLInputElement, texto: string): string | null {
  const ini = el.selectionStart;
  if (ini === null) return null;
  const fin = el.selectionEnd ?? ini;
  return el.value.slice(0, ini) + texto + el.value.slice(fin);
}

/** Lo que `texto` deja pasar en este campo (y si hubo que quitar algo que no fuera solo mayúsculas). */
function filtrar(el: HTMLInputElement, tipo: TipoCampo, texto: string): string {
  if ((tipo === 'entero' || tipo === 'decimal') && admiteNegativo(el)) {
    // El menos solo al principio del valor.
    const alInicio = (el.selectionStart ?? 0) === 0 && !el.value.startsWith('-');
    const sinSigno = texto.replace(/-/g, '');
    const limpio = limpiarPara(tipo, sinSigno, tipo === 'decimal' && yaTienePunto(el));
    return (texto.startsWith('-') && alInicio ? '-' : '') + limpio;
  }
  return limpiarPara(tipo, texto, tipo === 'decimal' && yaTienePunto(el));
}

function yaTienePunto(el: HTMLInputElement): boolean {
  const ini = el.selectionStart;
  if (ini === null) return false; // type=number: el punto lo administra el navegador
  return (el.value.slice(0, ini) + el.value.slice(el.selectionEnd ?? ini)).includes('.');
}

/** El tope de dígitos de cada tipo; `null` si cabe. */
function excede(el: HTMLInputElement, tipo: TipoCampo, texto: string): string | null {
  const nuevo = valorCon(el, texto);
  if (nuevo === null) return null;
  if (tipo === 'telefono' && soloDigitos(nuevo).length > TELEFONO_MAX_DIGITOS) return 'Un teléfono tiene 10 dígitos';
  if (tipo === 'cp' && el.maxLength <= 0 && nuevo.length > 5) return 'El código postal son 5 dígitos';
  return null;
}

/**
 * 4. VALIDEZ NATIVA. El filtro impide la basura, pero "81 12" sigue siendo un
 * teléfono incompleto. Se le pone al campo su `setCustomValidity` con la misma
 * regla de la API: los formularios que ya se apoyan en la validación del
 * navegador (`required` + enviar, `checkValidity`, `reportValidity`) la
 * respetan sin cambiar su código. Los que validan a mano usan `problema*`.
 */
const REGLA: Partial<Record<TipoCampo, (v: string) => string | null>> = {
  telefono: problemaTelefono,
  cp: problemaCp,
  email: problemaEmail,
  rfc: problemaRfc,
  nombre: problemaNombre,
};

function revisar(el: HTMLInputElement) {
  const tipo = tipoDe(el);
  const regla = tipo ? REGLA[tipo] : undefined;
  if (!regla) return;
  el.setCustomValidity(regla(el.value) ?? '');
}

function insertar(el: HTMLInputElement, texto: string) {
  if (document.execCommand('insertText', false, texto)) return;
  const ini = el.selectionStart;
  if (ini === null) return;
  el.setRangeText(texto, ini, el.selectionEnd ?? ini, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

interface Pista { texto: string; x: number; y: number; ancho: number; id: number }

export function FiltroDeCampos() {
  const [pista, setPista] = useState<Pista | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let n = 0;
    const avisar = (el: HTMLElement, texto: string) => {
      const r = el.getBoundingClientRect();
      setPista({ texto, x: r.left, y: r.bottom + 6, ancho: r.width, id: ++n });
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setPista(null), 1800);
    };

    // 1. Al teclear (y al soltar texto arrastrado).
    const alEscribir = (e: InputEvent) => {
      const el = e.target;
      if (!esCampo(el) || el.readOnly || el.disabled) return;
      if (!e.inputType.startsWith('insert') || e.inputType === 'insertFromPaste' || e.isComposing || e.inputType === 'insertCompositionText') return;
      const tipo = tipoDe(el);
      if (!tipo) return;
      const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      if (!data) return;

      const limpio = filtrar(el, tipo, data);
      const tope = excede(el, tipo, limpio);
      if (limpio === data && !tope) return;

      e.preventDefault();
      if (tope) {
        avisar(el, tope);
        return;
      }
      if (limpio) insertar(el, limpio);
      // El RFC en minúsculas no es un error: se escribe en mayúsculas y ya.
      const soloMayusculas = tipo === 'rfc' && limpio === data.toUpperCase();
      if (!soloMayusculas) avisar(el, PISTA_CAMPO[tipo]);
    };

    // 2. Al pegar: recortado y filtrado por tipo.
    const alPegar = (e: ClipboardEvent) => {
      const el = e.target;
      const esTextarea = el instanceof HTMLTextAreaElement && el.dataset.noTrim === undefined;
      if (!esTextarea && !esCampo(el)) return;
      const campo = el as HTMLInputElement | HTMLTextAreaElement;
      if (campo.readOnly || campo.disabled) return;

      const pegado = e.clipboardData?.getData('text/plain') ?? '';
      const recortado = pegado.trim();
      const tipo = campo instanceof HTMLInputElement ? tipoDe(campo) : null;
      let limpio = tipo ? filtrar(campo as HTMLInputElement, tipo, recortado) : recortado;
      if (tipo === 'telefono') {
        // Pegar "Tel. 81 1234 5678 ext 3": nos quedamos con lo que cabe, sin
        // separadores sueltos en las orillas (el punto de "Tel.", el espacio de "ext").
        while (soloDigitos(limpio).length > TELEFONO_MAX_DIGITOS) limpio = limpio.slice(0, -1);
        limpio = limpio.replace(/^[^\d+(]+/, '').replace(/[^\d)]+$/, '');
      }
      if (limpio === pegado) return;

      e.preventDefault();
      if (tipo && limpio.toUpperCase() !== recortado.toUpperCase()) avisar(campo, PISTA_CAMPO[tipo]);
      // Solo espacios (o nada válido) en el portapapeles: no se pega nada.
      if (!limpio) return;
      if (document.execCommand('insertText', false, limpio)) return;
      // Respaldo: en email/number no hay selección; ahí se deja el valor limpio entero.
      const ini = campo.selectionStart;
      if (ini === null) return;
      campo.setRangeText(limpio, ini, campo.selectionEnd ?? ini, 'end');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // 3. Al salir: recortar lo tecleado de más.
    const alSalir = (e: FocusEvent) => {
      const el = e.target;
      if (!esCampo(el)) return;
      const limpio = el.value.trim();
      if (limpio === el.value) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, limpio);
      else el.value = limpio;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // 4. Validez nativa: al cambiar el valor y, antes de enviar, en todos los
    // campos del formulario (los prellenados que nadie tocó también cuentan).
    // El clic de un botón llega aquí ANTES de que el navegador valide el envío
    // o de que el onClick de React llame a checkValidity.
    const alCambiar = (e: Event) => {
      if (esCampo(e.target)) revisar(e.target);
    };
    const alPulsar = (e: MouseEvent) => {
      const boton = (e.target as Element | null)?.closest?.('button, input[type="submit"]');
      const form = boton ? (boton as HTMLButtonElement).form ?? boton.closest('form') : null;
      if (!form) return;
      for (const el of Array.from(form.elements)) if (esCampo(el)) revisar(el);
    };

    // La pista va fija bajo el campo: si la página se mueve, se quita en vez
    // de quedarse flotando sobre otra cosa.
    const quitarPista = () => setPista(null);

    document.addEventListener('beforeinput', alEscribir as EventListener, true);
    document.addEventListener('paste', alPegar, true);
    document.addEventListener('blur', alSalir, true);
    document.addEventListener('input', alCambiar, true);
    document.addEventListener('click', alPulsar, true);
    window.addEventListener('scroll', quitarPista, { capture: true, passive: true });
    window.addEventListener('resize', quitarPista);
    return () => {
      window.removeEventListener('scroll', quitarPista, { capture: true });
      window.removeEventListener('resize', quitarPista);
      document.removeEventListener('beforeinput', alEscribir as EventListener, true);
      document.removeEventListener('paste', alPegar, true);
      document.removeEventListener('blur', alSalir, true);
      document.removeEventListener('input', alCambiar, true);
      document.removeEventListener('click', alPulsar, true);
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, []);

  if (!pista) return null;
  // Colores fijos (oscuro con texto claro): se lee igual en el sitio claro u
  // oscuro y en el panel, sin depender de los tokens de cada app. Sin portal:
  // el componente va directo en <body>, así que `fixed` se ancla a la ventana.
  return (
    <>
    <style>{'@keyframes filtro-pista{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}'}</style>
    <div
      key={pista.id}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: pista.x, top: pista.y, zIndex: 1300, maxWidth: Math.max(pista.ancho, 220),
        padding: '6px 10px', borderRadius: 8, background: '#1C2129', color: '#F5F7FA',
        border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 10px 28px -10px rgba(0,0,0,.6)',
        font: '500 12.5px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif', pointerEvents: 'none',
        animation: 'filtro-pista .16s ease',
      }}
    >
      {pista.texto}
    </div>
    </>
  );
}
