const assert = require('assert');
const { calculateEAR, estimateHeadPose, LivenessTracker } = require('../backend/livenessDetector');

console.log('--- Running Biometric Liveness (PAD Engine) Test Suite ---');

// Helper to create synthetic eye points
function createEyePoints(isOpen = true) {
  // 6 points: p1(outer), p2(top1), p3(top2), p4(inner), p5(bottom2), p6(bottom1)
  const height = isOpen ? 10 : 1.5; // Open eye has height 10, closed has 1.5
  return [
    { x: 10, y: 50 },          // p1: outer corner
    { x: 18, y: 50 - height }, // p2: top left
    { x: 26, y: 50 - height }, // p3: top right
    { x: 34, y: 50 },          // p4: inner corner
    { x: 26, y: 50 + height }, // p5: bottom right
    { x: 18, y: 50 + height }  // p6: bottom left
  ];
}

// Helper to create synthetic 68-point face landmarks
function createSyntheticLandmarks(options = {}) {
  const { eyeOpen = true, yawOffset = 0, pitchOffset = 0, jitter = 0 } = options;
  const landmarks = [];

  for (let i = 0; i < 68; i++) {
    landmarks.push({
      x: 100 + i * 2 + (Math.random() - 0.5) * jitter,
      y: 100 + (Math.random() - 0.5) * jitter
    });
  }

  // Set nose tip (30), nose root (27), chin (8)
  landmarks[30] = { x: 150 + yawOffset, y: 150 + pitchOffset };
  landmarks[27] = { x: 150, y: 120 };
  landmarks[8]  = { x: 150, y: 200 };

  // Set left eye (36-41)
  const leftEye = createEyePoints(eyeOpen);
  for (let i = 0; i < 6; i++) {
    landmarks[36 + i] = {
      x: leftEye[i].x + 100 + (Math.random() - 0.5) * jitter,
      y: leftEye[i].y + 100 + (Math.random() - 0.5) * jitter
    };
  }

  // Set right eye (42-47)
  const rightEye = createEyePoints(eyeOpen);
  for (let i = 0; i < 6; i++) {
    landmarks[42 + i] = {
      x: rightEye[i].x + 160 + (Math.random() - 0.5) * jitter,
      y: rightEye[i].y + 100 + (Math.random() - 0.5) * jitter
    };
  }

  return landmarks;
}

// Test 1: EAR computation for open vs closed eyes
{
  const openEye = createEyePoints(true);
  const closedEye = createEyePoints(false);

  const earOpen = calculateEAR(openEye);
  const earClosed = calculateEAR(closedEye);

  assert(earOpen > 0.25, `Open eye EAR should be > 0.25 (got ${earOpen})`);
  assert(earClosed < 0.18, `Closed eye EAR should be < 0.18 (got ${earClosed})`);
  assert(earOpen > earClosed * 2, 'Open eye EAR should be significantly greater than closed eye EAR');
  console.log(`✓ Test 1 Passed: EAR distinction verified (Open: ${earOpen.toFixed(3)}, Closed: ${earClosed.toFixed(3)})`);
}

// Test 2: Head pose estimation
{
  const frontalFace = createSyntheticLandmarks({ yawOffset: 0, pitchOffset: 0 });
  const pose = estimateHeadPose(frontalFace);
  assert(pose.isFrontal, 'Frontal face should be detected as frontal');
  assert(typeof pose.yawRatio === 'number');
  assert(typeof pose.rollDegrees === 'number');
  console.log(`✓ Test 2 Passed: Head pose estimation verified (Frontal: ${pose.isFrontal}, Roll: ${pose.rollDegrees}°)`);
}

// Test 3: Static photo spoof detection (Presentation Attack Detection)
{
  const tracker = new LivenessTracker({ windowSize: 8, minMicroMotionVariance: 0.00018 });
  const studentId = 'STU_SPOOF_TEST';

  // Feed 8 identical frames with ZERO jitter (simulating a printed photograph held steady)
  let lastResult;
  const staticLandmarks = createSyntheticLandmarks({ eyeOpen: true, jitter: 0 });

  for (let f = 0; f < 8; f++) {
    lastResult = tracker.evaluate(studentId, staticLandmarks);
  }

  assert.strictEqual(lastResult.isLive, false, 'Static photo should fail liveness');
  assert.strictEqual(lastResult.status, 'spoof_suspected', 'Static photo status must be spoof_suspected');
  assert(lastResult.reason.includes('Presentation Attack Suspected'), 'Reason must alert presentation attack');
  console.log(`✓ Test 3 Passed: Static photo attack detected and rejected (${lastResult.reason})`);
}

// Test 4: Live subject with natural blink and physiological tremor
{
  const tracker = new LivenessTracker({ windowSize: 8 });
  const studentId = 'STU_LIVE_TEST';

  let lastResult;
  // Frame sequence simulating live human: 3 open frames with natural tremor, 2 blink frames, 3 open frames
  for (let f = 0; f < 8; f++) {
    const isBlinking = (f === 3 || f === 4);
    const liveLandmarks = createSyntheticLandmarks({ eyeOpen: !isBlinking, jitter: 0.8 });
    lastResult = tracker.evaluate(studentId, liveLandmarks);
  }

  assert.strictEqual(lastResult.isLive, true, 'Live subject with blinks & micro-motion must pass');
  assert.strictEqual(lastResult.status, 'live');
  assert.strictEqual(lastResult.blinkDetected, true, 'Blink must be detected in sequence');
  assert(lastResult.score >= 0.7, `Live score should be >= 0.70 (got ${lastResult.score})`);
  console.log(`✓ Test 4 Passed: Live human verified with blink & tremor (Score: ${lastResult.score}, Blink: ${lastResult.blinkDetected})`);
}

console.log('All 4 Biometric Liveness tests passed successfully!\n');
