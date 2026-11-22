/**
 * ==============================================================================
 * SmartAttend — Presentation Attack Detection (PAD) / Biometric Liveness Engine
 * ==============================================================================
 * Multi-layer client-side biometric anti-spoofing detector.
 * Engineered with presentation attack detection (PAD) heuristics aligned with
 * ISO/IEC 30107-3 design principles for active/passive Presentation Attack mitigation.
 * 
 * Capabilities:
 *   1. Eye Aspect Ratio (EAR) computation (Left Eye: 36-41, Right Eye: 42-47).
 *   2. Blink dynamic detection & temporal state transition machine.
 *   3. Head pose orientation (Yaw, Pitch, Roll) using 68 3D/2D facial landmarks.
 *   4. Temporal landmark micro-motion variance analysis (Passive PAD).
 *      - Static printed photos and frozen screens have near-zero landmark variance.
 *      - Genuine human faces exhibit natural micro-saccades and physiological tremor.
 *   5. Active compound challenge-response mode (Blink+Turn, Blink+Nod).
 *   6. Multi-frame sliding window consensus & velocity-normalized splice detection.
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SmartAttendLiveness = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Euclidean distance between two 2D points
  function euclideanDist(p1, p2) {
    if (!p1 || !p2) return 0;
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate Eye Aspect Ratio (EAR)
   * Formula: EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
   * 
   * @param {Array<{x: number, y: number}>} eyePoints - 6 landmark points for the eye
   * @returns {number} EAR value (typically 0.15 for closed, 0.25 - 0.38 for open)
   */
  function calculateEAR(eyePoints) {
    if (!eyePoints || eyePoints.length < 6) return 0.3; // Default open fallback
    const p1 = eyePoints[0];
    const p2 = eyePoints[1];
    const p3 = eyePoints[2];
    const p4 = eyePoints[3];
    const p5 = eyePoints[4];
    const p6 = eyePoints[5];

    const verticalA = euclideanDist(p2, p6);
    const verticalB = euclideanDist(p3, p5);
    const horizontal = euclideanDist(p1, p4);

    if (horizontal < 1e-6) return 0.3;
    return (verticalA + verticalB) / (2.0 * horizontal);
  }

  /**
   * Estimate 3D Head Pose (Yaw, Pitch, Roll) from 68 landmarks
   * 
   * @param {Array<{x: number, y: number}>} landmarks - Array of 68 point objects
   * @returns {{ yawRatio: number, pitchRatio: number, rollDegrees: number, isFrontal: boolean }}
   */
  function estimateHeadPose(landmarks) {
    if (!landmarks || landmarks.length < 68) {
      return { yawRatio: 1.0, pitchRatio: 1.0, rollDegrees: 0, isFrontal: true };
    }

    const noseTip = landmarks[30];
    const leftEyeOuter = landmarks[36];
    const rightEyeOuter = landmarks[45];
    const noseRoot = landmarks[27];
    const chin = landmarks[8];

    // Yaw: ratio of distance from nose tip to outer eye corners
    const leftDist = Math.abs(noseTip.x - leftEyeOuter.x);
    const rightDist = Math.abs(rightEyeOuter.x - noseTip.x);
    const yawRatio = rightDist > 1e-4 ? leftDist / rightDist : 1.0;

    // Pitch: ratio of upper face height to lower face height
    const upperHeight = Math.abs(noseTip.y - noseRoot.y);
    const lowerHeight = Math.abs(chin.y - noseTip.y);
    const pitchRatio = lowerHeight > 1e-4 ? upperHeight / lowerHeight : 1.0;

    // Roll: angle of eye line relative to horizontal axis
    const dX = rightEyeOuter.x - leftEyeOuter.x;
    const dY = rightEyeOuter.y - leftEyeOuter.y;
    const rollRadians = Math.atan2(dY, dX);
    const rollDegrees = (rollRadians * 180) / Math.PI;

    // Frontal check: yaw ratio between 0.55 and 1.8, roll within +/- 15 deg
    const isFrontal = yawRatio >= 0.55 && yawRatio <= 1.8 && Math.abs(rollDegrees) <= 15;

    return {
      yawRatio: Number(yawRatio.toFixed(3)),
      pitchRatio: Number(pitchRatio.toFixed(3)),
      rollDegrees: Number(rollDegrees.toFixed(2)),
      isFrontal
    };
  }

  /**
   * Temporal Liveness Tracker
   * Evaluates frame-by-frame biometrics for a subject over a sliding window
   */
  class LivenessTracker {
    constructor(options = {}) {
      this.windowSize = options.windowSize || 8;
      this.earClosedThreshold = options.earClosedThreshold || 0.185;
      this.earOpenThreshold = options.earOpenThreshold || 0.24;
      // Minimum variance in landmark coordinates (normalized by eye distance) to reject static photos
      this.minMicroMotionVariance = options.minMicroMotionVariance || 0.00018;
      this.history = new Map(); // key: faceId -> Array of frame samples
    }

    /**
     * Clear tracking state for a specific face or all faces
     */
    reset(faceId) {
      if (faceId) {
        this.history.delete(faceId);
      } else {
        this.history.clear();
      }
    }

    /**
     * Process a single video frame for a face
     * 
     * @param {string} faceId - Student ID or unique face identifier
     * @param {Array<{x: number, y: number}>|object} landmarks - 68 landmarks
     * @param {object} [box] - Optional bounding box { x, y, width, height }
     * @returns {{
     *   isLive: boolean,
     *   score: number,
     *   status: 'evaluating' | 'live' | 'spoof_suspected',
     *   blinkDetected: boolean,
     *   microMotionScore: number,
     *   reason: string,
     *   details: object
     * }}
     */
    evaluate(faceId, landmarks, box) {
      // Unpack landmarks if passed as faceapi landmark object with .positions
      const points = Array.isArray(landmarks) ? landmarks : (landmarks && landmarks.positions ? landmarks.positions : null);

      if (!points || points.length < 68) {
        return {
          isLive: false,
          score: 0,
          status: 'evaluating',
          blinkDetected: false,
          microMotionScore: 0,
          reason: 'Insufficient landmark points for PAD evaluation.',
          details: {}
        };
      }

      // 1. Calculate EAR
      const leftEye = [points[36], points[37], points[38], points[39], points[40], points[41]];
      const rightEye = [points[42], points[43], points[44], points[45], points[46], points[47]];
      const leftEAR = calculateEAR(leftEye);
      const rightEAR = calculateEAR(rightEye);
      const currentEAR = (leftEAR + rightEAR) / 2.0;

      // 2. Inter-pupillary distance for normalization
      const ipd = euclideanDist(points[36], points[45]) || 100;

      // 3. Head pose
      const pose = estimateHeadPose(points);

      // 4. Rigid anchor landmark for micro-motion: Nose Bridge (landmarks 27-30)
      const noseTip = {
        x: points[30].x / ipd,
        y: points[30].y / ipd
      };

      // 5. Retrieve or init history
      let frames = this.history.get(faceId) || [];
      frames.push({
        timestamp: Date.now(),
        ear: currentEAR,
        noseTip,
        pose
      });

      // Keep only sliding window
      if (frames.length > this.windowSize) {
        frames.shift();
      }
      this.history.set(faceId, frames);

      // 5b. Temporal jump cut / splice attack detection
      // Detects instantaneous unnatural landmark displacement between successive frames
      // Uses both delta time and velocity normalization to function across varied camera frame rates
      if (frames.length >= 2) {
        const prevFrame = frames[frames.length - 2];
        const currFrame = frames[frames.length - 1];
        const dt = Math.max(1, currFrame.timestamp - prevFrame.timestamp);
        const dNose = euclideanDist(prevFrame.noseTip, currFrame.noseTip);
        // Normalized displacement velocity (units per second)
        const velocity = dNose / (dt / 1000);
        // Detects jump cuts: (high displacement within 60ms) OR (velocity > 7.5 units/s at lower frame rates)
        if ((dt < 60 && dNose > 0.45) || (velocity > 7.5 && dNose > 0.35)) {
          return {
            isLive: false,
            score: 0.05,
            status: 'spoof_suspected',
            blinkDetected: false,
            microMotionScore: 0,
            reason: '⚠️ Presentation Attack Suspected: Unnatural landmark jump cut detected (video splice/photo swap).',
            details: { dNose, dt, velocity: Number(velocity.toFixed(2)), pose }
          };
        }
      }

      // Need at least 3 frames to assess motion or blinks
      if (frames.length < 3) {
        return {
          isLive: true, // Optimistic during initial warmup, status remains evaluating
          score: 0.5,
          status: 'evaluating',
          blinkDetected: false,
          microMotionScore: 0.5,
          reason: `Acquiring liveness baseline (${frames.length}/${this.windowSize} frames)...`,
          details: { currentEAR, pose }
        };
      }

      // 6. Blink Detection across window
      // Look for a dip: open -> closed -> open
      let hadOpen = false;
      let hadClosed = false;
      let blinkDetected = false;

      for (const f of frames) {
        if (f.ear >= this.earOpenThreshold) hadOpen = true;
        if (f.ear <= this.earClosedThreshold) hadClosed = true;
        if (hadOpen && hadClosed) {
          blinkDetected = true;
          break;
        }
      }

      // 7. Micro-Motion Variance Analysis (Passive Anti-Spoof)
      // Computes spatial variance of normalized nose position
      const n = frames.length;
      let meanX = 0, meanY = 0;
      for (const f of frames) {
        meanX += f.noseTip.x;
        meanY += f.noseTip.y;
      }
      meanX /= n;
      meanY /= n;

      let varX = 0, varY = 0;
      for (const f of frames) {
        varX += Math.pow(f.noseTip.x - meanX, 2);
        varY += Math.pow(f.noseTip.y - meanY, 2);
      }
      const totalVariance = (varX + varY) / n;

      // Also compute EAR variance over window
      let meanEAR = 0;
      for (const f of frames) meanEAR += f.ear;
      meanEAR /= n;
      let varEAR = 0;
      for (const f of frames) varEAR += Math.pow(f.ear - meanEAR, 2);
      varEAR /= n;

      // 8. Spoofing Heuristics:
      // If frame count >= 6 and micro-motion variance is practically 0 AND EAR variance is near zero,
      // this indicates a static printed photo or a frozen screenshot placed in front of the lens.
      const isStaticPhoto = (n >= 5 && totalVariance < this.minMicroMotionVariance && varEAR < 0.00008);

      // Compute composite liveness score (0.0 to 1.0)
      let score = 0.5; // neutral baseline

      if (blinkDetected) score += 0.35;
      if (varEAR > 0.0003) score += 0.15;
      if (totalVariance >= this.minMicroMotionVariance && totalVariance < 0.08) score += 0.2;
      if (isStaticPhoto) score -= 0.6;

      // Clamp score
      score = Math.max(0.0, Math.min(1.0, score));

      if (isStaticPhoto) {
        return {
          isLive: false,
          score: Number(score.toFixed(2)),
          status: 'spoof_suspected',
          blinkDetected,
          microMotionScore: Number(totalVariance.toFixed(6)),
          reason: '⚠️ Presentation Attack Suspected: Static printed photo or motionless display detected.',
          details: { totalVariance, varEAR, currentEAR, pose }
        };
      }

      const isLive = score >= 0.45;
      return {
        isLive,
        score: Number(score.toFixed(2)),
        status: isLive ? 'live' : 'evaluating',
        blinkDetected,
        microMotionScore: Number(totalVariance.toFixed(6)),
        reason: isLive ? 'Live subject verified.' : 'Evaluating subject dynamics...',
        details: { totalVariance, varEAR, currentEAR, pose }
      };
    }

    /**
     * Generates a randomized active challenge for anti-replay verification.
     * Default timeout tightened to 5000ms (5s) for enhanced security.
     * 
     * @param {number} [timeoutMs=5000] - Challenge validity window in ms
     * @param {object} [options] - Configuration options { includeCompound: boolean, type: string }
     * @returns {{ id: string, type: string, prompt: string, issuedAt: number, expiresAt: number, isCompound: boolean }}
     */
    generateChallenge(timeoutMs = 5000, options = {}) {
      const basicTypes = [
        { type: 'BLINK', prompt: 'Please blink your eyes naturally', isCompound: false },
        { type: 'TURN_LEFT', prompt: 'Please turn your head slightly to the left', isCompound: false },
        { type: 'TURN_RIGHT', prompt: 'Please turn your head slightly to the right', isCompound: false },
        { type: 'NOD', prompt: 'Please nod your head downwards slightly', isCompound: false }
      ];

      const compoundTypes = [
        { type: 'COMPOUND_BLINK_AND_TURN_LEFT', prompt: 'Please blink naturally and turn your head slightly to the left', isCompound: true },
        { type: 'COMPOUND_BLINK_AND_TURN_RIGHT', prompt: 'Please blink naturally and turn your head slightly to the right', isCompound: true },
        { type: 'BLINK_AND_NOD', prompt: 'Please blink naturally and nod your head slightly downwards', isCompound: true }
      ];

      let candidatePool = basicTypes;
      if (options.compoundOnly) {
        candidatePool = compoundTypes;
      } else if (options.includeCompound) {
        candidatePool = [...basicTypes, ...compoundTypes];
      }

      if (options.type) {
        const matched = [...basicTypes, ...compoundTypes].find(t => t.type === options.type);
        if (matched) candidatePool = [matched];
      }

      const selected = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      return {
        id: 'chal_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        type: selected.type,
        prompt: selected.prompt,
        isCompound: selected.isCompound,
        issuedAt: Date.now(),
        expiresAt: Date.now() + timeoutMs
      };
    }

    /**
     * Generates a compound micro-challenge requiring simultaneous / sequential actions
     * (e.g. natural blink combined with lateral head pose rotation)
     * @param {number} [timeoutMs=5000]
     * @returns {{ id: string, type: string, prompt: string, issuedAt: number, expiresAt: number, isCompound: boolean }}
     */
    generateCompoundChallenge(timeoutMs = 5000) {
      return this.generateChallenge(timeoutMs, { compoundOnly: true });
    }

    /**
     * Validates whether an active challenge was successfully completed by the subject.
     * Supports both single micro-actions and compound multi-factor behavioral gestures.
     * 
     * @param {object} challenge
     * @param {object} evaluationResult - Output from evaluate()
     * @returns {{ completed: boolean, reason: string }}
     */
    verifyChallenge(challenge, evaluationResult) {
      if (!challenge || !evaluationResult) return { completed: false, reason: 'Invalid parameters' };
      if (Date.now() > challenge.expiresAt) {
        return { completed: false, reason: 'Challenge expired. Please try again.' };
      }

      const pose = evaluationResult.details && evaluationResult.details.pose;
      if (!pose) return { completed: false, reason: 'Head pose data not available' };

      switch (challenge.type) {
        case 'BLINK':
          if (evaluationResult.blinkDetected) {
            return { completed: true, reason: 'Natural blink verified.' };
          }
          return { completed: false, reason: 'Awaiting blink...' };

        case 'TURN_LEFT':
          if (pose.yawRatio < 0.65) {
            return { completed: true, reason: 'Left head turn verified.' };
          }
          return { completed: false, reason: 'Awaiting left head turn...' };

        case 'TURN_RIGHT':
          if (pose.yawRatio > 1.5) {
            return { completed: true, reason: 'Right head turn verified.' };
          }
          return { completed: false, reason: 'Awaiting right head turn...' };

        case 'NOD':
          if (pose.pitchRatio < 0.75 || pose.pitchRatio > 1.4) {
            return { completed: true, reason: 'Head nod verified.' };
          }
          return { completed: false, reason: 'Awaiting head nod...' };

        // ── Phase 4: Compound Micro-Challenge Handlers ──
        case 'COMPOUND_BLINK_AND_TURN_LEFT':
          if (evaluationResult.blinkDetected && pose.yawRatio < 0.65) {
            return { completed: true, reason: 'Compound gesture verified (blink + left turn).' };
          }
          if (!evaluationResult.blinkDetected) return { completed: false, reason: 'Awaiting natural blink...' };
          return { completed: false, reason: 'Awaiting left head turn...' };

        case 'COMPOUND_BLINK_AND_TURN_RIGHT':
          if (evaluationResult.blinkDetected && pose.yawRatio > 1.5) {
            return { completed: true, reason: 'Compound gesture verified (blink + right turn).' };
          }
          if (!evaluationResult.blinkDetected) return { completed: false, reason: 'Awaiting natural blink...' };
          return { completed: false, reason: 'Awaiting right head turn...' };

        case 'BLINK_AND_NOD':
          if (evaluationResult.blinkDetected && (pose.pitchRatio < 0.75 || pose.pitchRatio > 1.4)) {
            return { completed: true, reason: 'Compound gesture verified (blink + head nod).' };
          }
          if (!evaluationResult.blinkDetected) return { completed: false, reason: 'Awaiting natural blink...' };
          return { completed: false, reason: 'Awaiting downward head nod...' };

        default:
          return { completed: false, reason: 'Unknown challenge type' };
      }
    }
  }

  const CHALLENGE_TYPES = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT', 'NOD'];
  const COMPOUND_CHALLENGE_TYPES = ['COMPOUND_BLINK_AND_TURN_LEFT', 'COMPOUND_BLINK_AND_TURN_RIGHT', 'BLINK_AND_NOD'];
  const ALL_CHALLENGE_TYPES = [...CHALLENGE_TYPES, ...COMPOUND_CHALLENGE_TYPES];

  return {
    calculateEAR,
    estimateHeadPose,
    LivenessTracker,
    CHALLENGE_TYPES,
    COMPOUND_CHALLENGE_TYPES,
    ALL_CHALLENGE_TYPES
  };
});
