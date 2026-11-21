-- ==============================================================================
-- SMARTATTEND MIGRATION 02: MULTI-TENANCY FOUNDATION
-- ==============================================================================
-- Target: Establish relational multi-tenancy schema to support multiple
-- colleges, institutes, and campuses on a single database cluster with full
-- institutional isolation and tenant-aware partitioning.
-- Non-destructive: Existing single-campus data automatically maps to 'INST_MAIN'.
-- ==============================================================================

-- 1. Create Institutions Registry Table
CREATE TABLE IF NOT EXISTS public."institutions" (
    "id" VARCHAR(64) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(32) UNIQUE NOT NULL,
    "domain" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "attendance_threshold" NUMERIC(5,2) DEFAULT 75.0,
    "condonation_threshold" NUMERIC(5,2) DEFAULT 65.0,
    "is_active" BOOLEAN DEFAULT TRUE,
    "settings" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance Indexes on Institutions
CREATE INDEX IF NOT EXISTS idx_institutions_code ON public."institutions"("code");
CREATE INDEX IF NOT EXISTS idx_institutions_active ON public."institutions"("is_active");

-- 3. Row-Level Security for Institutions Table
ALTER TABLE public."institutions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on institutions" ON public."institutions";
CREATE POLICY "Service role full access on institutions"
    ON public."institutions"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public read active institutions" ON public."institutions";
CREATE POLICY "Public read active institutions"
    ON public."institutions"
    FOR SELECT
    TO public
    USING ("is_active" = true);

-- 4. Seed Default Campus Tenant
INSERT INTO public."institutions" ("id", "name", "code", "domain", "attendance_threshold", "condonation_threshold")
VALUES ('INST_MAIN', 'SmartAttend University Main Campus', 'MAIN', 'smartattend.edu', 75.0, 65.0)
ON CONFLICT ("id") DO NOTHING;

-- 5. Add institution_id to core entity tables (Idempotent)
DO $$
BEGIN
    -- students table
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'institution_id'
        ) THEN
            ALTER TABLE public."students" ADD COLUMN "institution_id" VARCHAR(64) DEFAULT 'INST_MAIN';
            CREATE INDEX IF NOT EXISTS idx_students_institution ON public."students"("institution_id");
        END IF;
    END IF;

    -- AttendanceHistory table
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'AttendanceHistory') THEN
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'AttendanceHistory' AND column_name = 'institution_id'
        ) THEN
            ALTER TABLE public."AttendanceHistory" ADD COLUMN "institution_id" VARCHAR(64) DEFAULT 'INST_MAIN';
            CREATE INDEX IF NOT EXISTS idx_attendance_history_institution ON public."AttendanceHistory"("institution_id");
        END IF;
    END IF;

    -- leave_requests table
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'leave_requests' AND column_name = 'institution_id'
        ) THEN
            ALTER TABLE public."leave_requests" ADD COLUMN "institution_id" VARCHAR(64) DEFAULT 'INST_MAIN';
            CREATE INDEX IF NOT EXISTS idx_leave_requests_institution ON public."leave_requests"("institution_id");
        END IF;
    END IF;
END $$;
