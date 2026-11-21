/**
 * SmartAttend — Authentication Routes Module
 * ==============================================================================
 * Route definitions for authentication and password management endpoints.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * Factory function creating configured auth router
 * @param {object} dependencies - { supabase, logActivity }
 * @returns {express.Router}
 */
function createAuthRoutes({ supabase, logActivity }) {
  // POST /api/reset-password
  router.post('/reset-password', async (req, res) => {
    return authController.resetPassword(req, res, { supabase, logActivity });
  });

  return router;
}

module.exports = createAuthRoutes;
