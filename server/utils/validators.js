/**
 * SmartAttend - Input Sanitization & Validation Helpers
 * OWASP A03:2021 - Injection Prevention
 */

/**
 * Escapes unsafe HTML characters to prevent XSS in email templates and dynamic HTML.
 * @param {any} str - Input value
 * @returns {string} Sanitized string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates whether an email string conforms to RFC 5322 format.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(email.trim());
}

/**
 * Validates whether a student ID contains only valid alphanumeric and standard separator characters.
 * @param {string} id
 * @returns {boolean}
 */
function isValidStudentId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_\-\/]{1,32}$/.test(id.trim());
}

/**
 * Trims and limits string length to prevent denial-of-service / payload buffer bloat.
 * @param {string} str - Input string
 * @param {number} [maxLength=255] - Maximum permitted length
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLength = 255) {
  if (!str) return '';
  return String(str).trim().slice(0, maxLength);
}

module.exports = {
  escapeHtml,
  isValidEmail,
  isValidStudentId,
  sanitizeString
};
