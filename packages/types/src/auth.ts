/** DTOs de autenticación (F2). */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  /** Estado/región (columna legacy `residency`). Ayuda a cotizar el traslado. */
  residency: string | null;
  /** Empresa del cliente (columna legacy `Nempresa`), 2026-11-16: opcional, en Mi perfil. */
  company: string | null;
  /** Alta del cliente, para "Miembro desde". */
  createdAt: string | null;
}

/** Datos que el checkout exige; sin ellos no se puede comprar ni rentar. */
export const REQUIRED_PROFILE_FIELDS = ['name', 'email', 'phone', 'address', 'city', 'zip'] as const;
export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number];

/** Campos que faltan para poder completar una compra. */
export function missingProfileFields(u: AuthUser): RequiredProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => !String(u[f] ?? '').trim());
}

export interface AuthResponse {
  token: string;
  /** Refresh token de Supabase (para renovar el access token de 1h). */
  refresh_token?: string;
  user: AuthUser;
}
