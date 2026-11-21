/**
 * ==============================================================================
 * SmartAttend — Enterprise Academic Attendance Calculation Engine
 * ==============================================================================
 * High-precision, zero-regression mathematical engine for:
 *   - Attendance Percentage calculation with decimal precision
 *   - Approved Medical & Official Duty Leave credits
 *   - Exact Buffer Class Margin (classes a student can safely miss)
 *   - Exact Recovery Trajectory (consecutive classes needed to regain >= 75%)
 *   - UGC / Indian University Statutory Condonation Zone (65.0% - 74.99%)
 *   - Multi-step forward projection modeling for academic advisory
 * ==============================================================================
 */

/**
 * Calculate comprehensive attendance metrics for a student
 * 
 * @param {object} params
 * @param {number} params.attended - Total sessions attended
 * @param {number} params.totalHeld - Total sessions conducted to date
 * @param {number} [params.approvedLeaves=0] - Approved medical / on-duty leaves
 * @param {number} [params.threshold=75] - Minimum required attendance threshold percentage
 * @returns {object} Full attendance analysis metrics
 */
function calculateAttendanceMetrics({
  attended = 0,
  totalHeld = 0,
  approvedLeaves = 0,
  threshold = 75
} = {}) {
  // Input sanitation & defensive clamping
  const att = Math.max(0, parseInt(attended, 10) || 0);
  const total = Math.max(0, parseInt(totalHeld, 10) || 0);
  const leaves = Math.max(0, parseInt(approvedLeaves, 10) || 0);
  const th = Number(threshold) > 0 && Number(threshold) <= 100 ? Number(threshold) : 75;

  const effectiveAttended = att + leaves;

  // Edge case: Semester start (0 classes held)
  if (total === 0) {
    return {
      attended: att,
      totalHeld: total,
      approvedLeaves: leaves,
      effectiveAttended: 0,
      percentage: 100.0,
      threshold: th,
      isSafe: true,
      bufferClasses: 0,
      classesNeeded: 0,
      statusCategory: 'EXCELLENT',
      condonationEligible: false,
      recoveryTrajectory: [],
      summaryText: 'Semester has just begun. 0 classes held to date (100% initial standing).'
    };
  }

  // Raw attendance percentage
  const rawPercentage = (effectiveAttended / total) * 100;
  // Clamped between 0 and 100 for display, rounded to 2 decimal places
  const percentage = Number(Math.min(100.0, Math.max(0.0, rawPercentage)).toFixed(2));
  const isSafe = percentage >= th;

  // ── 1. Buffer Classes (Miss Margin) ──
  // How many consecutive upcoming classes can be missed while keeping percentage >= threshold?
  // Formula: floor((100 * effectiveAttended / threshold) - totalHeld)
  let bufferClasses = 0;
  if (percentage >= th) {
    const rawBuffer = Math.floor((100.0 * effectiveAttended) / th - total);
    bufferClasses = Math.max(0, rawBuffer);
  }

  // ── 2. Recovery Classes Needed ──
  // How many consecutive upcoming classes must be attended to bring percentage >= threshold?
  // Formula: ceil((threshold * total - 100 * effectiveAttended) / (100 - threshold))
  let classesNeeded = 0;
  if (percentage < th) {
    const numerator = th * total - 100.0 * effectiveAttended;
    const denominator = 100.0 - th;
    if (denominator > 0) {
      classesNeeded = Math.max(0, Math.ceil(numerator / denominator));
    }
  }

  // ── 3. Academic Status Categorization ──
  let statusCategory = 'EXCELLENT';
  let condonationEligible = false;

  if (percentage >= 85.0) {
    statusCategory = 'EXCELLENT';
  } else if (percentage >= th) {
    statusCategory = 'SATISFACTORY';
  } else if (percentage >= 65.0) {
    statusCategory = 'CONDONATION_ELIGIBLE';
    condonationEligible = true;
  } else {
    statusCategory = 'CRITICAL_SHORTAGE';
  }

  // ── 4. Forward Recovery Trajectory (Next 1, 2, 3, 5, 10 sessions) ──
  const trajectorySteps = [1, 2, 3, 5, 10];
  const recoveryTrajectory = trajectorySteps.map(step => {
    const projAttended = effectiveAttended + step;
    const projTotal = total + step;
    const projPct = Number(((projAttended / projTotal) * 100).toFixed(2));
    return {
      classesAttendedConsecutively: step,
      projectedAttendance: Math.min(100.0, projPct),
      meetsThreshold: projPct >= th
    };
  });

  // ── 5. Human-readable Guidance Summary ──
  let summaryText = '';
  if (isSafe) {
    if (bufferClasses > 0) {
      summaryText = `Attendance is in good standing (${percentage}%). You have a safety buffer of ${bufferClasses} class${bufferClasses > 1 ? 'es' : ''}.`;
    } else {
      summaryText = `Attendance is on the safe boundary (${percentage}%). You cannot miss any upcoming classes without dropping below ${th}%.`;
    }
  } else {
    if (condonationEligible) {
      summaryText = `Attendance is in the Condonation Zone (${percentage}%). You must attend the next ${classesNeeded} consecutive class${classesNeeded > 1 ? 'es' : ''} to recover above ${th}%, or submit university medical certificates.`;
    } else {
      summaryText = `CRITICAL ATTENDANCE ALERT: Current attendance is ${percentage}%, well below statutory minimum (${th}%). You require ${classesNeeded} consecutive classes to become eligible for exams.`;
    }
  }

  return {
    attended: att,
    totalHeld: total,
    approvedLeaves: leaves,
    effectiveAttended,
    percentage,
    threshold: th,
    isSafe,
    bufferClasses,
    classesNeeded,
    statusCategory,
    condonationEligible,
    recoveryTrajectory,
    summaryText
  };
}

module.exports = {
  calculateAttendanceMetrics
};
