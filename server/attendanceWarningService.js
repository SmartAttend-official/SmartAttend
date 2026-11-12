/**
 * ==============================================================================
 * SmartAttend — Automated Attendance Monitoring & Warning Notification System
 * ==============================================================================
 * Continuously monitors:
 *   1. Overall Attendance Percentage
 *   2. Individual Subject-Wise Attendance Percentage (Classroom & Laboratory)
 *
 * Rules:
 *   • 60% or below (and > 50%): First Warning → Student Only
 *   • 50% or below: Critical Warning → Student AND Parent
 *   • Mandatory requirement: 75%
 *
 * Cooldown & Duplicate Prevention:
 *   • Maximum ONE notification per 7 days for each independent category/threshold.
 *   • Subsequent drops within 7 days do NOT trigger repeated emails.
 *   • After 7 days, if still below threshold, a weekly reminder is sent.
 *   • 50% Critical Alert takes priority over 60% (e.g. 65% -> 48% sends only 50%).
 *   • Previous 60% alert does NOT block subsequent 50% critical alert.
 *   • Attendance improvement (rising) NEVER triggers warning emails.
 *   • Rising above threshold marks status as 'recovered'.
 *   • Full persistence surviving server restarts (Supabase + local JSON fallback).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// 7-Day Cooldown constant in milliseconds (7 days * 24h * 60m * 60s * 1000ms)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Local fallback store path
const FALLBACK_STORE_DIR = path.resolve(__dirname, 'data');
const FALLBACK_STORE_FILE = path.resolve(FALLBACK_STORE_DIR, 'attendance_warnings.json');

// Memory cache synced with persistent storage
let memoryWarningCache = new Map();
let isStorageInitialized = false;

/**
 * Initialize persistent storage cache
 */
function initStorage() {
  if (isStorageInitialized) return;
  try {
    if (!fs.existsSync(FALLBACK_STORE_DIR)) {
      fs.mkdirSync(FALLBACK_STORE_DIR, { recursive: true });
    }
    if (fs.existsSync(FALLBACK_STORE_FILE)) {
      const raw = fs.readFileSync(FALLBACK_STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([k, v]) => memoryWarningCache.set(k, v));
      }
    }
  } catch (err) {
    console.warn('[attendanceWarningService] Local cache load warning:', err.message);
  }
  isStorageInitialized = true;
}

/**
 * Reset memory cache for testing/isolation
 */
function _clearCacheForTesting() {
  memoryWarningCache.clear();
  isStorageInitialized = false;
}

/**
 * Save memory cache to local fallback file
 */
function persistLocalFallback() {
  try {
    if (!fs.existsSync(FALLBACK_STORE_DIR)) {
      fs.mkdirSync(FALLBACK_STORE_DIR, { recursive: true });
    }
    const obj = {};
    for (const [k, v] of memoryWarningCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(FALLBACK_STORE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[attendanceWarningService] Local fallback write error:', err.message);
  }
}

/**
 * Generate a deterministic composite tracking key
 */
function getTrackingKey(studentId, category, subjectName, threshold) {
  const sId = String(studentId).trim().toUpperCase();
  const cat = String(category).trim().toLowerCase();
  const sub = subjectName ? String(subjectName).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_') : 'OVERALL';
  const th = parseInt(threshold, 10);
  return `${sId}_${cat}_${sub}_${th}`;
}

/**
 * Retrieve tracking record from Supabase or fallback cache
 */
async function getTrackingRecord(supabase, trackingKey) {
  initStorage();

  // 1. Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('AttendanceWarningLogs')
        .select('*')
        .eq('TrackingKey', trackingKey)
        .maybeSingle();

      if (!error && data) {
        // Keep memory cache fresh
        memoryWarningCache.set(trackingKey, {
          trackingKey: data.TrackingKey,
          studentId: data.StudentID,
          category: data.Category,
          subjectName: data.SubjectName,
          attendanceType: data.AttendanceType,
          threshold: data.Threshold,
          lastNotifiedAt: parseInt(data.LastNotifiedAt, 10),
          lastNotifiedPercentage: parseFloat(data.LastNotifiedPercentage),
          nextEligibleAt: parseInt(data.NextEligibleAt, 10),
          recipients: data.Recipients,
          deliveryStatus: data.DeliveryStatus,
          recoveryStatus: data.RecoveryStatus,
          updatedAt: parseInt(data.UpdatedAt, 10)
        });
        return memoryWarningCache.get(trackingKey);
      }
    } catch (e) {
      // Supabase table may not exist yet, proceed to fallback
    }
  }

  // 2. Return from persistent local memory cache
  return memoryWarningCache.get(trackingKey) || null;
}

/**
 * Save/Update tracking record in Supabase and local cache
 */
async function saveTrackingRecord(supabase, record) {
  initStorage();
  const key = record.trackingKey || record.TrackingKey;
  if (!key) return;

  const normalized = {
    trackingKey: key,
    studentId: record.studentId || record.StudentID || '',
    category: record.category || record.Category || 'overall',
    subjectName: record.subjectName || record.SubjectName || 'OVERALL',
    attendanceType: record.attendanceType || record.AttendanceType || 'Classroom',
    threshold: parseInt(record.threshold || record.Threshold || 60, 10),
    lastNotifiedAt: parseInt(record.lastNotifiedAt || record.LastNotifiedAt || Date.now(), 10),
    lastNotifiedPercentage: parseFloat(record.lastNotifiedPercentage || record.LastNotifiedPercentage || 0),
    nextEligibleAt: parseInt(record.nextEligibleAt || record.NextEligibleAt || (Date.now() + SEVEN_DAYS_MS), 10),
    recipients: record.recipients || record.Recipients || 'student',
    deliveryStatus: record.deliveryStatus || record.DeliveryStatus || 'sent',
    recoveryStatus: record.recoveryStatus || record.RecoveryStatus || 'active',
    updatedAt: parseInt(record.updatedAt || record.UpdatedAt || Date.now(), 10)
  };

  memoryWarningCache.set(key, normalized);
  persistLocalFallback();

  if (supabase) {
    try {
      const dbPayload = {
        TrackingKey: normalized.trackingKey,
        StudentID: normalized.studentId,
        Category: normalized.category,
        SubjectName: normalized.subjectName,
        AttendanceType: normalized.attendanceType,
        Threshold: normalized.threshold,
        LastNotifiedAt: normalized.lastNotifiedAt,
        LastNotifiedPercentage: normalized.lastNotifiedPercentage,
        NextEligibleAt: normalized.nextEligibleAt,
        Recipients: normalized.recipients,
        DeliveryStatus: normalized.deliveryStatus,
        RecoveryStatus: normalized.recoveryStatus,
        UpdatedAt: Date.now()
      };

      await supabase.from('AttendanceWarningLogs').upsert([dbPayload]);
    } catch (dbErr) {
      // Non-fatal if Supabase table is not yet migrated; local cache guarantees survival
      console.warn('[attendanceWarningService] Supabase log upsert notice:', dbErr.message);
    }
  }
}

/**
 * Calculate complete attendance metrics for a student (Overall + Subject-wise)
 */
async function calculateStudentMetrics(supabase, studentId) {
  const cleanId = String(studentId).trim();

  // 1. Fetch student info
  const { data: student, error: stdErr } = await supabase
    .from('students')
    .select('*')
    .ilike('ID', cleanId)
    .maybeSingle();

  if (stdErr || !student) {
    throw new Error(`Student with ID "${studentId}" not found in database.`);
  }

  const dbStudentId = student.ID;
  const studentDept = student.Department || '';
  const studentSem = student.Semester || '';

  // 2. Fetch all historical sessions for the student
  const { data: history, error: histErr } = await supabase
    .from('AttendanceHistory')
    .select('*')
    .ilike('StudentID', dbStudentId);

  if (histErr) throw histErr;

  const validHistory = history || [];

  // Overall calculations (deduplicated by Date_Subject)
  const uniqueOverallSessions = new Set();
  const uniqueOverallAttended = new Set();
  const subjectAggregates = {};

  validHistory.forEach(r => {
    const sDate = r.Date;
    const sSub = (r.Subject || 'General').trim();
    const sessionKey = `${sDate}_${sSub}`;
    const status = (r.Status || '').trim().toLowerCase();

    uniqueOverallSessions.add(sessionKey);

    // present, late, and approved leaves count as attended
    const isAttended = ['present', 'late', 'leave', 'on leave', 'excused'].includes(status);
    if (isAttended) {
      uniqueOverallAttended.add(sessionKey);
    }

    // Subject breakdown
    if (!subjectAggregates[sSub]) {
      // Determine if Laboratory or Classroom
      const isLab = /(lab|practical|workshop)/i.test(sSub);
      subjectAggregates[sSub] = {
        subject: sSub,
        type: isLab ? 'Laboratory' : 'Classroom',
        sessions: new Set(),
        attended: new Set()
      };
    }

    subjectAggregates[sSub].sessions.add(sessionKey);
    if (isAttended) {
      subjectAggregates[sSub].attended.add(sessionKey);
    }
  });

  const totalClasses = uniqueOverallSessions.size;
  const attendedClasses = uniqueOverallAttended.size;
  const overallPercentage = totalClasses > 0 ? parseFloat(((attendedClasses / totalClasses) * 100).toFixed(2)) : 0.0;

  // Build subject list
  const subjects = Object.values(subjectAggregates).map(item => {
    const tot = item.sessions.size;
    const att = item.attended.size;
    const pct = tot > 0 ? parseFloat(((att / tot) * 100).toFixed(2)) : 0.0;
    return {
      subject: item.subject,
      type: item.type,
      total: tot,
      attended: att,
      percentage: pct,
      below75: pct < 75.0
    };
  });

  // Sort subjects: lowest percentage first so troubled subjects appear on top
  subjects.sort((a, b) => a.percentage - b.percentage);

  return {
    student: {
      id: dbStudentId,
      name: student.Name || 'Student',
      email: (student.Email || '').trim(),
      parentEmail: (student.Parent_Email || student.ParentEmail || '').trim(),
      department: studentDept,
      semester: studentSem
    },
    overall: {
      total: totalClasses,
      attended: attendedClasses,
      percentage: overallPercentage,
      below75: overallPercentage < 75.0
    },
    subjects
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE HTML EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

function getEmailBaseStyles() {
  return `
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #0b1120;
    color: #f8fafc;
    margin: 0;
    padding: 0;
  `;
}

/**
 * Generate HTML table rows for subject breakdown
 */
function renderSubjectTableRows(subjects) {
  if (!subjects || subjects.length === 0) {
    return `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No subject records found.</td></tr>`;
  }

  return subjects.map(s => {
    const isBelow = s.percentage < 75.0;
    const isCritical = s.percentage <= 50.0;
    const statusBg = isCritical ? 'rgba(239, 68, 68, 0.2)' : (isBelow ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)');
    const statusColor = isCritical ? '#f87171' : (isBelow ? '#fbbf24' : '#34d399');
    const statusLabel = isCritical ? 'Critical (≤50%)' : (isBelow ? 'Below 75%' : 'Safe (≥75%)');

    return `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
        <td style="padding: 12px 14px; color: #f1f5f9; font-weight: 600;">
          ${s.subject}
          <span style="display: block; font-size: 11px; color: #94a3b8; font-weight: 400;">${s.type}</span>
        </td>
        <td style="padding: 12px 14px; text-align: center; color: #cbd5e1;">${s.attended} / ${s.total}</td>
        <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: ${statusColor}; font-size: 14px;">
          ${s.percentage.toFixed(1)}%
        </td>
        <td style="padding: 12px 14px; text-align: right;">
          <span style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}44; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            ${statusLabel}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * TYPE A: Overall Attendance Warning (60%) — Student Only
 */
function getOverallWarning60Template({ student, overall, subjects, dateStr }) {
  return `
    <div style="${getEmailBaseStyles()}">
      <div style="max-width: 620px; margin: 20px auto; background: #0f172a; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 26px 32px; color: #ffffff;">
          <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; opacity: 0.9;">SmartAttend — Academic Advisory</div>
          <h1 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: #ffffff;">Overall Attendance Warning: 60% Reached</h1>
        </div>

        <div style="padding: 28px 32px;">
          <p style="font-size: 15px; color: #e2e8f0; margin-top: 0;">Dear <strong>${student.name}</strong> (ID: <code>${student.id}</code>),</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
            This is an automated <strong>First Attendance Warning</strong>. Your cumulative attendance across all academic courses has reached or dropped below the <strong>60% threshold</strong>.
          </p>

          <!-- Metric Highlight Card -->
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 10px; padding: 18px; margin: 20px 0; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 12px; color: #fbbf24; text-transform: uppercase; font-weight: 700;">Current Overall Attendance</div>
              <div style="font-size: 28px; font-weight: 800; color: #fbbf24; margin-top: 4px;">${overall.percentage.toFixed(1)}%</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: #94a3b8;">Mandatory Requirement</div>
              <div style="font-size: 18px; font-weight: 700; color: #34d399; margin-top: 4px;">75.0%</div>
            </div>
          </div>

          <!-- Subject Breakdown Table -->
          <h3 style="font-size: 15px; font-weight: 700; color: #f8fafc; margin: 24px 0 12px 0;">Subject-Wise Attendance Breakdown:</h3>
          <table style="width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.02); border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.06); color: #94a3b8; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 10px 14px; text-align: left;">Subject</th>
                <th style="padding: 10px 14px; text-align: center;">Classes</th>
                <th style="padding: 10px 14px; text-align: center;">Attendance</th>
                <th style="padding: 10px 14px; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${renderSubjectTableRows(subjects)}
            </tbody>
          </table>

          <!-- Mandatory Notice -->
          <div style="background: rgba(15, 23, 42, 0.8); border-left: 4px solid #f59e0b; padding: 14px; margin-top: 24px; border-radius: 0 8px 8px 0;">
            <div style="font-weight: 700; color: #f59e0b; font-size: 13px;">Action Required:</div>
            <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px; line-height: 1.5;">
              University regulations strictly mandate a minimum of <strong>75% attendance</strong> to be eligible for semester examinations. Please attend upcoming lectures regularly to restore your eligibility.
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #080e1a; padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
          <span>Notification Date: ${dateStr}</span>
          <span>SmartAttend Automated Academic Monitoring</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * TYPE B: Subject-Wise Attendance Warning (60%) — Student Only
 */
function getSubjectWarning60Template({ student, subjectItem, dateStr }) {
  return `
    <div style="${getEmailBaseStyles()}">
      <div style="max-width: 600px; margin: 20px auto; background: #0f172a; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 24px 30px; color: #ffffff;">
          <div style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; opacity: 0.9;">SmartAttend — Subject Advisory</div>
          <h1 style="margin: 6px 0 0 0; font-size: 21px; font-weight: 800; color: #ffffff;">Attendance Warning: ${subjectItem.subject}</h1>
        </div>

        <div style="padding: 26px 30px;">
          <p style="font-size: 15px; color: #e2e8f0; margin-top: 0;">Dear <strong>${student.name}</strong> (ID: <code>${student.id}</code>),</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
            Your attendance in <strong>${subjectItem.subject}</strong> (${subjectItem.type}) has reached or dropped below the <strong>60% warning threshold</strong>.
          </p>

          <!-- Detail Card -->
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 18px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Subject:</td>
                <td style="color: #ffffff; font-weight: 700; text-align: right;">${subjectItem.subject} (${subjectItem.type})</td>
              </tr>
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Recorded Classes Attended:</td>
                <td style="color: #ffffff; font-weight: 600; text-align: right;">${subjectItem.attended} / ${subjectItem.total}</td>
              </tr>
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Current Subject Attendance:</td>
                <td style="color: #fbbf24; font-weight: 800; font-size: 18px; text-align: right;">${subjectItem.percentage.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Mandatory Requirement:</td>
                <td style="color: #34d399; font-weight: 700; text-align: right;">75.0%</td>
              </tr>
            </table>
          </div>

          <div style="background: rgba(15, 23, 42, 0.8); border-left: 4px solid #f59e0b; padding: 14px; border-radius: 0 8px 8px 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
            <strong>Advisory Note:</strong> This is a subject-specific notification. Please ensure you attend the upcoming lectures in <strong>${subjectItem.subject}</strong> to recover to the 75% required mark before the end of the semester.
          </div>
        </div>

        <div style="background: #080e1a; padding: 14px 30px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b;">
          Notification Date: ${dateStr} • SmartAttend System
        </div>
      </div>
    </div>
  `;
}

/**
 * TYPE C: Overall Attendance Critical Warning (50%) — Student & Parent
 */
function getOverallCritical50Template({ student, overall, subjects, dateStr, isParent }) {
  const greeting = isParent ? `Dear Parent / Guardian of <strong>${student.name}</strong>,` : `Dear <strong>${student.name}</strong>,`;

  return `
    <div style="${getEmailBaseStyles()}">
      <div style="max-width: 620px; margin: 20px auto; background: #0f172a; border-radius: 14px; overflow: hidden; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 10px 30px rgba(239, 68, 68, 0.2);">
        
        <!-- Urgent Red Header -->
        <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 26px 32px; color: #ffffff;">
          <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 800; color: #fecaca;">⚠️ CRITICAL ACADEMIC ESCALATION</div>
          <h1 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: #ffffff;">Critical Alert: Overall Attendance Dropped to ${overall.percentage.toFixed(1)}%</h1>
        </div>

        <div style="padding: 28px 32px;">
          <p style="font-size: 15px; color: #e2e8f0; margin-top: 0;">${greeting}</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
            This is an urgent official notice regarding <strong>${student.name}</strong> (Enrollment ID: <code>${student.id}</code>, Department: ${student.department || 'Academic'}). Cumulative overall attendance has dropped to a <strong>critically low level of ${overall.percentage.toFixed(1)}%</strong>.
          </p>

          <!-- Critical Card -->
          <div style="background: rgba(239, 68, 68, 0.12); border: 2px solid #ef4444; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center;">
            <div style="font-size: 12px; text-transform: uppercase; font-weight: 800; color: #f87171; letter-spacing: 1px;">CRITICAL SHORTAGE DETECTED</div>
            <div style="font-size: 36px; font-weight: 900; color: #ef4444; margin: 8px 0;">${overall.percentage.toFixed(1)}%</div>
            <div style="font-size: 13px; color: #fca5a5;">Mandatory Examination Threshold: <strong>75.0%</strong> (Shortfall: ${(75.0 - overall.percentage).toFixed(1)}%)</div>
          </div>

          <!-- Subject Breakdown -->
          <h3 style="font-size: 15px; font-weight: 700; color: #f8fafc; margin: 24px 0 12px 0;">Complete Subject Attendance Record:</h3>
          <table style="width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.02); border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.06); color: #94a3b8; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 10px 14px; text-align: left;">Subject</th>
                <th style="padding: 10px 14px; text-align: center;">Classes</th>
                <th style="padding: 10px 14px; text-align: center;">Attendance</th>
                <th style="padding: 10px 14px; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${renderSubjectTableRows(subjects)}
            </tbody>
          </table>

          <!-- Serious Warning Box -->
          <div style="background: rgba(220, 38, 38, 0.15); border-left: 4px solid #ef4444; padding: 16px; margin-top: 24px; border-radius: 0 8px 8px 0;">
            <div style="font-weight: 800; color: #f87171; font-size: 14px;">URGENT ACADEMIC RISK:</div>
            <div style="font-size: 13px; color: #fca5a5; margin-top: 6px; line-height: 1.5;">
              Under university academic regulations, students with attendance below 75% are <strong>strictly debarred from appearing in semester end examinations</strong>. Immediate daily attendance is required. Parents are requested to consult with the department head or academic advisor immediately.
            </div>
          </div>
        </div>

        <div style="background: #080e1a; padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
          <span>Notification Date: ${dateStr}</span>
          <span>SmartAttend Critical Escalation System</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * TYPE D: Subject-Wise Attendance Critical Warning (50%) — Student & Parent
 */
function getSubjectCritical50Template({ student, subjectItem, dateStr, isParent }) {
  const greeting = isParent ? `Dear Parent / Guardian of <strong>${student.name}</strong>,` : `Dear <strong>${student.name}</strong>,`;

  return `
    <div style="${getEmailBaseStyles()}">
      <div style="max-width: 600px; margin: 20px auto; background: #0f172a; border-radius: 14px; overflow: hidden; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 10px 30px rgba(239, 68, 68, 0.2);">
        
        <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 24px 30px; color: #ffffff;">
          <div style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 800; color: #fecaca;">⚠️ CRITICAL SUBJECT SHORTAGE</div>
          <h1 style="margin: 6px 0 0 0; font-size: 21px; font-weight: 800; color: #ffffff;">Critical Alert: ${subjectItem.subject}</h1>
        </div>

        <div style="padding: 26px 30px;">
          <p style="font-size: 15px; color: #e2e8f0; margin-top: 0;">${greeting}</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
            This is an urgent notification regarding attendance in <strong>${subjectItem.subject}</strong> (${subjectItem.type}) for student <strong>${student.name}</strong> (ID: <code>${student.id}</code>). Attendance in this course has fallen to a <strong>critical level of ${subjectItem.percentage.toFixed(1)}%</strong>.
          </p>

          <!-- Detail Card -->
          <div style="background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 10px; padding: 18px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Subject:</td>
                <td style="color: #ffffff; font-weight: 700; text-align: right;">${subjectItem.subject} (${subjectItem.type})</td>
              </tr>
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Classes Attended:</td>
                <td style="color: #ffffff; font-weight: 600; text-align: right;">${subjectItem.attended} / ${subjectItem.total}</td>
              </tr>
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Current Attendance:</td>
                <td style="color: #ef4444; font-weight: 900; font-size: 20px; text-align: right;">${subjectItem.percentage.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Required Minimum:</td>
                <td style="color: #34d399; font-weight: 700; text-align: right;">75.0%</td>
              </tr>
            </table>
          </div>

          <div style="background: rgba(220, 38, 38, 0.15); border-left: 4px solid #ef4444; padding: 14px; border-radius: 0 8px 8px 0; font-size: 13px; color: #fca5a5; line-height: 1.5;">
            <strong>Action Required:</strong> The student is in immediate danger of being marked as a defaulter in <strong>${subjectItem.subject}</strong>. Regular attendance in every upcoming class session is compulsory to restore eligibility.
          </div>
        </div>

        <div style="background: #080e1a; padding: 14px 30px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b;">
          Notification Date: ${dateStr} • SmartAttend System
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EVALUATION & DISPATCH ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates warning thresholds for a single student and dispatches emails if eligible.
 * Enforces 7-day cooldown, priority, and recovery logic.
 */
async function evaluateStudentWarnings(supabase, sendEmailFn, studentId, options = {}) {
  const now = options.simulatedNow || Date.now();
  const dateStr = options.sessionDate || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const dryRun = !!options.dryRun;

  const metrics = await calculateStudentMetrics(supabase, studentId);
  const { student, overall, subjects } = metrics;

  const sEmail = student.email;
  const pEmail = student.parentEmail;
  const warningsDispatched = [];

  // Helper to send email safely and log
  async function dispatchNotification({ recipients, subject, subjectParent, htmlStudent, htmlParent, html, key, category, subjectName, attendanceType, threshold, percentage }) {
    let deliverySuccess = true;
    const recipientList = [];

    const sSubject = subject;
    const pSubject = subjectParent || subject;
    const sHtml = htmlStudent || html;
    const pHtml = htmlParent || html;

    if (recipients.includes('student') && sEmail && sEmail.includes('@')) {
      recipientList.push(sEmail);
      if (!dryRun && sendEmailFn) {
        try {
          await sendEmailFn({ to: sEmail, subject: sSubject, html: sHtml });
        } catch (mailErr) {
          deliverySuccess = false;
          console.error(`[attendanceWarningService] Student mail send failed for ${sEmail}:`, mailErr.message);
        }
      }
    }

    if (recipients.includes('parent') && pEmail && pEmail.includes('@')) {
      recipientList.push(pEmail);
      if (!dryRun && sendEmailFn) {
        try {
          await sendEmailFn({ to: pEmail, subject: pSubject, html: pHtml });
        } catch (mailErr) {
          deliverySuccess = false;
          console.error(`[attendanceWarningService] Parent mail send failed for ${pEmail}:`, mailErr.message);
        }
      }
    }

    if (recipientList.length > 0 && deliverySuccess) {
      // Record persistent log with 7-day cooldown
      await saveTrackingRecord(supabase, {
        trackingKey: key,
        studentId: student.id,
        category,
        subjectName: subjectName || 'OVERALL',
        attendanceType: attendanceType || 'Classroom',
        threshold,
        lastNotifiedAt: now,
        lastNotifiedPercentage: percentage,
        nextEligibleAt: now + SEVEN_DAYS_MS,
        recipients: recipientList.join(', '),
        deliveryStatus: 'sent',
        recoveryStatus: 'active'
      });

      warningsDispatched.push({
        key,
        category,
        subjectName,
        threshold,
        percentage,
        recipients: recipientList,
        subject: sSubject
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. OVERALL ATTENDANCE EVALUATION
  // ════════════════════════════════════════════════════════════════════════════
  const overallKey50 = getTrackingKey(student.id, 'overall', 'OVERALL', 50);
  const overallKey60 = getTrackingKey(student.id, 'overall', 'OVERALL', 60);

  const existingOverall50 = await getTrackingRecord(supabase, overallKey50);
  const existingOverall60 = await getTrackingRecord(supabase, overallKey60);

  // Recovery Logic for Overall Attendance
  if (overall.percentage > 60.0) {
    if (existingOverall60 && existingOverall60.recoveryStatus === 'active') {
      await saveTrackingRecord(supabase, { ...existingOverall60, recoveryStatus: 'recovered' });
    }
    if (existingOverall50 && existingOverall50.recoveryStatus === 'active') {
      await saveTrackingRecord(supabase, { ...existingOverall50, recoveryStatus: 'recovered' });
    }
  } else if (overall.percentage > 50.0 && overall.percentage <= 60.0) {
    if (existingOverall50 && existingOverall50.recoveryStatus === 'active') {
      await saveTrackingRecord(supabase, { ...existingOverall50, recoveryStatus: 'recovered' });
    }
  }

  // Priority Rule: If overall <= 50%, evaluate 50% Critical Alert (Suppress 60%)
  if (overall.percentage <= 50.0) {
    const isEligible50 = !existingOverall50 || existingOverall50.recoveryStatus === 'recovered' || now >= existingOverall50.nextEligibleAt;

    if (isEligible50) {
      const emailSubjectStudent = `Critical Alert: Your Overall Attendance Has Dropped to ${overall.percentage.toFixed(1)}%`;
      const emailSubjectParent = `Critical Alert: Overall Attendance for ${student.name} Has Dropped to ${overall.percentage.toFixed(1)}%`;
      const htmlBodyStudent = getOverallCritical50Template({ student, overall, subjects, dateStr, isParent: false });
      const htmlBodyParent = getOverallCritical50Template({ student, overall, subjects, dateStr, isParent: true });

      await dispatchNotification({
        recipients: ['student', 'parent'],
        subject: emailSubjectStudent,
        subjectParent: emailSubjectParent,
        htmlStudent: htmlBodyStudent,
        htmlParent: htmlBodyParent,
        key: overallKey50,
        category: 'overall',
        subjectName: 'OVERALL',
        attendanceType: 'All',
        threshold: 50,
        percentage: overall.percentage
      });
    }
  } else if (overall.percentage <= 60.0) {
    // 60% Warning Threshold (Student Only)
    const isEligible60 = !existingOverall60 || existingOverall60.recoveryStatus === 'recovered' || now >= existingOverall60.nextEligibleAt;

    if (isEligible60) {
      const emailSubject = `Warning: Your Overall Attendance Has Dropped to ${overall.percentage.toFixed(1)}%`;
      const htmlBody = getOverallWarning60Template({ student, overall, subjects, dateStr });

      await dispatchNotification({
        recipients: ['student'],
        subject: emailSubject,
        html: htmlBody,
        key: overallKey60,
        category: 'overall',
        subjectName: 'OVERALL',
        attendanceType: 'All',
        threshold: 60,
        percentage: overall.percentage
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. INDIVIDUAL SUBJECT-WISE ATTENDANCE EVALUATION
  // ════════════════════════════════════════════════════════════════════════════
  for (const subItem of subjects) {
    const subName = subItem.subject;
    const subPct = subItem.percentage;
    const subType = subItem.type;

    const subKey50 = getTrackingKey(student.id, 'subject', subName, 50);
    const subKey60 = getTrackingKey(student.id, 'subject', subName, 60);

    const existingSub50 = await getTrackingRecord(supabase, subKey50);
    const existingSub60 = await getTrackingRecord(supabase, subKey60);

    // Recovery Logic for Subject
    if (subPct > 60.0) {
      if (existingSub60 && existingSub60.recoveryStatus === 'active') {
        await saveTrackingRecord(supabase, { ...existingSub60, recoveryStatus: 'recovered' });
      }
      if (existingSub50 && existingSub50.recoveryStatus === 'active') {
        await saveTrackingRecord(supabase, { ...existingSub50, recoveryStatus: 'recovered' });
      }
    } else if (subPct > 50.0 && subPct <= 60.0) {
      if (existingSub50 && existingSub50.recoveryStatus === 'active') {
        await saveTrackingRecord(supabase, { ...existingSub50, recoveryStatus: 'recovered' });
      }
    }

    // Priority Rule: If subject <= 50%, evaluate 50% Critical Alert (Suppress 60%)
    if (subPct <= 50.0) {
      const isEligibleSub50 = !existingSub50 || existingSub50.recoveryStatus === 'recovered' || now >= existingSub50.nextEligibleAt;

      if (isEligibleSub50) {
        const emailSubjectStudent = `Critical Alert: ${subName} Attendance Has Dropped to ${subPct.toFixed(1)}%`;
        const emailSubjectParent = `Critical Alert: ${subName} Attendance for ${student.name} Has Dropped to ${subPct.toFixed(1)}%`;
        const htmlBodyStudent = getSubjectCritical50Template({ student, subjectItem: subItem, dateStr, isParent: false });
        const htmlBodyParent = getSubjectCritical50Template({ student, subjectItem: subItem, dateStr, isParent: true });

        await dispatchNotification({
          recipients: ['student', 'parent'],
          subject: emailSubjectStudent,
          subjectParent: emailSubjectParent,
          htmlStudent: htmlBodyStudent,
          htmlParent: htmlBodyParent,
          key: subKey50,
          category: 'subject',
          subjectName: subName,
          attendanceType: subType,
          threshold: 50,
          percentage: subPct
        });
      }
    } else if (subPct <= 60.0) {
      // 60% Subject Warning (Student Only)
      const isEligibleSub60 = !existingSub60 || existingSub60.recoveryStatus === 'recovered' || now >= existingSub60.nextEligibleAt;

      if (isEligibleSub60) {
        const emailSubject = `Attendance Warning: ${subName} Has Reached ${subPct.toFixed(1)}%`;
        const htmlBody = getSubjectWarning60Template({ student, subjectItem: subItem, dateStr });

        await dispatchNotification({
          recipients: ['student'],
          subject: emailSubject,
          html: htmlBody,
          key: subKey60,
          category: 'subject',
          subjectName: subName,
          attendanceType: subType,
          threshold: 60,
          percentage: subPct
        });
      }
    }
  }

  return {
    studentId: student.id,
    overallPercentage: overall.percentage,
    warningsDispatched
  };
}

/**
 * Batch evaluates all students or students of a department/semester
 */
async function evaluateAllStudents(supabase, sendEmailFn, filter = {}, options = {}) {
  let query = supabase.from('students').select('ID, Department, Semester');
  if (filter.department) query = query.ilike('Department', `%${filter.department}%`);
  if (filter.semester) query = query.eq('Semester', filter.semester);

  const { data: students, error } = await query;
  if (error) throw error;

  const results = [];
  for (const s of (students || [])) {
    try {
      const res = await evaluateStudentWarnings(supabase, sendEmailFn, s.ID, options);
      results.push(res);
    } catch (err) {
      console.error(`[evaluateAllStudents] Error evaluating student ${s.ID}:`, err.message);
    }
  }

  return {
    totalEvaluated: results.length,
    totalWarningsSent: results.reduce((acc, r) => acc + (r.warningsDispatched ? r.warningsDispatched.length : 0), 0),
    details: results
  };
}

/**
 * Fetch warning logs (from Supabase or local cache fallback)
 */
async function getWarningLogs(supabase, filter = {}) {
  initStorage();
  const limit = parseInt(filter.limit, 10) || 50;

  if (supabase) {
    try {
      let query = supabase.from('AttendanceWarningLogs').select('*').order('UpdatedAt', { ascending: false }).limit(limit);
      if (filter.studentId) {
        query = query.ilike('StudentID', filter.studentId.trim());
      }
      if (filter.category) {
        query = query.eq('Category', filter.category.trim().toLowerCase());
      }
      if (filter.threshold) {
        query = query.eq('Threshold', parseInt(filter.threshold, 10));
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (e) {
      // Supabase table query failed, fall through to memory cache
    }
  }

  // Fallback: in-memory cache
  let logs = Array.from(memoryWarningCache.values());
  if (filter.studentId) {
    const sId = filter.studentId.trim().toLowerCase();
    logs = logs.filter(l => (l.studentId || l.StudentID || '').toLowerCase() === sId);
  }
  if (filter.category) {
    const cat = filter.category.trim().toLowerCase();
    logs = logs.filter(l => (l.category || l.Category || '').toLowerCase() === cat);
  }
  if (filter.threshold) {
    const th = parseInt(filter.threshold, 10);
    logs = logs.filter(l => parseInt(l.threshold || l.Threshold, 10) === th);
  }
  logs.sort((a, b) => (b.updatedAt || b.UpdatedAt || 0) - (a.updatedAt || a.UpdatedAt || 0));
  return logs.slice(0, limit);
}

module.exports = {
  calculateStudentMetrics,
  evaluateStudentWarnings,
  evaluateAllStudents,
  getTrackingKey,
  getTrackingRecord,
  saveTrackingRecord,
  getWarningLogs,
  SEVEN_DAYS_MS,
  _clearCacheForTesting,
  templates: {
    getOverallWarning60Template,
    getSubjectWarning60Template,
    getOverallCritical50Template,
    getSubjectCritical50Template
  }
};
