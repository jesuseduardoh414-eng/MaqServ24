'use client';

import { ShDatePicker, ShTimePicker, type ShDatePickerProps, type ShTimePickerProps } from '@maqserv/ui';
import { claseCampoAdmin } from './AdminSelect';

/**
 * Fecha y hora del panel (2026-10-15): el ShDatePicker / ShTimePicker de
 * @maqserv/ui con la forma de los campos del panel, igual que AdminSelect con
 * el desplegable. Sustituyen a `<input type="date|time">`, que abría el
 * calendario del navegador encima del panel oscuro.
 */
export function AdminDatePicker({ size = 'md', className, ...props }: ShDatePickerProps & { size?: 'sm' | 'md' }) {
  return <ShDatePicker {...props} className={[claseCampoAdmin(size), className].filter(Boolean).join(' ')} />;
}

export function AdminTimePicker({ size = 'md', className, ...props }: ShTimePickerProps & { size?: 'sm' | 'md' }) {
  return <ShTimePicker {...props} className={[claseCampoAdmin(size), className].filter(Boolean).join(' ')} />;
}
