import crypto from 'crypto';

// AES-256-GCM encryption key derivation
// Uses COOKIE_ENCRYPTION_KEY if provided, otherwise falls back to NEXTAUTH_SECRET.
// Always hashed via SHA-256 to guarantee a strict 32-byte key.
function getEncryptionKey(): Buffer {
  const secret =
    process.env.COOKIE_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'lc-companion-fallback-encryption-secret-key-32b';

  return crypto.createHash('sha256').update(secret).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = 'enc:v1:';

/**
 * Encrypts a sensitive string (such as a LEETCODE_SESSION cookie token)
 * using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptCookie(plainText: string): string {
  if (!plainText || !plainText.trim()) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted cookie string.
 * Gracefully handles legacy unencrypted strings for backward compatibility.
 */
export function decryptCookie(cipherText: string): string {
  if (!cipherText || !cipherText.trim()) return '';

  const val = cipherText.trim();

  // Backward compatibility: If stored value is not encrypted, return as-is
  if (!val.startsWith(PREFIX)) {
    return val;
  }

  try {
    const key = getEncryptionKey();
    const parts = val.slice(PREFIX.length).split(':');

    if (parts.length !== 3) {
      console.warn('Malformed encrypted cookie format');
      return '';
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    console.error('Failed to decrypt session cookie:', err.message);
    return '';
  }
}
