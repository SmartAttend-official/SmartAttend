/**
 * ============================================================================
 * SMARTATTEND — LAB ACCESS & ROTATING CODE CONTROLLER (Phase 9.3)
 * Handles rotating lab code generation, anti-brute-force failure tracking,
 * device proxy detection, and CRIT-3 identity-bound attendance verification.
 * ============================================================================
 */

// In-memory sliding-window failure tracker for lab code submissions
const labCodeFailureTracker = new Map();

/**
 * Returns the current failed attempt count for a student within the cooldown window (2 mins).
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
 * Increments failed attempt count and returns the updated count.
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
 * Resets failure count on successful verification.
 * @param {string} studentId
 */
function resetLabCodeFailure(studentId) {
  if (!studentId) return;
  labCodeFailureTracker.delete(studentId.toLowerCase().trim());
}

/**
 * Prunes entries older than 5 minutes.
 */
function pruneExpiredFailures() {
  const now = Date.now();
  for (const [key, entry] of labCodeFailureTracker.entries()) {
    if (now - entry.timestamp > 5 * 60 * 1000) {
      labCodeFailureTracker.delete(key);
    }
  }
}

/**
 * Generates rotating 6-digit lab code valid for 90 seconds.
 * @param {string} professorId
 * @param {string} subject
 * @returns {{ code: string, expiresAt: number, record: Object }}
 */
function generateLabCodePayload(professorId, subject) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 90000; // 90 seconds TTL

  return {
    code,
    expiresAt,
    record: {
      Code: code,
      ProfessorID: professorId || '',
      Subject: subject || '',
      ExpiresAt: expiresAt,
      ScannedStudents: ''
    }
  };
}

/**
 * Enforces CRIT-3 IDOR identity binding: student can only verify lab code for their own ID.
 * @param {Object} reqUser
 * @param {string} bodyStudentId
 * @returns {{ valid: boolean, cleanStudentId: string, message?: string }}
 */
function validateLabVerificationIdentity(reqUser, bodyStudentId) {
  const jwtStudentId = (reqUser && (reqUser.id || reqUser.studentId || reqUser.email || '')).toString().toLowerCase().trim();
  const cleanBodyId = (bodyStudentId || '').toString().toLowerCase().trim();

  // If JWT student ID is available and doesn't match the body student ID, reject cross-student submission
  if (jwtStudentId && cleanBodyId && jwtStudentId !== cleanBodyId) {
    return {
      valid: false,
      cleanStudentId: cleanBodyId,
      message: 'Unauthorized: You can only mark your own attendance.'
    };
  }

  const cleanStudentId = jwtStudentId || cleanBodyId;
  return {
    valid: true,
    cleanStudentId
  };
}

/**
 * Checks whether the student has already scanned this code.
 * @param {Array<Object>} existingScans
 * @param {string} cleanStudentId
 * @returns {boolean}
 */
function checkDuplicateScan(existingScans, cleanStudentId) {
  if (!Array.isArray(existingScans) || !cleanStudentId) return false;
  return existingScans.some(log => (log.StudentID || '').toLowerCase().trim() === cleanStudentId.toLowerCase().trim());
}

/**
 * Checks whether the physical device has already scanned for a different student (Anti-Proxy).
 * @param {Array<Object>} existingScans
 * @param {string} cleanStudentId
 * @param {string} deviceId
 * @returns {boolean}
 */
function checkProxyDevice(existingScans, cleanStudentId, deviceId) {
  if (!Array.isArray(existingScans) || !deviceId) return false;
  return existingScans.some(
    log => log.DeviceID === deviceId && (log.StudentID || '').toLowerCase().trim() !== cleanStudentId.toLowerCase().trim()
  );
}

module.exports = {
  getLabCodeFailure,
  recordLabCodeFailure,
  resetLabCodeFailure,
  pruneExpiredFailures,
  generateLabCodePayload,
  validateLabVerificationIdentity,
  checkDuplicateScan,
  checkProxyDevice,
  labCodeFailureTracker
};
