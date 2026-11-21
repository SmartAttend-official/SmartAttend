/**
 * PHASE 5 — ARCHITECTURAL MODULARIZATION TEST SUITE
 * ============================================================================
 * Verifies that code modularization cleanly separates concerns without
 * introducing regressions or breaking backward-compatible API contracts:
 *  1. Centralized Email Template Engine (server/templates/emailTemplates.js)
 *  2. Modularized Authentication Controller (server/controllers/authController.js)
 *  3. Modularized Attendance Controller & Session Lock (server/controllers/attendanceController.js)
 *  4. Modular Attendance REST Routes (/api/attendance/metrics)
 *  5. Backward-Compatible / Dispatcher & /api/reset-password Route
 */

const path = require('path');
const assert = require('assert');

require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
require('../server/node_modules/dotenv').config();

const request = require('../server/node_modules/supertest');
const { app } = require('../server/server.js');

const emailTemplates = require('../server/templates/emailTemplates');
const authController = require('../server/controllers/authController');
const attendanceController = require('../server/controllers/attendanceController');

let passed = 0;
let failed = 0;

function report(name, condition) {
  if (condition) {
    console.log(`  ✓ Test Passed: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${name}`);
    failed++;
  }
}

async function runPhase5ModularizationTests() {
  console.log('\n=== PHASE 5: ARCHITECTURAL MODULARIZATION TESTS ===\n');

  // ── 1. CENTRALIZED EMAIL TEMPLATE ENGINE ────────────────────────────────────
  console.log('1. Centralized Email Template Engine (server/templates/emailTemplates.js)');
  {
    const expectedFunctions = [
      'getOtpEmailTemplate',
      'getWelcomeEmailTemplate',
      'getAssignmentEmailTemplate',
      'getAssignmentRetractionEmailTemplate',
      'getStudentAlertTemplate',
      'getParentAbsentAlertTemplate',
      'getLateAlertTemplate',
      'getParentLateAlertTemplate',
      'getLeaveSubmittedParentTemplate',
      'getLeaveApprovedStudentTemplate',
      'getLeaveApprovedParentTemplate',
      'getLeaveRejectedStudentTemplate'
    ];

    for (const fnName of expectedFunctions) {
      report(`Template export "${fnName}" is a valid function`, typeof emailTemplates[fnName] === 'function');
    }

    // Verify XSS escaping across extracted templates
    const xssOtp = emailTemplates.getOtpEmailTemplate('123456', '<img src=x onerror=alert(1)>');
    report('OTP template escapes XSS injection in name', xssOtp.includes('&lt;img') && !xssOtp.includes('<img'));

    const xssLeave = emailTemplates.getLeaveSubmittedParentTemplate('Test<script>', 'ID01', '2026-11-21', '2026-11-22', 2, 'Prof<X>', 'Reason<Y>', 'Medical<Z>');
    report('Leave template escapes XSS injection in student name', xssLeave.includes('Test&lt;script&gt;'));
    report('Leave template escapes XSS injection in reason', xssLeave.includes('Reason&lt;Y&gt;'));
  }

  // ── 2. MODULAR AUTHENTICATION CONTROLLER ─────────────────────────────────────
  console.log('\n2. Modular Authentication Controller (server/controllers/authController.js)');
  {
    report('authController.resetPassword is a valid function', typeof authController.resetPassword === 'function');

    // Test input validation with mock req/res
    let statusSent = null;
    let jsonSent = null;
    const mockRes = {
      status: (s) => { statusSent = s; return mockRes; },
      json: (j) => { jsonSent = j; return mockRes; }
    };

    // Missing fields
    await authController.resetPassword({ body: {} }, mockRes, {});
    report('resetPassword rejects empty payload with HTTP 400', statusSent === 400);

    // Password < 8 characters
    await authController.resetPassword({ body: { email: 'a@b.com', otp: '123456', newPassword: 'short', role: 'student' } }, mockRes, {});
    report('resetPassword rejects passwords < 8 characters with HTTP 400', statusSent === 400);
    report('resetPassword error message specifies minimum 8 characters', jsonSent.message && jsonSent.message.includes('8 characters'));
  }

  // ── 3. MODULAR ATTENDANCE CONTROLLER & SESSION LOCK ──────────────────────────
  console.log('\n3. Modular Attendance Controller (server/controllers/attendanceController.js)');
  {
    report('acquireSessionLock is a function', typeof attendanceController.acquireSessionLock === 'function');
    report('releaseSessionLock is a function', typeof attendanceController.releaseSessionLock === 'function');
    report('checkDuplicateSession is a function', typeof attendanceController.checkDuplicateSession === 'function');

    const testLocks = new Set();
    const classInfo = { date: '2026-11-25', subject: 'Machine Learning' };

    // Acquire lock
    const lock1 = attendanceController.acquireSessionLock(classInfo, testLocks);
    report('Session lock successfully acquired on initial request', lock1.isLocked === false);
    report('Session lock key correctly formatted as date||subject', lock1.sessionLockKey === '2026-11-25||machine learning');

    // Concurrent duplicate lock attempt
    const lock2 = attendanceController.acquireSessionLock(classInfo, testLocks);
    report('Concurrent request detected and blocked by session lock', lock2.isLocked === true);
    report('Blocked message advises request already being saved', lock2.message && lock2.message.includes('already being saved'));

    // Release lock
    attendanceController.releaseSessionLock(lock1.sessionLockKey, testLocks);
    report('Session lock successfully released', !testLocks.has(lock1.sessionLockKey));
  }

  // ── 4. MODULAR ATTENDANCE REST ROUTES ────────────────────────────────────────
  console.log('\n4. Modular Attendance REST Routes (/api/attendance/metrics)');
  try {
    const res = await request(app)
      .get('/api/attendance/metrics?attended=18&totalHeld=20&threshold=75');

    report('GET /api/attendance/metrics returns HTTP 200', res.status === 200);
    report('Returns status: "success"', res.body && res.body.status === 'success');
    report('Metrics calculated accurately (90% attendance)', res.body.metrics && res.body.metrics.percentage === 90);
    report('Buffer classes calculated accurately (4 misses allowed)', res.body.metrics && res.body.metrics.bufferClasses === 4);
    report('Marked as safe (isSafe: true)', res.body.metrics && res.body.metrics.isSafe === true);
  } catch (err) {
    report('Attendance REST route test execution', false);
  }

  // ── 5. BACKWARD-COMPATIBLE API CONTRACTS ────────────────────────────────────
  console.log('\n5. Backward-Compatible /api/reset-password Contract');
  try {
    const resEmpty = await request(app)
      .post('/api/reset-password')
      .send({});
    report('POST /api/reset-password continues to return HTTP 400 via modular controller', resEmpty.status === 400);

    const resShort = await request(app)
      .post('/api/reset-password')
      .send({ email: 'test@smartattend.edu', otp: '123456', newPassword: '123', role: 'student' });
    report('POST /api/reset-password validates password length via modular controller', resShort.status === 400);
  } catch (err) {
    report('Backward-compatible API test execution', false);
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 5 Modularization Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n⚠ ${failed} test(s) FAILED — fix modularization issues.\n`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} Phase 5 Modularization tests passed successfully!\n`);
    process.exit(0);
  }
}

runPhase5ModularizationTests().catch(err => {
  console.error('Unhandled Phase 5 test suite error:', err);
  process.exit(1);
});
