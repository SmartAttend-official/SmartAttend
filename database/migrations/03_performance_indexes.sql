-- ==============================================================================
-- Migration 03: Performance Optimization Composite & Covering Indexes
-- Applied: 2026-11-21
-- Purpose: Optimize high-throughput query paths for campus-scale deployment
-- Target: Sub-15ms response times on attendance verification and login
-- ==============================================================================

-- 1. AttendanceHistory Optimization
-- Speeds up duplicate session verification: .eq('Date', date).eq('Subject', subject)
CREATE INDEX IF NOT EXISTS idx_attendance_history_date_subject 
ON "AttendanceHistory" ("Date", "Subject");

-- Speeds up per-student history aggregation: .eq('StudentID', sId)
CREATE INDEX IF NOT EXISTS idx_attendance_history_student_id 
ON "AttendanceHistory" ("StudentID");

-- Speeds up tenant-scoped attendance history queries
CREATE INDEX IF NOT EXISTS idx_attendance_history_tenant 
ON "AttendanceHistory" ("institution_id");

-- 2. Students Table Optimization
-- Speeds up student login: .ilike('Email', cleanEmail)
CREATE INDEX IF NOT EXISTS idx_students_email_lower 
ON "students" (LOWER("Email"));

-- Speeds up tenant student directory filtering: .eq('institution_id', req.tenantId)
CREATE INDEX IF NOT EXISTS idx_students_tenant_dept_sem 
ON "students" ("institution_id", "Department", "Semester");

-- 3. Unified Professors Table Optimization
-- Speeds up faculty login: .ilike('Email', cleanEmail)
CREATE INDEX IF NOT EXISTS idx_professors_email_lower 
ON "professors" (LOWER("Email"));

-- 4. Leave Requests Optimization
-- Speeds up active leaves query on daily scanner: (studentId, status)
CREATE INDEX IF NOT EXISTS idx_leave_requests_active_scanner 
ON "LeaveRequests" ("studentId", "status", "startDate", "endDate");
