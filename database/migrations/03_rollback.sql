-- ==============================================================================
-- Rollback 03: Revert Performance Optimization Indexes
-- ==============================================================================

DROP INDEX IF EXISTS idx_attendance_history_date_subject;
DROP INDEX IF EXISTS idx_attendance_history_student_id;
DROP INDEX IF EXISTS idx_attendance_history_tenant;
DROP INDEX IF EXISTS idx_students_email_lower;
DROP INDEX IF EXISTS idx_students_tenant_dept_sem;
DROP INDEX IF EXISTS idx_professors_email_lower;
DROP INDEX IF EXISTS idx_leave_requests_active_scanner;
