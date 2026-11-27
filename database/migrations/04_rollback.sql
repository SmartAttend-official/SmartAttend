-- ==============================================================================
-- SMARTATTEND — MIGRATION 04 ROLLBACK (EXPANDED)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
        DROP INDEX IF EXISTS public.idx_students_tenant;
        ALTER TABLE public.students DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AttendanceHistory') THEN
        DROP INDEX IF EXISTS public.idx_attendance_history_tenant;
        ALTER TABLE public."AttendanceHistory" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'LeaveRequests') THEN
        DROP INDEX IF EXISTS public.idx_leave_requests_tenant;
        ALTER TABLE public."LeaveRequests" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'SecurityEvents') THEN
        DROP INDEX IF EXISTS public.idx_security_events_tenant;
        ALTER TABLE public."SecurityEvents" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ADMIN') THEN
        DROP INDEX IF EXISTS public.idx_admin_tenant;
        ALTER TABLE public."ADMIN" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Departments') THEN
        DROP INDEX IF EXISTS public.idx_departments_tenant;
        ALTER TABLE public."Departments" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Timetables') THEN
        DROP INDEX IF EXISTS public.idx_timetables_tenant;
        ALTER TABLE public."Timetables" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Lab_Access_Logs') THEN
        DROP INDEX IF EXISTS public.idx_lab_access_logs_tenant;
        ALTER TABLE public."Lab_Access_Logs" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AuditLogs') THEN
        DROP INDEX IF EXISTS public.idx_audit_logs_tenant;
        ALTER TABLE public."AuditLogs" DROP COLUMN IF EXISTS institution_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Classes') THEN
        DROP INDEX IF EXISTS public.idx_classes_tenant;
        ALTER TABLE public."Classes" DROP COLUMN IF EXISTS institution_id;
    END IF;
END $$;
