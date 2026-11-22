/**
 * ============================================================================
 * SMARTATTEND — ADMINISTRATIVE USER MANAGEMENT CONTROLLER (Phase 9.3)
 * Handles student registration, bulk CSV/Excel ingestion, faculty onboarding,
 * profile modifications with IDOR controls, and account deletions.
 * ============================================================================
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Resolves professor department table mapping (BCA, MCA, BBA, MBA).
 * @param {string} dept
 * @returns {string} Table name
 */
function getProfessorDeptTable(dept) {
  const d = (dept || '').toString().toLowerCase().trim();
  if (d.includes('mca') || d.includes('master of computer')) return 'MCA';
  if (d.includes('bba') || d.includes('bachelor of business') || d.includes('business administration')) return 'BBA';
  if (d.includes('mba') || d.includes('master of business') || d.includes('masters of business')) return 'MBA';
  return 'BCA'; // Default fallback
}

/**
 * Validates single student registration payload.
 * @param {Object} data
 * @returns {{ valid: boolean, message?: string }}
 */
function validateStudentRegistration(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Invalid student registration payload.' };
  }
  const id = (data.ID || '').toString().trim();
  const name = (data.Name || '').toString().trim();
  const email = (data.Email || '').toString().trim();

  if (!id) return { valid: false, message: 'Student ID is required.' };
  if (!name) return { valid: false, message: 'Student name is required.' };
  if (!email || !email.includes('@')) return { valid: false, message: 'Valid student email address is required.' };

  return { valid: true };
}

/**
 * Validates professor registration payload.
 * @param {Object} data
 * @returns {{ valid: boolean, message?: string }}
 */
function validateProfessorRegistration(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Invalid professor registration payload.' };
  }
  const name = (data.Name || '').toString().trim();
  const email = (data.Email || '').toString().trim();
  const password = (data.Password || '').toString().trim();
  const dept = (data.Department || '').toString().trim();

  if (!name) return { valid: false, message: 'Professor name is required.' };
  if (!email || !email.includes('@')) return { valid: false, message: 'Valid professor email is required.' };
  if (!password || password.length < 8) {
    return { valid: false, message: 'A valid password (minimum 8 characters) must be provided when adding a professor account.' };
  }
  if (!dept) return { valid: false, message: 'Department is required.' };

  return { valid: true };
}

/**
 * Deduplicates and prepares bulk student records for ingestion.
 * @param {Array<Object>} studentList
 * @param {Set<string>} existingIds
 * @param {Set<string>} existingEmails
 * @returns {Promise<{ toInsert: Array<Object>, skipped: Array<Object> }>}
 */
async function processBulkStudents(studentList, existingIds = new Set(), existingEmails = new Set()) {
  const toInsert = [];
  const skipped = [];
  const batchIds = new Set();
  const batchEmails = new Set();

  for (const s of studentList) {
    const rawId = String(s.ID || s.id || '').trim();
    const rawName = String(s.Name || s.name || '').trim();
    const rawEmail = String(s.Email || s.email || '').trim().toLowerCase();
    const rawDept = String(s.Department || s.department || s.Dept || s.dept || 'General').trim();
    const rawSem = String(s.Semester || s.semester || s.Sem || s.sem || '1st sem').trim();
    const rawParentEmail = String(s.Parent_Email || s.parentEmail || s.parent_email || '').trim();
    const rawMobile = String(s.Mobile || s.mobile || s.Phone || s.phone || '').trim();

    if (!rawId || !rawName || !rawEmail) {
      skipped.push({ ID: rawId || 'N/A', Name: rawName || 'N/A', reason: 'Missing ID, Name, or Email' });
      continue;
    }

    const lowerId = rawId.toLowerCase();
    if (existingIds.has(lowerId) || batchIds.has(lowerId)) {
      skipped.push({ ID: rawId, Name: rawName, reason: 'Duplicate Student ID already exists' });
      continue;
    }

    if (existingEmails.has(rawEmail) || batchEmails.has(rawEmail)) {
      skipped.push({ ID: rawId, Name: rawName, reason: 'Duplicate Email address already exists' });
      continue;
    }

    batchIds.add(lowerId);
    batchEmails.add(rawEmail);

    // SEC-4: Generate per-student unique cryptographic activation token
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tempSecret = crypto.randomBytes(48).toString('hex');
    const hashedTempPwd = await bcrypt.hash(tempSecret, 10);

    toInsert.push({
      ID: rawId,
      Name: rawName,
      Email: rawEmail,
      Password: hashedTempPwd,
      Department: rawDept,
      Semester: rawSem,
      Parent_Email: rawParentEmail,
      Mobile: rawMobile,
      Total_Classes: 0,
      Classes_Attended: 0,
      Attendance_Percentage: 0.00,
      ResetStatus: 'PENDING',
      OTP: activationToken.substring(0, 32),
      OTP_Timestamp: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      _activationToken: activationToken
    });
  }

  return { toInsert, skipped };
}

/**
 * Validates update request permissions and scopes IDOR boundaries.
 * @param {string} userRole
 * @param {Object} reqUser
 * @param {string} sheet
 * @param {string} searchVal
 * @param {string} id
 * @returns {{ allowed: boolean, statusCode?: number, message?: string }}
 */
function validateUpdatePermissions(userRole, reqUser, sheet, searchVal, id) {
  if (userRole === 'student') {
    if (sheet && sheet !== 'student') {
      return { allowed: false, statusCode: 403, message: 'Access Denied: Students can only update student profiles.' };
    }
    const studentOwnId = ((reqUser && reqUser.id) || '').toString().trim().toLowerCase();
    const studentOwnEmail = ((reqUser && reqUser.email) || '').toString().trim().toLowerCase();
    const requestedTarget = (searchVal || id || '').toString().trim().toLowerCase();
    if (requestedTarget && requestedTarget !== studentOwnId && requestedTarget !== studentOwnEmail) {
      return { allowed: false, statusCode: 403, message: 'Access Denied: You cannot modify records belonging to other users.' };
    }
  }

  if (sheet === 'admin' && userRole !== 'admin') {
    return { allowed: false, statusCode: 403, message: 'Access Denied: Admin privileges required.' };
  }

  return { allowed: true };
}

module.exports = {
  getProfessorDeptTable,
  validateStudentRegistration,
  validateProfessorRegistration,
  processBulkStudents,
  validateUpdatePermissions
};
