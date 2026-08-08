const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Comprobación de formato simple, no RFC 5322 completa — suficiente para
 * detectar errores de tecleo obvios sin rechazar direcciones reales.
 */
export function isValidEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(raw.trim());
}
