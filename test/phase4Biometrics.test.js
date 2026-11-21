/**
 * PHASE 4 — BIOMETRIC SECURITY, ACTIVE PAD & RELIABILITY TEST SUITE
 * ============================================================================
 * Verifies enhanced biometric security capabilities:
 *  1. Compound micro-challenges (Blink + Left Turn, Blink + Right Turn, Blink + Nod)
 *  2. Tightened 5-second challenge response window
 *  3. Video splice / instantaneous jump-cut presentation attack detection
 *  4. Server-side cryptographic HMAC challenge token generation
 *  5. Cryptographic signature verification and anti-forgery protection
 *  6. Anti-replay attack barrier (one-time challenge token consumption)
 *  7. Expired challenge token rejection
 *  8. AES-256-GCM encryption-at-rest verification for biometric vectors
 */

const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
require('../server/node_modules/dotenv').config();

const request = require('../server/node_modules/supertest');
const { app } = require('../server/server.js');
const { LivenessTracker, COMPOUND_CHALLENGE_TYPES } = require('../backend/livenessDetector');
const { encryptBiometric, decryptBiometric, isEncrypted } = require('../server/utils/biometricCrypto');

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

async function runPhase4BiometricTests() {
  console.log('\n=== PHASE 4: BIOMETRIC SECURITY & ACTIVE PAD TESTS ===\n');

  const tracker = new LivenessTracker();

  // ── 1. COMPOUND MICRO-CHALLENGE GENERATION ──────────────────────────────────
  console.log('1. Compound Micro-Challenge Generation & Contract');
  {
    const chal = tracker.generateCompoundChallenge(5000);
    report('Compound challenge generated with valid ID format', typeof chal.id === 'string' && chal.id.startsWith('chal_'));
    report('Compound challenge has isCompound flag set to true', chal.isCompound === true);
    report('Challenge type belongs to COMPOUND_CHALLENGE_TYPES pool', COMPOUND_CHALLENGE_TYPES.includes(chal.type));
    report('Tightened default timeout is exactly 5000ms (5 seconds)', chal.expiresAt - chal.issuedAt === 5000);
  }

  // ── 2. COMPOUND CHALLENGE VERIFICATION LOGIC ────────────────────────────────
  console.log('\n2. Compound Micro-Challenge Verification Logic');
  {
    // Compound Blink + Left Turn
    const leftCompound = { id: 'c_left', type: 'COMPOUND_BLINK_AND_TURN_LEFT', expiresAt: Date.now() + 5000 };
    
    // Complete match (blinked + turned left)
    const passLeft = tracker.verifyChallenge(leftCompound, {
      isLive: true,
      blinkDetected: true,
      details: { pose: { yawRatio: 0.50, pitchRatio: 1.0, isFrontal: false } }
    });
    report('Compound Blink + Left Turn succeeds when both gestures verified', passLeft.completed === true);

    // Partial match: blinked but did NOT turn head
    const failLeftPose = tracker.verifyChallenge(leftCompound, {
      isLive: true,
      blinkDetected: true,
      details: { pose: { yawRatio: 1.0, pitchRatio: 1.0, isFrontal: true } }
    });
    report('Compound Blink + Left Turn rejected when turn is missing', failLeftPose.completed === false);

    // Partial match: turned head but did NOT blink
    const failLeftBlink = tracker.verifyChallenge(leftCompound, {
      isLive: true,
      blinkDetected: false,
      details: { pose: { yawRatio: 0.50, pitchRatio: 1.0, isFrontal: false } }
    });
    report('Compound Blink + Left Turn rejected when blink is missing', failLeftBlink.completed === false);

    // Compound Blink + Right Turn
    const rightCompound = { id: 'c_right', type: 'COMPOUND_BLINK_AND_TURN_RIGHT', expiresAt: Date.now() + 5000 };
    const passRight = tracker.verifyChallenge(rightCompound, {
      isLive: true,
      blinkDetected: true,
      details: { pose: { yawRatio: 1.60, pitchRatio: 1.0, isFrontal: false } }
    });
    report('Compound Blink + Right Turn succeeds when both gestures verified', passRight.completed === true);

    // Compound Blink + Nod
    const nodCompound = { id: 'c_nod', type: 'BLINK_AND_NOD', expiresAt: Date.now() + 5000 };
    const passNod = tracker.verifyChallenge(nodCompound, {
      isLive: true,
      blinkDetected: true,
      details: { pose: { yawRatio: 1.0, pitchRatio: 0.70, isFrontal: false } }
    });
    report('Compound Blink + Nod succeeds when both gestures verified', passNod.completed === true);
  }

  // ── 3. TEMPORAL VIDEO SPLICE / JUMP-CUT DETECTION ───────────────────────────
  console.log('\n3. Temporal Jump-Cut / Video Splice Attack Detection');
  {
    const spliceTracker = new LivenessTracker();
    const faceId = 'STU_SPLICE_ATTACK';

    // Helper: make synthetic landmarks with nose at specific position
    function makeLandmarks(noseX, noseY) {
      const arr = [];
      for (let i = 0; i < 68; i++) arr.push({ x: 100, y: 100 });
      arr[30] = { x: noseX, y: noseY }; // nose tip
      arr[36] = { x: 50, y: 50 };       // left eye outer (for ipd)
      arr[45] = { x: 150, y: 50 };      // right eye outer
      return arr;
    }

    // Frame 1: Normal position
    spliceTracker.evaluate(faceId, makeLandmarks(100, 100));

    // Frame 2: Instantaneous 60-pixel shift (simulating sudden photo/video swap)
    const spliceResult = spliceTracker.evaluate(faceId, makeLandmarks(160, 160));
    report('Instantaneous landmark displacement flags spoof_suspected', spliceResult.status === 'spoof_suspected');
    report('Splice attack reason indicates unnatural landmark jump cut', spliceResult.reason.includes('jump cut detected'));
  }

  // ── 4. SERVER-SIDE HMAC CHALLENGE GENERATION ────────────────────────────────
  console.log('\n4. Server-Side HMAC Challenge Generation (Anti-Tamper)');
  let issuedChallenge = null;
  try {
    const res = await request(app)
      .post('/')
      .send({ action: 'get_liveness_challenge' });

    report('POST get_liveness_challenge returns HTTP 200', res.status === 200);
    report('Response contains challenge object', !!res.body && !!res.body.challenge);
    issuedChallenge = res.body.challenge;

    report('Server challenge contains challengeId', !!issuedChallenge.challengeId);
    report('Server challenge contains cryptographic HMAC signature', !!issuedChallenge.signature);

    // Verify HMAC calculation matches on client using same secret
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${issuedChallenge.challengeId}:${issuedChallenge.type}:${issuedChallenge.expiresAt}`)
      .digest('hex');

    report('Server HMAC signature matches cryptographic calculation', issuedChallenge.signature === expectedSig);
  } catch (err) {
    report('HMAC Challenge generation test execution', false);
  }

  // ── 5. SERVER-SIDE HMAC CHALLENGE VERIFICATION & REPLAY BARRIER ─────────────
  console.log('\n5. Server-Side Challenge Verification & Anti-Replay Gate');
  try {
    if (issuedChallenge) {
      // 5a. Valid submission succeeds
      const resValid = await request(app)
        .post('/')
        .send({
          action: 'verify_liveness_challenge',
          challengeId: issuedChallenge.challengeId,
          type: issuedChallenge.type,
          expiresAt: issuedChallenge.expiresAt,
          signature: issuedChallenge.signature,
          proof: { completed: true }
        });
      report('Valid challenge submission verified with HTTP 200', resValid.status === 200);
      report('Verification response has verified: true', resValid.body && resValid.body.verified === true);

      // 5b. Replay attack: submitting same challenge a second time
      const resReplay = await request(app)
        .post('/')
        .send({
          action: 'verify_liveness_challenge',
          challengeId: issuedChallenge.challengeId,
          type: issuedChallenge.type,
          expiresAt: issuedChallenge.expiresAt,
          signature: issuedChallenge.signature,
          proof: { completed: true }
        });
      report('Replay attack rejected with HTTP 403 Forbidden', resReplay.status === 403);
      report('Replay attack error states token already consumed', resReplay.body && resReplay.body.message.includes('replay attack detected'));

      // 5c. Forged/Tampered signature rejected
      const resForged = await request(app)
        .post('/')
        .send({
          action: 'verify_liveness_challenge',
          challengeId: 'chal_tampered_id',
          type: 'BLINK',
          expiresAt: Date.now() + 5000,
          signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          proof: { completed: true }
        });
      report('Forged HMAC signature rejected with HTTP 403 Forbidden', resForged.status === 403);
      report('Forged signature error states tamper detected', resForged.body && resForged.body.message.includes('tamper detected'));

      // 5d. Expired challenge rejected
      const resExpired = await request(app)
        .post('/')
        .send({
          action: 'verify_liveness_challenge',
          challengeId: 'chal_expired_id',
          type: 'BLINK',
          expiresAt: Date.now() - 1000, // Expired
          signature: 'dummy_sig'
        });
      report('Expired challenge rejected with HTTP 400 Bad Request', resExpired.status === 400);
    }
  } catch (err) {
    report('Challenge verification tests execution', false);
  }

  // ── 6. BIOMETRIC AES-256-GCM AT-REST ASSURANCES ─────────────────────────────
  console.log('\n6. Biometric Encryption-at-Rest Assurances');
  {
    const sampleVector = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
    const serialized = JSON.stringify(sampleVector);

    const encrypted = encryptBiometric(serialized);
    report('Encrypted payload conforms to AES-256-GCM structure', isEncrypted(encrypted) === true);
    report('Ciphertext is completely distinct from plaintext JSON vector', !encrypted.ciphertext.includes(serialized) && !encrypted.ciphertext.includes('['));
    report('Decrypted payload accurately restores 128-dimensional vector', decryptBiometric(encrypted) === serialized);
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 4 Biometric Security Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n⚠ ${failed} test(s) FAILED — fix biometric security issues.\n`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} Phase 4 Biometric Security tests passed successfully!\n`);
    process.exit(0);
  }
}

runPhase4BiometricTests().catch(err => {
  console.error('Unhandled Phase 4 test suite error:', err);
  process.exit(1);
});
