/**
 * Automated Test Suite: SmartAttend Validators & Sanitization
 */

const assert = require('assert');
const {
  escapeHtml,
  isValidEmail,
  isValidStudentId,
  sanitizeString
} = require('../server/utils/validators');

console.log('--- Running Validators & Sanitization Test Suite ---');

// Test 1: HTML escaping against XSS payloads
const malicious = '<script>alert("XSS & exploit")</script>\'';
const escaped = escapeHtml(malicious);
assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;XSS &amp; exploit&quot;)&lt;/script&gt;&#039;', 'Test 1 Failed: XSS payload was not escaped');
assert.strictEqual(escapeHtml(null), '', 'Test 1 Failed: Null should return empty string');
assert.strictEqual(escapeHtml(undefined), '', 'Test 1 Failed: Undefined should return empty string');
console.log('✓ Test 1 Passed: XSS injection vectors properly neutralized with HTML entity encoding');

// Test 2: Valid and invalid email formats
assert.strictEqual(isValidEmail('student@institution.edu'), true, 'Test 2 Failed: Valid email rejected');
assert.strictEqual(isValidEmail('prof.name+tag@college.ac.in'), true, 'Test 2 Failed: Valid email rejected');
assert.strictEqual(isValidEmail('plainaddress'), false, 'Test 2 Failed: Invalid email accepted');
assert.strictEqual(isValidEmail('@missingusername.com'), false, 'Test 2 Failed: Invalid email accepted');
assert.strictEqual(isValidEmail('missingdomain@.com'), false, 'Test 2 Failed: Invalid email accepted');
assert.strictEqual(isValidEmail(null), false, 'Test 2 Failed: Null email accepted');
console.log('✓ Test 2 Passed: RFC 5322 email validation correctly accepts valid addresses and rejects invalid formats');

// Test 3: Student ID character validation
assert.strictEqual(isValidStudentId('BCA2026_042'), true, 'Test 3 Failed: Valid ID rejected');
assert.strictEqual(isValidStudentId('STU-8899/X'), true, 'Test 3 Failed: Valid ID rejected');
assert.strictEqual(isValidStudentId('ID; DROP TABLE students;--'), false, 'Test 3 Failed: SQL injection payload in ID accepted');
assert.strictEqual(isValidStudentId('<script>'), false, 'Test 3 Failed: HTML in ID accepted');
console.log('✓ Test 3 Passed: Student ID validator restricts input to authorized characters');

// Test 4: String length sanitation
assert.strictEqual(sanitizeString('   hello world   ', 5), 'hello', 'Test 4 Failed: String was not trimmed and clamped');
assert.strictEqual(sanitizeString(null), '', 'Test 4 Failed: Null string should return empty');
console.log('✓ Test 4 Passed: String length bounding and trimming verified');

console.log('All 4 Validator tests passed successfully!\n');
