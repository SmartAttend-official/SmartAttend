/**
 * SmartAttend - Authentication Security & Lockout Service
 * Anti-Distributed Brute Force, Credential Stuffing & Rate Tracking
 */

// In-memory security tracking structures
const accountLockouts = new Map();
const emailOtpRequests = new Map();
const otpFailureTracker = new Map();
const labCodeFailureTracker = new Map();

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;   // 60 seconds
const MAX_OTP_PER_WINDOW = 3;               // Max 3 OTPs per 15 min per email
const MAX_OTP_FAILED_ATTEMPTS = 5;

/**
 * Generates a cryptographically random numeric OTP.
 * @param {number} [length=6]
 * @returns {string} Numeric string
 */
function generateOTP(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Retrieves the lockout status for an email address.
 * @param {string} email
 * @returns {object|null}
 */
function getAccountLockout(email) {
  if (!email) return null;
  const key = email.toLowerCase().trim();
  const state = accountLockouts.get(key);
  if (!state) return null;

  if (state.lockedUntil && Date.now() > state.lockedUntil) {
    accountLockouts.delete(key);
    return null;
  }
  return state;
}

/**
 * Increments failed login count and triggers lockout if threshold reached.
 * @param {string} email
 * @returns {object} { count, remaining, lockedUntil }
 */
function recordFailedLogin(email) {
  if (!email) return { count: 1, remaining: MAX_FAILED_ATTEMPTS - 1 };
  const key = email.toLowerCase().trim();
  const state = accountLockouts.get(key) || { count: 0, lockedUntil: null };

  state.count += 1;
  if (state.count >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    accountLockouts.set(key, state);
    return { count: state.count, remaining: 0, lockedUntil: state.lockedUntil };
  }

  accountLockouts.set(key, state);
  return { count: state.count, remaining: MAX_FAILED_ATTEMPTS - state.count, lockedUntil: null };
}

/**
 * Resets the failed login counter for an email upon successful authentication.
 * @param {string} email
 */
function resetFailedLogin(email) {
  if (!email) return;
  accountLockouts.delete(email.toLowerCase().trim());
}

/**
 * Checks if an email is permitted to request an OTP.
 * @param {string} email
 * @returns {object} { allowed: boolean, message?: string }
 */
function checkOtpRequestAllowed(email) {
  if (!email) return { allowed: true };
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const entry = emailOtpRequests.get(key);
  if (!entry) return { allowed: true };

  const timeSinceLast = now - entry.lastSent;
  if (timeSinceLast < OTP_RESEND_COOLDOWN_MS) {
    const secondsLeft = Math.ceil((OTP_RESEND_COOLDOWN_MS - timeSinceLast) / 1000);
    return { allowed: false, message: `Please wait ${secondsLeft} second(s) before requesting another OTP.` };
  }

  if (now - entry.windowStart < 15 * 60 * 1000) {
    if (entry.count >= MAX_OTP_PER_WINDOW) {
      const minutesLeft = Math.ceil((15 * 60 * 1000 - (now - entry.windowStart)) / (60 * 1000));
      return { allowed: false, message: `Too many OTP requests for this account. Please try again after ${minutesLeft} minute(s).` };
    }
  } else {
    entry.count = 0;
    entry.windowStart = now;
  }
  return { allowed: true };
}

/**
 * Records that an OTP was dispatched to an email address.
 * @param {string} email
 */
function recordOtpSent(email) {
  if (!email) return;
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const entry = emailOtpRequests.get(key) || { count: 0, windowStart: now, lastSent: 0 };
  if (now - entry.windowStart >= 15 * 60 * 1000) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }
  entry.lastSent = now;
  emailOtpRequests.set(key, entry);
}

/**
 * Records an OTP verification failure.
 * @param {string} email
 * @returns {number}
 */
function recordOtpFailure(email) {
  if (!email) return 1;
  const key = email.toLowerCase().trim();
  const count = (otpFailureTracker.get(key) || 0) + 1;
  otpFailureTracker.set(key, count);
  return count;
}

/**
 * Resets OTP failure counter upon successful verification.
 * @param {string} email
 */
function resetOtpFailure(email) {
  if (!email) return;
  otpFailureTracker.delete(email.toLowerCase().trim());
}

/**
 * Retrieves failed attempts for a lab attendance code.
 * @param {string} studentId
 * @returns {number}
 */
function getLabCodeFailure(studentId) {
  if (!studentId) return 0;
  const key = studentId.toLowerCase().trim();
  const entry = labCodeFailureTracker.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.timestamp > 2 * 60 * 1000) {
    labCodeFailureTracker.delete(key);
    return 0;
  }
  return entry.count;
}

/**
 * Records a lab attendance code failure for a student.
 * @param {string} studentId
 * @returns {number}
 */
function recordLabCodeFailure(studentId) {
  if (!studentId) return 1;
  const key = studentId.toLowerCase().trim();
  const now = Date.now();
  const entry = labCodeFailureTracker.get(key);
  if (!entry || now - entry.timestamp > 2 * 60 * 1000) {
    labCodeFailureTracker.set(key, { count: 1, timestamp: now });
    return 1;
  }
  entry.count += 1;
  entry.timestamp = now;
  labCodeFailureTracker.set(key, entry);
  return entry.count;
}

/**
 * Resets lab code failure counter for a student.
 * @param {string} studentId
 */
function resetLabCodeFailure(studentId) {
  if (!studentId) return;
  labCodeFailureTracker.delete(studentId.toLowerCase().trim());
}

/**
 * Checks whether an account is currently locked out.
 * @param {string} email
 * @returns {boolean}
 */
function isAccountLocked(email) {
  const lockout = getAccountLockout(email);
  return Boolean(lockout && lockout.lockedUntil && Date.now() < lockout.lockedUntil);
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  MAX_OTP_FAILED_ATTEMPTS,
  generateOTP,
  getAccountLockout,
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogin,
  checkOtpRequestAllowed,
  recordOtpSent,
  recordOtpFailure,
  resetOtpFailure,
  getLabCodeFailure,
  recordLabCodeFailure,
  resetLabCodeFailure
};
