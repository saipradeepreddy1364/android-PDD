
import { supabase } from "../src/lib/supabase";

async function checkColumns() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching profile:", error);
  } else if (data && data.length > 0) {
    console.log("Profile columns:", Object.keys(data[0]));
    console.log("Sample profile:", data[0]);
  } else {
    console.log("No profiles found.");
  }
}

checkColumns();
