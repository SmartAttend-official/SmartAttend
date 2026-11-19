-- =====================================================================
-- SmartAttend — Supabase RLS Setup
-- Run this in Supabase SQL Editor if you ever add new tables
-- =====================================================================

-- Step 1: Create SecurityEvents table (for account lockout persistence)
CREATE TABLE IF NOT EXISTS "SecurityEvents" (
  "Email"          TEXT PRIMARY KEY,
  "FailedAttempts" INTEGER NOT NULL DEFAULT 0,
  "LockedUntil"    BIGINT  NOT NULL DEFAULT 0,
  "LastAttempt"    BIGINT  NOT NULL DEFAULT 0,
  "UpdatedAt"      BIGINT  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_securityevents_lockeduntil
  ON "SecurityEvents" ("LockedUntil");

-- Step 2: Enable RLS on ALL tables automatically
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Deny anon access" ON %I', tbl.tablename);
    EXECUTE format('CREATE POLICY "Deny anon access" ON %I FOR ALL TO anon USING (false)', tbl.tablename);
    RAISE NOTICE 'Protected: %', tbl.tablename;
  END LOOP;
END $$;

-- Step 3: Verify — all tables should show TRUE
SELECT tablename AS "Table", rowsecurity AS "RLS Enabled"
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

