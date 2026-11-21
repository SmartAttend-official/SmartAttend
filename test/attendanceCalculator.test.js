const assert = require('assert');
const { calculateAttendanceMetrics } = require('../server/attendanceCalculator');

console.log('--- Running Attendance Calculator Test Suite ---');

// Test 1: Initial semester state (0 classes held)
{
  const result = calculateAttendanceMetrics({ attended: 0, totalHeld: 0, approvedLeaves: 0, threshold: 75 });
  assert.strictEqual(result.percentage, 100.0, 'Zero classes held should return 100% baseline');
  assert.strictEqual(result.isSafe, true, 'Zero classes should be safe');
  assert.strictEqual(result.classesNeeded, 0, 'No classes needed at start');
  assert.strictEqual(result.bufferClasses, 0, 'No buffer classes at start');
  assert.strictEqual(result.statusCategory, 'EXCELLENT');
  console.log('✓ Test 1 Passed: Semester start (0 held) edge case');
}

// Test 2: Standard safe student (18 attended out of 20 held = 90%)
{
  const result = calculateAttendanceMetrics({ attended: 18, totalHeld: 20, threshold: 75 });
  assert.strictEqual(result.percentage, 90.0);
  assert.strictEqual(result.isSafe, true);
  assert.strictEqual(result.classesNeeded, 0);
  // floor((100 * 18 / 75) - 20) = floor(24 - 20) = 4
  assert.strictEqual(result.bufferClasses, 4, 'Buffer should allow 4 misses before dropping below 75%');
  assert.strictEqual(result.statusCategory, 'EXCELLENT');
  console.log('✓ Test 2 Passed: 90% attendance allows 4 buffer misses');
}

// Test 3: Borderline boundary student (15 attended out of 20 held = 75%)
{
  const result = calculateAttendanceMetrics({ attended: 15, totalHeld: 20, threshold: 75 });
  assert.strictEqual(result.percentage, 75.0);
  assert.strictEqual(result.isSafe, true);
  assert.strictEqual(result.classesNeeded, 0);
  // floor((100 * 15 / 75) - 20) = floor(20 - 20) = 0
  assert.strictEqual(result.bufferClasses, 0, 'Buffer should be 0 on exact 75% boundary');
  assert.strictEqual(result.statusCategory, 'SATISFACTORY');
  console.log('✓ Test 3 Passed: Exact boundary (75.00%) has 0 buffer and 0 needed');
}

// Test 4: Condonation Zone student (14 attended out of 20 held = 70%)
{
  const result = calculateAttendanceMetrics({ attended: 14, totalHeld: 20, threshold: 75 });
  assert.strictEqual(result.percentage, 70.0);
  assert.strictEqual(result.isSafe, false);
  assert.strictEqual(result.condonationEligible, true);
  assert.strictEqual(result.statusCategory, 'CONDONATION_ELIGIBLE');
  // ceil((75 * 20 - 100 * 14) / 25) = ceil((1500 - 1400) / 25) = ceil(100 / 25) = 4
  assert.strictEqual(result.classesNeeded, 4, 'Needs 4 consecutive classes to reach 75% (18/24 = 75%)');
  assert.strictEqual(result.bufferClasses, 0);
  console.log('✓ Test 4 Passed: 70% condonation zone needs exactly 4 consecutive classes');
}

// Test 5: Critical Shortage student (5 attended out of 20 held = 25%)
{
  const result = calculateAttendanceMetrics({ attended: 5, totalHeld: 20, threshold: 75 });
  assert.strictEqual(result.percentage, 25.0);
  assert.strictEqual(result.isSafe, false);
  assert.strictEqual(result.condonationEligible, false);
  assert.strictEqual(result.statusCategory, 'CRITICAL_SHORTAGE');
  // ceil((75 * 20 - 100 * 5) / 25) = ceil((1500 - 500) / 25) = ceil(1000 / 25) = 40
  assert.strictEqual(result.classesNeeded, 40, 'Needs 40 consecutive classes to reach 75% (45/60 = 75%)');
  console.log('✓ Test 5 Passed: Critical shortage (25%) calculated correctly');
}

// Test 6: Medical / Official Leave Credits (12 attended + 3 leaves = 15 effective out of 20 held = 75%)
{
  const result = calculateAttendanceMetrics({ attended: 12, totalHeld: 20, approvedLeaves: 3, threshold: 75 });
  assert.strictEqual(result.effectiveAttended, 15);
  assert.strictEqual(result.percentage, 75.0);
  assert.strictEqual(result.isSafe, true);
  console.log('✓ Test 6 Passed: Approved leave credits properly elevate standing');
}

// Test 7: Trajectory projection verification
{
  const result = calculateAttendanceMetrics({ attended: 14, totalHeld: 20, threshold: 75 });
  assert.strictEqual(result.recoveryTrajectory.length, 5);
  // Trajectory step 4 (5 consecutive classes attended): (14+5)/(20+5) = 19/25 = 76.0% -> meets threshold
  const step5 = result.recoveryTrajectory.find(s => s.classesAttendedConsecutively === 5);
  assert.strictEqual(step5.projectedAttendance, 76.0);
  assert.strictEqual(step5.meetsThreshold, true);
  console.log('✓ Test 7 Passed: Multi-step forward trajectory projections verified');
}

console.log('All 7 Attendance Calculator tests passed successfully!\n');
