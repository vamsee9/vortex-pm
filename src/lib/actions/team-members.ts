/**
 * lib/actions/team-members.ts
 * ----------------------------
 * Server actions for managing Team Members within a Project.
 * Handles user creation with temp credentials, credential tracking,
 * password resets, and downloadable credential files.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function generateTempPassword(): string {
  const length = 16;
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
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

export interface TeamMemberInfo {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
  temp_password_changed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

/**
 * Add a team member to a project's organization.
 * Creates: auth user → profile → org_member.
 * Returns the generated credentials for download.
 */
export async function addTeamMember(
  orgId: string,
  username: string,
  displayName: string,
  email: string,
  role: string = "member"
): Promise<{ member: TeamMemberInfo; credentials: { username: string; email: string; password: string } }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const adminClient = createAdminClient();

  // Get org slug for default email
  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", orgId)
    .single();

  const tempPassword = generateTempPassword();
  const finalEmail = email || `${username}@${org?.slug || "org"}.vortex`;

  // 1. Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: finalEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      username: username,
      role: role,
      must_change_password: true,
    },
  });

  if (authError) {
    throw new Error(`Failed to create user: ${authError.message}`);
  }

  const newUserId = authData.user.id;

  // 2. Create profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({
      id: newUserId,
      username: username,
      email: finalEmail,
      org_id: orgId,
      role: role,
      temp_password_changed: false,
    });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUserId);
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  // 3. Add to org_members
  const { error: memberError } = await adminClient
    .from("org_members")
    .insert([{ org_id: orgId, user_id: newUserId, role: role }]);

  if (memberError) {
    await adminClient.from("profiles").delete().eq("id", newUserId);
    await adminClient.auth.admin.deleteUser(newUserId);
    throw new Error(`Failed to add org member: ${memberError.message}`);
  }

  const member: TeamMemberInfo = {
    id: newUserId,
    username: username,
    email: finalEmail,
    display_name: displayName,
    role: role,
    temp_password_changed: false,
    created_at: new Date().toISOString(),
    last_sign_in_at: null,
  };

  return {
    member,
    credentials: {
      username: username,
      email: finalEmail,
      password: tempPassword,
    },
  };
}

/**
 * Fetch all team members for a project's organization.
 */
export async function fetchProjectMembers(orgId: string): Promise<TeamMemberInfo[]> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Get org member user IDs (non-admin roles)
  const { data: members, error } = await supabase
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", orgId)
    .in("role", ["member", "moderator"]);

  if (error || !members) return [];

  // Fetch profiles and auth data for each member
  const memberInfos: TeamMemberInfo[] = await Promise.all(
    members.map(async (m) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", m.user_id)
        .single();

      // Fetch auth user for last_sign_in
      const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(m.user_id);

      return {
        id: m.user_id,
        username: profile?.username || "—",
        email: profile?.email || "—",
        display_name: authUser?.user_metadata?.display_name || profile?.username || "—",
        role: m.role,
        temp_password_changed: profile?.temp_password_changed ?? false,
        created_at: profile?.created_at || "",
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    })
  );

  return memberInfos;
}

/**
 * Reset a member's password and return new temp credentials.
 */
export async function resetMemberPassword(memberId: string): Promise<{ email: string; password: string }> {
  const adminClient = createAdminClient();

  const tempPassword = generateTempPassword();

  // Update auth password
  const { error: authError } = await adminClient.auth.admin.updateUserById(memberId, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  });

  if (authError) {
    throw new Error(`Failed to reset password: ${authError.message}`);
  }

  // Reset temp_password_changed in profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ temp_password_changed: false })
    .eq("id", memberId);

  if (profileError) {
    console.error("Failed to update profile temp_password_changed:", profileError);
  }

  // Get user email
  const { data: { user } } = await adminClient.auth.admin.getUserById(memberId);
  const email = user?.email || "";

  return { email, password: tempPassword };
}

/**
 * Delete a team member entirely (auth user + profile + org_member).
 */
export async function deleteMember(memberId: string, orgId: string) {
  const adminClient = createAdminClient();

  // Remove from org_members
  await adminClient
    .from("org_members")
    .delete()
    .eq("user_id", memberId)
    .eq("org_id", orgId);

  // Remove profile
  await adminClient
    .from("profiles")
    .delete()
    .eq("id", memberId);

  // Delete auth user
  const { error } = await adminClient.auth.admin.deleteUser(memberId);
  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }

  revalidatePath("/projects");
}
