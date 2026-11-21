/**
 * PHASE 3 — HTTP API INTEGRATION TEST SUITE
 * ============================================================================
 * Live in-memory Express integration tests using supertest.
 * Verifies HTTP response codes, headers, JSON body contracts, authentication,
 * RBAC authorization, IDOR ownership enforcement, and error resilience.
 *
 * NOTE: Tests do NOT send real emails or perform destructive database operations.
 */

const path = require('path');
const assert = require('assert');

// Load environment from server directory
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
require('../server/node_modules/dotenv').config();

const request = require('../server/node_modules/supertest');
const jwt = require('../server/node_modules/jsonwebtoken');

const { app } = require('../server/server.js');
const JWT_SECRET = process.env.JWT_SECRET;

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

async function runApiIntegrationTests() {
  console.log('\n=== PHASE 3: HTTP API INTEGRATION TESTS ===\n');

  // Generate verified test JWT tokens
  const studentToken = jwt.sign(
    { id: 'STU_TEST_001', email: 'student_test@smartattend.edu', role: 'student', institution_id: 'INST_MAIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const professorToken = jwt.sign(
    { id: 'PROF_TEST_001', email: 'prof_test@smartattend.edu', role: 'professor', institution_id: 'INST_MAIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { id: 'ADMIN_TEST_001', email: 'admin_test@smartattend.edu', role: 'admin', institution_id: 'INST_MAIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ── 1. HEALTH CHECK & SECURITY HEADERS ──────────────────────────────────────
  console.log('1. Health Check & OWASP Security Headers');
  try {
    const res = await request(app).get('/');
    report('GET / returns HTTP 200 OK', res.status === 200);
    report('GET / returns status "ok"', res.body && res.body.status === 'ok');
    report('Helmet X-Content-Type-Options: nosniff present', res.headers['x-content-type-options'] === 'nosniff');
    report('Helmet X-Frame-Options present', !!res.headers['x-frame-options']);
  } catch (err) {
    report('GET / health check execution', false);
  }

  // ── 2. INPUT VALIDATION & RESET PASSWORD API ───────────────────────────────
  console.log('\n2. Password Reset API (CWE-598 & Input Validation)');
  try {
    // Missing required fields
    const resEmpty = await request(app)
      .post('/api/reset-password')
      .send({});
    report('POST /api/reset-password rejects empty payload with 400', resEmpty.status === 400);
    report('POST /api/reset-password returns descriptive error', resEmpty.body && resEmpty.body.status === 'error');

    // Missing password
    const resPartial = await request(app)
      .post('/api/reset-password')
      .send({ email: 'user@test.edu', otp: '123456', role: 'student' });
    report('POST /api/reset-password rejects missing newPassword with 400', resPartial.status === 400);

    // Invalid OTP format
    const resInvalidOtp = await request(app)
      .post('/api/reset-password')
      .send({ email: 'user@test.edu', otp: '12', newPassword: 'ValidPassword123!', role: 'student' });
    report('POST /api/reset-password rejects malformed OTP with 400', resInvalidOtp.status === 400);
  } catch (err) {
    report('Password Reset API tests execution', false);
  }

  // ── 3. AUTHENTICATION & LOGIN DISPATCHER ───────────────────────────────────
  console.log('\n3. Authentication & Login Endpoint');
  try {
    // Missing credentials
    const resMissing = await request(app)
      .post('/')
      .send({ action: 'login' });
    report('POST login with missing fields returns 400', resMissing.status === 400);

    // Non-existent user login attempt
    const resInvalid = await request(app)
      .post('/')
      .send({ action: 'login', email: 'nonexistent_test_user@invalid.edu', password: 'WrongPassword123!', role: 'student' });
    report('POST login with invalid credentials returns 401', resInvalid.status === 401);
  } catch (err) {
    report('Login endpoint test execution', false);
  }

  // ── 4. JWT AUTHENTICATION GATE ─────────────────────────────────────────────
  console.log('\n4. JWT Authentication Gate');
  try {
    // Protected action with no token
    const resNoAuth = await request(app)
      .post('/')
      .send({ action: 'save_session', classInfo: {}, students: [] });
    report('Unauthenticated request to protected action returns 401', resNoAuth.status === 401);

    // Protected action with invalid token
    const resBadToken = await request(app)
      .post('/')
      .set('Authorization', 'Bearer invalid.token.value')
      .send({ action: 'save_session', classInfo: {}, students: [] });
    report('Invalid JWT token returns 403 Forbidden', resBadToken.status === 403);
  } catch (err) {
    report('JWT gate test execution', false);
  }

  // ── 5. ROLE-BASED ACCESS CONTROL (RBAC) ───────────────────────────────────
  console.log('\n5. Role-Based Access Control (RBAC)');
  try {
    // Student attempting faculty action: save_session
    const resStuProfAction = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ action: 'save_session', classInfo: {}, students: [] });
    report('Student blocked from save_session with 403', resStuProfAction.status === 403);

    // Student attempting faculty action: upload_assignment
    const resStuUploadAction = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ action: 'upload_assignment' });
    report('Student blocked from upload_assignment with 403', resStuUploadAction.status === 403);

    // Student attempting admin action: add_professor
    const resStuAdminAction = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ action: 'add_professor' });
    report('Student blocked from add_professor with 403', resStuAdminAction.status === 403);

    // Professor attempting admin action: add_dept
    const resProfAdminAction = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ action: 'add_dept' });
    report('Professor blocked from add_dept with 403', resProfAdminAction.status === 403);

    // Professor attempting admin action: upload_timetable
    const resProfTimetableAction = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ action: 'upload_timetable' });
    report('Professor blocked from upload_timetable with 403', resProfTimetableAction.status === 403);
  } catch (err) {
    report('RBAC tests execution', false);
  }

  // ── 6. DATA OWNERSHIP & IDOR ENFORCEMENT ──────────────────────────────────
  console.log('\n6. Ownership & IDOR Protection');
  try {
    // Student attempting to submit leave for another student ID
    const resIdorLeave = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        action: 'submit_leave',
        studentId: 'STU_OTHER_999',
        reason: 'Attempted IDOR leave submission'
      });
    report('Student submitting leave for another student ID returns 403', resIdorLeave.status === 403);
    report('IDOR leave response gives clear access denied message', resIdorLeave.body && resIdorLeave.body.message.includes('only submit leave requests for yourself'));

    // Student attempting to read attendance history of another student ID
    const resIdorHist = await request(app)
      .get('/?sheet=attendance_history&studentId=STU_OTHER_999')
      .set('Authorization', `Bearer ${studentToken}`);
    report('Student reading another student\'s attendance history returns 403', resIdorHist.status === 403);

    // Professor attempting to save session under another professor's email
    const resIdorSession = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({
        action: 'save_session',
        classInfo: {
          professorEmail: 'impersonated_prof@smartattend.edu',
          subject: 'Operating Systems',
          dept: 'BCA',
          sem: 'Sem 3',
          date: '2026-11-21'
        },
        students: []
      });
    report('Professor impersonating another professor in save_session returns 403', resIdorSession.status === 403);
  } catch (err) {
    report('IDOR protection tests execution', false);
  }

  // ── 7. BIOMETRIC ACCESS CONTROL ───────────────────────────────────────────
  console.log('\n7. Biometric Data Protection Gate');
  try {
    // get_encoding requires authentication
    const resGetEncUnauth = await request(app)
      .post('/')
      .send({ action: 'get_encoding', studentId: 'STU001' });
    report('Unauthenticated get_encoding returns 401', resGetEncUnauth.status === 401);

    // save_encoding requires authentication
    const resSaveEncUnauth = await request(app)
      .post('/')
      .send({ action: 'save_encoding', studentId: 'STU001', encoding: [] });
    report('Unauthenticated save_encoding returns 401', resSaveEncUnauth.status === 401);

    // Student blocked from get_encoding
    const resStuGetEnc = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ action: 'get_encoding', studentId: 'STU001' });
    report('Student blocked from get_encoding with 403', resStuGetEnc.status === 403);
  } catch (err) {
    report('Biometric gate tests execution', false);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 3 API Integration Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n⚠ ${failed} test(s) FAILED — fix before continuing.\n`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} Phase 3 API Integration tests passed successfully!\n`);
    process.exit(0);
  }
}

runApiIntegrationTests().catch(err => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
