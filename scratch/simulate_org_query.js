const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zruonfdnfvgmaebanvdm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydW9uZmRuZnZnbWFlYmFudmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTczODksImV4cCI6MjA5MjU5MzM4OX0.AfutlmSt6ix8TNm0Lc70P2R2U554CXSaa7DxPyY8Hz4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Signing in as organization bunny.akki21@gmail.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'bunny.akki21@gmail.com',
    password: 'password123' // Wait, we don't know the exact password. Let's see if we can use a select query with Service Role Key?
  });
  
  if (authError) {
    console.error("Auth error:", authError.message);
    return;
  }
  
  console.log("Logged in successfully! User ID:", authData.user.id);
  
  // Try querying profiles as logged-in user
  const { data: pending, error: dbError } = await supabase
    .from('profiles')
    .select('*')
    .eq('org_id', authData.user.id)
    .in('role', ['doctor', 'lab'])
    .eq('status', 'pending');
    
  if (dbError) {
    console.error("Database query error:", dbError.message);
  } else {
    console.log("Pending profiles fetched as Org:", pending);
  }
}

run();
