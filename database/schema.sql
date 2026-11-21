-- ==============================================================================
-- SmartAttend — Complete PostgreSQL Database Schema & Security Definition
-- Compatible with Supabase PostgreSQL 15+
-- ==============================================================================
-- Idempotent setup script: safe to execute on fresh databases or existing instances.
-- Execute this entire script inside the Supabase SQL Editor (Dashboard -> SQL Editor).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Core Users & Academic Entities
-- ------------------------------------------------------------------------------

-- Administrator Accounts
CREATE TABLE IF NOT EXISTS public."ADMIN" (
    "ID" BIGSERIAL PRIMARY KEY,
    "Email" TEXT UNIQUE NOT NULL,
    "Password" TEXT NOT NULL,
    "Name" TEXT,
    "TwoFactorEnabled" BOOLEAN DEFAULT FALSE,
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Students Table (includes client-side face recognition template storage)
CREATE TABLE IF NOT EXISTS public."students" (
    "ID" TEXT PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Email" TEXT UNIQUE NOT NULL,
    "Password" TEXT NOT NULL,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "Parent_Email" TEXT,
    "ParentEmail" TEXT,
    "FatherEmail" TEXT,
    "Mobile" TEXT,
    "Phone" TEXT,
    "Total_Classes" INTEGER DEFAULT 0,
    "Attended_Classes" INTEGER DEFAULT 0,
    "Percentage" NUMERIC(5, 2) DEFAULT 0.00,
    "Face_Encoding" TEXT, -- Stores JSON: 128-float vector or multi-template JSON
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT,
    "ResetStatus" TEXT,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Unified Faculty Table (Normalized Multi-Tenant Architecture)
CREATE TABLE IF NOT EXISTS public."professors" (
    "ID" TEXT,
    "Email" TEXT PRIMARY KEY,
    "Password" TEXT NOT NULL,
    "Name" TEXT,
    "Professor  first_name" TEXT,
    "Professor  last_name" TEXT,
    "Department" TEXT NOT NULL DEFAULT 'General',
    "Designation" TEXT DEFAULT 'Assistant Professor',
    "TwoFactorEnabled" BOOLEAN DEFAULT FALSE,
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT,
    "institution_id" UUID DEFAULT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy Department Faculty Tables (Maintained for Backward Compatibility)
CREATE TABLE IF NOT EXISTS public."BCA" (
    "ID" TEXT,
    "Email" TEXT PRIMARY KEY,
    "Password" TEXT NOT NULL,
    "Name" TEXT,
    "Professor  first_name" TEXT,
    "Professor  last_name" TEXT,
    "Department" TEXT DEFAULT 'BCA',
    "Designation" TEXT DEFAULT 'Assistant Professor',
    "TwoFactorEnabled" BOOLEAN DEFAULT FALSE,
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS public."MCA" (
    "ID" TEXT,
    "Email" TEXT PRIMARY KEY,
    "Password" TEXT NOT NULL,
    "Name" TEXT,
    "Professor  first_name" TEXT,
    "Professor  last_name" TEXT,
    "Department" TEXT DEFAULT 'MCA',
    "Designation" TEXT DEFAULT 'Assistant Professor',
    "TwoFactorEnabled" BOOLEAN DEFAULT FALSE,
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS public."BBA" (
    "ID" TEXT,
    "Email" TEXT PRIMARY KEY,
    "Password" TEXT NOT NULL,
    "Name" TEXT,
    "Professor  first_name" TEXT,
    "Professor  last_name" TEXT,
    "Department" TEXT DEFAULT 'BBA',
    "Designation" TEXT DEFAULT 'Assistant Professor',
    "TwoFactorEnabled" BOOLEAN DEFAULT FALSE,
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS public."MBA" (
    "ID" TEXT,
    "Email" TEXT PRIMARY KEY,
    "Password" TEXT NOT NULL,
    "Name" TEXT,
    "Professor  first_name" TEXT,
    "Professor  last_name" TEXT,
    "Department" TEXT DEFAULT 'MBA',
    "Designation" TEXT DEFAULT 'Assistant Professor',
    "TwoFactorEnabled" BOOLEAN DEFAULT FALSE,
    "OTP" TEXT,
    "OTP_Timestamp" BIGINT
);

-- Academic Departments, Classes, and Subjects
CREATE TABLE IF NOT EXISTS public."Departments" (
    "id" SERIAL PRIMARY KEY,
    "Name" TEXT,
    "Department_Name" TEXT UNIQUE,
    "Code" TEXT
);

CREATE TABLE IF NOT EXISTS public."Classes" (
    "id" SERIAL PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Code" TEXT,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "Section" TEXT
);

CREATE TABLE IF NOT EXISTS public."Subjects" (
    "id" SERIAL PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Code" TEXT,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "Credits" INTEGER DEFAULT 3,
    "SubjectType" TEXT DEFAULT 'Theory' -- 'Theory' or 'Lab'
);

-- Camera & Classroom Infrastructure Mapping
CREATE TABLE IF NOT EXISTS public."Camera_IPs" (
    "id" SERIAL PRIMARY KEY,
    "Department_Name" TEXT NOT NULL,
    "Classroom_Name" TEXT UNIQUE NOT NULL,
    "IP_Address" TEXT NOT NULL
);

-- Professor Proxy Scheduling
CREATE TABLE IF NOT EXISTS public."Proxies" (
    "id" SERIAL PRIMARY KEY,
    "Subject" TEXT NOT NULL,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "ProxyDate" TEXT NOT NULL,
    "OriginalDate" TEXT,
    "OriginalProfessor" TEXT,
    "ProxyProfessor" TEXT,
    "Reason" TEXT,
    "Status" TEXT DEFAULT 'Active'
);

-- ------------------------------------------------------------------------------
-- 2. Attendance Tracking & Auditing
-- ------------------------------------------------------------------------------

-- Master Attendance History (Classroom & Lab)
CREATE TABLE IF NOT EXISTS public."AttendanceHistory" (
    "id" BIGSERIAL PRIMARY KEY,
    "Date" TEXT NOT NULL,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "Subject" TEXT NOT NULL,
    "StudentID" TEXT NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'Present', -- 'Present', 'Absent', 'On Leave'
    "Type" TEXT DEFAULT 'Classroom', -- 'Classroom' or 'Lab'
    "lateMinutes" INTEGER DEFAULT 0,
    "Timestamp" TIMESTAMPTZ DEFAULT NOW()
);

-- Active Temporary OTP Codes for Laboratory Attendance
CREATE TABLE IF NOT EXISTS public."Active_Codes" (
    "Code" TEXT PRIMARY KEY,
    "ProfessorID" TEXT NOT NULL,
    "Subject" TEXT NOT NULL,
    "ExpiresAt" BIGINT NOT NULL,
    "CreatedAt" BIGINT DEFAULT (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT
);

-- Lab Access Entry Audit Trail
CREATE TABLE IF NOT EXISTS public."Lab_Access_Logs" (
    "id" BIGSERIAL PRIMARY KEY,
    "StudentID" TEXT NOT NULL,
    "StudentName" TEXT,
    "Subject" TEXT,
    "LabCode" TEXT,
    "Timestamp" TIMESTAMPTZ DEFAULT NOW(),
    "Status" TEXT DEFAULT 'Verified'
);

-- Automated Attendance Warning Tracker (60% and 50% Thresholds)
CREATE TABLE IF NOT EXISTS public."AttendanceWarningLogs" (
    "TrackingKey" TEXT PRIMARY KEY,
    "StudentID" TEXT NOT NULL,
    "Category" TEXT NOT NULL CHECK ("Category" IN ('overall', 'subject')),
    "SubjectName" TEXT NOT NULL DEFAULT 'OVERALL',
    "AttendanceType" TEXT NOT NULL DEFAULT 'Classroom',
    "Threshold" INTEGER NOT NULL CHECK ("Threshold" IN (50, 60)),
    "LastNotifiedAt" BIGINT NOT NULL,
    "LastNotifiedPercentage" NUMERIC(5, 2) NOT NULL,
    "NextEligibleAt" BIGINT NOT NULL,
    "Recipients" TEXT NOT NULL,
    "DeliveryStatus" TEXT NOT NULL DEFAULT 'sent',
    "RecoveryStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("RecoveryStatus" IN ('active', 'recovered')),
    "UpdatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT
);

-- Leave Requests & Multimodal AI Verification Records
CREATE TABLE IF NOT EXISTS public."LeaveRequests" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "targetProfessor" TEXT NOT NULL,
    "leaveCategory" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "totalDays" INTEGER DEFAULT 1,
    "reason" TEXT,
    "proofAttachment" TEXT,
    "aiVerdict" TEXT,       -- 'VALID', 'SUSPICIOUS', 'INVALID', 'NOT_APPLICABLE'
    "aiConfidence" NUMERIC(5, 2),
    "aiAnalysis" TEXT,
    "status" TEXT DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT
);

-- Timetables & Syllabus Content
CREATE TABLE IF NOT EXISTS public."Timetables" (
    "FileID" TEXT PRIMARY KEY,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "FileName" TEXT,
    "FileContent" TEXT, -- Base64 encoded or storage URL
    "UploadedBy" TEXT,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Academic Assignments
CREATE TABLE IF NOT EXISTS public."StudentAssignments" (
    "ID" TEXT PRIMARY KEY,
    "ProfessorEmail" TEXT NOT NULL,
    "Department" TEXT NOT NULL,
    "Semester" TEXT NOT NULL,
    "Subject" TEXT NOT NULL,
    "Title" TEXT NOT NULL,
    "Description" TEXT,
    "Deadline" TEXT,
    "AttachmentName" TEXT,
    "FileContent" TEXT,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Security, Rate Limiting & System Auditing
-- ------------------------------------------------------------------------------

-- Account Lockout & Security Events Tracker
CREATE TABLE IF NOT EXISTS public."SecurityEvents" (
    "Email" TEXT PRIMARY KEY,
    "FailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "LockedUntil" BIGINT NOT NULL DEFAULT 0,
    "LastAttempt" BIGINT NOT NULL DEFAULT 0,
    "UpdatedAt" BIGINT NOT NULL DEFAULT 0
);

-- System Audit Trail
CREATE TABLE IF NOT EXISTS public."AuditLogs" (
    "id" BIGSERIAL PRIMARY KEY,
    "Timestamp" TEXT NOT NULL,
    "Type" TEXT NOT NULL,
    "Details" TEXT
);

-- ------------------------------------------------------------------------------
-- 4. High-Performance Query Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_dept_sem ON public."students" ("Department", "Semester");
CREATE INDEX IF NOT EXISTS idx_attendance_history_lookup ON public."AttendanceHistory" ("Date", "Subject", "StudentID");
CREATE INDEX IF NOT EXISTS idx_attendance_history_student ON public."AttendanceHistory" ("StudentID");
CREATE INDEX IF NOT EXISTS idx_attendance_history_sem ON public."AttendanceHistory" ("Semester");
CREATE INDEX IF NOT EXISTS idx_active_codes_expiry ON public."Active_Codes" ("ExpiresAt");
CREATE INDEX IF NOT EXISTS idx_leaverequests_student ON public."LeaveRequests" ("studentId");
CREATE INDEX IF NOT EXISTS idx_leaverequests_prof ON public."LeaveRequests" ("targetProfessor");
CREATE INDEX IF NOT EXISTS idx_securityevents_locked ON public."SecurityEvents" ("LockedUntil");
CREATE INDEX IF NOT EXISTS idx_awl_studentid ON public."AttendanceWarningLogs" ("StudentID");
CREATE INDEX IF NOT EXISTS idx_awl_next_eligible ON public."AttendanceWarningLogs" ("NextEligibleAt");
CREATE INDEX IF NOT EXISTS idx_awl_recovery ON public."AttendanceWarningLogs" ("RecoveryStatus");

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
-- Enable RLS across all application tables to restrict anonymous direct database access.
ALTER TABLE public."ADMIN" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BCA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MCA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BBA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MBA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Camera_IPs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Proxies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AttendanceHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Active_Codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Lab_Access_Logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AttendanceWarningLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LeaveRequests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Timetables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StudentAssignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SecurityEvents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLogs" ENABLE ROW LEVEL SECURITY;

-- Block anonymous access by default on all tables
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Deny anon access" ON public.%I', tbl.tablename);
        EXECUTE format('CREATE POLICY "Deny anon access" ON public.%I FOR ALL TO anon USING (false)', tbl.tablename);
        
        -- Grant full access to backend service_role
        EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', tbl.tablename);
        EXECUTE format('CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl.tablename);
    END LOOP;
END $$;
