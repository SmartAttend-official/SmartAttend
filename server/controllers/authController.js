/**
 * SmartAttend — Authentication Controller
 * ==============================================================================
 * Handles authentication, password reset, account lockout, and token generation.
 * ==============================================================================
 */

const bcrypt = require('bcryptjs');
const {
  recordOtpFailure,
  resetOtpFailure,
  MAX_OTP_FAILED_ATTEMPTS
} = require('../services/authService');

/**
 * Handle secure password reset (SEC-1 / CWE-598)
 * Ensures new passwords are transmitted exclusively via POST body.
 */
async function resetPassword(req, res, { supabase, logActivity }) {
  try {
    const { email, otp, newPassword, role } = req.body || {};

    const cleanEmail = (email || '').toString().toLowerCase().trim();
    const cleanOtp   = (otp || '').toString().trim();
    const cleanPass  = (newPassword || '').toString();

    if (!cleanEmail || !cleanOtp || !cleanPass) {
      return res.status(400).json({ status: 'error', message: 'Email, OTP, and new password are required.' });
    }

    if (cleanPass.length < 8) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters long.' });
    }

    const isStudent = (role === 'student');
    let targetTable = 'students';
    let users = [];

    if (isStudent) {
      const { data } = await supabase.from('students').select('*').eq('Email', cleanEmail);
      users = data || [];
    } else {
      const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
      for (const table of deptSheets) {
        const { data } = await supabase.from(table).select('*').eq('Email', cleanEmail);
        if (data && data.length > 0) { targetTable = table; users = data; break; }
      }
    }

    // SEC-5 (Anti-Enumeration): Do NOT reveal whether email exists
    if (users.length === 0) {
      if (logActivity) await logActivity('PASSWORD_RESET_ATTEMPT', `Reset attempted for unregistered email: ${cleanEmail}`);
      return res.status(400).json({ status: 'error', message: 'Invalid or expired verification code.' });
    }

    const user = users[0];

    // OTP match check
    if (!user.OTP || user.OTP.toString().trim() !== cleanOtp) {
      const failures = recordOtpFailure(cleanEmail);
      if (failures >= MAX_OTP_FAILED_ATTEMPTS) {
        await supabase.from(targetTable).update({ OTP: null, OTP_Timestamp: null }).eq('Email', cleanEmail);
        resetOtpFailure(cleanEmail);
        if (logActivity) await logActivity('SECURITY_ALERT', `OTP for ${cleanEmail} permanently invalidated after ${MAX_OTP_FAILED_ATTEMPTS} incorrect attempts.`);
        return res.status(429).json({ status: 'error', message: 'Maximum attempts exceeded. Please request a new verification code.' });
      }
      return res.status(400).json({ status: 'error', message: 'Invalid or expired verification code.' });
    }

    // OTP expiry check
    if (user.OTP_Timestamp) {
      const expiry = new Date(user.OTP_Timestamp).getTime();
      if (Date.now() > expiry) {
        await supabase.from(targetTable).update({ OTP: null, OTP_Timestamp: null }).eq('Email', cleanEmail);
        resetOtpFailure(cleanEmail);
        return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new one.' });
      }
    }

    resetOtpFailure(cleanEmail);

    // Hash the new password with bcrypt
    const hashedPass = await bcrypt.hash(cleanPass, 10);
    await supabase.from(targetTable)
      .update({ Password: hashedPass, OTP: null, OTP_Timestamp: null, ResetStatus: 'USED' })
      .eq('Email', cleanEmail);

    if (logActivity) await logActivity('PASSWORD_RESET', `${isStudent ? 'Student' : 'Professor'} ${cleanEmail} reset password via secure POST endpoint.`);
    return res.json({ status: 'success', message: 'Password updated successfully.' });

  } catch (err) {
    console.error('[authController.resetPassword] Error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error. Please try again.' });
  }
}

module.exports = {
  resetPassword
};
