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

module.exports = {
  acquireSessionLock,
  releaseSessionLock,
  checkDuplicateSession
};
