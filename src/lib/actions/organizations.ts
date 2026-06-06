/**
 * lib/actions/organizations.ts
 * ----------------------------
 * Server actions for managing Organizations.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isDemoModeActive, getMockOrganizations } from "@/lib/demo-mode";
import type { Organization } from "@/lib/types";
import crypto from "crypto";

function generateTempPassword(): string {
  const length = 16;
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O
  const lowercase = "abcdefghjkmnpqrstuvwxyz"; // Removed i, l, o
  const numbers = "23456789"; // Removed 0, 1
  const special = "#$@!%&*?";

  let password = "";
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
}

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

export async function createOrganizationWithAdmin(
  orgName: string, 
  orgSlug: string, 
  adminUsername: string, 
  adminName: string, 
  adminEmail: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "owner") {
    throw new Error("Only global owners can create organizations");
  }

  const adminClient = createAdminClient();

  // 1. Create the Organization
  const { data: org, error: orgError } = await adminClient
    .from("organizations")
    .insert([{ name: orgName, slug: orgSlug, created_by: user.id }])
    .select()
    .single();

  if (orgError) {
    throw new Error(`Organization creation failed: ${orgError.message}`);
  }

  // 2. Generate temporary password
  const tempPassword = generateTempPassword();
  const finalEmail = adminEmail || `${adminUsername}@${org.slug}.vortex`;

  // 3. Create the Admin User in Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: finalEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: adminName,
      username: adminUsername,
      role: "admin", // They are an Org Admin
      must_change_password: true,
    },
  });

  if (authError) {
    // Rollback Organization
    await adminClient.from("organizations").delete().eq("id", org.id);
    throw new Error(`Failed to create Org Admin user: ${authError.message}`);
  }

  const newUserId = authData.user.id;

  // 4. Create Profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({
      id: newUserId,
      username: adminUsername,
      email: finalEmail,
      org_id: org.id,
      role: "admin",
    });

  if (profileError) {
    // Rollback User and Org
    await adminClient.auth.admin.deleteUser(newUserId);
    await adminClient.from("organizations").delete().eq("id", org.id);
    throw new Error(`Failed to create user profile: ${profileError.message}`);
  }

  // 5. Add to org_members as admin
  const { error: memberError } = await adminClient
    .from("org_members")
    .insert([{ org_id: org.id, user_id: newUserId, role: "admin" }]);
    
  if (memberError) {
    // Rollback Profile, User, and Org
    await adminClient.from("profiles").delete().eq("id", newUserId);
    await adminClient.auth.admin.deleteUser(newUserId);
    await adminClient.from("organizations").delete().eq("id", org.id);
    throw new Error(`Failed to assign organization admin: ${memberError.message}`);
  }

  revalidatePath("/orgs");
  
  return {
    organization: org as Organization,
    adminCredentials: {
      email: finalEmail,
      password: tempPassword
    }
  };
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

export async function deleteOrganizationCascading(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Double check if the user is a global owner or org admin
  const isOwner = user.user_metadata?.role === "owner";
  const adminClient = createAdminClient();

  // 1. Delete the organization
  const { error: orgError } = await adminClient
    .from("organizations")
    .delete()
    .eq("id", id);

  if (orgError) {
    throw new Error(`Failed to delete organization: ${orgError.message}`);
  }

  // 2. If the user is NOT a global owner, purge their user account
  if (!isOwner) {
    const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error(`Failed to delete user account ${user.id} during org cascade delete:`, authError);
      // Even if user deletion fails, org is already deleted (cascade achieved via ON DELETE CASCADE in db for projects/tasks etc.)
      throw new Error(`Organization deleted, but failed to delete user account: ${authError.message}`);
    }
  }

  revalidatePath("/orgs");
}
