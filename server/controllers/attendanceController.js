/**
 * SmartAttend — Attendance Controller
 * ==============================================================================
 * Handles attendance session processing, duplicate session prevention,
 * and attendance record retrieval with tenant and ownership isolation.
 * ==============================================================================
 */

/**
 * Validate and check duplicate locks for an incoming attendance session
 * @param {object} classInfo
 * @param {Set} savingSessionLocks
 * @returns {{ isLocked: boolean, sessionLockKey: string, message?: string }}
 */
function acquireSessionLock(classInfo, savingSessionLocks) {
  const { subject, date } = classInfo || {};
  const sessionLockKey = `${date}||${(subject || '').trim().toLowerCase()}`;

  if (savingSessionLocks.has(sessionLockKey)) {
    return {
      isLocked: true,
      sessionLockKey,
      message: `Attendance for "${subject}" is already being saved right now. Please wait a moment.`
    };
  }

  savingSessionLocks.add(sessionLockKey);
  return { isLocked: false, sessionLockKey };
}

/**
 * Release an active in-memory session lock
 * @param {string} sessionLockKey
 * @param {Set} savingSessionLocks
 */
function releaseSessionLock(sessionLockKey, savingSessionLocks) {
  if (sessionLockKey && savingSessionLocks) {
    savingSessionLocks.delete(sessionLockKey);
  }
}

/**
 * Check if attendance has already been recorded in the database for Date + Subject
 * @param {object} supabase
 * @param {string} date
 * @param {string} subject
 * @returns {Promise<{ isDuplicate: boolean, error?: string }>}
 */
async function checkDuplicateSession(supabase, date, subject) {
  try {
    const { data: existingHist, error: dupCheckErr } = await supabase
      .from('AttendanceHistory')
      .select('StudentID')
      .eq('Date', date)
      .eq('Subject', subject)
      .limit(1);

    if (dupCheckErr) {
      console.warn('[attendanceController] Duplicate check query warning (non-fatal):', dupCheckErr.message);
      return { isDuplicate: false, error: dupCheckErr.message };
    }

    return { isDuplicate: (existingHist || []).length > 0 };
  } catch (err) {
    console.warn('[attendanceController] Duplicate check exception:', err.message);
    return { isDuplicate: false, error: err.message };
  }
}

const crypto = require('crypto');

/**
 * Generate a cryptographic HMAC signature for an offline attendance payload
 * @param {object} payload
 * @param {string} timestamp
 * @param {string} secretKey
 * @returns {string} hex signature
 */
function signOfflinePayload(payload, timestamp, secretKey) {
  const cleanPayload = { ...payload };
  delete cleanPayload._offlineMeta;
  const data = JSON.stringify(cleanPayload) + '|' + timestamp;
  return crypto.createHmac('sha256', secretKey || 'smartattend_default_offline_key').update(data).digest('hex');
}

/**
 * Verify an offline attendance sync payload against tampering and time boundaries.
 * Supports a single secretKey string or an array of candidate keys (e.g., JWT_SECRET, user session token).
 * @param {object} payload
 * @param {object} offlineMeta
 * @param {string|string[]} secretKey
 * @param {number} [maxAgeMs=86400000] 24 hours max age
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyOfflinePayload(payload, offlineMeta, secretKey, maxAgeMs = 86400000) {
  if (!offlineMeta || !offlineMeta.timestamp || !offlineMeta.signature) {
    return { valid: false, reason: 'Missing offline cryptographic signature metadata' };
  }

  const recordTime = new Date(offlineMeta.timestamp).getTime();
  if (isNaN(recordTime)) {
    return { valid: false, reason: 'Invalid offline timestamp format' };
  }

  const now = Date.now();
  // Reject future timestamps (> 5 minutes clock drift allowance)
  if (recordTime > now + 300000) {
    return { valid: false, reason: 'Offline timestamp cannot be in the future' };
  }

  // Reject stale records (> 24 hours old)
  if (now - recordTime > maxAgeMs) {
    return { valid: false, reason: 'Offline record has expired (older than 24 hours)' };
  }

  const candidateKeys = Array.isArray(secretKey) ? secretKey : [secretKey];
  const sigBuffer = Buffer.from(offlineMeta.signature, 'hex');

  for (const candidate of candidateKeys) {
    if (!candidate || typeof candidate !== 'string') continue;
    const expectedSig = signOfflinePayload(payload, offlineMeta.timestamp, candidate);
    const expBuffer = Buffer.from(expectedSig, 'hex');

    if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'Cryptographic signature mismatch: offline record was tampered with' };
}

module.exports = {
  acquireSessionLock,
  releaseSessionLock,
  checkDuplicateSession,
  signOfflinePayload,
  verifyOfflinePayload
};
