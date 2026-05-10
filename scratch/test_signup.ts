
import { supabase } from "../src/lib/supabase";

async function testSignup() {
  const email = "bunny.akki21@gmail.com";
  console.log("Testing signup for existing email:", email);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: "DUMMY_CHECK_PWD_" + Math.random().toString(36),
  });

  if (error) {
    console.log("Error object:", error);
    console.log("Error message:", error.message);
  } else {
    console.log("Success! Data:", data);
  }
}

testSignup();
