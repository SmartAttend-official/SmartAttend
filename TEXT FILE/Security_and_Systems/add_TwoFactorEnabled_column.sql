-- SmartAttend: Add TwoFactorEnabled Column to Professor Tables
-- Run this SQL in: https://supabase.com/dashboard/project/kuqynurnkslvultxzzen/sql/new
-- 
-- This adds the Two-Factor Authentication column to all professor department tables.
-- After running this, the 2FA toggle in the Professor Profile > Notification Preferences
-- section will work correctly.

ALTER TABLE "BCA" ADD COLUMN IF NOT EXISTS "TwoFactorEnabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE "MCA" ADD COLUMN IF NOT EXISTS "TwoFactorEnabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE "BBA" ADD COLUMN IF NOT EXISTS "TwoFactorEnabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE "MBA" ADD COLUMN IF NOT EXISTS "TwoFactorEnabled" BOOLEAN DEFAULT FALSE;

-- Verify columns were added:
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('BCA', 'MCA', 'BBA', 'MBA') 
AND column_name = 'TwoFactorEnabled';
