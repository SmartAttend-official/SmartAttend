/**
 * SmartAttend — Attendance Routes Module
 * ==============================================================================
 * Route definitions for attendance metrics and session management.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { calculateAttendanceMetrics } = require('../attendanceCalculator');

/**
 * Factory function creating configured attendance router
 * @param {object} dependencies - { supabase, logActivity, _savingSessionLocks }
 * @returns {express.Router}
 */
function createAttendanceRoutes({ supabase, logActivity, _savingSessionLocks }) {
  // GET /api/attendance/metrics - programmatic metric calculation endpoint
  router.get('/metrics', (req, res) => {
    const attended = parseInt(req.query.attended) || 0;
    const totalHeld = parseInt(req.query.totalHeld) || 0;
    const approvedLeaves = parseInt(req.query.approvedLeaves) || 0;
    const threshold = parseFloat(req.query.threshold) || 75;

    const metrics = calculateAttendanceMetrics({ attended, totalHeld, approvedLeaves, threshold });
    return res.json({ status: 'success', metrics });
  });

  return router;
}

module.exports = createAttendanceRoutes;
