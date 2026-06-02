"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function lookupEmailByUsername(username: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", username)
    .single();

  if (error || !data) {
    return null;
  }

  return data.email;
}

export async function checkUsername(username: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();
    
  return !!data;
}
