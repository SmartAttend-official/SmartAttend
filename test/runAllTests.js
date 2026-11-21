/**
 * SmartAttend - Central Automated Test Runner
 * Executes all component and subsystem test suites with consolidated reporting.
 */

const { execSync } = require('child_process');
const path = require('path');

const TEST_SUITES = [
  { name: 'Attendance Calculation Engine', file: 'attendanceCalculator.test.js' },
  { name: 'Biometric Liveness (PAD Engine)', file: 'livenessDetector.test.js' },
  { name: 'Biometric Cryptography (AES-256-GCM)', file: 'biometricCrypto.test.js' },
  { name: 'Application Tenant Isolation', file: 'tenantIsolation.test.js' },
  { name: 'Input Validation & Anti-XSS', file: 'validators.test.js' },
  { name: 'Authentication & Anti-Brute Force', file: 'authService.test.js' },
  { name: 'Email Notification Engine', file: 'emailService.test.js' },
  { name: 'Phase 1 Security Regression (CWE-598, CWE-798, CWE-204, SEC-4)', file: 'phase1Security.test.js' },
  { name: 'Phase 2 Ownership-Based Authorization (OWN-1 through OWN-6)', file: 'phase2Ownership.test.js' }
];

console.log('================================================================');
console.log('SMARTATTEND — AUTOMATED TEST SUITE RUNNER');
console.log('Execution Time: ' + new Date().toISOString());
console.log('================================================================\n');

let passedSuites = 0;
let failedSuites = 0;

for (const suite of TEST_SUITES) {
  const filePath = path.join(__dirname, suite.file);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8' });
    process.stdout.write(output);
    passedSuites++;
  } catch (err) {
    console.error(`\n❌ FAILED: ${suite.name} (${suite.file})`);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    failedSuites++;
  }
}

console.log('================================================================');
console.log('TEST EXECUTION SUMMARY');
console.log(`Total Suites Run : ${TEST_SUITES.length}`);
console.log(`Suites Passed    : ${passedSuites}`);
console.log(`Suites Failed    : ${failedSuites}`);
console.log('Status           : ' + (failedSuites === 0 ? '✅ ALL SUITES PASSED (100% SUCCESS)' : '❌ FAILURES DETECTED'));
console.log('================================================================\n');

if (failedSuites > 0) {
  process.exit(1);
}
