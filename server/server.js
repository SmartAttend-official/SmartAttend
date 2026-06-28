const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse any incoming body as text first to handle no-cors content-types securely
app.use(express.text({ limit: '50mb', type: '*/*' }));
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // If it's not valid JSON, leave it as a string
    }
  }
  next();
});
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.method === 'POST') {
    console.log('Body:', req.body);
  }
  next();
});

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env file!");
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder');

const JWT_SECRET = process.env.JWT_SECRET || '55ebcfc623910c59dd6c32145391bd76abf8c05763137976e106d9d1c9ef25bf';

// JWT Token Authentication Middleware
function authenticateToken(req, res, next) {
  // Allow login, send OTP, verify OTP, and root health check routes to bypass authentication
  const action = req.query.action || (req.body && req.body.action);
  const sheet = req.query.sheet || (req.body && req.body.sheet);
  
  if (action === 'login' || action === 'send_otp' || action === 'verify_otp' || (!action && !sheet)) {
    return next();
  }

  // Also allow verify_lab_code (students scanning a QR code don't have to be logged in to mark attendance,
  // or they might be logged in, so we make authentication optional/lenient for mark_attendance)
  if (action === 'verify_lab_code') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Session Expired: Please log in again.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ status: 'error', message: 'Session Expired: Please log in again.' });
    }
    req.user = decoded;
    next();
  });
}

// Initialize Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper: Log activities in AuditLogs table
async function logActivity(action, details) {
  try {
    await supabase.from('AuditLogs').insert([{ Action: action, Details: details }]);
  } catch (e) {
    console.error('Logging activity failed:', e.message);
  }
}

// Helper: Format Student for frontend compatibility
function formatStudent(row) {
  if (!row) return null;
  const clone = { ...row };
  delete clone.Password;
  delete clone.password;
  return {
    ...clone,
    'id': row.ID,
    'Student ID': row.ID,
  };
}

// Helper: Format Professor for frontend compatibility
function formatProfessor(row) {
  if (!row) return null;
  const clone = { ...row };
  delete clone.Password;
  delete clone.password;
  const firstName = row['Professor  first_name'] || row['Professor first_name'] || '';
  const lastName = row['Professor  last_name'] || row['Professor last_name'] || '';
  return {
    ...clone,
    'id': row['Professor id'],
    'Professor id': row['Professor id'],
    'Name': `${firstName} ${lastName}`.trim() || 'Professor',
    'Professor first_name': firstName,
    'Professor last_name': lastName,
    'Professor  first_name': firstName,
    'Professor  last_name': lastName,
    'OTP_Timestamp': row.OTP_Timestamp ? new Date(row.OTP_Timestamp).getTime() : null,
  };
}

// Helper: Format Admin for frontend compatibility
function formatAdmin(row) {
  if (!row) return null;
  const clone = { ...row };
  delete clone.Password;
  delete clone.password;
  return {
    ...clone,
    'id': row.Admin_id,
    'ID': row.Admin_id,
    'Name': `${row.First_name || ''} ${row.Last_name || ''}`.trim() || 'Admin User',
  };
}

// Helper: Helper to resolve which table a professor belongs to based on department
function getProfessorTable(dept) {
  const d = (dept || '').toString().toLowerCase().trim();
  if (d.includes('mca') || d.includes('master of computer')) return 'MCA';
  if (d.includes('bba') || d.includes('bachelor of business') || d.includes('business administration')) return 'BBA';
  if (d.includes('mba') || d.includes('master of business') || d.includes('masters of business')) return 'MBA';
  return 'BCA'; // Default fallback
}

// Helper: Robust department matching mimicking Apps Script
function isDeptMatch(recordDept, queryDept, depts = []) {
  if (!recordDept || !queryDept) return false;
  const rDept = recordDept.toString().toLowerCase().trim();
  const qDept = queryDept.toString().toLowerCase().trim();

  if (rDept === qDept) return true;

  // Check the known departments from database
  for (const d of depts) {
    const dCode = (d.Code || '').toLowerCase().trim();
    const dName = (d.Name || '').toLowerCase().trim();

    if (dCode === qDept || dName === qDept) {
      if (dCode === rDept || dName === rDept) return true;
    }
  }

  // Basic fallbacks
  const maps = {
    "bca": "bachelor of computer application",
    "bba": "bachelor of business administration",
    "mca": "master of computer application",
    "mba": "master of business administration"
  };
  if (maps[rDept] === qDept || maps[qDept] === rDept) return true;

  // Fuzzy containment fallbacks
  if (rDept.includes(qDept) || qDept.includes(rDept)) return true;

  return false;
}

// HTML Email Template for OTP
function getOtpEmailTemplate(otp, name) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #4f46e5, #3730a3); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">SmartAttend Portal</h1>
        <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.85;">AI-Powered Academic ERP</p>
      </div>
      <div style="padding: 32px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Dear <strong>${name}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.5;">We received a request to activate or reset your account password. Please use the following 6-digit One-Time Password (OTP) to complete the process. This code is valid for 10 minutes.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background-color: #f3f4f6; color: #111827; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${otp}
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

// HTML Email Template for Assignment Upload
function getAssignmentEmailTemplate(title, description, subject, profEmail, fileUrl, fileName, dueDate) {
  let actionBtn = '';
  if (fileUrl) {
    actionBtn = `<div style="margin:24px 0;text-align:center;">
      <a href="${fileUrl}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;box-shadow:0 4px 6px rgba(59,130,246,0.2);">Download/View Attachment</a>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px;">File: ${fileName}</div>
      </div>`;
  }
  
  let dueDateHtml = '';
  if (dueDate) {
    let formattedDueDate = dueDate;
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
    <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Subject: ${subject}</div></div>
    <div style="padding:30px;">
    <h3 style="margin-top:0;font-size:18px;color:#60a5fa;">${title}</h3>
    <p style="color:#e2e8f0;line-height:1.6;white-space:pre-line;">${description}</p>
    ${dueDateHtml}
    ${actionBtn}
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;margin-top:20px;font-size:13px;color:#94a3b8;">
    Assigned by: <strong>${profEmail}</strong><br>
    System: SmartAttend Portal
    </div></div></div>`;
}

// HTML Email Template for Assignment Retraction
function getAssignmentRetractionEmailTemplate(title, subject, profEmail) {
  return `<div style="font-family:'Outfit',sans-serif,Arial;max-width:550px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid rgba(239,68,68,0.2);">
    <div style="background:linear-gradient(135deg,#ef4444,#0f172a);padding:30px;text-align:center;">
    <h2 style="margin:0;font-size:22px;color:white;font-weight:600;">Assignment Retracted</h2>
    <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Subject: ${subject}</div></div>
    <div style="padding:30px;">
    <h3 style="margin-top:0;font-size:18px;color:#ef4444;">Retracted: ${title}</h3>
    <p style="color:#e2e8f0;line-height:1.6;">This assignment has been retracted or cancelled by the professor. You are no longer required to submit this assignment.</p>
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;margin-top:20px;font-size:13px;color:#94a3b8;">
    Retracted by: <strong>${profEmail}</strong><br>
    System: SmartAttend Portal
    </div></div></div>`;
}

// HTML Email Template for Absent Student Alert
function getStudentAlertTemplate(name, subject, date, pct, attended, total) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:28px 32px;">
    <h2 style="margin:0;font-size:22px;color:white;">Attendance Alert</h2></div>
    <div style="padding:32px;">
    <p style="color:#f8fafc;">Dear <strong>${name}</strong>,</p>
    <p style="color:#f8fafc;">You were marked <strong style="color:#ef4444;">Absent</strong> in:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;color:#f8fafc;">
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;width:40%;">Subject</td><td style="padding:10px;background:#1e293b;font-weight:600;">${subject}</td></tr>
    <tr><td style="padding:10px;background:#0f172a;color:#94a3b8;">Date</td><td style="padding:10px;background:#0f172a;font-weight:600;">${date}</td></tr>
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;">Attendance</td><td style="padding:10px;background:#1e293b;font-weight:600;color:#f59e0b;">${pct}% (${attended}/${total} classes)</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;">Please maintain regular attendance to avoid academic issues.</p>
    </div>
    <div style="padding:16px 32px;background:#0f172a;color:#475569;font-size:12px;">SmartAttend — Automated Attendance Alert</div></div>`;
}

// HTML Email Template for Absent Parent Alert
function getParentAbsentAlertTemplate(studentName, subjectName, classDate, pct) {
  return `<div style="font-family:Arial;padding:25px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;max-width:500px;margin:auto;">
    <h3 style="color:#ef4444;margin-top:0;">Attendance Alert for Parent</h3>
    <p>Dear Parent,</p>
    <p>This is to inform you that your ward, <strong>${studentName}</strong>, was marked <strong>Absent</strong> during the <strong>${subjectName}</strong> session on <strong>${classDate}</strong>.</p>
    <div style="background:#fff;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #ef4444;">
    Current Attendance: <strong>${pct}%</strong><br>Status: Absent</div>
    <p style="color:#64748b;font-size:12px;margin-bottom:0;">This is an automated notification from the SmartAttend System.</p></div>`;
}

// HTML Email Template for Late Student Alert
function getLateAlertTemplate(studentName, enrollmentNumber, className, attendanceDate, lateMinutes) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0b1120;color:#f8fafc;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
    <h2 style="margin:0;font-size:22px;color:white;">Late Attendance Alert</h2></div>
    <div style="padding:32px;">
    <p style="color:#f8fafc;">Dear <strong>${studentName}</strong>,</p>
    <p style="color:#f8fafc;">You arrived <strong style="color:#f59e0b;">${lateMinutes} minutes Late</strong> to:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;color:#f8fafc;">
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;width:40%;">Enrollment No.</td><td style="padding:10px;background:#1e293b;font-weight:600;">${enrollmentNumber}</td></tr>
    <tr><td style="padding:10px;background:#0f172a;color:#94a3b8;">Subject</td><td style="padding:10px;background:#0f172a;font-weight:600;">${className}</td></tr>
    <tr><td style="padding:10px;background:#1e293b;color:#94a3b8;">Date</td><td style="padding:10px;background:#1e293b;font-weight:600;">${attendanceDate}</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;">Please ensure punctual attendance in future lectures.</p>
    </div>
    <div style="padding:16px 32px;background:#0f172a;color:#475569;font-size:12px;">SmartAttend — Automated Attendance Alert</div></div>`;
}

// HTML Email Template for Late Parent Alert
function getParentLateAlertTemplate(studentName, className, attendanceDate, lateMinutes) {
  return `<div style="font-family:Arial;padding:25px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;max-width:500px;margin:auto;">
    <h3 style="color:#f59e0b;margin-top:0;">Late Attendance Alert for Parent</h3>
    <p>Dear Parent,</p>
    <p>This is to inform you that your ward, <strong>${studentName}</strong>, arrived <strong>${lateMinutes} minutes Late</strong> during the <strong>${className}</strong> session on <strong>${attendanceDate}</strong>.</p>
    <div style="background:#fff;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #f59e0b;">
    Arrived Late By: <strong>${lateMinutes} minutes</strong><br>Status: Late</div>
    <p style="color:#64748b;font-size:12px;margin-bottom:0;">This is an automated notification from the SmartAttend System.</p></div>`;
}

// ==========================================
// 1. DYNAMIC FILE SERVICE ROUTE (GET)
// ==========================================
app.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('StudentAssignments')
      .select('AttachmentName, FileContent')
      .eq('ID', id)
      .single();

    if (error || !data || !data.FileContent) {
      return res.status(404).send('File not found');
    }

    const base64Data = data.FileContent;
    const mimeType = base64Data.split(';')[0].split(':')[1];
    const base64Str = base64Data.split(',')[1];
    const fileBuffer = Buffer.from(base64Str, 'base64');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${data.AttachmentName}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('File serving error:', err);
    return res.status(500).send('Error retrieving file');
  }
});

// Dynamic Timetable file route
app.get('/timetables/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('Timetables')
      .select('Department, Semester, FileContent')
      .eq('FileID', id)
      .single();

    if (error || !data || !data.FileContent) {
      return res.status(404).send('Timetable not found');
    }

    const base64Data = data.FileContent;
    const mimeType = base64Data.split(';')[0].split(':')[1];
    const base64Str = base64Data.split(',')[1];
    const fileBuffer = Buffer.from(base64Str, 'base64');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${data.Department}_${data.Semester}_Timetable.pdf"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('Timetable serving error:', err);
    return res.status(500).send('Error retrieving timetable file');
  }
});

// ==========================================
// 2. GET ROUTE (Replicates doGet)
// ==========================================
app.get('/', authenticateToken, async (req, res) => {
  try {
    const { action, sheet, email, studentId, department, semester, dept, sem, token, newPassword } = req.query;

    // Health Check Ping for Render
    if (!action && !sheet && Object.keys(req.query).length === 0) {
      return res.json({ status: 'ok', message: 'SmartAttend Server is running.' });
    }

    // ── ACTIVE CODE SCANS FOR LIVE GRID ──
    if (sheet === 'active_code_scans') {
      const code = req.query.code;
      if (!code) return res.json([]);
      const { data, error } = await supabase
        .from('Lab_Access_Logs')
        .select('StudentID')
        .eq('Code', code.toString().trim());

      if (error) throw error;
      const scannedArr = (data || []).map(r => r.StudentID);
      return res.json(scannedArr);
    }

    // ── A. TIMETABLE ACTIONS ──
    if (action === 'get_timetable') {
      const qDept = (department || dept || '').toString().trim();
      const qSem = (semester || sem || '').toString().trim();

      const { data, error } = await supabase.from('Timetables').select('*');
      if (error) throw error;

      // Fetch departments first to translate code/names if needed
      const { data: depts } = await supabase.from('Departments').select('*');

      // Fuzzy matching to mirror the original Apps Script logic
      const timetable = data.find(r => {
        const rDept = (r.Department || '').toString().trim();
        const rSem = (r.Semester || '').toLowerCase().trim();
        
        const deptMatch = isDeptMatch(rDept, qDept, depts || []);
        const semMatch = (rSem === qSem.toLowerCase()) || (rSem.replace(/[^0-9]/g, '') === qSem.replace(/[^0-9]/g, ''));
        return deptMatch && semMatch;
      });

      if (timetable) {
        return res.json({ status: 'success', data: timetable });
      } else {
        return res.json({ status: 'error', message: 'No timetable found for this course.' });
      }
    }

    if (action === 'get_all_timetables') {
      const { data, error } = await supabase.from('Timetables').select('*');
      if (error) throw error;
      return res.json({ status: 'success', data: data });
    }

    // ── B. OTP / RESET ACTIONS ──
    if (action === 'send_otp') {
      // Find which department sheet has this professor's email
      const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
      let targetTable = null;
      let targetProf = null;

      for (const table of deptSheets) {
        const { data, error } = await supabase.from(table).select('*').eq('Email', email);
        if (!error && data && data.length > 0) {
          targetTable = table;
          targetProf = data[0];
          break;
        }
      }

      if (!targetProf) {
        return res.json({ status: 'error', message: 'Email not found in our system.' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins validity

      const { error: updateErr } = await supabase
        .from(targetTable)
        .update({ OTP: otp, OTP_Timestamp: expiry })
        .eq('Email', email);

      if (updateErr) throw updateErr;

      const profName = targetProf['Professor  first_name'] || targetProf['Professor first_name'] || 'Professor';

      // Send Email
      await transporter.sendMail({
        from: `SmartAttend <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'SmartAttend — Your Password Reset OTP',
        html: getOtpEmailTemplate(otp, profName),
      });

      return res.json({ status: 'success', message: 'OTP sent to your email.' });
    }

    if (action === 'send_admin_otps') {
      const emailList = (req.query.emails || "").split(',');
      
      for (const targetEmail of emailList) {
        const trimmedEmail = targetEmail.trim();
        if (!trimmedEmail) continue;

        const { data: students, error: stdErr } = await supabase
          .from('students')
          .select('*')
          .eq('Email', trimmedEmail);

        if (stdErr || !students || students.length === 0) continue;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await supabase
          .from('students')
          .update({ OTP: otp, OTP_Timestamp: expiry, ResetStatus: 'PENDING' })
          .eq('Email', trimmedEmail);

        const studentName = students[0].Name || 'Student';

        try {
          await transporter.sendMail({
            from: `SmartAttend <${process.env.SMTP_USER}>`,
            to: trimmedEmail,
            subject: 'SmartAttend — Your Password Reset OTP',
            html: getOtpEmailTemplate(otp, studentName),
          });
        } catch (mailErr) {
          console.error("Mail Send Error:", mailErr);
        }
      }

      await logActivity('OTP_DISPATCH', `Sent Recovery OTPs to ${emailList.length} students`);
      return res.json({ status: 'success', message: 'OTPs processed.' });
    }

    if (action === 'verify_student_email') {
      const { data, error } = await supabase
        .from('students')
        .select('ID')
        .eq('Email', email);

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.json({ status: 'error', message: 'This email is not registered in the student database.' });
      }

      return res.json({ status: 'success', message: 'Email verified.' });
    }

    if (action === 'verify_otp') {
      const isStudent = (req.query.sheet === 'student');
      let targetTable = 'students';
      let users = [];

      if (isStudent) {
        const { data } = await supabase.from('students').select('*').eq('Email', email);
        users = data || [];
      } else {
        // Professor check
        const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
        for (const table of deptSheets) {
          const { data } = await supabase.from(table).select('*').eq('Email', email);
          if (data && data.length > 0) {
            targetTable = table;
            users = data;
            break;
          }
        }
      }

      if (users.length === 0) {
        return res.json({ status: 'error', message: 'This email is not registered in our system.' });
      }

      const user = users[0];
      const inputOtp = req.query.otp;

      if (!user.OTP || user.OTP.toString().trim() !== inputOtp.toString().trim()) {
        return res.json({ status: 'error', message: 'Invalid or expired OTP.' });
      }

      if (user.OTP_Timestamp) {
        const expiry = new Date(user.OTP_Timestamp).getTime();
        if (Date.now() > expiry) {
          await supabase.from(targetTable).update({ OTP: null, OTP_Timestamp: null }).eq('Email', email);
          return res.json({ status: 'error', message: 'OTP has expired. Please request a new one.' });
        }
      }

      // Update password
      await supabase
        .from(targetTable)
        .update({ Password: newPassword, OTP: null, OTP_Timestamp: null, ResetStatus: 'USED' })
        .eq('Email', email);

      await logActivity('PASSWORD_RESET', `${isStudent ? 'Student' : 'Professor'} ${email} updated password successfully`);
      return res.json({ status: 'success', message: 'Password updated successfully.' });
    }

    if (action === 'verify_otp_only') {
      const isStudent = (req.query.sheet === 'student');
      let users = [];

      if (isStudent) {
        const { data } = await supabase.from('students').select('*').eq('Email', email);
        users = data || [];
      } else {
        // Professor check
        const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
        for (const table of deptSheets) {
          const { data } = await supabase.from(table).select('*').eq('Email', email);
          if (data && data.length > 0) {
            users = data;
            break;
          }
        }
      }

      if (users.length === 0) {
        return res.json({ status: 'error', message: 'User not found.' });
      }

      const user = users[0];
      const inputOtp = req.query.otp;

      if (!user.OTP || user.OTP.toString().trim() !== inputOtp.toString().trim()) {
        return res.json({ status: 'error', message: 'Invalid or expired OTP.' });
      }

      if (user.OTP_Timestamp) {
        const expiry = new Date(user.OTP_Timestamp).getTime();
        if (Date.now() > expiry) {
          return res.json({ status: 'error', message: 'OTP has expired.' });
        }
      }

      return res.json({ status: 'success', message: 'OTP verified.' });
    }

    // ── C. DIRECT SHEET FETCHING ROUTING ──
    if (sheet === 'professor') {
      const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
      let allProfs = [];

      for (const table of deptSheets) {
        let query = supabase.from(table).select('*');
        if (email) query = query.eq('Email', email);
        
        const { data, error } = await query;
        if (!error && data) {
          allProfs = allProfs.concat(data.map(formatProfessor));
        }
      }
      return res.json(allProfs);
    }

    if (sheet === 'admin') {
      let query = supabase.from('ADMIN').select('*');
      if (email) query = query.eq('Email', email);

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data.map(formatAdmin));
    }

    if (sheet === 'student') {
      let query = supabase.from('students').select('*');
      if (email) query = query.eq('Email', email);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch departments first to translate code/names if needed
      const { data: depts } = await supabase.from('Departments').select('*');

      let filtered = data || [];

      if (dept) {
        filtered = filtered.filter(r => {
          const rowDept = (r.Department || '').toString();
          return isDeptMatch(rowDept, dept, depts || []);
        });
      }

      if (sem) {
        filtered = filtered.filter(r => {
          const rowSem = (r.Semester || '').toString().toLowerCase().trim().replace(/[^0-9]/g, '');
          const qSem = sem.toString().toLowerCase().trim().replace(/[^0-9]/g, '');
          return rowSem === qSem;
        });
      }

      const sorted = filtered.map(formatStudent).sort((a, b) => {
        const deptA = (a.Department || '').toLowerCase().trim();
        const deptB = (b.Department || '').toLowerCase().trim();
        if (deptA !== deptB) return deptA < deptB ? -1 : 1;
        return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
      });

      return res.json(sorted);
    }

    if (sheet === 'leave') {
      let query = supabase.from('LeaveRequests').select('*');
      if (studentId) query = query.eq('studentId', studentId);
      if (req.query.profEmail) query = query.eq('targetProfessor', req.query.profEmail);

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data);
    }

    if ((sheet === 'subject_stats' || sheet === 'SubjectAttendance') && (email || studentId)) {
      let student = null;
      if (studentId) {
        const { data } = await supabase.from('students').select('*').ilike('ID', studentId).single();
        student = data;
      } else if (email) {
        const { data } = await supabase.from('students').select('*').ilike('Email', email).single();
        student = data;
      }

      if (!student) {
        return res.json([]);
      }

      const dbStudentId = student.ID;
      const studentDept = student.Department || '';
      const studentSem = student.Semester || '';

      // Fetch all attendance history records from AttendanceHistory for this Semester
      const { data: history, error: histErr } = await supabase
        .from('AttendanceHistory')
        .select('*')
        .eq('Semester', studentSem);

      if (histErr) throw histErr;

      // Fetch departments first to translate and perform fuzzy matching
      const { data: depts } = await supabase.from('Departments').select('*');
      const classHistory = (history || []).filter(r => isDeptMatch(r.Department, studentDept, depts || []));

      const subjectStats = {};
      classHistory.forEach(row => {
        const hSub = row.Subject;
        const hDate = row.Date;
        const hSid = (row.StudentID || '').toString().toLowerCase().trim();
        const hStatus = (row.Status || '').toString().trim().toLowerCase();

        if (hSub) {
          if (!subjectStats[hSub]) {
            subjectStats[hSub] = { dates: new Set(), attended: 0 };
          }
          subjectStats[hSub].dates.add(hDate);
          if (hSid === dbStudentId.toLowerCase().trim() && ['present', 'late'].includes(hStatus)) {
            subjectStats[hSub].attended++;
          }
        }
      });

      const result = Object.keys(subjectStats).map(subName => {
        const stats = subjectStats[subName];
        const total = stats.dates.size;
        const pct = total > 0 ? (stats.attended / total) * 100 : 0;
        return {
          Subject: subName,
          Attended: stats.attended,
          Total: total,
          Percentage: parseFloat(pct.toFixed(2))
        };
      });

      return res.json(result);
    }

    // Academic mappings
    if (sheet === 'departments') {
      const { data, error } = await supabase.from('Departments').select('*');
      if (error) throw error;
      return res.json(data);
    }

    if (sheet === 'classes') {
      const { data, error } = await supabase.from('Classes').select('*');
      if (error) throw error;
      return res.json(data);
    }

    if (sheet === 'subjects') {
      const { data, error } = await supabase.from('Subjects').select('*');
      if (error) throw error;
      return res.json(data);
    }

    if (sheet === 'camera_ips') {
      const { data, error } = await supabase.from('Camera_IPs').select('*');
      if (error) throw error;
      return res.json(data);
    }

    if (sheet === 'audit_logs') {
      const { data, error } = await supabase
        .from('AuditLogs')
        .select('*')
        .order('Timestamp', { ascending: false });
      if (error) throw error;
      return res.json(data);
    }

    if (sheet === 'student_assignments') {
      let query = supabase.from('StudentAssignments').select('*');
      if (req.query.profEmail) {
        query = query.eq('ProfessorEmail', req.query.profEmail);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.json(data);
    }

    if (sheet === 'attendance_history') {
      const qDate = req.query.date || req.query.Date;
      const qDept = req.query.dept || req.query.Department;
      const qSem = req.query.sem || req.query.Semester;
      const qSub = req.query.sub || req.query.Subject;

      let query = supabase.from('AttendanceHistory').select('*');
      if (qDate) query = query.eq('Date', qDate);
      if (qDept) query = query.eq('Department', qDept);
      if (qSem) query = query.eq('Semester', qSem);
      if (qSub) query = query.eq('Subject', qSub);

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data);
    }

    // Default error fallback
    return res.status(400).json({ status: 'error', message: `Unhandled action or sheet fetch: ${action || sheet}` });

  } catch (err) {
    console.error("GET API Error:", err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==========================================
// 3. POST ROUTE (Replicates doPost)
// ==========================================
app.post('/', authenticateToken, async (req, res) => {
  try {
    const { action, sheet, data, id, email, searchCol, searchVal } = req.body;

    // ── SECURE LOGIN ACTION ──
    if (action === 'login') {
      const { email: loginEmail, password: loginPassword, role } = req.body;
      const cleanEmail = (loginEmail || '').toString().toLowerCase().trim();
      const cleanPass = (loginPassword || '').toString().trim();

      if (!cleanEmail || !cleanPass || !role) {
        return res.status(400).json({ status: 'error', message: 'Email, password, and role are required.' });
      }

      let user = null;
      let matchedTable = '';

      if (role === 'student') {
        const { data: dbUser } = await supabase
          .from('students')
          .select('*')
          .ilike('Email', cleanEmail)
          .single();
        user = dbUser;
        matchedTable = 'students';
      } else if (role === 'admin') {
        const { data: dbUser } = await supabase
          .from('ADMIN')
          .select('*')
          .ilike('Email', cleanEmail)
          .single();
        user = dbUser;
        matchedTable = 'ADMIN';
      } else if (role === 'professor') {
        const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
        for (const t of deptSheets) {
          const { data: prof } = await supabase
            .from(t)
            .select('*')
            .ilike('Email', cleanEmail)
            .single();
          if (prof) {
            user = prof;
            matchedTable = t;
            break;
          }
        }
      }

      if (!user) {
        return res.status(401).json({ status: 'error', message: 'User not found in database.' });
      }

      // Check Password (case-sensitive check as in original client code)
      const dbPass = user.Password || user.password || '';
      if (dbPass !== cleanPass) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials. Password mismatch.' });
      }

      // Generate a signed JWT
      const payload = {
        id: user.ID || user.id || user['Student ID'] || user['Professor id'] || user['Admin_id'] || '',
        email: cleanEmail,
        role: role
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Valid for 7 days

      // Return token and user details (excluding password)
      const userClone = { ...user };
      delete userClone.Password;
      delete userClone.password;

      return res.json({
        status: 'success',
        token,
        user: userClone
      });
    }

    // ── A. UPDATE DATA ──
    if (action === 'update') {
      let table = 'students';
      let searchColumn = searchCol || 'ID';
      let searchValue = searchVal || id;

      if (sheet === 'admin') {
        table = 'ADMIN';
        searchColumn = searchCol === 'Email' ? 'Email' : 'Admin_id';
      } else if (sheet === 'professor') {
        const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
        for (const t of deptSheets) {
          const { data: prof } = await supabase.from(t).select('*').eq(searchCol || 'Professor id', searchValue);
          if (prof && prof.length > 0) {
            table = t;
            break;
          }
        }
      }

      // Map incoming keys
      const mappedData = {};
      if (data) {
        for (const k in data) {
          mappedData[k] = data[k];
        }
      }

      const { error } = await supabase
        .from(table)
        .update(mappedData)
        .eq(searchColumn, searchValue);

      if (error) throw error;
      return res.json({ status: 'success' });
    }

    // ── B. REGISTRATION ACTIONS ──
    if (action === 'add' && sheet === 'student') {
      const { ID, Name, Email, Password, Department, Semester, Parent_Email } = data;
      const { error } = await supabase
        .from('students')
        .insert([{
          ID: ID,
          Name: Name,
          Email: Email,
          Password: Password,
          Department: Department,
          Semester: Semester,
          Parent_Email: Parent_Email,
          Total_Classes: 0,
          Classes_Attended: 0,
          Attendance_Percentage: 0.00
        }]);

      if (error) throw error;
      await logActivity('ADD_STUDENT', `Student added: ${Name} (${ID})`);
      return res.json({ status: 'success' });
    }

    if (action === 'add_professor') {
      const { Name, Email, Password, Department } = data;
      const nameParts = (Name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const deptTable = getProfessorTable(Department);

      const { error } = await supabase
        .from(deptTable)
        .insert([{
          'Professor  first_name': firstName,
          'Professor  last_name': lastName,
          'Email': Email,
          'Password': Password,
          'Department': Department
        }]);

      if (error) throw error;
      await logActivity('ADD_PROFESSOR', `Professor added: ${Name} in ${Department}`);
      return res.json({ status: 'success' });
    }

    // ── C. DELETE ACTIONS ──
    if (action === 'delete') {
      if (sheet === 'student') {
        const { error } = await supabase.from('students').delete().eq('ID', id);
        if (error) throw error;
        await logActivity('DELETE_STUDENT', `Student deleted with ID ${id}`);
      }
      return res.json({ status: 'success' });
    }

    if (action === 'delete_professor') {
      const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
      for (const t of deptSheets) {
        await supabase.from(t).delete().eq('Email', email);
      }
      await logActivity('DELETE_PROFESSOR', `Professor deleted with email ${email}`);
      return res.json({ status: 'success' });
    }

    // ── D. LEAVE REQUEST ACTIONS ──
    if (action === 'submit_leave') {
      const { studentId, email: studentEmail, reason, image } = req.body;
      
      const { data: std } = await supabase.from('students').select('Name').eq('ID', studentId).single();
      const studentName = std ? std.Name : 'Student';

      const { error } = await supabase
        .from('LeaveRequests')
        .insert([{
          studentId: studentId,
          studentName: studentName,
          reason: reason,
          image: image || null,
          status: 'Pending',
          submittedAt: new Date().toISOString()
        }]);

      if (error) throw error;
      await logActivity('SUBMIT_LEAVE', `Student ${studentId} submitted leave request`);
      return res.json({ status: 'success' });
    }

    if (action === 'resolve_leave') {
      const { id: leaveId, status: newStatus } = req.body;
      const { error } = await supabase
        .from('LeaveRequests')
        .update({ status: newStatus })
        .eq('id', leaveId);

      if (error) throw error;
      await logActivity('RESOLVE_LEAVE', `Resolved leave request #${leaveId} as ${newStatus}`);
      return res.json({ status: 'success' });
    }

    // ── E. BATCH ATTENDANCE LOGGING (SAVE SESSION) ──
    if (action === 'save_session') {
      const { classInfo, students } = req.body;
      
      if (!classInfo || !students || !Array.isArray(students)) {
        return res.status(400).json({ status: 'error', message: 'Missing classInfo or students data.' });
      }

      const { subject, dept, sem, date } = classInfo;

      // Fetch known departments to translate Code/Name
      const { data: depts } = await supabase.from('Departments').select('*');

      // Check if session has already been saved today (Prevent duplicate sessions)
      const { data: existingHist } = await supabase
        .from('AttendanceHistory')
        .select('ID')
        .eq('Date', date)
        .eq('Subject', subject)
        .eq('Semester', sem);

      const alreadySaved = (existingHist || []).some(r => isDeptMatch(r.Department, dept, depts || []));

      if (alreadySaved) {
        return res.json({ status: 'error', message: 'This session has already been saved today.' });
      }

      // Record individual student history
      for (const s of students) {
        const cleanSId = String(s.id).toLowerCase().trim();

        // Check if record already exists for this StudentID + Date + Subject
        const { data: existing } = await supabase
          .from('AttendanceHistory')
          .select('ID')
          .eq('StudentID', s.id)
          .eq('Date', date)
          .eq('Subject', subject);

        if (existing && existing.length > 0) {
          // Update it
          const { error: updateErr } = await supabase
            .from('AttendanceHistory')
            .update({
              Status: s.status || 'Present',
              lateMinutes: s.lateMinutes || 0
            })
            .eq('StudentID', s.id)
            .eq('Date', date)
            .eq('Subject', subject);

          if (updateErr) throw updateErr;
        } else {
          // Insert new one
          const { error: insertErr } = await supabase
            .from('AttendanceHistory')
            .insert([{
              Date: date,
              Department: dept,
              Semester: sem,
              Subject: subject,
              StudentID: s.id,
              Status: s.status || 'Present',
              lateMinutes: s.lateMinutes || 0
            }]);

          if (insertErr) throw insertErr;
        }
      }

      // Sync overall totals for each student in the list
      const studentIds = students.map(s => s.id);
      for (const sId of studentIds) {
        try {
          const { data: history } = await supabase
            .from('AttendanceHistory')
            .select('Status')
            .eq('StudentID', sId);

          if (history) {
            const total = history.length;
            const present = history.filter(r => ['present', 'late'].includes((r.Status || '').toLowerCase().trim())).length;
            const pct = total > 0 ? parseFloat(((present / total) * 100).toFixed(2)) : 0.00;

            await supabase
              .from('students')
              .update({
                Total_Classes: total,
                Classes_Attended: present,
                Attendance_Percentage: pct
              })
              .eq('ID', sId);
          }
        } catch (syncErr) {
          console.error(`Syncing totals failed for student ${sId}:`, syncErr.message);
        }
      }

      await logActivity('SAVE_SESSION', `Saved attendance session for ${subject} - ${dept} - ${sem}`);
      return res.json({ status: 'success' });
    }

    // ── F. GENERAL ACADEMIC WRITES ──
    if (action === 'delete_academic') {
      const { subSheet, key: filterKey, val: filterVal } = req.body;
      const { error } = await supabase.from(subSheet).delete().eq(filterKey, filterVal);
      if (error) throw error;
      await logActivity('DELETE_ACADEMIC', `Deleted ${filterVal} from ${subSheet}`);
      return res.json({ status: 'success' });
    }

    if (action === 'update_academic') {
      const { subSheet, key: filterKey, val: filterVal, data: updateData } = req.body;
      const { error } = await supabase.from(subSheet).update(updateData).eq(filterKey, filterVal);
      if (error) throw error;
      await logActivity('UPDATE_ACADEMIC', `Updated ${filterVal} in ${subSheet}`);
      return res.json({ status: 'success' });
    }

    if (action === 'add_dept') {
      const { error } = await supabase.from('Departments').insert([req.body.data]);
      if (error) throw error;
      await logActivity('ADD_DEPT', `Department created: ${req.body.data.Name}`);
      return res.json({ status: 'success' });
    }

    if (action === 'add_class') {
      const { error } = await supabase.from('Classes').insert([req.body.data]);
      if (error) throw error;
      await logActivity('ADD_CLASS', `Class created: ${req.body.data.Name}`);
      return res.json({ status: 'success' });
    }

    if (action === 'add_subject') {
      const { error } = await supabase.from('Subjects').insert([req.body.data]);
      if (error) throw error;
      await logActivity('ADD_SUBJECT', `Subject created: ${req.body.data.Name}`);
      return res.json({ status: 'success' });
    }

    if (action === 'add_proxy') {
      const { error } = await supabase.from('Proxies').insert([req.body.data]);
      if (error) throw error;
      await logActivity('ADD_PROXY', `Proxy created for subject: ${req.body.data.Subject}`);
      return res.json({ status: 'success' });
    }

    if (action === 'add_camera_ip') {
      const { Department_Name, Classroom_Name, IP_Address } = req.body;
      const { error } = await supabase
        .from('Camera_IPs')
        .insert([{ Department_Name, Classroom_Name, IP_Address }]);
      if (error) throw error;
      await logActivity('ADD_CAMERA_IP', `Camera added for classroom ${Classroom_Name}`);
      return res.json({ status: 'success' });
    }

    if (action === 'update_camera_ip') {
      const { Department_Name, Classroom_Name, IP_Address, original_classroom } = req.body;
      const { error } = await supabase
        .from('Camera_IPs')
        .update({ Department_Name, Classroom_Name, IP_Address })
        .eq('Classroom_Name', original_classroom);
      if (error) throw error;
      await logActivity('UPDATE_CAMERA_IP', `Camera updated for classroom ${Classroom_Name}`);
      return res.json({ status: 'success' });
    }

    if (action === 'delete_camera_ip') {
      const { Classroom_Name } = req.body;
      const { error } = await supabase
        .from('Camera_IPs')
        .delete()
        .eq('Classroom_Name', Classroom_Name);
      if (error) throw error;
      await logActivity('DELETE_CAMERA_IP', `Camera deleted for classroom ${Classroom_Name}`);
      return res.json({ status: 'success' });
    }

    // ── G. STUDENT ASSIGNMENT HUBS ──
    if (action === 'upload_assignment') {
      const { professorEmail, department, semester, subject, title, description, fileBase64, fileName, dueDate } = req.body;
      const id = 'ASM' + Math.floor(100000 + Math.random() * 899999);
      const dateStr = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      const fileUrl = fileBase64 ? `http://localhost:${PORT}/files/${id}` : '';
      
      const { error } = await supabase
        .from('StudentAssignments')
        .insert([{
          ID: id,
          ProfessorEmail: professorEmail,
          Department: department,
          Semester: semester,
          Subject: subject,
          Title: title,
          Description: description,
          AttachmentName: fileName || 'Assignment.pdf',
          AttachmentURL: fileUrl,
          FileID: fileBase64 ? id : '',
          Date: dateStr,
          UploadedAt: timestamp,
          DueDate: dueDate || '',
          FileContent: fileBase64 || null
        }]);

      if (error) throw error;

      // Fetch students in department & semester to email them
      let emailCount = 0;
      try {
        const { data: students } = await supabase
          .from('students')
          .select('Email, Name')
          .eq('Semester', semester);
        
        if (students && students.length > 0) {
          const filteredStudents = students.filter(s => {
            const sDept = (s.Department || '').toLowerCase().trim();
            const qDept = (department || '').toLowerCase().trim();
            return sDept.includes(qDept) || qDept.includes(sDept);
          });

          for (const s of filteredStudents) {
            if (s.Email && s.Email.includes('@')) {
              try {
                await transporter.sendMail({
                  from: `SmartAttend <${process.env.SMTP_USER}>`,
                  to: s.Email,
                  subject: `New Assignment: ${title} (${subject})`,
                  html: getAssignmentEmailTemplate(title, description, subject, professorEmail, fileUrl, fileName, dueDate)
                });
                emailCount++;
              } catch (e) {
                console.error(`Failed to send assignment email to ${s.Email}:`, e.message);
              }
            }
          }
        }
      } catch (errStudents) {
        console.error("Failed to query students for assignment notification:", errStudents.message);
      }

      await logActivity('UPLOAD_ASSIGNMENT', `Uploaded assignment ID ${id} for ${subject} and emailed ${emailCount} students.`);
      return res.json({ status: 'success', id: id, emailCount: emailCount });
    }

    if (action === 'delete_assignment') {
      const { id: assignmentId, professorEmail } = req.body;
      
      const { data: assignment, error: fetchErr } = await supabase
        .from('StudentAssignments')
        .select('*')
        .eq('ID', assignmentId)
        .single();
        
      if (fetchErr || !assignment) {
        return res.status(404).json({ status: 'error', message: 'Assignment not found.' });
      }

      if (assignment.ProfessorEmail.toLowerCase() !== professorEmail.toLowerCase()) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized: You did not create this assignment.' });
      }

      const { error: deleteErr } = await supabase
        .from('StudentAssignments')
        .delete()
        .eq('ID', assignmentId);

      if (deleteErr) throw deleteErr;

      // Fetch students to notify retraction
      let recallEmailCount = 0;
      try {
        const { data: students } = await supabase
          .from('students')
          .select('Email')
          .eq('Semester', assignment.Semester);
          
        if (students && students.length > 0) {
          const filteredStudents = students.filter(s => {
            const sDept = (s.Department || '').toLowerCase().trim();
            const qDept = (assignment.Department || '').toLowerCase().trim();
            return sDept.includes(qDept) || qDept.includes(sDept);
          });

          for (const s of filteredStudents) {
            if (s.Email && s.Email.includes('@')) {
              try {
                await transporter.sendMail({
                  from: `SmartAttend <${process.env.SMTP_USER}>`,
                  to: s.Email,
                  subject: `RETRACTED: Assignment Cancelled: ${assignment.Title}`,
                  html: getAssignmentRetractionEmailTemplate(assignment.Title, assignment.Subject, professorEmail)
                });
                recallEmailCount++;
              } catch (e) {}
            }
          }
        }
      } catch (errRecall) {
        console.error("Failed to query students for retraction notification:", errRecall.message);
      }

      await logActivity('DELETE_ASSIGNMENT', `Deleted assignment ID ${assignmentId} and notified ${recallEmailCount} students.`);
      return res.json({ status: 'success', message: 'Assignment deleted successfully.' });
    }

    // ── H. TIMETABLE ACTIONS ──
    if (action === 'upload_timetable') {
      const { department, semester, pdfBase64 } = req.body;
      const fileId = 'TT' + Math.floor(100000 + Math.random() * 899999);
      const viewUrl = `http://localhost:${PORT}/timetables/file/${fileId}`;
      const downloadUrl = `http://localhost:${PORT}/timetables/file/${fileId}`;
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // First, delete existing timetable for same course
      const { data: timetables } = await supabase.from('Timetables').select('*');
      if (timetables && timetables.length > 0) {
        const qDept = (department || '').toString().toLowerCase().trim();
        const qSem = (semester || '').toString().toLowerCase().trim().replace(/[^0-9]/g, '');
        
        const matching = timetables.filter(r => {
          const rDept = (r.Department || '').toLowerCase().trim();
          const rSem = (r.Semester || '').toLowerCase().trim().replace(/[^0-9]/g, '');
          const deptMatch = rDept.includes(qDept) || qDept.includes(rDept);
          const semMatch = rSem === qSem;
          return deptMatch && semMatch;
        });

        for (const match of matching) {
          await supabase.from('Timetables').delete().eq('FileID', match.FileID);
        }
      }

      // Now insert the new one
      const { error } = await supabase
        .from('Timetables')
        .insert([{
          Department: department,
          Semester: semester,
          ViewURL: viewUrl,
          DownloadURL: downloadUrl,
          FileID: fileId,
          UploadedAt: timestamp,
          FileContent: pdfBase64
        }]);

      if (error) throw error;
      await logActivity('UPLOAD_TIMETABLE', `Uploaded timetable for ${department} - ${semester}`);
      return res.json({ status: 'success', message: 'Timetable uploaded successfully', url: viewUrl });
    }

    if (action === 'delete_timetable') {
      const { department, semester } = req.body;
      
      const { data: timetables } = await supabase.from('Timetables').select('*');
      let deletedCount = 0;
      
      if (timetables && timetables.length > 0) {
        const qDept = (department || '').toString().toLowerCase().trim();
        const qSem = (semester || '').toString().toLowerCase().trim().replace(/[^0-9]/g, '');
        
        const matching = timetables.filter(r => {
          const rDept = (r.Department || '').toLowerCase().trim();
          const rSem = (r.Semester || '').toLowerCase().trim().replace(/[^0-9]/g, '');
          const deptMatch = rDept.includes(qDept) || qDept.includes(rDept);
          const semMatch = rSem === qSem;
          return deptMatch && semMatch;
        });

        for (const match of matching) {
          await supabase.from('Timetables').delete().eq('FileID', match.FileID);
          deletedCount++;
        }
      }

      await logActivity('DELETE_TIMETABLE', `Deleted timetable for ${department} - ${semester}`);
      return res.json({ status: 'success', message: `Deleted ${deletedCount} timetable records.` });
    }

    // ── ANALYTIC REPORTS ──
    if (action === 'generate_analytic_report') {
      const { professorEmail, department, semester, subject, timeframe, sessionType = 'All' } = req.body;

      // Determine cutoff date
      const now = new Date();
      const cutoff = new Date();
      if (timeframe === 'Weekly') cutoff.setDate(now.getDate() - 7);
      else if (timeframe === 'Monthly') cutoff.setDate(now.getDate() - 30);
      else if (timeframe === 'Half-Yearly') cutoff.setDate(now.getDate() - 182);
      else if (timeframe === 'Yearly') cutoff.setDate(now.getDate() - 365);
      else cutoff.setDate(now.getDate() - 7);

      // Fetch all attendance logs for this semester
      const { data: historyRecords, error: historyErr } = await supabase
        .from('AttendanceHistory')
        .select('*')
        .eq('Semester', semester);

      if (historyErr) throw historyErr;

      // Fetch known departments to translate and match Code/Name fuzzy matching
      const { data: depts } = await supabase.from('Departments').select('*');

      // Filter matching records
      const classRecords = (historyRecords || []).filter(r => {
        if (!isDeptMatch(r.Department, department, depts || [])) return false;
        
        const rSubject = (r.Subject || '').toString();
        if (subject !== 'All Subjects' && !rSubject.toLowerCase().includes(subject.toLowerCase())) return false;

        if (sessionType === 'Theory' && rSubject.toLowerCase().includes('lab')) return false;
        if (sessionType === 'Lab' && !rSubject.toLowerCase().includes('lab')) return false;

        const rDate = new Date(r.Date);
        if (isNaN(rDate.getTime())) return false;
        if (rDate < cutoff || rDate > now) return false;

        return true;
      });

      if (classRecords.length === 0) {
        return res.json({ status: 'error', message: 'No attendance records found for this class in the selected timeframe.' });
      }

      // Count classes and presence per student
      const studentStats = {};
      const uniqueDates = {};

      classRecords.forEach(r => {
        const sId = r.StudentID || r.StudentID;
        const stat = (r.Status || '').trim().toLowerCase();
        const rDate = r.Date;
        uniqueDates[rDate] = true;

        if (!studentStats[sId]) {
          studentStats[sId] = { total: 0, present: 0, late: 0, absent: 0 };
        }
        
        studentStats[sId].total++;
        if (stat === 'present' || stat === 'late') studentStats[sId].present++;
        else studentStats[sId].absent++;
      });

      const totalClasses = Object.keys(uniqueDates).length;

      // Get student names
      const { data: students } = await supabase.from('students').select('*');
      const studentNames = {};
      if (students) {
        students.forEach(s => {
          const id = (s.ID || '').toString();
          studentNames[id] = s.Name || 'Unknown Student';
        });
      }

      // Build HTML report
      const htmlRows = [];
      for (const sId in studentStats) {
        const stats = studentStats[sId];
        const pct = (stats.total > 0) ? Math.round((stats.present / stats.total) * 100) : 0;
        const name = studentNames[sId] || sId;
        const color = pct < 75 ? '#ef4444' : '#10b981';

        htmlRows.push(`
          <tr>
            <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:14px;">${name}<br><span style="color:#64748b; font-size:12px;">${sId}</span></td>
            <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:14px; text-align:center;">${stats.present} / ${stats.total}</td>
            <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:14px; font-weight:bold; color:${color}; text-align:center;">${pct}%</td>
          </tr>
        `);
      }

      const htmlBody = `
        <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:600px; margin:20px auto; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background:linear-gradient(135deg, #3b82f6, #6366f1); padding:30px 24px; color:white;">
            <h2 style="margin:0; font-size:24px; font-weight:600;">Analytic Report: ${timeframe}</h2>
            <p style="margin:8px 0 0 0; opacity:0.9; font-size:14px;">${department} | ${semester}<br>${subject}</p>
          </div>
          <div style="padding:24px; background:white;">
            <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:24px;">
              <p style="margin:0; color:#334155; font-size:15px;"><strong>Total Classes Conducted:</strong> <span style="font-size:18px; color:#3b82f6;">${totalClasses}</span></p>
            </div>
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569; font-size:13px; text-transform:uppercase;">Student</th>
                  <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569; font-size:13px; text-transform:uppercase; text-align:center;">Attended</th>
                  <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569; font-size:13px; text-transform:uppercase; text-align:center;">Percentage</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows.join('')}
              </tbody>
            </table>
          </div>
          <div style="background:#f8fafc; padding:20px; text-align:center; border-top:1px solid #e2e8f0;">
            <p style="margin:0; font-size:12px; color:#94a3b8; font-weight:500;">Secured by SmartAttend System</p>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `SmartAttend <${process.env.SMTP_USER}>`,
          to: professorEmail,
          subject: `SmartAttend: ${timeframe} Analytic Report for ${subject}`,
          html: htmlBody
        });
        await logActivity('GENERATE_REPORT', `Generated ${timeframe} report for ${subject} and sent to ${professorEmail}`);
        return res.json({ status: 'success' });
      } catch (mailErr) {
        console.error("Failed to send analytic email:", mailErr.message);
        return res.json({ status: 'error', message: 'Mail dispatch failed: ' + mailErr.message });
      }
    }

    // ── ACTIVE LAB CODE GENERATION ──
    if (action === 'generate_lab_code') {
      const { professorId, subject } = req.body;
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 90000; // 90 seconds from now

      // Clean up old expired codes
      try {
        await supabase.from('Active_Codes').delete().lt('ExpiresAt', Date.now());
      } catch (e) {}

      const { error } = await supabase
        .from('Active_Codes')
        .insert([{
          Code: code,
          ProfessorID: professorId,
          Subject: subject,
          ExpiresAt: expiresAt,
          ScannedStudents: ''
        }]);

      if (error) throw error;

      await logActivity('GENERATE_LAB_CODE', `Generated lab code ${code} for subject ${subject}`);
      return res.json({ status: 'success', code: code, expiresAt: expiresAt });
    }

    // ── STUDENT LAB CODE VERIFICATION ──
    if (action === 'verify_lab_code') {
      const { studentId, code, deviceId } = req.body;
      const cleanStudentId = (studentId || '').toString().toLowerCase().trim();

      const { data: session, error: fetchSessionErr } = await supabase
        .from('Active_Codes')
        .select('*')
        .eq('Code', code.toString().trim())
        .single();

      if (fetchSessionErr || !session || Date.now() > Number(session.ExpiresAt)) {
        return res.json({ status: 'error', message: 'Code is invalid or has expired.' });
      }

      // Check if student already scanned this code in Lab_Access_Logs
      const { data: existingScans, error: checkErr } = await supabase
        .from('Lab_Access_Logs')
        .select('*')
        .eq('Code', code.toString().trim());

      if (checkErr) throw checkErr;

      const alreadyScanned = (existingScans || []).some(log => (log.StudentID || '').toLowerCase().trim() === cleanStudentId);
      if (alreadyScanned) {
        return res.json({ status: 'error', message: 'You have already marked attendance with this code.' });
      }

      // Anti-Proxy Check (Device UUID check)
      const duplicateDevice = (existingScans || []).find(
        log => log.DeviceID === deviceId && (log.StudentID || '').toLowerCase().trim() !== cleanStudentId
      );

      if (deviceId && duplicateDevice) {
        return res.json({ status: 'error', message: 'Proxy Detected: This device has already been used for this code.' });
      }

      // Verify student exists in the database
      const { data: student } = await supabase
        .from('students')
        .select('ID, Name')
        .ilike('ID', studentId)
        .single();

      if (!student) {
        return res.json({ status: 'error', message: 'Student ID not found in database.' });
      }

      const dbStudentId = student.ID;

      // Insert log into Lab_Access_Logs
      const { error: insertLogErr } = await supabase
        .from('Lab_Access_Logs')
        .insert([{
          Code: code.toString().trim(),
          StudentID: dbStudentId,
          Timestamp: Date.now(),
          DeviceID: deviceId || ''
        }]);

      if (insertLogErr) throw insertLogErr;

      return res.json({ status: 'success', message: 'Attendance Marked Successfully!' });
    }

    // ── EMAIL ABSENT STUDENTS ──
    if (action === 'email_students') {
      const { classInfo, students } = req.body;
      const studentsToAlert = students || [];
      const absentIds = studentsToAlert.map(s => String(s.id).trim()).filter(id => id !== '');

      if (absentIds.length === 0) {
        return res.json({ status: 'error', message: 'No student IDs received in alert request.' });
      }

      const { subject, date } = classInfo || {};
      const subjectName = subject || 'Academic Session';
      const classDate = date || new Date().toLocaleDateString('en-IN');

      // Fetch all students matching these IDs
      const { data: dbStudents, error: dbErr } = await supabase
        .from('students')
        .select('*')
        .in('ID', absentIds);

      if (dbErr) throw dbErr;

      let sentCount = 0;
      for (const student of (dbStudents || [])) {
        const sEmail = student.Email;
        const pEmail = student.Parent_Email || student.ParentEmail || '';
        const name = student.Name || 'Student';
        const pct = student.Attendance_Percentage || 0;
        const att = student.Classes_Attended || 0;
        const tot = student.Total_Classes || 0;

        const emailBody = getStudentAlertTemplate(name, subjectName, classDate, pct, att, tot);

        if (sEmail && sEmail.includes('@')) {
          try {
            await transporter.sendMail({
              from: `SmartAttend <${process.env.SMTP_USER}>`,
              to: sEmail.trim(),
              subject: 'SmartAttend — Attendance Alert',
              html: emailBody
            });
          } catch (e) {
            console.error(`Failed to send student email to ${sEmail}:`, e.message);
          }
        }

        if (pEmail && pEmail.includes('@')) {
          try {
            await transporter.sendMail({
              from: `SmartAttend <${process.env.SMTP_USER}>`,
              to: pEmail.trim(),
              subject: `SmartAttend — Absenteeism Notification: ${name}`,
              html: getParentAbsentAlertTemplate(name, subjectName, classDate, pct)
            });
          } catch (e) {
            console.error(`Failed to send parent email to ${pEmail}:`, e.message);
          }
        }
        sentCount++;
      }

      await logActivity('ABSENT_ALERTS', `Sent ${sentCount} alerts for ${subjectName}`);
      return res.json({ status: 'success', sent: sentCount });
    }

    // ── EMAIL LATE STUDENTS ──
    if (action === 'email_late_students') {
      const { classInfo, students } = req.body;
      const lateStudents = students || [];
      const lateIds = lateStudents.map(s => String(s.id).trim()).filter(id => id !== '');

      if (lateIds.length === 0) {
        return res.json({ status: 'error', message: 'No student IDs received in late alert request.' });
      }

      const { subject, date } = classInfo || {};
      const subjectName = subject || 'Academic Session';
      const classDate = date || new Date().toLocaleDateString('en-IN');

      // Fetch student details from database
      const { data: dbStudents, error: dbErr } = await supabase
        .from('students')
        .select('*')
        .in('ID', lateIds);

      if (dbErr) throw dbErr;

      let sentCount = 0;
      for (const s of lateStudents) {
        const cleanSId = String(s.id).trim();
        const student = (dbStudents || []).find(st => String(st.ID).trim() === cleanSId);
        if (!student) continue;

        const lateMins = parseInt(s.lateMinutes) || 0;
        if (lateMins > 0) {
          const sEmail = student.Email;
          const pEmail = student.Parent_Email || student.ParentEmail || '';
          const name = student.Name || s.name || 'Student';

          if (sEmail && sEmail.includes('@')) {
            try {
              await transporter.sendMail({
                from: `SmartAttend <${process.env.SMTP_USER}>`,
                to: sEmail.trim(),
                subject: 'SmartAttend — Late Attendance Alert',
                html: getLateAlertTemplate(name, cleanSId, subjectName, classDate, lateMins)
              });
            } catch (e) {
              console.error(`Failed to send late student email to ${sEmail}:`, e.message);
            }
          }

          if (pEmail && pEmail.includes('@')) {
            try {
              await transporter.sendMail({
                from: `SmartAttend <${process.env.SMTP_USER}>`,
                to: pEmail.trim(),
                subject: `SmartAttend — Late Attendance Notification: ${name}`,
                html: getParentLateAlertTemplate(name, subjectName, classDate, lateMins)
              });
            } catch (e) {
              console.error(`Failed to send late parent email to ${pEmail}:`, e.message);
            }
          }
          sentCount++;
        }
      }

      await logActivity('LATE_ALERTS', `Sent ${sentCount} late alerts for ${subjectName}`);
      return res.json({ status: 'success', sent: sentCount });
    }

    // Fallback
    return res.status(400).json({ status: 'error', message: `Unhandled POST action: ${action}` });

  } catch (err) {
    console.error("POST API Error:", err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Function to clean expired OTPs from the database
async function cleanExpiredOtps() {
  try {
    const nowIso = new Date().toISOString();
    
    // 1. Clear expired student OTPs
    const { error: stdErr } = await supabase
      .from('students')
      .update({ OTP: null, OTP_Timestamp: null })
      .lt('OTP_Timestamp', nowIso);
    if (stdErr) throw stdErr;

    // 2. Clear expired professor OTPs across all department tables
    const deptSheets = ['BCA', 'MCA', 'BBA', 'MBA'];
    for (const table of deptSheets) {
      const { error: profErr } = await supabase
        .from(table)
        .update({ OTP: null, OTP_Timestamp: null })
        .lt('OTP_Timestamp', nowIso);
      if (profErr) throw profErr;
    }
    console.log('🧹 Expired security OTPs cleaned successfully from database.');
  } catch (err) {
    console.error('Failed to clean expired OTPs:', err.message);
  }
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 SmartAttend Server is running on port ${PORT}`);
  
  // Run startup clean-up
  cleanExpiredOtps();
  
  // Set up hourly automatic cleanup
  setInterval(cleanExpiredOtps, 60 * 60 * 1000);
});
