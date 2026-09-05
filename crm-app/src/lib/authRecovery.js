export const INVALID_PASSWORD_RECOVERY_MESSAGE =
  'El enlace de recuperación no es válido o ya venció. Solicitá uno nuevo e intentá nuevamente.';

export const EXPIRED_PASSWORD_RECOVERY_MESSAGE =
  'El enlace de recuperación venció o ya fue utilizado. Solicitá uno nuevo e intentá nuevamente.';

export function readPasswordRecoveryRedirect(locationLike = globalThis.location) {
  const pathname = String(locationLike?.pathname || '').replace(/\/+$/, '') || '/';
  const isRecoveryRoute = pathname === '/reset-password';

  if (!isRecoveryRoute) {
    return { isRecoveryRoute: false, recoveryError: '' };
  }

  const searchParams = new URLSearchParams(String(locationLike?.search || '').replace(/^\?/, ''));
  const hashParams = new URLSearchParams(String(locationLike?.hash || '').replace(/^#/, ''));
  const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
  const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

  if (errorCode === 'otp_expired') {
    return { isRecoveryRoute: true, recoveryError: EXPIRED_PASSWORD_RECOVERY_MESSAGE };
  }

  if (errorCode || errorDescription) {
    return { isRecoveryRoute: true, recoveryError: INVALID_PASSWORD_RECOVERY_MESSAGE };
  }

  return { isRecoveryRoute: true, recoveryError: '' };
}
