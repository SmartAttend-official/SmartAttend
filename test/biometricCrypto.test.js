/**
 * Automated Test Suite: SmartAttend Biometric Cryptography (AES-256-GCM)
 */

const assert = require('assert');
const {
  encryptBiometric,
  decryptBiometric,
  isEncrypted,
  getEncryptionKey,
  ALGORITHM
} = require('../server/utils/biometricCrypto');

console.log('--- Running Biometric Cryptography (AES-256-GCM) Test Suite ---');

// Mock 128-float face encoding vector
const mockVector = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
const mockVectorJson = JSON.stringify(mockVector);

// Mock multi-template enrollment object
const mockMultiTemplate = {
  version: 2,
  count: 3,
  enrolled_at: new Date().toISOString(),
  templates: [mockVector, mockVector, mockVector]
};
const mockMultiTemplateJson = JSON.stringify(mockMultiTemplate);

// Test 1: Encrypt and decrypt round-trip for 128-float array
const encrypted1 = encryptBiometric(mockVectorJson);
assert(isEncrypted(encrypted1), 'Test 1 Failed: isEncrypted returned false for encrypted payload');
assert.strictEqual(encrypted1.version, 1, 'Test 1 Failed: Version must be 1');
assert.strictEqual(encrypted1.algorithm, ALGORITHM, 'Test 1 Failed: Algorithm must be aes-256-gcm');
assert(typeof encrypted1.iv === 'string' && encrypted1.iv.length === 24, 'Test 1 Failed: IV must be 24 hex chars (12 bytes)');
assert(typeof encrypted1.authTag === 'string' && encrypted1.authTag.length === 32, 'Test 1 Failed: AuthTag must be 32 hex chars (16 bytes)');

const decrypted1 = decryptBiometric(encrypted1);
assert.strictEqual(decrypted1, mockVectorJson, 'Test 1 Failed: Decrypted text does not match original plaintext');
console.log('✓ Test 1 Passed: 128-float vector AES-256-GCM encrypt/decrypt round-trip verified');

// Test 2: Encrypt and decrypt multi-template envelope
const encrypted2 = encryptBiometric(mockMultiTemplate);
const decrypted2 = decryptBiometric(encrypted2);
assert.deepStrictEqual(JSON.parse(decrypted2), mockMultiTemplate, 'Test 2 Failed: Multi-template round-trip mismatch');
console.log('✓ Test 2 Passed: Multi-template payload AES-256-GCM round-trip verified');

// Test 3: Non-deterministic ciphertext (IV uniqueness)
const encrypted3a = encryptBiometric(mockVectorJson);
const encrypted3b = encryptBiometric(mockVectorJson);
assert.notStrictEqual(encrypted3a.iv, encrypted3b.iv, 'Test 3 Failed: IV must be randomly generated and unique per encryption');
assert.notStrictEqual(encrypted3a.ciphertext, encrypted3b.ciphertext, 'Test 3 Failed: Ciphertexts must differ for identical plaintexts');
assert.strictEqual(decryptBiometric(encrypted3a), decryptBiometric(encrypted3b), 'Test 3 Failed: Both unique ciphertexts must decrypt to original data');
console.log('✓ Test 3 Passed: Unique initialization vectors (IV) produce distinct ciphertexts for identical plaintexts');

// Test 4: Tampered ciphertext detection via GCM Auth Tag
const tamperedCiphertext = {
  ...encrypted1,
  ciphertext: (encrypted1.ciphertext.slice(0, -2) + (encrypted1.ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa'))
};
assert.throws(() => {
  decryptBiometric(tamperedCiphertext);
}, /Biometric decryption failed/, 'Test 4 Failed: Tampered ciphertext must trigger authentication tag mismatch');
console.log('✓ Test 4 Passed: Tampered ciphertext correctly rejected by GCM authentication tag');

// Test 5: Tampered Auth Tag detection
const tamperedTag = {
  ...encrypted1,
  authTag: (encrypted1.authTag.slice(0, -2) + (encrypted1.authTag.slice(-2) === '11' ? '22' : '11'))
};
assert.throws(() => {
  decryptBiometric(tamperedTag);
}, /Biometric decryption failed/, 'Test 5 Failed: Tampered auth tag must trigger authentication failure');
console.log('✓ Test 5 Passed: Tampered authentication tag detected and rejected');

// Test 6: Legacy plaintext backward-compatibility (pass-through)
const legacyRaw = '[0.123, -0.456, 0.789]';
assert.strictEqual(isEncrypted(legacyRaw), false, 'Test 6 Failed: Legacy plaintext should not be flagged as encrypted');
const legacyResult = decryptBiometric(legacyRaw);
assert.strictEqual(legacyResult, legacyRaw, 'Test 6 Failed: Legacy plaintext must pass through unchanged');
console.log('✓ Test 6 Passed: Legacy unencrypted face data safely passes through for zero downtime');

// Test 7: Double-encryption prevention
const doubleEncrypted = encryptBiometric(encrypted1);
assert.deepStrictEqual(doubleEncrypted, encrypted1, 'Test 7 Failed: Already-encrypted payload must not be double-encrypted');
console.log('✓ Test 7 Passed: Idempotency check prevents double encryption');

// Test 8: Null and undefined safety
assert.strictEqual(encryptBiometric(null), null, 'Test 8 Failed: Null input must return null');
assert.strictEqual(encryptBiometric(undefined), null, 'Test 8 Failed: Undefined input must return null');
assert.strictEqual(decryptBiometric(null), null, 'Test 8 Failed: Null input must return null');
assert.strictEqual(decryptBiometric(undefined), null, 'Test 8 Failed: Undefined input must return null');
console.log('✓ Test 8 Passed: Null and undefined inputs handled safely without exceptions');

console.log('All 8 Biometric Cryptography tests passed successfully!\n');
