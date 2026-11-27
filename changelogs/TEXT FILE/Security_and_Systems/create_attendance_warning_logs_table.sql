-- ==============================================================================
-- SmartAttend — Automated Attendance Monitoring & Warning Notification System
-- Table: AttendanceWarningLogs
-- Description: Persistent tracking for automated attendance warnings (60% and 50%)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public."AttendanceWarningLogs" (
    "TrackingKey" TEXT PRIMARY KEY,
    "StudentID" TEXT NOT NULL,
    "Category" TEXT NOT NULL CHECK ("Category" IN ('overall', 'subject')),
    "SubjectName" TEXT NOT NULL DEFAULT 'OVERALL',
    "AttendanceType" TEXT NOT NULL DEFAULT 'Classroom',
    "Threshold" INTEGER NOT NULL CHECK ("Threshold" IN (50, 60)),
    "LastNotifiedAt" BIGINT NOT NULL,
    "LastNotifiedPercentage" NUMERIC(5, 2) NOT NULL,
    "NextEligibleAt" BIGINT NOT NULL,
    "Recipients" TEXT NOT NULL,
    "DeliveryStatus" TEXT NOT NULL DEFAULT 'sent',
    "RecoveryStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("RecoveryStatus" IN ('active', 'recovered')),
    "UpdatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT
);

-- Indexes for high performance query lookups
CREATE INDEX IF NOT EXISTS idx_awl_studentid ON public."AttendanceWarningLogs"("StudentID");
CREATE INDEX IF NOT EXISTS idx_awl_next_eligible ON public."AttendanceWarningLogs"("NextEligibleAt");
CREATE INDEX IF NOT EXISTS idx_awl_recovery ON public."AttendanceWarningLogs"("RecoveryStatus");
CREATE INDEX IF NOT EXISTS idx_awl_category ON public."AttendanceWarningLogs"("Category");

-- Enable Row Level Security (RLS)
ALTER TABLE public."AttendanceWarningLogs" ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy for backend server
DROP POLICY IF EXISTS "Service role full access on AttendanceWarningLogs" ON public."AttendanceWarningLogs";
CREATE POLICY "Service role full access on AttendanceWarningLogs"
    ON public."AttendanceWarningLogs"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users (Admin / Professor) read-only policy
DROP POLICY IF EXISTS "Authenticated users can read AttendanceWarningLogs" ON public."AttendanceWarningLogs";
CREATE POLICY "Authenticated users can read AttendanceWarningLogs"
    ON public."AttendanceWarningLogs"
    FOR SELECT
    TO authenticated
    USING (true);

