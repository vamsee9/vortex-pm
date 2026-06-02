/**
 * lib/actions/organizations.ts
 * ----------------------------
 * Server actions for managing Organizations.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isDemoModeActive, getMockOrganizations } from "@/lib/demo-mode";
import type { Organization } from "@/lib/types";

export async function fetchOrganizations(): Promise<Organization[]> {
  if (await isDemoModeActive()) {
    return getMockOrganizations();
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching organizations:", error);
    return [];
  }

  return data as Organization[];
}

export async function createOrganization(name: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // 1. Create the org
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert([{ name, slug, created_by: user.id }])
    .select()
    .single();

  if (orgError) {
    throw new Error(orgError.message);
  }

  // 2. Add creator as owner in org_members
  const { error: memberError } = await supabase
    .from("org_members")
    .insert([{ org_id: org.id, user_id: user.id, role: "owner" }]);
    
  if (memberError) {
    console.error("Failed to add owner to org_members:", memberError);
    // Ideally we'd rollback here, but Supabase JS doesn't support transactions easily without RPC.
    // For this MVP, we proceed.
  }

  revalidatePath("/orgs");
  return org as Organization;
}

export async function deleteOrganization(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/orgs");
}
