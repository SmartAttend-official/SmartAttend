-- ==============================================================================
-- SMARTATTEND MIGRATION 01 ROLLBACK SCRIPT
-- ==============================================================================
-- Reverses Migration 01: Safely drops the 'professors' table and related policies.
-- Does NOT touch legacy tables (BCA, MCA, BBA, MBA) to ensure zero data loss.
-- ==============================================================================

DROP TABLE IF EXISTS public."professors" CASCADE;
