const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zruonfdnfvgmaebanvdm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydW9uZmRuZnZnbWFlYmFudmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTczODksImV4cCI6MjA5MjU5MzM4OX0.AfutlmSt6ix8TNm0Lc70P2R2U554CXSaa7DxPyY8Hz4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Checking Supabase profiles...");
  
  // 1. Fetch some profiles
  const { data: profiles, error: err1 } = await supabase
    .from('profiles')
    .select('*')
    .limit(10);
    
  if (err1) {
    console.error("Error reading profiles:", err1);
  } else {
    console.log("Profiles count:", profiles.length);
    console.log("Sample profiles:", JSON.stringify(profiles, null, 2));
  }

  // 2. Fetch pending profiles
  const { data: pending, error: err2 } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending');
    
  if (err2) {
    console.error("Error reading pending profiles:", err2);
  } else {
    console.log("Pending profiles count:", pending.length);
    console.log("Pending profiles:", JSON.stringify(pending, null, 2));
  }
}

test();
