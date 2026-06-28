const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Inspecting Active_Codes ScannedStudents column...');
  const { data, error } = await supabase
    .from('Active_Codes')
    .select('ScannedStudents')
    .limit(1);
    
  if (error) {
    console.error('Select error details:', error);
  } else {
    console.log('Select success, data:', data);
  }
}

main();
