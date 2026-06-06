/**
 * api/admin/users/route.ts
 * ------------------------
 * Admin-only API endpoint for managing team members.
 * Only users with role = "owner" in their user_metadata can use this.
 *
 * Endpoints:
 * - GET  → List all users in the system
 * - POST → Create a new user with a temporary password
 *
 * Uses the Supabase Service Role key to access the admin API.
 * This key NEVER reaches the browser — it only runs server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// ─── GET: List all users ───
export async function GET() {
  try {
    // Verify the caller is an admin
    const authError = await verifyAdmin();
    if (authError) return authError;

    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return only safe fields — never expose internal auth details
    const users = data.users.map((user) => ({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.display_name || "",
      username: user.user_metadata?.username || "",
      role: user.user_metadata?.role || "member",
      must_change_password: user.user_metadata?.must_change_password || false,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new user ───
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is an admin
    const authError = await verifyAdmin();
    if (authError) return authError;

    const body = await request.json();
    const { email, display_name, username, org_id, role } = body;

    // Basic validation
    if (!username || !display_name || !org_id) {
      return NextResponse.json(
        { error: "Username, display name, and organization are required." },
        { status: 400 }
      );
    }

    // Generate a cryptographically random temporary password
    // 16 bytes = 24 char base64 string — strong enough for a temp password
    const tempPassword = generateTempPassword();

    const supabase = createAdminClient();

    // 1. Verify org exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("slug")
      .eq("id", org_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 400 });
    }

    // 2. Generate dummy email if email is not provided
    const finalEmail = email ? email : `${username}@${org.slug}.vortex`;

    const { data, error } = await supabase.auth.admin.createUser({
      email: finalEmail,
      password: tempPassword,
      email_confirm: true, // Skip email verification since admin is creating
      user_metadata: {
        display_name,
        username,
        role: role || "member",
        must_change_password: true, // Force password change on first login
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Insert into profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        username: username,
        email: finalEmail,
        org_id: org_id,
        role: role || "member",
      });

    if (profileError) {
      // Should rollback auth user ideally, but leaving it for now
      console.error("Failed to insert profile:", profileError);
    }

    // 4. Insert into org_members
    await supabase
      .from("org_members")
      .insert({
        org_id: org_id,
        user_id: data.user.id,
        role: role === "admin" ? "admin" : (role === "moderator" ? "moderator" : "member"),
      });

    // Return the temp password so the admin can share it
    // This is the ONLY time the temp password is visible
    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        display_name,
      },
      temp_password: tempPassword,
      message: "User created successfully. Share the temporary password with them.",
    });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// Helper: Verify that the current user is an admin
// ────────────────────────────────────────────────────────────
async function verifyAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (user.user_metadata?.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can manage users." },
      { status: 403 }
    );
  }

  // All good — caller is owner
  return null;
}

// ────────────────────────────────────────────────────────────
// Helper: Generate a strong random temporary password
// Format: Mix of uppercase, lowercase, numbers, and special chars
// Example output: "Kx7#mP2$nR4@qW9"
// ────────────────────────────────────────────────────────────
function generateTempPassword(): string {
  const length = 16;
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O to avoid confusion
  const lowercase = "abcdefghjkmnpqrstuvwxyz"; // Removed i, l, o
  const numbers = "23456789"; // Removed 0, 1 to avoid confusion
  const special = "#$@!%&*?";

  // Ensure at least one of each type
  let password = "";
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest randomly from all characters
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password so the guaranteed chars aren't always at the start
  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
}
