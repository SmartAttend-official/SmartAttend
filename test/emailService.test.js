/**
 * Automated Test Suite: SmartAttend Email Service & Templates
 */

const assert = require('assert');
const {
  getWelcomeEmailTemplate,
  getAssignmentEmailTemplate,
  getAssignmentRetractionEmailTemplate,
  getStudentAlertTemplate,
  getParentAbsentAlertTemplate
} = require('../server/services/emailService');

console.log('--- Running Email Service & Templates Test Suite ---');

// Test 1: Welcome template renders safely with XSS characters escaped
const welcomeHtml = getWelcomeEmailTemplate('<script>alert("hacked")</script>', 'STU101', 'Pass&Word123');
assert(welcomeHtml.includes('&lt;script&gt;'), 'Test 1 Failed: Name was not HTML escaped');
assert(welcomeHtml.includes('STU101'), 'Test 1 Failed: Missing student ID');
assert(welcomeHtml.includes('Pass&amp;Word123'), 'Test 1 Failed: Password special chars not escaped');
console.log('✓ Test 1 Passed: Welcome email template securely escapes untrusted inputs');

// Test 2: Assignment upload template renders subject and download link
const assignHtml = getAssignmentEmailTemplate('Lab 3', 'Complete problems 1-5', 'Data Structures', 'prof@college.edu', 'https://files.smartattend.edu/lab3.pdf', 'lab3.pdf', '2026-12-01');
assert(assignHtml.includes('Lab 3'), 'Test 2 Failed: Missing title');
assert(assignHtml.includes('Data Structures'), 'Test 2 Failed: Missing subject');
assert(assignHtml.includes('https://files.smartattend.edu/lab3.pdf'), 'Test 2 Failed: Missing attachment URL');
assert(assignHtml.includes('01/12/2026') || assignHtml.includes('2026-12-01'), 'Test 2 Failed: Missing due date');
console.log('✓ Test 2 Passed: Assignment notification email template correctly formatted');

// Test 3: Absent alert template renders attendance percentage and breakdown
const alertHtml = getStudentAlertTemplate('Aman Kumar', 'Database Systems', '2026-11-21', 65, 13, 20);
assert(alertHtml.includes('Aman Kumar'), 'Test 3 Failed: Missing name');
assert(alertHtml.includes('Database Systems'), 'Test 3 Failed: Missing subject');
assert(alertHtml.includes('65% (13/20 classes)'), 'Test 3 Failed: Missing attendance calculation summary');
console.log('✓ Test 3 Passed: Absent student warning template renders accurate metric breakdown');

console.log('All 3 Email Service tests passed successfully!\n');
