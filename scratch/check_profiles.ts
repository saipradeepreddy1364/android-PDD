
import { supabase } from "../src/lib/supabase";

async function checkProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name')
    .limit(5);

  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Profiles sample:", data);
  }
}
checkProfiles();
