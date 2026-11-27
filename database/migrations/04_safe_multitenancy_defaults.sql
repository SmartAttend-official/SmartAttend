-- ==============================================================================
-- SMARTATTEND — MIGRATION 04: SAFE MULTI-TENANCY DEFAULTS & ISOLATION (EXPANDED)
-- ==============================================================================
-- Purpose:
--   Non-destructively provisions institutional multi-tenancy columns and tables.
--   Enforces a backward-compatible default ('INST_MAIN') across all 10 schema tables
--   so that existing legacy single-tenant records and endpoints function seamlessly.
-- ==============================================================================

-- 1. Master institutions table
CREATE TABLE IF NOT EXISTS public.institutions (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed primary default institution
INSERT INTO public.institutions (id, name, domain, status)
VALUES ('INST_MAIN', 'Default University Campus', 'smartattend.edu', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Non-destructive column additions across all 10 core tables with safe execution
DO $$
BEGIN
    -- students table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
        ALTER TABLE public.students ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_students_tenant ON public.students(institution_id);
    END IF;

    -- AttendanceHistory table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AttendanceHistory') THEN
        ALTER TABLE public."AttendanceHistory" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_attendance_history_tenant ON public."AttendanceHistory"(institution_id);
    END IF;

    -- LeaveRequests table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'LeaveRequests') THEN
        ALTER TABLE public."LeaveRequests" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON public."LeaveRequests"(institution_id);
    END IF;

    -- SecurityEvents table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'SecurityEvents') THEN
        ALTER TABLE public."SecurityEvents" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON public."SecurityEvents"(institution_id);
    END IF;

    -- ADMIN table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ADMIN') THEN
        ALTER TABLE public."ADMIN" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_admin_tenant ON public."ADMIN"(institution_id);
    END IF;

    -- Departments table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Departments') THEN
        ALTER TABLE public."Departments" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_departments_tenant ON public."Departments"(institution_id);
    END IF;

    -- Timetables table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Timetables') THEN
        ALTER TABLE public."Timetables" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_timetables_tenant ON public."Timetables"(institution_id);
    END IF;

    -- Lab_Access_Logs table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Lab_Access_Logs') THEN
        ALTER TABLE public."Lab_Access_Logs" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_lab_access_logs_tenant ON public."Lab_Access_Logs"(institution_id);
    END IF;

    -- AuditLogs table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AuditLogs') THEN
        ALTER TABLE public."AuditLogs" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public."AuditLogs"(institution_id);
    END IF;

    -- Classes table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Classes') THEN
        ALTER TABLE public."Classes" ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';
        CREATE INDEX IF NOT EXISTS idx_classes_tenant ON public."Classes"(institution_id);
    END IF;
END $$;
