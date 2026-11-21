/**
 * SmartAttend - Sanitized Request Logging Middleware
 * OWASP A09:2021 - Security Logging and Monitoring Failures
 * Prevents sensitive credential leakage (passwords, OTPs, biometric vectors, tokens) in server logs.
 */

const SENSITIVE_FIELDS = [
  'password',
  'Password',
  'otp',
  'OTP',
  'encoding',
  'Face_Encoding',
  'face_encoding',
  'token',
  'Token',
  'authorization',
  'Authorization'
];

function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = Array.isArray(body) ? [...body] : { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in clone) {
      clone[field] = '[REDACTED]';
    }
  }
  return clone;
}

function requestLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);

  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    const safeBody = sanitizeRequestBody(req.body);
    console.log('Body (sanitized):', JSON.stringify(safeBody).substring(0, 500));
  }

  next();
}

module.exports = {
  requestLogger,
  sanitizeRequestBody,
  SENSITIVE_FIELDS
};
