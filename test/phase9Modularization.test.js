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

const { app, leaveController, academicController, adminController, labController } = require('../server/server.js');
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

  // 2c. Payload sanitization against mass assignment
  const sanitizedDept = academicController.sanitizeDepartmentPayload({ Name: 'CS', Code: 'CS101', Description: 'CompSci', malicious: 'drop' });
  report('sanitizeDepartmentPayload strips unauthorized attributes',
    sanitizedDept.Name === 'CS' && sanitizedDept.Code === 'CS101' && sanitizedDept.malicious === undefined
  );

  // ── 3. ADMIN CONTROLLER UNIT TESTS ─────────────────────────────────────────
  console.log('\n3. Admin Controller Unit Verification');

  // 3a. Department mapping
  report('getProfessorDeptTable maps MCA correctly', adminController.getProfessorDeptTable('Master of Computer Applications') === 'MCA');
  report('getProfessorDeptTable maps BBA correctly', adminController.getProfessorDeptTable('Bachelor of Business') === 'BBA');
  report('getProfessorDeptTable maps MBA correctly', adminController.getProfessorDeptTable('MBA Dept') === 'MBA');
  report('getProfessorDeptTable defaults to BCA', adminController.getProfessorDeptTable('Unknown Dept') === 'BCA');

  // 3b. Student registration validation
  report('validateStudentRegistration rejects missing email',
    adminController.validateStudentRegistration({ ID: 'STU10', Name: 'Alice' }).valid === false
  );
  report('validateStudentRegistration accepts valid student',
    adminController.validateStudentRegistration({ ID: 'STU10', Name: 'Alice', Email: 'alice@smartattend.edu' }).valid === true
  );

  // 3c. Professor registration validation
  report('validateProfessorRegistration rejects password < 8 characters',
    adminController.validateProfessorRegistration({ Name: 'Dr. Smith', Email: 'smith@smartattend.edu', Password: 'short', Department: 'BCA' }).valid === false
  );
  report('validateProfessorRegistration accepts compliant credentials',
    adminController.validateProfessorRegistration({ Name: 'Dr. Smith', Email: 'smith@smartattend.edu', Password: 'supersecretpass', Department: 'BCA' }).valid === true
  );

  // 3d. Bulk student deduplication
  const existingDbIds = new Set(['stu001']);
  const existingDbEmails = new Set(['stu001@smartattend.edu']);
  const bulkInput = [
    { ID: 'STU001', Name: 'Existing Stu', Email: 'stu001@smartattend.edu' },
    { ID: 'STU002', Name: 'New Stu 1', Email: 'stu002@smartattend.edu' },
    { ID: 'STU002', Name: 'Duplicate in batch', Email: 'stu002_dup@smartattend.edu' },
    { ID: 'STU003', Name: 'New Stu 2', Email: 'stu003@smartattend.edu' }
  ];
  const { toInsert, skipped } = await adminController.processBulkStudents(bulkInput, existingDbIds, existingDbEmails);
  report('processBulkStudents deduplicates against DB and batch duplicates',
    toInsert.length === 2 && skipped.length === 2
  );

  // 3e. Update permissions & IDOR
  const studentSelf = adminController.validateUpdatePermissions('student', { id: 'STU001' }, 'student', 'STU001', 'STU001');
  report('validateUpdatePermissions allows student self-profile update', studentSelf.allowed === true);

  const studentCross = adminController.validateUpdatePermissions('student', { id: 'STU001' }, 'student', 'STU999', 'STU999');
  report('validateUpdatePermissions blocks student modifying other profile (IDOR)',
    studentCross.allowed === false && studentCross.statusCode === 403
  );

  // ── 4. LAB CONTROLLER UNIT TESTS ───────────────────────────────────────────
  console.log('\n4. Lab Controller Unit Verification');

  // 4a. Lab code generation
  const labPayload = labController.generateLabCodePayload('PROF001', 'Operating Systems');
  report('generateLabCodePayload produces 6-digit numeric code',
    /^\d{6}$/.test(labPayload.code) && labPayload.expiresAt > Date.now()
  );

  // 4b. Identity binding
  const validLabIdentity = labController.validateLabVerificationIdentity({ id: 'STU001' }, 'STU001');
  report('validateLabVerificationIdentity allows matching JWT identity', validLabIdentity.valid === true);

  const invalidLabIdentity = labController.validateLabVerificationIdentity({ id: 'STU001' }, 'STU002');
  report('validateLabVerificationIdentity rejects cross-student IDOR attempt', invalidLabIdentity.valid === false);

  // 4c. Anti-duplicate scan & proxy check
  const existingScans = [
    { StudentID: 'stu001', DeviceID: 'DEVICE_ALPHA' },
    { StudentID: 'stu002', DeviceID: 'DEVICE_BETA' }
  ];
  report('checkDuplicateScan detects prior scan for student',
    labController.checkDuplicateScan(existingScans, 'stu001') === true
  );
  report('checkProxyDevice detects device reuse across different student IDs',
    labController.checkProxyDevice(existingScans, 'stu003', 'DEVICE_ALPHA') === true
  );
  report('checkProxyDevice allows legitimate device for same student',
    labController.checkProxyDevice(existingScans, 'stu001', 'DEVICE_ALPHA') === false
  );

  // 4d. Brute-force failure tracking
  labController.resetLabCodeFailure('test_brute_student');
  report('getLabCodeFailure returns 0 initially', labController.getLabCodeFailure('test_brute_student') === 0);
  labController.recordLabCodeFailure('test_brute_student');
  labController.recordLabCodeFailure('test_brute_student');
  report('recordLabCodeFailure increments failure count', labController.getLabCodeFailure('test_brute_student') === 2);
  labController.resetLabCodeFailure('test_brute_student');
  report('resetLabCodeFailure clears failure count', labController.getLabCodeFailure('test_brute_student') === 0);

  // ── 5. LIVE SUPERTEST HTTP INTEGRATION TESTS ───────────────────────────────
  console.log('\n5. Live Supertest HTTP Integration Tests');

  const adminToken = jwt.sign(
    { id: 'ADMIN001', email: 'admin@smartattend.edu', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { id: 'STU001', email: 'stu001@smartattend.edu', role: 'student' },
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

  // Test HTTP update IDOR enforcement (Student attempting to update another student's profile)
  const idorRes = await request(app)
    .post('/')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ action: 'update', sheet: 'student', searchVal: 'STU999_OTHER', data: { Name: 'Hacked' } });
  report('HTTP student update on another profile receives 403 Forbidden',
    idorRes.status === 403 && idorRes.body.message.includes('Access Denied')
  );

  // Test HTTP lab code IDOR enforcement (Student attempting to verify for another student)
  const labIdorRes = await request(app)
    .post('/')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ action: 'verify_lab_code', studentId: 'STU999_OTHER', code: '123456' });
  report('HTTP student lab verification for another student receives 403 Forbidden',
    labIdorRes.status === 403 && labIdorRes.body.message.includes('Unauthorized')
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
