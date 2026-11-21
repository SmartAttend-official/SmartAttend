/**
 * SmartAttend - Email Notification Service & Template Engine
 * Handles generation of standardized, mobile-responsive, anti-XSS email templates.
 */

const { escapeHtml } = require('../utils/validators');

/**
 * HTML Email Template for Welcome/New Student
 */
function getWelcomeEmailTemplate(name, id, password) {
  const safeName = escapeHtml(name);
  const safeId = escapeHtml(id);
  const safePassword = escapeHtml(password);
  return `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f7f6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; border-top: 4px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: #10b981; margin-bottom: 20px;">Welcome to SmartAttend!</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>Your student account has been successfully created. You can now log into the SmartAttend portal using the credentials below:</p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p style="margin: 5px 0;"><strong>Student ID:</strong> ${safeId}</p>
        <p style="margin: 5px 0;"><strong>Password:</strong> ${safePassword}</p>
      </div>
      <p>Please log in and ensure your information is up to date.</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">If you did not request this, please contact the administration.</p>
    </div>
  </div>`;
}

/**
 * HTML Email Template for Assignment Upload
 */
function getAssignmentEmailTemplate(title, description, subject, profEmail, fileUrl, fileName, dueDate) {
  let actionBtn = '';
  if (fileUrl) {
    actionBtn = `<div style="margin:24px 0;text-align:center;">
      <a href="${escapeHtml(fileUrl)}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;box-shadow:0 4px 6px rgba(59,130,246,0.2);">Download/View Attachment</a>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px;">File: ${escapeHtml(fileName || 'Attachment')}</div>
      </div>`;
  }
  
  let dueDateHtml = '';
  if (dueDate) {
    let formattedDueDate = escapeHtml(dueDate);
    try {
      if (dueDate.includes('-')) {
        const parts = dueDate.split('-');
        if (parts.length === 3) {
          formattedDueDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    } catch(e) {}
    dueDateHtml = `<div style="margin:16px 0;padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;text-align:center;font-weight:bold;color:#fbbf24;font-size:15px;">
      📅 Due Date: ${formattedDueDate}
      </div>`;
  }
  
  return `<div style="font-family:'Outfit',sans-serif,Arial;max-width:550px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:30px;text-align:center;">
    <h2 style="margin:0;font-size:22px;color:white;font-weight:600;">New Assignment Assigned</h2>
    <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Subject: ${escapeHtml(subject)}</div></div>
    <div style="padding:30px;">
    <h3 style="margin-top:0;font-size:18px;color:#60a5fa;">${escapeHtml(title)}</h3>
    <p style="color:#e2e8f0;line-height:1.6;white-space:pre-line;">${escapeHtml(description)}</p>
    ${dueDateHtml}
    ${actionBtn}
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;margin-top:20px;font-size:13px;color:#94a3b8;">
    Assigned by: <strong>${escapeHtml(profEmail)}</strong><br>
    System: SmartAttend Portal
    </div></div></div>`;
}

/**
 * HTML Email Template for Assignment Retraction
 */
function getAssignmentRetractionEmailTemplate(title, subject, profEmail) {
  return `<div style="font-family:'Outfit',sans-serif,Arial;max-width:550px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid rgba(239,68,68,0.2);">
    <div style="background:linear-gradient(135deg,#ef4444,#0f172a);padding:30px;text-align:center;">
    <h2 style="margin:0;font-size:22px;color:white;font-weight:600;">Assignment Retracted</h2>
    <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Subject: ${escapeHtml(subject)}</div></div>
    <div style="padding:30px;">
    <h3 style="margin-top:0;font-size:18px;color:#ef4444;">Retracted: ${escapeHtml(title)}</h3>
    <p style="color:#e2e8f0;line-height:1.6;">This assignment has been retracted or cancelled by the professor. You are no longer required to submit this assignment.</p>
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;margin-top:20px;font-size:13px;color:#94a3b8;">
    Retracted by: <strong>${escapeHtml(profEmail)}</strong><br>
    System: SmartAttend Portal
    </div></div></div>`;
}

/**
 * HTML Email Template for Absent Student Alert
 */
function getStudentAlertTemplate(name, subject, date, pct, attended, total) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:28px 32px;">
    <h2 style="margin:0;font-size:22px;color:white;">Attendance Alert</h2></div>
    <div style="padding:32px;">
    <p style="color:#f8fafc;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#f8fafc;">You were marked <strong style="color:#ef4444;">Absent</strong> in:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;color:#f8fafc;">
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;width:40%;">Subject</td><td style="padding:10px;background:#1e293b;font-weight:600;">${escapeHtml(subject)}</td></tr>
    <tr><td style="padding:10px;background:#0f172a;color:#94a3b8;">Date</td><td style="padding:10px;background:#0f172a;font-weight:600;">${escapeHtml(date)}</td></tr>
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;">Attendance</td><td style="padding:10px;background:#1e293b;font-weight:600;color:#f59e0b;">${pct}% (${attended}/${total} classes)</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;">Please maintain regular attendance to avoid academic issues.</p>
    </div>
    <div style="padding:16px 32px;background:#0f172a;color:#475569;font-size:12px;">SmartAttend — Automated Attendance Alert</div></div>`;
}

/**
 * HTML Email Template for Absent Parent Alert
 */
function getParentAbsentAlertTemplate(studentName, subjectName, classDate, pct) {
  return `<div style="font-family:Arial;padding:25px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;max-width:500px;margin:auto;">
    <h3 style="color:#ef4444;margin-top:0;">Attendance Alert for Parent</h3>
    <p>Dear Parent,</p>
    <p>This is to inform you that your ward, <strong>${escapeHtml(studentName)}</strong>, was marked <strong>Absent</strong> during the <strong>${escapeHtml(subjectName)}</strong> session on <strong>${escapeHtml(classDate)}</strong>.</p>
    <div style="background:#fff;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #ef4444;">
    Current Attendance: <strong>${pct}%</strong><br>Status: Absent</div>
    <p style="color:#64748b;font-size:12px;margin-bottom:0;">This is an automated notification from the SmartAttend System.</p></div>`;
}

module.exports = {
  getWelcomeEmailTemplate,
  getAssignmentEmailTemplate,
  getAssignmentRetractionEmailTemplate,
  getStudentAlertTemplate,
  getParentAbsentAlertTemplate
};
