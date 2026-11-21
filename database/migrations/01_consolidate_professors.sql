-- ==============================================================================
-- SMARTATTEND MIGRATION 01: UNIFIED PROFESSORS TABLE
-- ==============================================================================
-- Target: Consolidate legacy department-split tables (BCA, MCA, BBA, MBA)
-- into a unified 'professors' relational table while preserving 100% backward compatibility.
-- Non-destructive: Does NOT drop legacy tables.
-- ==============================================================================

-- 1. Create Unified Professors Table
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

-- 2. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_professors_dept ON public."professors"("Department");
CREATE INDEX IF NOT EXISTS idx_professors_inst ON public."professors"("institution_id");

-- 3. Enable Row-Level Security
ALTER TABLE public."professors" ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Service role full access on professors" ON public."professors";
CREATE POLICY "Service role full access on professors"
    ON public."professors"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Professors can view own profile" ON public."professors";
CREATE POLICY "Professors can view own profile"
    ON public."professors"
    FOR SELECT
    TO authenticated
    USING ("Email" = auth.jwt() ->> 'email');

-- 5. Non-Destructive Data Hydration from Legacy Tables (if present)
DO $$
BEGIN
    -- Hydrate from BCA
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'BCA') THEN
        INSERT INTO public."professors" (
            "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", "Department", "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        )
        SELECT "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", COALESCE("Department", 'BCA'), "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        FROM public."BCA"
        ON CONFLICT ("Email") DO UPDATE
        SET "Password" = EXCLUDED."Password",
            "Department" = EXCLUDED."Department",
            "TwoFactorEnabled" = EXCLUDED."TwoFactorEnabled";
    END IF;

    -- Hydrate from MCA
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'MCA') THEN
        INSERT INTO public."professors" (
            "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", "Department", "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        )
        SELECT "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", COALESCE("Department", 'MCA'), "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        FROM public."MCA"
        ON CONFLICT ("Email") DO UPDATE
        SET "Password" = EXCLUDED."Password",
            "Department" = EXCLUDED."Department",
            "TwoFactorEnabled" = EXCLUDED."TwoFactorEnabled";
    END IF;

    -- Hydrate from BBA
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'BBA') THEN
        INSERT INTO public."professors" (
            "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", "Department", "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        )
        SELECT "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", COALESCE("Department", 'BBA'), "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        FROM public."BBA"
        ON CONFLICT ("Email") DO UPDATE
        SET "Password" = EXCLUDED."Password",
            "Department" = EXCLUDED."Department",
            "TwoFactorEnabled" = EXCLUDED."TwoFactorEnabled";
    END IF;

    -- Hydrate from MBA
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'MBA') THEN
        INSERT INTO public."professors" (
            "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", "Department", "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        )
        SELECT "ID", "Email", "Password", "Name", "Professor  first_name", "Professor  last_name", COALESCE("Department", 'MBA'), "Designation", "TwoFactorEnabled", "OTP", "OTP_Timestamp"
        FROM public."MBA"
        ON CONFLICT ("Email") DO UPDATE
        SET "Password" = EXCLUDED."Password",
            "Department" = EXCLUDED."Department",
            "TwoFactorEnabled" = EXCLUDED."TwoFactorEnabled";
    END IF;
END $$;
