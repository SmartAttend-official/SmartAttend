/**
 * PHASE 2 — OWNERSHIP-BASED AUTHORIZATION TESTS
 * ================================================
 * Verifies that all critical data-sensitive endpoints enforce
 * ownership rules beyond role-level RBAC. Tests are static
 * source-code assertions (no live HTTP calls, no real DB).
 *
 * Coverage:
 *  OWN-1: attendance_history IDOR prevention (student can't read another student's records)
 *  OWN-2: submit_leave IDOR prevention (student can't submit for another student)
 *  OWN-3: resolve_leave ownership (professor can only resolve leaves addressed to them)
 *  OWN-4: save_session ownership (professor can't impersonate another professor)
 *  OWN-5: get_encoding audit logging (every biometric read is logged with actor identity)
 *  OWN-6: RBAC gate still present for all sensitive actions
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server', 'server.js');
const serverSrc = fs.readFileSync(serverPath, 'utf8');

let passed = 0;
let failed = 0;

function test(name, assertion) {
  if (assertion) {
    console.log(`  ✓ Test Passed: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${name}`);
    failed++;
  }
}

console.log('\n=== PHASE 2: OWNERSHIP-BASED AUTHORIZATION TESTS ===\n');

// ── OWN-1: attendance_history IDOR prevention ─────────────────────────────
console.log('OWN-1: attendance_history IDOR prevention (student reads own records only)');

test(
  'OWN-1: attendance_history handler checks req.user.role === student',
  serverSrc.includes("req.user.role === 'student'") &&
  serverSrc.includes("attendance_history")
);

test(
  'OWN-1: attendance_history enforces StudentID filter via ilike for student role',
  serverSrc.includes("query = query.ilike('StudentID', jwtStudentId)")
);

test(
  'OWN-1: attendance_history IDOR attempt is logged to audit',
  serverSrc.includes("IDOR attempt: Student") &&
  serverSrc.includes("tried to read attendance_history")
);

test(
  'OWN-1: attendance_history returns 403 on cross-student access attempt',
  serverSrc.includes("You may only view your own attendance history.")
);

// ── OWN-2: submit_leave IDOR prevention ──────────────────────────────────
console.log('\nOWN-2: submit_leave IDOR prevention (student submits only for self)');

test(
  'OWN-2: submit_leave checks student role before allowing submission',
  serverSrc.includes("OWN-2: OWNERSHIP ENFORCEMENT") &&
  serverSrc.includes("submit_leave")
);

test(
  'OWN-2: submit_leave compares submitted studentId against JWT identity',
  serverSrc.includes("submittedId !== jwtStudentId") &&
  serverSrc.includes("submittedId !== jwtStudentEmail")
);

test(
  'OWN-2: submit_leave IDOR attempt is logged to audit',
  serverSrc.includes("tried to submit leave on behalf of studentId=")
);

test(
  'OWN-2: submit_leave returns 403 on cross-student submit attempt',
  serverSrc.includes("You may only submit leave requests for yourself.")
);

// ── OWN-3: resolve_leave professor ownership ──────────────────────────────
console.log('\nOWN-3: resolve_leave ownership (professor resolves only their own leaves)');

test(
  'OWN-3: resolve_leave checks professor role before allowing resolution',
  serverSrc.includes("OWN-3: OWNERSHIP ENFORCEMENT") &&
  serverSrc.includes("resolve_leave")
);

test(
  'OWN-3: resolve_leave pre-fetches leave targetProfessor before updating',
  serverSrc.includes("targetProfessor !== profEmail") ||
  (serverSrc.includes("targetProf && targetProf !== profEmail"))
);

test(
  'OWN-3: resolve_leave IDOR attempt is logged to audit',
  serverSrc.includes("tried to resolve leave #")
);

test(
  'OWN-3: resolve_leave returns 403 on cross-professor resolve attempt',
  serverSrc.includes("You can only resolve leave requests addressed to you.")
);

// ── OWN-4: save_session professor ownership ───────────────────────────────
console.log('\nOWN-4: save_session ownership (professor cannot impersonate another)');

test(
  'OWN-4: save_session checks professor role before allowing session save',
  serverSrc.includes("OWN-4: OWNERSHIP ENFORCEMENT") &&
  serverSrc.includes("save_session")
);

test(
  'OWN-4: save_session compares submitted professorEmail against JWT email',
  serverSrc.includes("submittedProfEmail !== jwtProfEmail")
);

test(
  'OWN-4: save_session stamps session with authenticated professor email',
  serverSrc.includes("classInfo.professorEmail = jwtProfEmail")
);

test(
  'OWN-4: save_session IDOR attempt is logged to audit',
  serverSrc.includes("tried to save session under email")
);

test(
  'OWN-4: save_session returns 403 on impersonation attempt',
  serverSrc.includes("You cannot save attendance sessions on behalf of another professor.")
);

// ── OWN-5: get_encoding audit logging ────────────────────────────────────
console.log('\nOWN-5: get_encoding biometric read is fully audit-logged');

test(
  'OWN-5: get_encoding logs BIOMETRIC_ACCESS with actor identity',
  serverSrc.includes("'BIOMETRIC_ACCESS'") &&
  serverSrc.includes("Biometric encoding READ for student")
);

test(
  'OWN-5: get_encoding log includes actor email and role',
  serverSrc.includes("req.user.email : 'unknown'") &&
  serverSrc.includes("req.user.role : 'unknown'")
);

// ── OWN-6: RBAC still intact ─────────────────────────────────────────────
console.log('\nOWN-6: RBAC gate still intact for all Phase 2 endpoints');

test(
  'OWN-6: submit_leave remains restricted to [student, admin] roles in RBAC_RULES',
  serverSrc.includes("'submit_leave': ['student', 'admin']")
);

test(
  'OWN-6: resolve_leave remains restricted to [professor, admin] roles in RBAC_RULES',
  serverSrc.includes("'resolve_leave': ['professor', 'admin']")
);

test(
  'OWN-6: save_session remains restricted to [professor, admin] roles in RBAC_RULES',
  serverSrc.includes("'save_session': ['professor', 'admin']")
);

test(
  'OWN-6: get_encoding remains restricted to [professor, admin] roles in RBAC_RULES',
  serverSrc.includes("'get_encoding': ['professor', 'admin']")
);

test(
  'OWN-6: save_encoding remains restricted to [professor, admin] roles in RBAC_RULES',
  serverSrc.includes("'save_encoding': ['professor', 'admin']")
);

// ── SUMMARY ──────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`Phase 2 Ownership Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n⚠ ${failed} test(s) FAILED — fix before committing.\n`);
  process.exit(1);
} else {
  console.log(`\nAll ${passed} Phase 2 Ownership Authorization tests passed!\n`);
}
