/**
 * SmartAttend — Centralized HTML Email Template Engine
 * ==============================================================================
 * Standardized, mobile-responsive, and XSS-sanitized HTML email templates
 * for all notification workflows:
 *   1. getOtpEmailTemplate
 *   2. getWelcomeEmailTemplate
 *   3. getAssignmentEmailTemplate
 *   4. getAssignmentRetractionEmailTemplate
 *   5. getStudentAlertTemplate
 *   6. getParentAbsentAlertTemplate
 *   7. getLateAlertTemplate
 *   8. getParentLateAlertTemplate
 *   9. getLeaveSubmittedParentTemplate
 *  10. getLeaveApprovedStudentTemplate
 *  11. getLeaveApprovedParentTemplate
 *  12. getLeaveRejectedStudentTemplate
 * ==============================================================================
 */

// Helper: HTML escaping for secure email templating (Anti-XSS / Injection)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 1. HTML Email Template for OTP (Professor & Student Account Verification)
 */
function getOtpEmailTemplate(otp, name) {
  const safeName = escapeHtml(name || 'User');
  const safeOtp = escapeHtml(otp || '');
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #4f46e5, #3730a3); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">SmartAttend Portal</h1>
        <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.85;">AI-Powered Academic ERP</p>
      </div>
      <div style="padding: 32px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Dear <strong>${safeName}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.5;">We received a request to activate or reset your account password. Please use the following 6-digit One-Time Password (OTP) to complete the process. This code is valid for 10 minutes.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background-color: #f3f4f6; color: #111827; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${safeOtp}
          </div>
        </div>

        <p style="font-size: 13px; color: #ef4444; background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; margin: 24px 0;">
          <strong>Security Warning:</strong> Never share this OTP with anyone, including university administrators or technical support agents.
        </p>

        <p style="font-size: 14px; color: #555555; line-height: 1.5; margin-bottom: 0;">Best regards,<br><strong>SmartAttend Administration System</strong></p>
      </div>
      <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
        This is an automated security transmission. Please do not reply directly to this email.
      </div>
    </div>
  `;
}

/**
 * 2. HTML Email Template for Welcome/New Student (SEC-4: Secure Activation Link)
 */
function getWelcomeEmailTemplate(name, id, activationToken) {
  const safeName = escapeHtml(name);
  const safeId = escapeHtml(id);
  const safeToken = escapeHtml(activationToken || '');
  const baseUrl = process.env.FRONTEND_URL || 'https://smartattend2.netlify.app';
  const setupUrl = `${baseUrl}/html/reset_password.html?token=${encodeURIComponent(safeToken)}&id=${encodeURIComponent(safeId)}`;
  return `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f7f6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; border-top: 4px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: #10b981; margin-bottom: 20px;">Welcome to SmartAttend!</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>Your student account has been successfully created. Your Student ID is <strong>${safeId}</strong>.</p>
      <p>To activate your account and set your own password, click the button below. This activation credential is valid for <strong>48 hours</strong> and can only be used once.</p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p style="margin: 5px 0;"><strong>Student ID:</strong> ${safeId}</p>
        <p style="margin: 5px 0;"><strong>Activation Key / Credential:</strong> ${safeToken}</p>
      </div>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${setupUrl}" style="background:#10b981;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
          Activate Your Account &amp; Set Password
        </a>
      </div>
      <p style="font-size:13px;color:#555;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;word-break:break-all;color:#3b82f6;">${setupUrl}</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">If you did not request this, please contact the administration immediately.</p>
    </div>
  </div>`;
}

/**
 * 3. HTML Email Template for Assignment Upload
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
 * 4. HTML Email Template for Assignment Retraction
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
 * 5. HTML Email Template for Absent Student Alert
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
 * 6. HTML Email Template for Absent Parent Alert
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

/**
 * 7. HTML Email Template for Late Student Alert
 */
function getLateAlertTemplate(studentName, enrollmentNumber, className, attendanceDate, lateMinutes) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
    <h2 style="margin:0;font-size:22px;color:white;">Late Attendance Alert</h2></div>
    <div style="padding:32px;">
    <p style="color:#f8fafc;">Dear <strong>${escapeHtml(studentName)}</strong>,</p>
    <p style="color:#f8fafc;">You arrived <strong style="color:#f59e0b;">${lateMinutes} minutes Late</strong> to:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;color:#f8fafc;">
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;width:40%;">Enrollment No.</td><td style="padding:10px;background:#1e293b;font-weight:600;">${escapeHtml(enrollmentNumber)}</td></tr>
    <tr><td style="padding:10px;background:#0f172a;color:#94a3b8;">Subject</td><td style="padding:10px;background:#0f172a;font-weight:600;">${escapeHtml(className)}</td></tr>
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;">Date</td><td style="padding:10px;background:#1e293b;font-weight:600;">${escapeHtml(attendanceDate)}</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;">Please ensure punctual attendance in future lectures.</p>
    </div>
    <div style="padding:16px 32px;background:#0f172a;color:#475569;font-size:12px;">SmartAttend — Automated Attendance Alert</div></div>`;
}

/**
 * 8. HTML Email Template for Late Parent Alert
 */
function getParentLateAlertTemplate(studentName, className, attendanceDate, lateMinutes) {
  return `<div style="font-family:Arial;padding:25px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;max-width:500px;margin:auto;">
    <h3 style="color:#f59e0b;margin-top:0;">Late Attendance Alert for Parent</h3>
    <p>Dear Parent,</p>
    <p>This is to inform you that your ward, <strong>${escapeHtml(studentName)}</strong>, arrived <strong>${lateMinutes} minutes Late</strong> during the <strong>${escapeHtml(className)}</strong> session on <strong>${escapeHtml(attendanceDate)}</strong>.</p>
    <div style="background:#fff;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #f59e0b;">
    Arrived Late By: <strong>${lateMinutes} minutes</strong><br>Status: Late</div>
    <p style="color:#64748b;font-size:12px;margin-bottom:0;">This is an automated notification from the SmartAttend System.</p></div>`;
}

/**
 * 9. HTML Email Template for Submitted Leave Request (Parent Instant Notification)
 */
function getLeaveSubmittedParentTemplate(studentName, studentId, startDate, endDate, durationDays, professor, reason, leaveType) {
  const periodText = (!endDate || startDate === endDate)
    ? `${escapeHtml(startDate)}`
    : `From ${escapeHtml(startDate)} to ${escapeHtml(endDate)} (${durationDays || 1} Days)`;

  return `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:26px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;max-width:520px;margin:auto;box-shadow:0 4px 18px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:18px 22px;border-radius:8px;margin:-26px -26px 20px -26px;">
      <h3 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">SmartAttend — Official Academic Leave Notice</h3>
      <p style="margin:4px 0 0 0;color:#bfdbfe;font-size:12px;">Student Leave Application Notification</p>
    </div>
    <p style="color:#334155;font-size:14px;margin-top:0;">Dear Parent,</p>
    <p style="color:#475569;font-size:14px;line-height:1.5;">This is to inform you that your ward, <strong>${escapeHtml(studentName)}</strong> (ID: <strong>${escapeHtml(studentId)}</strong>), has formally submitted a <strong>${escapeHtml(leaveType || 'Medical')} Leave</strong> application for academic review.</p>
    <div style="background:#f8fafc;padding:14px 16px;border-radius:8px;margin:16px 0;border-left:4px solid #3b82f6;font-size:13px;line-height:1.6;color:#334155;">
      <div><strong>Student Name:</strong> ${escapeHtml(studentName)} (ID: ${escapeHtml(studentId)})</div>
      <div><strong>Leave Period:</strong> <span style="color:#1d4ed8;font-weight:700;">${periodText}</span></div>
      <div><strong>Total Duration:</strong> <strong>${durationDays || 1} Day${(durationDays || 1) > 1 ? 's' : ''}</strong></div>
      <div><strong>Requested Professor:</strong> ${escapeHtml(professor || 'Course Faculty')}</div>
      <div><strong>Stated Reason:</strong> ${escapeHtml(reason || 'Not specified')}</div>
      <div style="margin-top:6px;"><strong>Status:</strong> <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#b45309;font-weight:700;font-size:11px;">SUBMITTED — PENDING REVIEW</span></div>
    </div>
    <p style="color:#64748b;font-size:12px;line-height:1.4;">During this leave period, attendance alerts are withheld pending faculty review. You will receive an automated confirmation as soon as the professor approves or updates this request.</p>
    <p style="color:#94a3b8;font-size:11px;margin-bottom:0;border-top:1px solid #f1f5f9;padding-top:10px;">SmartAttend Academic Attendance & Leave Management Subsystem</p>
  </div>`;
}

/**
 * 10. HTML Email Template for Approved Medical Leave (Student)
 */
function getLeaveApprovedStudentTemplate(studentName, studentId, leavePeriodStr, professor, reason, durationDays) {
  const durationLabel = (durationDays && durationDays > 1) ? ` (${durationDays} Days)` : '';
  return `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:26px 30px;text-align:left;">
      <h2 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">Medical Leave Approved</h2>
      <p style="margin:6px 0 0 0;color:#d1fae5;font-size:13px;">SmartAttend Academic Leave Management</p>
    </div>
    <div style="padding:28px 30px;">
      <p style="color:#f8fafc;font-size:15px;margin-top:0;">Dear <strong>${escapeHtml(studentName)}</strong>,</p>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.5;">Your medical leave request has been reviewed and <strong style="color:#10b981;">Approved</strong> by your professor.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 14px;background:#1e293b;color:#94a3b8;width:38%;">Student</td><td style="padding:10px 14px;background:#1e293b;color:#f8fafc;font-weight:600;">${escapeHtml(studentName)} (${escapeHtml(studentId)})</td></tr>
        <tr><td style="padding:10px 14px;background:#0f172a;color:#94a3b8;">Leave Period</td><td style="padding:10px 14px;background:#0f172a;color:#f8fafc;font-weight:600;">${escapeHtml(leavePeriodStr)}${durationLabel}</td></tr>
        <tr><td style="padding:10px 14px;background:#1e293b;color:#94a3b8;">Reviewed By</td><td style="padding:10px 14px;background:#1e293b;color:#f8fafc;font-weight:600;">${escapeHtml(professor)}</td></tr>
        <tr><td style="padding:10px 14px;background:#0f172a;color:#94a3b8;">Stated Reason</td><td style="padding:10px 14px;background:#0f172a;color:#cbd5e1;">${escapeHtml(reason)}</td></tr>
        <tr><td style="padding:10px 14px;background:#1e293b;color:#94a3b8;">Status</td><td style="padding:10px 14px;background:#1e293b;color:#10b981;font-weight:700;">APPROVED</td></tr>
      </table>
      <div style="background:rgba(16,185,129,0.1);border-left:4px solid #10b981;padding:12px 14px;border-radius:4px;color:#a7f3d0;font-size:13px;line-height:1.4;">
        Your attendance record will reflect this approved medical leave. We hope you have recovered well.
      </div>
    </div>
    <div style="padding:14px 30px;background:#0f172a;color:#64748b;font-size:12px;border-top:1px solid #1e293b;">
      SmartAttend — Automated Academic Notification
    </div>
  </div>`;
}

/**
 * 11. HTML Email Template for Approved Medical Leave (Parent)
 */
function getLeaveApprovedParentTemplate(studentName, studentId, leavePeriodStr, professor, reason, durationDays) {
  const durationLabel = (durationDays && durationDays > 1) ? ` (${durationDays} Days)` : '';
  return `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:26px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;max-width:520px;margin:auto;box-shadow:0 4px 18px rgba(0,0,0,0.05);">
    <h3 style="color:#059669;margin-top:0;font-size:19px;font-weight:700;">Medical Leave Approved — Parent Notification</h3>
    <p style="color:#334155;font-size:14px;">Dear Parent,</p>
    <p style="color:#475569;font-size:14px;line-height:1.5;">This is to inform you that the medical leave request submitted for your ward, <strong>${escapeHtml(studentName)}</strong>, has been reviewed and <strong style="color:#059669;">Approved</strong>.</p>
    <div style="background:#f8fafc;padding:14px 16px;border-radius:8px;margin:16px 0;border-left:4px solid #10b981;font-size:13px;line-height:1.6;color:#334155;">
      <div><strong>Student Name:</strong> ${escapeHtml(studentName)} (ID: ${escapeHtml(studentId)})</div>
      <div><strong>Leave Period:</strong> <strong>${escapeHtml(leavePeriodStr)}${durationLabel}</strong></div>
      <div><strong>Status:</strong> <span style="color:#059669;font-weight:700;">Approved</span></div>
      <div><strong>Approved By:</strong> ${escapeHtml(professor)}</div>
      <div><strong>Reason:</strong> ${escapeHtml(reason)}</div>
    </div>
    <div style="background:rgba(16,185,129,0.1);padding:10px 12px;border-radius:6px;color:#065f46;font-size:12px;margin:12px 0;">
      Attendance records for lectures occurring within this leave window will be recorded as Authorized Leave.
    </div>
    <p style="color:#64748b;font-size:12px;margin-bottom:0;">This is an official automated notification from the SmartAttend Academic System.</p>
  </div>`;
}

/**
 * 12. HTML Email Template for Rejected Medical Leave (Student Only)
 */
function getLeaveRejectedStudentTemplate(studentName, studentId, leavePeriodStr, professor, reason, durationDays) {
  const durationLabel = (durationDays && durationDays > 1) ? ` (${durationDays} Days)` : '';
  return `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:26px 30px;text-align:left;">
      <h2 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">Medical Leave Request Update</h2>
      <p style="margin:6px 0 0 0;color:#fee2e2;font-size:13px;">SmartAttend Academic Leave Management</p>
    </div>
    <div style="padding:28px 30px;">
      <p style="color:#f8fafc;font-size:15px;margin-top:0;">Dear <strong>${escapeHtml(studentName)}</strong>,</p>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.5;">Your medical leave request has been reviewed and <strong style="color:#ef4444;">Rejected</strong> by your professor.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 14px;background:#1e293b;color:#94a3b8;width:38%;">Student</td><td style="padding:10px 14px;background:#1e293b;color:#f8fafc;font-weight:600;">${escapeHtml(studentName)} (${escapeHtml(studentId)})</td></tr>
        <tr><td style="padding:10px 14px;background:#0f172a;color:#94a3b8;">Leave Period</td><td style="padding:10px 14px;background:#0f172a;color:#f8fafc;font-weight:600;">${escapeHtml(leavePeriodStr)}${durationLabel}</td></tr>
        <tr><td style="padding:10px 14px;background:#1e293b;color:#94a3b8;">Reviewed By</td><td style="padding:10px 14px;background:#1e293b;color:#f8fafc;font-weight:600;">${escapeHtml(professor)}</td></tr>
        <tr><td style="padding:10px 14px;background:#0f172a;color:#94a3b8;">Stated Reason</td><td style="padding:10px 14px;background:#0f172a;color:#cbd5e1;">${escapeHtml(reason)}</td></tr>
        <tr><td style="padding:10px 14px;background:#1e293b;color:#94a3b8;">Status</td><td style="padding:10px 14px;background:#1e293b;color:#ef4444;font-weight:700;">REJECTED</td></tr>
      </table>
      <div style="background:rgba(239,68,68,0.1);border-left:4px solid #ef4444;padding:12px 14px;border-radius:4px;color:#fca5a5;font-size:13px;line-height:1.4;">
        If you have questions or require further clarification, please contact your professor or department administration directly.
      </div>
    </div>
    <div style="padding:14px 30px;background:#0f172a;color:#64748b;font-size:12px;border-top:1px solid #1e293b;">
      SmartAttend — Automated Academic Notification
    </div>
  </div>`;
}

module.exports = {
  escapeHtml,
  getOtpEmailTemplate,
  getWelcomeEmailTemplate,
  getAssignmentEmailTemplate,
  getAssignmentRetractionEmailTemplate,
  getStudentAlertTemplate,
  getParentAbsentAlertTemplate,
  getLateAlertTemplate,
  getParentLateAlertTemplate,
  getLeaveSubmittedParentTemplate,
  getLeaveApprovedStudentTemplate,
  getLeaveApprovedParentTemplate,
  getLeaveRejectedStudentTemplate
};
