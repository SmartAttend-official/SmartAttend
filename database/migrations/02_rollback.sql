-- ==============================================================================
-- SMARTATTEND MIGRATION 02 ROLLBACK: REVERT MULTI-TENANCY FOUNDATION
-- ==============================================================================
-- Safely removes migration 02 modifications without affecting application data.
-- ==============================================================================

DO $$
BEGIN
    -- Drop added indexes and columns
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'institution_id') THEN
        DROP INDEX IF EXISTS public.idx_students_institution;
        ALTER TABLE public."students" DROP COLUMN IF EXISTS "institution_id";
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AttendanceHistory' AND column_name = 'institution_id') THEN
        DROP INDEX IF EXISTS public.idx_attendance_history_institution;
        ALTER TABLE public."AttendanceHistory" DROP COLUMN IF EXISTS "institution_id";
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_requests' AND column_name = 'institution_id') THEN
        DROP INDEX IF EXISTS public.idx_leave_requests_institution;
        ALTER TABLE public."leave_requests" DROP COLUMN IF EXISTS "institution_id";
    END IF;

    -- Drop institutions table
    DROP TABLE IF EXISTS public."institutions" CASCADE;
END $$;
