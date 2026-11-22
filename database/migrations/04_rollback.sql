-- ==============================================================================
-- SMARTATTEND — MIGRATION 04 ROLLBACK
-- ==============================================================================
DROP INDEX IF EXISTS public.idx_students_tenant;
DROP INDEX IF EXISTS public.idx_attendance_history_tenant;
DROP INDEX IF EXISTS public.idx_leave_requests_tenant;

ALTER TABLE public.students DROP COLUMN IF EXISTS institution_id;
ALTER TABLE public.AttendanceHistory DROP COLUMN IF EXISTS institution_id;
ALTER TABLE public.LeaveRequests DROP COLUMN IF EXISTS institution_id;
ALTER TABLE public.SecurityEvents DROP COLUMN IF EXISTS institution_id;
