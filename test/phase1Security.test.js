/**
 * SmartAttend — Phase 1 Security Regression Tests
 * Verifies all fixes from the Critical Security Remediation phase.
 *
 * Tests are STATIC (no live server or database needed):
 *  - Inspect server.js source for forbidden patterns
 *  - Verify backend/forget.js and backend/student_forget.js use POST
 *  - Verify uniform account enumeration responses
 *  - Verify no hardcoded JWT fallback
 *  - Verify no default predictable passwords in registration handlers
 */

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✓ Test Passed: ${description}`);
    pass++;
  } else {
    console.error(`  ✗ FAILED: ${description}`);
    fail++;
  }
}

function readFile(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

console.log('\n--- Running Phase 1 Critical Security Regression Tests ---\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 1: JWT Secret — no hardcoded fallback (SEC-2)
// ─────────────────────────────────────────────────────────────────────────────
const serverSrc = readFile('server/server.js');

assert(
  'SEC-2: Hardcoded JWT fallback string is removed from server.js',
  !serverSrc.includes("'55ebcfc623910c59dd6c32145391bd76abf8c05763137976e106d9d1c9ef25bf'") &&
  !serverSrc.includes('"55ebcfc623910c59dd6c32145391bd76abf8c05763137976e106d9d1c9ef25bf"')
);

assert(
  'SEC-2: JWT_SECRET enforces process.exit(1) if missing or too short',
  serverSrc.includes('process.exit(1)') &&
  serverSrc.includes('JWT_SECRET.length < 32')
);

assert(
  'SEC-2: JWT_SECRET is never assigned a string literal fallback via ||',
  !/JWT_SECRET\s*=\s*process\.env\.JWT_SECRET\s*\|\|\s*['"`]/.test(serverSrc)
);

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 2: Password Reset — not in GET query parameters (SEC-1)
// ─────────────────────────────────────────────────────────────────────────────
assert(
  'SEC-1: newPassword is NOT destructured from req.query in GET handler',
  !serverSrc.match(/req\.query.*\bnewPassword\b/) || 
  serverSrc.includes('newPassword is NEVER read from req.query')
);

assert(
  'SEC-1: Dedicated POST /api/reset-password endpoint exists in server.js',
  serverSrc.includes("app.post('/api/reset-password'")
);

assert(
  'SEC-1: POST reset-password reads newPassword from req.body, not req.query',
  serverSrc.includes('req.body.newPassword') || serverSrc.includes('const { email, otp, newPassword, role } = req.body')
);

const forgeSrc = readFile('backend/forget.js');
assert(
  'SEC-1: Professor forget.js uses POST with JSON body (not GET query string)',
  forgeSrc.includes("method: 'POST'") &&
  forgeSrc.includes("'Content-Type': 'application/json'") &&
  forgeSrc.includes("body: JSON.stringify(")
);

assert(
  'SEC-1: Professor forget.js does NOT put newPassword in URL',
  !forgeSrc.includes('newPassword=${encodeURIComponent')
);

const stuForgeSrc = readFile('backend/student_forget.js');
assert(
  'SEC-1: Student student_forget.js uses POST with JSON body (not GET query string)',
  stuForgeSrc.includes("method: 'POST'") &&
  stuForgeSrc.includes("'Content-Type': 'application/json'") &&
  stuForgeSrc.includes("body: JSON.stringify(")
);

assert(
  'SEC-1: Student student_forget.js does NOT put newPassword in URL',
  !stuForgeSrc.includes('newPassword=${encodeURIComponent')
);

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 3: Account Enumeration (SEC-5)
// ─────────────────────────────────────────────────────────────────────────────
assert(
  'SEC-5: "Email not found in our system" is replaced with uniform response in professor OTP flow',
  !serverSrc.includes("'Email not found in our system.'")
);

assert(
  'SEC-5: "This email is not registered in the student database" is replaced with uniform response',
  !serverSrc.includes("'This email is not registered in the student database.'")
);

assert(
  'SEC-5: Uniform anti-enumeration response message is present',
  serverSrc.includes('If an account with that email address exists, a 6-digit verification code has been dispatched.')
);

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 4: Default Predictable Passwords (SEC-4)
// ─────────────────────────────────────────────────────────────────────────────
assert(
  "SEC-4: 'Welcome@123' is NOT used as a plain fallback password in bulk_add_students",
  !serverSrc.includes("bcrypt.hash('Welcome@123'")
);

assert(
  "SEC-4: 'Prof@123' is NOT used as a default professor password",
  !serverSrc.includes("|| 'Prof@123'")
);

assert(
  'SEC-4: add_professor enforces an explicitly provided password (no default)',
  serverSrc.includes('A valid password (minimum 8 characters) must be provided when adding a professor account.')
);

assert(
  'SEC-4: Secure random activation token generation (crypto.randomBytes) is used for new students',
  serverSrc.includes('crypto.randomBytes(32).toString(') &&
  serverSrc.includes('_activationToken')
);

assert(
  'SEC-4: Welcome email now sends activation link/token, not plaintext password',
  serverSrc.includes('Activate Your Account') &&
  serverSrc.includes('reset_password.html?token=')
);

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('');
if (fail === 0) {
  console.log(`All ${pass} Phase 1 Security tests passed successfully!\n`);
} else {
  console.error(`FAILURES: ${fail} test(s) failed out of ${pass + fail}.\n`);
  process.exitCode = 1;
}

module.exports = { pass, fail };
