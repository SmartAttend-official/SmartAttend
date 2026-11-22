/**
 * SmartAttend — Academic Controller
 * ==============================================================================
 * Handles academic entity management (departments, classes, subjects, proxies,
 * timetables, and student assignments) with validation and authorization checks.
 * ==============================================================================
 */

'use strict';

/**
 * Validate timetable upload payload parameters and file size bounds
 * @param {object} payload
 * @param {number} [maxBytes=5242880] Default 5MB
 * @returns {{ valid: boolean, message?: string }}
 */
function validateTimetableUpload(payload, maxBytes = 5 * 1024 * 1024) {
  const { department, semester, pdfBase64 } = payload || {};

  if (!department || !semester) {
    return { valid: false, message: 'Missing department or semester for timetable upload.' };
  }

  if (!pdfBase64) {
    return { valid: false, message: 'No file received for timetable upload.' };
  }

  const sizeInBytes = (pdfBase64.length * 3) / 4;
  if (sizeInBytes > maxBytes) {
    return { valid: false, message: 'File size exceeds the 5MB limit.' };
  }

  return { valid: true };
}

/**
 * Delete a record from an academic subSheet
 * @param {object} supabase
 * @param {string} subSheet Table name
 * @param {string} filterKey Column name
 * @param {string|number} filterVal Column value
 * @returns {Promise<{ error?: object }>}
 */
async function deleteAcademicRecord(supabase, subSheet, filterKey, filterVal) {
  const allowedTables = ['Departments', 'Timetables', 'StudentAssignments', 'Classes', 'Subjects'];
  if (!allowedTables.includes(subSheet)) {
    return { error: { message: `Deletion from table '${subSheet}' is not permitted.` } };
  }
  return await supabase.from(subSheet).delete().eq(filterKey, filterVal);
}

/**
 * Update a record in an academic subSheet
 * @param {object} supabase
 * @param {string} subSheet Table name
 * @param {string} filterKey Column name
 * @param {string|number} filterVal Column value
 * @param {object} updateData Data to update
 * @returns {Promise<{ error?: object }>}
 */
async function updateAcademicRecord(supabase, subSheet, filterKey, filterVal, updateData) {
  const allowedTables = ['Departments', 'Timetables', 'StudentAssignments', 'Classes', 'Subjects'];
  if (!allowedTables.includes(subSheet)) {
    return { error: { message: `Update on table '${subSheet}' is not permitted.` } };
  }
  return await supabase.from(subSheet).update(updateData).eq(filterKey, filterVal);
}

module.exports = {
  validateTimetableUpload,
  deleteAcademicRecord,
  updateAcademicRecord
};
