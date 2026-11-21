/**
 * Automated Test Suite: SmartAttend Auth & Lockout Service
 */

const assert = require('assert');
const {
  generateOTP,
  getAccountLockout,
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogin,
  checkOtpRequestAllowed,
  recordOtpSent,
  recordOtpFailure,
  resetOtpFailure
} = require('../server/services/authService');

console.log('--- Running AuthService Test Suite ---');

// Test 1: OTP generator format and randomness
const otp1 = generateOTP(6);
const otp2 = generateOTP(6);
assert.strictEqual(otp1.length, 6, 'Test 1 Failed: OTP must be 6 digits');
assert(/^\d{6}$/.test(otp1), 'Test 1 Failed: OTP must be purely numeric');
assert.notStrictEqual(otp1, otp2, 'Test 1 Failed: Successive OTPs must be random');
console.log('✓ Test 1 Passed: 6-digit numeric OTP generation verified');

// Test 2: Account lockout triggers exactly after 5 failed attempts
const testEmail = 'lockout_test@institution.edu';
resetFailedLogin(testEmail);
assert.strictEqual(isAccountLocked(testEmail), false, 'Test 2 Failed: Initial state should not be locked');

for (let i = 1; i <= 4; i++) {
  const result = recordFailedLogin(testEmail);
  assert.strictEqual(result.count, i);
  assert.strictEqual(result.remaining, 5 - i);
  assert.strictEqual(result.lockedUntil, null);
  assert.strictEqual(isAccountLocked(testEmail), false);
}

// 5th attempt triggers lockout
const lockedResult = recordFailedLogin(testEmail);
assert.strictEqual(lockedResult.count, 5);
assert.strictEqual(lockedResult.remaining, 0);
assert(lockedResult.lockedUntil > Date.now(), 'Test 2 Failed: lockedUntil must be in future');

assert.strictEqual(isAccountLocked(testEmail), true, 'Test 2 Failed: Account should be locked');
console.log('✓ Test 2 Passed: 5 failed attempts successfully trigger account lockout');

// Test 3: Reset on successful login clears lockout
resetFailedLogin(testEmail);
assert.strictEqual(getAccountLockout(testEmail), null, 'Test 3 Failed: Lockout should be cleared');
console.log('✓ Test 3 Passed: Reset clears account lockout state completely');

// Test 4: OTP rate throttling (cooldown)
const otpEmail = 'otp_rate_test@institution.edu';
const check1 = checkOtpRequestAllowed(otpEmail);
assert.strictEqual(check1.allowed, true, 'Test 4 Failed: First request should be allowed');
recordOtpSent(otpEmail);

const check2 = checkOtpRequestAllowed(otpEmail);
assert.strictEqual(check2.allowed, false, 'Test 4 Failed: Immediate second request should be throttled by cooldown');
assert(check2.message.includes('second(s)'), 'Test 4 Failed: Throttle message should inform user');
console.log('✓ Test 4 Passed: OTP request cooldown throttling verified');

console.log('All 4 AuthService tests passed successfully!\n');
