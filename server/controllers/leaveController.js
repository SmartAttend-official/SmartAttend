/**
 * SmartAttend — Leave Controller
 * ==============================================================================
 * Handles student leave applications, overlap validation, multi-day calculations,
 * and professor leave approvals/rejections with strict identity ownership gates.
 * ==============================================================================
 */

'use strict';

/**
 * Format any date into YYYY-MM-DD
 * @param {string|Date} d
 * @returns {string|null}
 */
function normalizeDateString(d) {
  if (!d) return null;
  const trimmed = String(d).trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return trimmed.split('T')[0];
}

/**
 * Calculate leave duration in calendar days (inclusive)
 * @param {string} normStartDate
 * @param {string} normEndDate
 * @param {number|string} [rawDuration]
 * @returns {number}
 */
function calculateLeaveDuration(normStartDate, normEndDate, rawDuration) {
  let start = normStartDate;
  let end = normEndDate;
  if (end < start) {
    const temp = start;
    start = end;
    end = temp;
  }
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const calculated = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
  return parseInt(rawDuration, 10) || calculated;
}

/**
 * Check if the student already has an approved or pending leave covering this window
 * @param {object} supabase
 * @param {string} studentId
 * @param {string} normStartDate
 * @param {string} normEndDate
 * @returns {Promise<{ hasOverlap: boolean, overlap?: object }>}
 */
async function checkLeaveOverlap(supabase, studentId, normStartDate, normEndDate) {
  try {
    const { data: existingLeaves } = await supabase
      .from('LeaveRequests')
      .select('id, startDate, endDate, date, status')
      .ilike('studentId', studentId.trim())
      .in('status', ['Approved', 'Pending']);

    if (existingLeaves && existingLeaves.length > 0) {
      const overlap = existingLeaves.find(ex => {
        const exStart = normalizeDateString(ex.startDate) || normalizeDateString(ex.date);
        const exEnd = normalizeDateString(ex.endDate) || normalizeDateString(ex.date) || exStart;
        if (!exStart) return false;
        return (normStartDate <= exEnd && normEndDate >= exStart);
      });

      if (overlap) {
        return { hasOverlap: true, overlap };
      }
    }
    return { hasOverlap: false };
  } catch (err) {
    console.warn('[leaveController] Overlap check warning:', err.message);
    return { hasOverlap: false };
  }
}

/**
 * Validate ownership on leave submission: students can only submit for themselves (OWN-2)
 * @param {object} user - req.user from JWT
 * @param {object} leaveData
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validateLeaveSubmissionOwnership(user, leaveData) {
  if (user && user.role === 'student') {
    const jwtStudentId = ((user.id) || '').toString().trim().toLowerCase();
    const jwtStudentEmail = ((user.email) || '').toString().trim().toLowerCase();
    const submittedId = ((leaveData.studentId || leaveData.id) || '').toString().trim().toLowerCase();

    if (submittedId && jwtStudentId && submittedId !== jwtStudentId && submittedId !== jwtStudentEmail) {
      return {
        allowed: false,
        reason: 'Access Denied: You may only submit leave requests for yourself.'
      };
    }
  }
  return { allowed: true };
}

/**
 * Validate ownership on leave resolution: professors can only resolve leaves addressed to them (OWN-3)
 * @param {object} user - req.user from JWT
 * @param {string|number} leaveId
 * @param {object} supabase
 * @returns {Promise<{ allowed: boolean, reason?: string, preCheck?: object }>}
 */
async function validateLeaveResolutionOwnership(user, leaveId, supabase) {
  if (user && user.role === 'professor') {
    const profEmail = (user.email || '').toString().trim().toLowerCase();
    const { data: preCheck } = await supabase
      .from('LeaveRequests')
      .select('targetProfessor')
      .eq('id', leaveId)
      .maybeSingle();

    if (preCheck && preCheck.targetProfessor) {
      const targetProf = (preCheck.targetProfessor || '').toString().trim().toLowerCase();
      if (targetProf && targetProf !== profEmail) {
        return {
          allowed: false,
          reason: 'Access Denied: You can only resolve leave requests addressed to you.',
          preCheck
        };
      }
    }
    return { allowed: true, preCheck };
  }
  return { allowed: true };
}

module.exports = {
  normalizeDateString,
  calculateLeaveDuration,
  checkLeaveOverlap,
  validateLeaveSubmissionOwnership,
  validateLeaveResolutionOwnership
};
