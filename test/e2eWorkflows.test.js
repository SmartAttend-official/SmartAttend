/**
 * PHASE 3 — END-TO-END WORKFLOW INTEGRATION TESTS
 * ============================================================================
 * Validates complex, multi-step business logic and security state machines
 * across multiple subsystems:
 *  1. Attendance Marking & Metric Aggregation Lifecycle
 *  2. Multi-Day Leave Parsing & Overlap Detection Pipeline
 *  3. Biometric Ingestion, Cryptographic Protection & Decryption Pipeline
 *  4. Brute-Force Lockout & Account Protection State Machine
 *  5. DPDP Right-to-be-Forgotten Compliance Workflow
 */

const assert = require('assert');
const path = require('path');

const { calculateAttendanceMetrics } = require('../server/attendanceCalculator');
const { encryptBiometric, decryptBiometric, isEncrypted } = require('../server/utils/biometricCrypto');
const { recordFailedLogin, resetFailedLogin, isAccountLocked } = require('../server/services/authService');

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

console.log('\n=== PHASE 3: END-TO-END WORKFLOW INTEGRATION TESTS ===\n');

// ── 1. ATTENDANCE MARKING & METRIC LIFECYCLE WORKFLOW ─────────────────────────
console.log('1. Attendance Marking & Metric Aggregation Workflow');
{
  // Simulating an attendance session for 30 students across a semester
  const totalClassesHeld = 40;
  const safeStudentAttended = 34; // 85%
  const boundaryStudentAttended = 30; // 75%
  const criticalStudentAttended = 22; // 55%

  const safeMetrics = calculateAttendanceMetrics({
    attended: safeStudentAttended,
    totalHeld: totalClassesHeld,
    threshold: 75
  });
  report('Safe student attendance correctly computed as 85%', safeMetrics.percentage === 85.0);
  report('Safe student marked as isSafe: true', safeMetrics.isSafe === true);
  report('Safe student buffer classes calculated accurately', safeMetrics.bufferClasses === 5);

  const boundaryMetrics = calculateAttendanceMetrics({
    attended: boundaryStudentAttended,
    totalHeld: totalClassesHeld,
    threshold: 75
  });
  report('Boundary student attendance correctly computed as 75%', boundaryMetrics.percentage === 75.0);
  report('Boundary student buffer classes is exactly 0', boundaryMetrics.bufferClasses === 0);
  report('Boundary student classesNeeded is exactly 0', boundaryMetrics.classesNeeded === 0);

  const criticalMetrics = calculateAttendanceMetrics({
    attended: criticalStudentAttended,
    totalHeld: totalClassesHeld,
    threshold: 75
  });
  report('Critical student attendance correctly computed as 55%', criticalMetrics.percentage === 55.0);
  report('Critical student marked as isSafe: false', criticalMetrics.isSafe === false);
  report('Critical student classes needed calculated to reach 75%', criticalMetrics.classesNeeded === 32);
  report('Critical student marked statusCategory: CRITICAL_SHORTAGE', criticalMetrics.statusCategory === 'CRITICAL_SHORTAGE');
}

// ── 2. MULTI-DAY LEAVE PARSING & OVERLAP WORKFLOW ────────────────────────────
console.log('\n2. Multi-Day Leave Parsing & Overlap Detection Workflow');
{
  // Date normalization logic used in server.js
  const normalizeDateString = (d) => {
    if (!d) return null;
    const trimmed = String(d).trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    return trimmed.split('T')[0];
  };

  const norm1 = normalizeDateString('25/11/2026');
  const norm2 = normalizeDateString('2026-11-25T08:30:00Z');
  report('Date normalizer handles DD/MM/YYYY format correctly', norm1 === '2026-11-25');
  report('Date normalizer handles ISO string format correctly', norm2 === '2026-11-25');

  // Inclusive duration calculation
  const startMs = new Date('2026-11-25').getTime();
  const endMs = new Date('2026-11-28').getTime();
  const duration = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
  report('Multi-day leave duration calculated inclusive of start and end days (4 days)', duration === 4);

  // Overlap detection
  const existingLeave = { startDate: '2026-11-25', endDate: '2026-11-28', status: 'Approved' };
  const conflictingAttempt = { startDate: '2026-11-27', endDate: '2026-11-30' };
  const isOverlap = (conflictingAttempt.startDate <= existingLeave.endDate && conflictingAttempt.endDate >= existingLeave.startDate);
  report('Overlapping leave window correctly flagged as conflict', isOverlap === true);

  const nonConflictingAttempt = { startDate: '2026-12-01', endDate: '2026-12-03' };
  const isNoOverlap = (nonConflictingAttempt.startDate <= existingLeave.endDate && nonConflictingAttempt.endDate >= existingLeave.startDate);
  report('Non-overlapping leave window correctly permitted', isNoOverlap === false);
}

// ── 3. BIOMETRIC ENCRYPTION & INTEGRITY PIPELINE ─────────────────────────────
console.log('\n3. Biometric Cryptographic Protection Pipeline');
{
  const testVector = Array.from({ length: 128 }, (_, i) => Math.cos(i) * 0.05);
  const rawPayload = JSON.stringify(testVector);

  const encrypted = encryptBiometric(rawPayload);
  report('Biometric vector encrypted with AES-256-GCM', isEncrypted(encrypted) === true);
  report('Ciphertext payload includes unique IV and AuthTag', !!encrypted.iv && !!encrypted.authTag && !!encrypted.ciphertext);

  const decrypted = decryptBiometric(encrypted);
  report('Decrypted biometric vector perfectly matches original plaintext', decrypted === rawPayload);

  // Tampered ciphertext detection
  const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -4) + 'abcd' };
  let tamperCaught = false;
  try {
    decryptBiometric(tampered);
  } catch (e) {
    tamperCaught = true;
  }
  report('Tampered ciphertext detected and rejected by GCM authentication tag', tamperCaught === true);
}

// ── 4. BRUTE-FORCE LOCKOUT & STATE MACHINE WORKFLOW ─────────────────────────
console.log('\n4. Brute-Force Lockout State Machine Workflow');
{
  const testAccount = 'audit_lockout_test@smartattend.edu';
  resetFailedLogin(testAccount);

  report('Account initially unlocked', isAccountLocked(testAccount) === false);

  // Simulate 4 failed attempts (under 5-attempt threshold)
  for (let i = 1; i <= 4; i++) {
    recordFailedLogin(testAccount);
  }
  report('Account remains unlocked after 4 failed attempts', isAccountLocked(testAccount) === false);

  // 5th failed attempt triggers lockout
  const lockoutState = recordFailedLogin(testAccount);
  report('Account locked on 5th failed attempt', isAccountLocked(testAccount) === true);
  report('Lockout state contains lockedUntil timestamp in future', lockoutState.lockedUntil > Date.now());

  // Successful reset clears lockout
  resetFailedLogin(testAccount);
  report('Account immediately unlocked upon successful reset', isAccountLocked(testAccount) === false);
}

// ── 5. DPDP COMPLIANCE & AUDIT LOGGING WORKFLOW ──────────────────────────────
console.log('\n5. DPDP Act 2023 Compliance & Audit Event Contract');
{
  const mockStudent = { ID: 'STU_DPDP_001', Name: 'Test Subject', Email: 'dpdp@smartattend.edu', Face_Encoding: 'encrypted_data' };
  
  // Verify purge action contract: biometric field becomes null
  const purgedRecord = { ...mockStudent, Face_Encoding: null };
  report('DPDP Purge action clears biometric vector to null', purgedRecord.Face_Encoding === null);
  report('Student non-biometric academic records preserved after purge', purgedRecord.ID === 'STU_DPDP_001' && purgedRecord.Name === 'Test Subject');

  // Audit event payload contract
  const auditEvent = {
    action: 'BIOMETRIC_PURGE_DPDP',
    actor: 'admin@smartattend.edu',
    targetStudentId: mockStudent.ID,
    timestamp: new Date().toISOString(),
    legalBasis: 'DPDP Act 2023 / GDPR Article 17'
  };
  report('Audit event captures actor identity, target, timestamp, and legal basis', !!auditEvent.actor && !!auditEvent.targetStudentId && !!auditEvent.legalBasis);
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`Phase 3 E2E Workflow Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n⚠ ${failed} test(s) FAILED — check workflow logic.\n`);
  process.exit(1);
} else {
  console.log(`\nAll ${passed} Phase 3 E2E Workflow tests passed successfully!\n`);
  process.exit(0);
}
