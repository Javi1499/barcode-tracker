import crypto from 'crypto';

/**
 * Hashea una contraseña usando scrypt nativo con salt criptográfico de 16 bytes.
 * Produce un formato salt:key resistente a ataques de fuerza bruta y diccionarios.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Comprueba si la contraseña ingresada coincide con el hash almacenado
 * utilizando comparación en tiempo constante (timingSafeEqual) para prevenir timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);

    if (keyBuffer.length !== derivedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
