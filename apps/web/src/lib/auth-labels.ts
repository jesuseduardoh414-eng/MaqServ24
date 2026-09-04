import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import type { AuthLabels } from '@/components/AuthCard';

/**
 * Copys de la card de auth resueltos desde el TEMA (server-side). Fuente única
 * para /login y /registro: editar "Entrar" o "Crea tu cuenta" en Panel →
 * Diseño ya mueve estas vistas.
 */
export function authLabels(theme: Theme): AuthLabels {
  return {
    tabLogin: t(theme, 'auth.login.title'),
    tabRegister: t(theme, 'auth.register.title'),
    loginEyebrow: t(theme, 'auth.login.eyebrow'),
    loginHeading: t(theme, 'auth.login.heading'),
    loginSubmit: t(theme, 'auth.login.submit'),
    registerEyebrow: t(theme, 'auth.register.eyebrow'),
    registerHeading: t(theme, 'auth.register.heading'),
    registerSubmit: t(theme, 'auth.register.submit'),
    fieldName: t(theme, 'auth.field.name'),
    fieldEmail: t(theme, 'auth.field.email'),
    fieldPassword: t(theme, 'auth.field.password'),
    remember: t(theme, 'auth.remember'),
    forgotLink: t(theme, 'auth.forgot.link'),
    forgotEyebrow: t(theme, 'auth.forgot.eyebrow'),
    forgotTitle: t(theme, 'auth.forgot.title'),
    forgotHint: t(theme, 'auth.forgot.hint'),
    forgotSubmit: t(theme, 'auth.forgot.submit'),
    forgotBack: t(theme, 'auth.forgot.back'),
    doneTitle: t(theme, 'auth.forgot.done.title'),
    doneBody: t(theme, 'auth.forgot.done.body'),
  };
}
