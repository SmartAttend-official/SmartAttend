/**
 * SmartAttend - Biometric Data Migration Utility
 * 
 * Safely migrates existing plaintext face encodings in Supabase to AES-256-GCM encryption.
 * Idempotent: Skips records that are already encrypted.
 * 
 * Usage:
 *   node server/utils/migrateExistingEncodings.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { encryptBiometric, isEncrypted } = require('./biometricCrypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env or environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateEncodings() {
  console.log('--- Starting Biometric Encodings Encryption Migration ---');
  
  const { data: students, error } = await supabase
    .from('students')
    .select('ID, Name, Face_Encoding')
    .not('Face_Encoding', 'is', null);

  if (error) {
    console.error('Failed to fetch students:', error.message);
    process.exit(1);
  }

  console.log(`Found ${students.length} student records with face encodings.`);

  let alreadyEncryptedCount = 0;
  let migratedCount = 0;
  let errorCount = 0;

  for (const student of students) {
    const rawEncoding = student.Face_Encoding;
    if (!rawEncoding || rawEncoding.trim() === '') continue;

    if (isEncrypted(rawEncoding)) {
      alreadyEncryptedCount++;
      continue;
    }

    try {
      const encrypted = encryptBiometric(rawEncoding);
      const payloadToSave = JSON.stringify(encrypted);

      const { error: updateErr } = await supabase
        .from('students')
        .update({ Face_Encoding: payloadToSave })
        .eq('ID', student.ID);

      if (updateErr) {
        console.error(`Failed to update student ID ${student.ID}:`, updateErr.message);
        errorCount++;
      } else {
        migratedCount++;
        console.log(`✓ Migrated student ID ${student.ID} (${student.Name || 'Unknown'})`);
      }
    } catch (e) {
      console.error(`Error processing student ID ${student.ID}:`, e.message);
      errorCount++;
    }
  }

  console.log('--- Migration Summary ---');
  console.log(`Total checked       : ${students.length}`);
  console.log(`Already encrypted   : ${alreadyEncryptedCount}`);
  console.log(`Successfully migrated: ${migratedCount}`);
  console.log(`Errors              : ${errorCount}`);
  console.log('Migration finished.');
}

if (require.main === module) {
  migrateEncodings().catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  });
}

module.exports = { migrateEncodings };
