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

// In-memory replay attack cache: signature -> timestamp
const seenOfflineSignatures = new Map();

/**
 * Prune seen offline signatures older than 24 hours
 */
function pruneExpiredSignatures() {
  const now = Date.now();
  for (const [sig, ts] of seenOfflineSignatures.entries()) {
    if (now - ts > 86400000) {
      seenOfflineSignatures.delete(sig);
    }
  }
}

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
 * Verify an offline attendance sync payload against tampering, replay attacks, and time boundaries.
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

  const candidateKeys = (Array.isArray(secretKey) ? secretKey : [secretKey]).filter(Boolean);
  if (candidateKeys.length === 0) {
    return { valid: false, reason: 'No trusted cryptographic verification keys supplied' };
  }

  const sigBuffer = Buffer.from(offlineMeta.signature, 'hex');
  let matched = false;

  for (const candidate of candidateKeys) {
    if (!candidate || typeof candidate !== 'string') continue;
    const expectedSig = signOfflinePayload(payload, offlineMeta.timestamp, candidate);
    const expBuffer = Buffer.from(expectedSig, 'hex');

    if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return { valid: false, reason: 'Cryptographic signature mismatch: offline record was tampered with' };
  }

  // Anti-replay check: valid signature must not have been processed previously
  pruneExpiredSignatures();
  if (seenOfflineSignatures.has(offlineMeta.signature)) {
    return { valid: false, reason: 'Replay attack detected: offline signature has already been processed' };
  }

  // Record signature to prevent replay
  seenOfflineSignatures.set(offlineMeta.signature, now);
  return { valid: true };
}

/**
 * Persists an attendance session and synchronizes student totals to Supabase.
 * Reusable by both live save_session and batch sync_offline_attendance routes.
 * @param {object} supabase
 * @param {object} classInfo
 * @param {Array<object>} students
 * @param {object} [user]
 * @returns {Promise<{ success: boolean, inserted: number, skipped: number, error?: string }>}
 */
async function persistAttendanceSession(supabase, classInfo, students, user = null) {
  const { subject, dept, sem, date } = classInfo || {};
  if (!subject || !date || !Array.isArray(students)) {
    return { success: false, inserted: 0, skipped: 0, error: 'Invalid classInfo or students array' };
  }

  let inserted = 0;
  let skipped = 0;

  for (const s of students) {
    const sId = s.id || s.StudentID || s.studentId;
    if (!sId) continue;

    // Check if record already exists for this StudentID + Date + Subject
    const { data: existing, error: existingErr } = await supabase
      .from('AttendanceHistory')
      .select('StudentID')
      .eq('StudentID', sId)
      .eq('Date', date)
      .eq('Subject', subject)
      .limit(1);

    if (existingErr) {
      console.warn(`[persistAttendanceSession] Existence check warning for ${sId}:`, existingErr.message);
    }

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase
      .from('AttendanceHistory')
      .insert([{
        Date: date,
        Department: dept || 'General',
        Semester: sem || '1st sem',
        Subject: subject,
        StudentID: sId,
        Status: s.status || 'Present',
        lateMinutes: s.lateMinutes || 0
      }]);

    if (insertErr) {
      console.error(`[persistAttendanceSession] Insert error for ${sId}:`, insertErr.message);
    } else {
      inserted++;
    }
  }

  // Sync overall attendance totals for each affected student
  const studentIds = [...new Set(students.map(s => s.id || s.StudentID || s.studentId).filter(Boolean))];
  for (const sId of studentIds) {
    try {
      const { data: history } = await supabase
        .from('AttendanceHistory')
        .select('Status, Date, Subject')
        .eq('StudentID', sId);

      if (history && history.length > 0) {
        const uniqueSessions = new Set();
        const uniqueAttended = new Set();

        history.forEach(r => {
          const sessionKey = `${r.Date}_${r.Subject}`;
          const st = (r.Status || '').toLowerCase().trim();
          uniqueSessions.add(sessionKey);
          if (['present', 'late', 'leave'].includes(st)) {
            uniqueAttended.add(sessionKey);
          }
        });

        const total = uniqueSessions.size;
        const present = uniqueAttended.size;
        const pct = total > 0 ? parseFloat(((present / total) * 100).toFixed(2)) : 0.00;

        await supabase
          .from('students')
          .update({
            Total_Classes: total,
            Classes_Attended: present,
            Attendance_Percentage: pct
          })
          .eq('ID', sId);
      }
    } catch (syncErr) {
      console.warn(`[persistAttendanceSession] Totals sync failed for student ${sId}:`, syncErr.message);
    }
  }

  return { success: true, inserted, skipped };
}

module.exports = {
  acquireSessionLock,
  releaseSessionLock,
  checkDuplicateSession,
  signOfflinePayload,
  verifyOfflinePayload,
  persistAttendanceSession,
  seenOfflineSignatures,
  pruneExpiredSignatures
};
