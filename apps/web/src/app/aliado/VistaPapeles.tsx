'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShDatePicker, ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '@maqserv/ui';
import { Icon } from '@/components/Icon';
import { API, Chip, Encabezado, ROJO, Titulo, VERDE, avisar, estadoDocs } from './comun';
import type { DatosPortal } from './tipos';

/**
 * PAPELES (2026-10-27): el expediente a la izquierda y la subida a la
 * derecha, siempre abierta. Antes había que tocar "Subir o renovar" para
 * que apareciera el formulario; en una pantalla propia sobra el paso.
 */
export function VistaPapeles({ datos }: { datos: DatosPortal }) {
  const router = useRouter();
  const { documentos } = datos;
  const docs = estadoDocs(documentos.estado);
  const [tipoDoc, setTipoDoc] = useState(documentos.tipos[0]?.clave ?? '');
  const [guardando, setGuardando] = useState(false);
  const faltan = documentos.faltan ?? [];

  /** Va por FormData por la foto; el Content-Type NO se fija a mano (boundary). */
  async function subirDocumento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('kind', tipoDoc);
    setGuardando(true);
    const r = await fetch(`${API}/aliado/documentos`, { method: 'POST', body: fd }).catch(() => null);
    setGuardando(false);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      avisar(j?.message ?? 'No se pudo subir. Intenta otra vez.', false);
      return;
    }
    const d = await r.json();
    avisar(d?.estadoDocumentos === 'al-dia' ? 'Recibido. Tu expediente quedó al día.' : 'Recibido. Todavía tienes papeles por renovar.');
    form.reset();
    router.refresh();
  }

  return (
    <>
      <Encabezado
        titulo="Tus papeles"
        desc="Con tus papeles vigentes obtienes el sello de verificado y sales primero en las propuestas. Si uno vence, pierdes el sello; sube el renovado aquí y vuelve solo."
        accion={<Chip tono={docs.tono}>{docs.label}</Chip>}
      />

      {faltan.length > 0 ? (
        <div className="ms-alert ms-alert-warn">
          <span style={{ color: 'var(--color-warning)', display: 'flex', marginTop: 2 }}><Icon name="warning" size={16} /></span>
          <span><strong>Te falta:</strong> {faltan.join(' y ')}. Sin esos papeles no hay sello de verificado.</span>
        </div>
      ) : null}

      {documentos.avisos.length > 0 ? (
        <div className={`ms-alert ${documentos.avisos.some((d) => d.urgencia === 'vencido') ? 'ms-alert-bad' : 'ms-alert-warn'}`} style={{ display: 'grid', gap: 8 }}>
          {documentos.avisos.map((d) => (
            <div key={d.documentId} style={{ fontSize: 13.5, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip tono={d.urgencia === 'vencido' ? 'bad' : 'warn'}>{d.texto}</Chip>
              <span>{d.name || d.kind}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="al-cuenta">
        <section>
          <Titulo desc={documentos.lista.length ? 'Lo que has entregado y hasta cuándo vale.' : undefined}>Tu expediente</Titulo>
          <div className="ms-panel al-lista">
            {documentos.lista.length === 0 ? (
              <p className="ms-muted" style={{ margin: 0, padding: '18px 20px', fontSize: 14, lineHeight: 1.6 }}>
                Todavía no tienes papeles entregados. Empieza por la <strong style={{ color: 'var(--color-text)' }}>póliza de seguro</strong> y la{' '}
                <strong style={{ color: 'var(--color-text)' }}>constancia de situación fiscal</strong>.
              </p>
            ) : (
              documentos.lista.map((d, i) => {
                const vencido = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59`) < new Date() : false;
                return (
                  <div key={d.id} className="al-lista-i" style={i ? undefined : { borderTop: 'none' }}>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ color: vencido ? ROJO : VERDE, display: 'flex', flexShrink: 0 }}><Icon name={vencido ? 'warning' : 'check'} size={15} /></span>
                      <span style={{ minWidth: 0 }}>
                        <span className="al-lista-t">{d.kindLabel}</span>
                        {d.name && d.name !== d.kindLabel ? <span className="al-lista-s">{d.name}</span> : null}
                      </span>
                    </span>
                    <span className="ms-num" style={{ fontSize: 13, color: vencido ? ROJO : 'var(--color-text-muted)' }}>
                      {d.expiresAt ? `${vencido ? 'Venció' : 'Vence'} ${d.expiresAt}` : 'Sin vencimiento'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section>
          <Titulo desc="Foto o PDF. Solo lo ve MAQSER24.">Subir o renovar un papel</Titulo>
          <form onSubmit={subirDocumento} className="ms-panel" style={{ display: 'grid', gap: 14 }}>
            <label className="ms-field">
              <span className="ms-label">¿Qué papel es?</span>
              <ShSelect value={tipoDoc} onValueChange={setTipoDoc}>
                <ShSelectTrigger aria-label="Tipo de papel"><ShSelectValue /></ShSelectTrigger>
                <ShSelectContent>
                  {documentos.tipos.map((t) => <ShSelectItem key={t.clave} value={t.clave}>{t.label}</ShSelectItem>)}
                </ShSelectContent>
              </ShSelect>
            </label>
            <div className="ms-field">
              <span className="ms-label">¿Hasta cuándo vale?</span>
              <ShDatePicker name="expiresAt" defaultValue="" placeholder={tipoDoc === 'seguro' ? 'Elige la fecha' : 'No vence'} aria-label="¿Hasta cuándo vale?" />
              <span className="ms-hint">{tipoDoc === 'seguro' ? 'La póliza siempre tiene vigencia: pon hasta cuándo vale.' : 'Si no vence, déjalo vacío.'}</span>
            </div>
            <label className="ms-field">
              <span className="ms-label">Foto o PDF del documento</span>
              {/* En obra se le toma foto a la póliza; en oficina suele haber PDF. Se
                  guarda en una carpeta privada: solo lo ve MAQSER24. */}
              <input type="file" name="file" accept="image/*,application/pdf" required className="ms-input" style={{ padding: '10px 13px' }} />
            </label>
            <button type="submit" className="ms-btn" disabled={guardando}>
              <Icon name="shield" size={16} />{guardando ? 'Subiendo…' : 'Subir'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
