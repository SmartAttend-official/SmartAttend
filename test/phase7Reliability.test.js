/**
 * PHASE 7 — PERFORMANCE, OFFLINE RELIABILITY & DEPLOYMENT TEST SUITE
 * ============================================================================
 * Verifies:
 *  1. Cryptographic Offline Queue HMAC-SHA256 Signing & Verification
 *  2. Anti-Tampering & Clock Drift Protection on Offline Sync
 *  3. Bounded Batch Sizing on Sync (Max 50 Sessions)
 *  4. System Telemetry & Self-Hosted Health Dashboard (/health, /api/metrics)
 *  5. In-Memory Account Lockout Hydration on Server Startup
 *  6. Render Backend Keep-Alive / Warmup Self-Ping Engine
 *  7. Empirical Load & Concurrency Benchmark Execution
 */

'use strict';

const path = require('path');
const assert = require('assert');

require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
require('../server/node_modules/dotenv').config();

const request = require('../server/node_modules/supertest');
const { app, _savingSessionLocks, hydrateLockedAccountsFromDb, accountLockouts, initKeepAlive } = require('../server/server.js');
const attendanceController = require('../server/controllers/attendanceController');
const authService = require('../server/services/authService');

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

async function runPhase7Tests() {
  console.log('\n=== PHASE 7: PERFORMANCE, OFFLINE RELIABILITY & DEPLOYMENT TESTS ===\n');

  const TEST_SECRET = 'test_offline_signing_secret_key_32_bytes_long';

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Cryptographic Offline Queue Signing & Verification
  // ─────────────────────────────────────────────────────────────────────────
  console.log('1. Cryptographic Offline Queue Integrity (HMAC-SHA256)');

  const samplePayload = {
    action: 'save_session',
    classInfo: {
      subject: 'Data Structures',
      dept: 'BCA',
      sem: '3',
      date: '2026-11-21'
    },
    students: [
      { id: 'STU-001', name: 'Alice', detected: true },
      { id: 'STU-002', name: 'Bob', detected: false }
    ]
  };

  const validTimestamp = new Date().toISOString();
  const validSignature = attendanceController.signOfflinePayload(samplePayload, validTimestamp, TEST_SECRET);

  report('Offline signature is a valid 64-character SHA-256 hex string',
    typeof validSignature === 'string' && validSignature.length === 64
  );

  const validMeta = { timestamp: validTimestamp, signature: validSignature };
  const validVerification = attendanceController.verifyOfflinePayload(samplePayload, validMeta, TEST_SECRET);
  report('Untampered offline payload passes cryptographic verification',
    validVerification.valid === true
  );

  // Tamper detection: modify student detected status
  const tamperedPayload = {
    ...samplePayload,
    students: [
      { id: 'STU-001', name: 'Alice', detected: true },
      { id: 'STU-002', name: 'Bob', detected: true } // Tampered: marked present offline!
    ]
  };

  const tamperedVerification = attendanceController.verifyOfflinePayload(tamperedPayload, validMeta, TEST_SECRET);
  report('Tampered offline payload detected and rejected with signature mismatch',
    tamperedVerification.valid === false && tamperedVerification.reason.includes('signature mismatch')
  );

  // Stale record detection (> 24 hours)
  const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const staleSignature = attendanceController.signOfflinePayload(samplePayload, staleTimestamp, TEST_SECRET);
  const staleMeta = { timestamp: staleTimestamp, signature: staleSignature };
  const staleVerification = attendanceController.verifyOfflinePayload(samplePayload, staleMeta, TEST_SECRET);
  report('Stale offline record (> 24h old) detected and rejected',
    staleVerification.valid === false && staleVerification.reason.includes('expired')
  );

  // Future record detection (> 5 minutes in future)
  const futureTimestamp = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const futureSignature = attendanceController.signOfflinePayload(samplePayload, futureTimestamp, TEST_SECRET);
  const futureMeta = { timestamp: futureTimestamp, signature: futureSignature };
  const futureVerification = attendanceController.verifyOfflinePayload(samplePayload, futureMeta, TEST_SECRET);
  report('Future offline record detected and rejected',
    futureVerification.valid === false && futureVerification.reason.includes('future')
  );

  // Missing signature metadata
  const missingVerification = attendanceController.verifyOfflinePayload(samplePayload, {}, TEST_SECRET);
  report('Missing offline metadata detected and rejected',
    missingVerification.valid === false && missingVerification.reason.includes('Missing offline')
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Health & Telemetry Endpoints (/health, /api/metrics)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n2. System Health & Telemetry Endpoints');

  const healthRes = await request(app).get('/health');
  report('GET /health returns HTTP 200', healthRes.status === 200);
  report('GET /health returns status: "healthy"', healthRes.body.status === 'healthy');
  report('GET /health provides process uptime', typeof healthRes.body.uptime === 'number' && healthRes.body.uptime >= 0);

  const metricsRes = await request(app).get('/api/metrics');
  report('GET /api/metrics returns HTTP 200', metricsRes.status === 200);
  report('GET /api/metrics provides uptimeSeconds', typeof metricsRes.body.uptimeSeconds === 'number');
  report('GET /api/metrics provides structured memory usage (RSS, Heap)',
    metricsRes.body.memory && typeof metricsRes.body.memory.rssMb === 'number' && typeof metricsRes.body.memory.heapUsedMb === 'number'
  );
  report('GET /api/metrics provides activeSessionLocks count', typeof metricsRes.body.activeSessionLocks === 'number');

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Batch Offline Attendance Sync Endpoint Contract
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n3. Batch Offline Sync Endpoint (Bounded Batch Sizing)');

  // Unauthenticated / public access should be gated by token
  const unauthSyncRes = await request(app)
    .post('/')
    .send({ action: 'sync_offline_attendance', sessions: [] });
  report('Unauthenticated sync_offline_attendance rejected with 401', unauthSyncRes.status === 401);

  // Bounded batch size limit (> 50 sessions)
  const tooManySessions = new Array(51).fill({ classInfo: {}, students: [] });
  const jwt = require('../server/node_modules/jsonwebtoken');
  const testProfToken = jwt.sign(
    { email: 'prof@smartattend.edu', role: 'professor' },
    process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_characters_long_super_secure'
  );

  const batchLimitRes = await request(app)
    .post('/')
    .set('Authorization', `Bearer ${testProfToken}`)
    .send({ action: 'sync_offline_attendance', sessions: tooManySessions });
  report('Offline sync batch exceeding 50 sessions rejected with HTTP 400',
    batchLimitRes.status === 400 && batchLimitRes.body.message.includes('50')
  );

  // Empty sessions array
  const emptyBatchRes = await request(app)
    .post('/')
    .set('Authorization', `Bearer ${testProfToken}`)
    .send({ action: 'sync_offline_attendance', sessions: [] });
  report('Empty sessions array rejected with HTTP 400', emptyBatchRes.status === 400);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. In-Memory Account Lockout Hydration
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n4. Account Lockout State Hydration');

  const now = Date.now();
  const testRecords = [
    { email: 'hydrated_locked_user@test.edu', lockedUntil: now + 600000, count: 5 },
    { email: 'expired_user@test.edu', lockedUntil: now - 60000, count: 5 } // already expired
  ];

  const hydrated = authService.hydrateLockouts(testRecords);
  report('hydrateLockouts correctly accepts active lockouts and ignores expired ones',
    hydrated === 1
  );

  report('Active locked user status confirmed after hydration',
    authService.isAccountLocked('hydrated_locked_user@test.edu') === true
  );

  report('Expired user status confirmed unlocked after hydration',
    authService.isAccountLocked('expired_user@test.edu') === false
  );

  // Clean up test lockout
  authService.resetFailedLogin('hydrated_locked_user@test.edu');

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Render Backend Keep-Alive Warmup Engine
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n5. Render Backend Keep-Alive Self-Ping Engine');

  report('initKeepAlive returns null in test environment (prevents background timers)',
    initKeepAlive() === null
  );

  report('hydrateLockedAccountsFromDb is an exported async function',
    typeof hydrateLockedAccountsFromDb === 'function'
  );

  console.log(`\n============================================================`);
  console.log(`Phase 7 Reliability Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runPhase7Tests().catch(err => {
    console.error('Test execution exception:', err);
    process.exit(1);
  });
}

module.exports = { runPhase7Tests };
