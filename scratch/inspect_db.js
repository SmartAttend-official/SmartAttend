const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  console.log("Connecting to:", process.env.SUPABASE_URL);
  
  // Query all tables and columns from PostgreSQL information_schema
  const { data, error } = await supabase.rpc('inspect_schema');
  
  if (error) {
    // If RPC doesn't exist, we can run a raw SQL query using a custom select
    console.log("RPC failed, trying raw query...");
    const { data: cols, error: err } = await supabase
      .from('students')
      .select('*')
      .limit(1);
      
    if (err) {
      console.error("Error fetching students:", err.message);
    } else {
      console.log("Columns in 'students' table:");
      if (cols && cols.length > 0) {
        console.log(Object.keys(cols[0]));
      } else {
        // If empty, let's try to query the schema directly using a postgres query
        console.log("Students table is empty, could not inspect keys from first row.");
      }
    }
  } else {
    console.log("Schema inspection results:", data);
  }
}

inspect();
