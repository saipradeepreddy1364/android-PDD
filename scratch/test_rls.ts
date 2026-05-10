
import { supabase } from "../src/lib/supabase";

async function testRLS() {
  const email = "bunny.akki21@gmail.com";
  console.log("Testing profile read for:", email);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.log("Error object:", error);
    console.log("Error message:", error.message);
  } else if (data) {
    console.log("Success! Profile found:", data);
  } else {
    console.log("No profile found (or blocked by RLS)");
    
    // Test if we can read organizations at least
    const { data: orgData } = await supabase.from('profiles').select('*').eq('role', 'organization').limit(1);
    console.log("Can read orgs?", orgData ? orgData.length > 0 : false);
  }
}

testRLS();
