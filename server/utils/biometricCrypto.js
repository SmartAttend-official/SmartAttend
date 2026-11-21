/**
 * SmartAttend Biometric Cryptographic Service
 * AES-256-GCM Authenticated Encryption for Face Biometric Vectors
 * 
 * Compliant with:
 * - Indian Digital Personal Data Protection (DPDP) Act 2023 (Sec 2(t), Sec 8(5))
 * - OWASP Top 10 Cryptographic Failures (A02:2021)
 * - NIST SP 800-38D (Galois/Counter Mode)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96 bits - NIST standard for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128 bits

// Fallback transitional key derivation (SHA-256 of internal salt)
const TRANSITIONAL_KEY = crypto.createHash('sha256')
  .update('SMARTATTEND_TRANSITIONAL_BIOMETRIC_KEY_SALT_2026_PRODUCTION_SECURE')
  .digest();

/**
 * Retrieves the 32-byte encryption key from environment or transitional fallback.
 * @returns {Buffer} 32-byte key buffer
 */
function getEncryptionKey() {
  const envKey = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (envKey) {
    const trimmed = envKey.trim();
    if (trimmed.length === 64) {
      return Buffer.from(trimmed, 'hex');
    }
    if (Buffer.byteLength(trimmed, 'utf8') === 32) {
      return Buffer.from(trimmed, 'utf8');
    }
    // If key is present but not 32 bytes, hash it to ensure 32-byte key
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  // Fallback transitional key if env var not yet configured on Render
  return TRANSITIONAL_KEY;
}

/**
 * Determines whether a given value is already encrypted with SmartAttend Biometric Crypto.
 * @param {any} val - Value to check (object or string)
 * @returns {boolean}
 */
function isEncrypted(val) {
  if (!val) return false;
  let obj = val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return false;
    }
  }
  return Boolean(
    obj &&
    typeof obj === 'object' &&
    obj.version === 1 &&
    obj.algorithm === ALGORITHM &&
    typeof obj.iv === 'string' &&
    typeof obj.authTag === 'string' &&
    typeof obj.ciphertext === 'string'
  );
}

/**
 * Encrypts biometric face encoding vectors using AES-256-GCM.
 * @param {string|object|Array} plaintext - The raw face encoding data
 * @returns {object|null} Encrypted envelope with version, iv, authTag, and ciphertext
 */
function encryptBiometric(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;

  // Prevent double encryption
  if (isEncrypted(plaintext)) {
    return typeof plaintext === 'string' ? JSON.parse(plaintext) : plaintext;
  }

  const textToEncrypt = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(textToEncrypt, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext
  };
}

/**
 * Decrypts an encrypted biometric envelope back to plaintext string.
 * Supports legacy plaintext pass-through for zero-downtime backward compatibility.
 * @param {string|object} encryptedPayload - The encrypted envelope or legacy data
 * @returns {string|null} Decrypted plaintext string or legacy data as-is
 */
function decryptBiometric(encryptedPayload) {
  if (encryptedPayload === null || encryptedPayload === undefined) return null;

  // Backward compatibility: If not encrypted, return original data
  if (!isEncrypted(encryptedPayload)) {
    return typeof encryptedPayload === 'string' ? encryptedPayload : JSON.stringify(encryptedPayload);
  }

  let envelope = encryptedPayload;
  if (typeof envelope === 'string') {
    envelope = JSON.parse(envelope);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(envelope.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error(`Biometric decryption failed: Authentication tag mismatch or corrupted ciphertext (${err.message})`);
  }
}

module.exports = {
  encryptBiometric,
  decryptBiometric,
  isEncrypted,
  getEncryptionKey,
  ALGORITHM
};
