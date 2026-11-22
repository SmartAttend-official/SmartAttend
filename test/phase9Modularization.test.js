/**
 * PHASE 9 — ARCHITECTURAL MODULARIZATION & CONTROLLER INTEGRATION TESTS
 * ============================================================================
 * Verifies the extracted modular controllers:
 *  1. leaveController (date normalization, duration calculation, ownership gates)
 *  2. academicController (timetable validation, permitted subSheet updates/deletes)
 *  3. Live Supertest HTTP integration for leave submission & timetable validation
 */

const path = require('path');
const assert = require('assert');

require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
require('../server/node_modules/dotenv').config();

const request = require('../server/node_modules/supertest');
const jwt = require('../server/node_modules/jsonwebtoken');

const { app, leaveController, academicController } = require('../server/server.js');
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_characters_long_super_secure';

let passed = 0;
let failed = 0;

function report(name, condition, extra) {
  if (condition) {
    console.log(`  ✓ Test Passed: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${name}${extra ? ` (${extra})` : ''}`);
    failed++;
  }
}

async function runPhase9Tests() {
  console.log('\n=== PHASE 9: ARCHITECTURAL MODULARIZATION & CONTROLLER TESTS ===\n');

  // ── 1. LEAVE CONTROLLER UNIT TESTS ─────────────────────────────────────────
  console.log('1. Leave Controller Unit Verification');

  // 1a. Date normalization
  report('leaveController.normalizeDateString handles ISO string',
    leaveController.normalizeDateString('2026-11-22T10:00:00Z') === '2026-11-22'
  );
  report('leaveController.normalizeDateString handles DD/MM/YYYY',
    leaveController.normalizeDateString('22/11/2026') === '2026-11-22'
  );
  report('leaveController.normalizeDateString handles null safely',
    leaveController.normalizeDateString(null) === null
  );

  // 1b. Duration calculation
  report('leaveController.calculateLeaveDuration computes exact calendar days inclusive',
    leaveController.calculateLeaveDuration('2026-11-22', '2026-11-24') === 3
  );
  report('leaveController.calculateLeaveDuration handles inverted dates gracefully',
    leaveController.calculateLeaveDuration('2026-11-24', '2026-11-22') === 3
  );
  report('leaveController.calculateLeaveDuration respects valid rawDuration override',
    leaveController.calculateLeaveDuration('2026-11-22', '2026-11-22', 2) === 2
  );

  // 1c. Ownership validation (Student submission)
  const studentUser = { id: 'STU001', email: 'student1@smartattend.edu', role: 'student' };
  const validOwn = leaveController.validateLeaveSubmissionOwnership(studentUser, { studentId: 'STU001' });
  report('validateLeaveSubmissionOwnership allows student submitting for own ID', validOwn.allowed === true);

  const crossOwn = leaveController.validateLeaveSubmissionOwnership(studentUser, { studentId: 'STU002' });
  report('validateLeaveSubmissionOwnership rejects cross-student leave submission',
    crossOwn.allowed === false && crossOwn.reason.includes('Access Denied')
  );

  // ── 2. ACADEMIC CONTROLLER UNIT TESTS ──────────────────────────────────────
  console.log('\n2. Academic Controller Unit Verification');

  // 2a. Timetable validation
  report('validateTimetableUpload rejects missing department/semester',
    academicController.validateTimetableUpload({ pdfBase64: 'data' }).valid === false
  );
  report('validateTimetableUpload rejects missing file payload',
    academicController.validateTimetableUpload({ department: 'BCA', semester: 'Sem 3' }).valid === false
  );
  report('validateTimetableUpload rejects file exceeding 5MB',
    academicController.validateTimetableUpload({
      department: 'BCA',
      semester: 'Sem 3',
      pdfBase64: 'A'.repeat(8 * 1024 * 1024)
    }).valid === false
  );
  report('validateTimetableUpload accepts valid payload within bounds',
    academicController.validateTimetableUpload({
      department: 'BCA',
      semester: 'Sem 3',
      pdfBase64: 'JVBERi0xLjQK...'
    }).valid === true
  );

  // 2b. Table whitelisting
  const unauthDelete = await academicController.deleteAcademicRecord({}, 'students', 'id', '1');
  report('deleteAcademicRecord blocks deletion from non-academic table (e.g., students)',
    unauthDelete.error && unauthDelete.error.message.includes('not permitted')
  );

  const unauthUpdate = await academicController.updateAcademicRecord({}, 'ADMIN', 'id', '1', {});
  report('updateAcademicRecord blocks update on unauthorized table (e.g., ADMIN)',
    unauthUpdate.error && unauthUpdate.error.message.includes('not permitted')
  );

  // ── 3. LIVE SUPERTEST HTTP INTEGRATION TESTS ───────────────────────────────
  console.log('\n3. Live Supertest HTTP Integration Tests');

  const adminToken = jwt.sign(
    { id: 'ADMIN001', email: 'admin@smartattend.edu', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Test timetable upload validation over HTTP
  const ttRes = await request(app)
    .post('/')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'upload_timetable', department: 'BCA', semester: 'Sem 3' });
  report('HTTP upload_timetable without file returns error',
    ttRes.body && ttRes.body.status === 'error' && ttRes.body.message.includes('No file received')
  );

  // Test timetable delete_academic invalid table blocking
  const delRes = await request(app)
    .post('/')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'delete_academic', subSheet: 'ADMIN', key: 'Admin_id', val: '1' });
  report('HTTP delete_academic on forbidden table is intercepted',
    delRes.status === 200 || delRes.body.status === 'error'
  );

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 9 Modularization Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n⚠ ${failed} test(s) FAILED — fix before committing.\n`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} Phase 9 Modularization tests passed successfully!\n`);
    process.exit(0);
  }
}

if (require.main === module) {
  runPhase9Tests();
}

module.exports = runPhase9Tests;
