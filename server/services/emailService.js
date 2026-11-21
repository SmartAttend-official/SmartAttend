/**
 * SmartAttend - Email Notification Service & Template Engine
 * Handles generation of standardized, mobile-responsive, anti-XSS email templates.
 */

const emailTemplates = require('../templates/emailTemplates');

module.exports = {
  ...emailTemplates
};
