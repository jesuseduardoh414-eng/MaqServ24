'use client';

import { ESTADO_SOLICITUD_PROVEEDOR } from '@maqserv/config';
import { Btn } from '@/components/ui';
import type { ProviderRow } from './ProvidersManager';

/**
 * EL EXCEL DE LA RED (2026-10-27). Antes era el del CRM: una fila por máquina
 * con lo que cobraba por hora. Se quitaron los costos de referencia, así que
 * ahora es una fila por aliado con lo que sí se lleva en el panel: contacto,
 * dónde está, hasta dónde llega, qué da y cómo van sus papeles.
 */

/**
 * Celda CSV: entre comillas si trae coma, comilla o salto de línea. Un texto
 * que empieza con = + - @ Excel lo ejecuta como fórmula, y los nombres y notas
 * de un aliado vienen del registro público: se le antepone un apóstrofo
 * (auditoría 2026-10-23). Los números negativos se quedan como están.
 */
const celda = (v: unknown) => {
  const crudo = v == null ? '' : String(v);
  const s = /^[=+\-@\t\r]/.test(crudo) && !/^-?\d+(\.\d+)?$/.test(crudo) ? `'${crudo}` : crudo;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const SITUACION: Record<number, string> = { 1: 'Activo en la red', [ESTADO_SOLICITUD_PROVEEDOR]: 'Solicitud por revisar', 0: 'Dado de baja' };
const PAPELES: Record<ProviderRow['docsStatus'], string> = {
  'al-dia': 'Al día',
  'por-vencer': 'Por vencer',
  vencido: 'Vencido',
  incompleto: 'Faltan papeles',
  'sin-documentos': 'Sin papeles',
};

export function DescargarExcelProveedores({ aliados }: { aliados: ProviderRow[] }) {
  function descargar() {
    const enc = ['Aliado', 'Situación', 'Contacto', 'Teléfono', 'Correo', 'Dirección de su base', 'Municipio', 'Estado',
      'Municipios que cubre', 'Llega hasta (km)', 'Qué ofrece', 'Equipos', 'Papeles', 'Sello', 'Preferente', 'Meses en la red'];
    const filas = aliados.map((p) => [
      p.name, SITUACION[p.status] ?? 'Dado de baja', p.contactName, p.phone, p.email, p.address, p.city, p.state,
      p.coverage.join(', '), p.coverageRadiusKm, (p.categoryLabels ?? p.categories).join(', '),
      (p.equipment ?? []).filter((e) => !e.pending).map((e) => `${e.name}${e.brand ? ` (${e.brand})` : ''}`).join('; '),
      PAPELES[p.docsStatus], p.verified ? 'Sí' : 'No', p.level === 'preferente' ? 'Sí' : 'No', p.monthsInNetwork,
    ]);
    const csv = [enc, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
    // El BOM hace que Excel lea bien los acentos.
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `aliados-maqser24-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return <Btn icon="ph-download-simple" onClick={descargar}>Descargar Excel</Btn>;
}
