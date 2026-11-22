-- ==============================================================================
-- SMARTATTEND — MIGRATION 04: SAFE MULTI-TENANCY DEFAULTS & ISOLATION
-- ==============================================================================
-- Purpose:
--   Non-destructively provisions institutional multi-tenancy columns and tables.
--   Enforces a backward-compatible default ('INST_MAIN') so that existing legacy
--   single-tenant records and endpoints function seamlessly with zero disruption.
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

-- 3. Non-destructive column additions with default fallback
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';

ALTER TABLE public.AttendanceHistory 
ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';

ALTER TABLE public.LeaveRequests 
ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';

ALTER TABLE public.SecurityEvents 
ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) DEFAULT 'INST_MAIN';

-- 4. B-Tree Performance Indexes for Institutional Scoping
CREATE INDEX IF NOT EXISTS idx_students_tenant ON public.students(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_history_tenant ON public.AttendanceHistory(institution_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON public.LeaveRequests(institution_id);
