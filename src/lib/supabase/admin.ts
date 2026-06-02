/**
 * supabase/admin.ts
 * -----------------
 * Admin Supabase client using the SERVICE ROLE key.
 * This bypasses all RLS policies — use with extreme caution.
 *
 * Only two places should use this:
 * 1. The webhook endpoint (/api/webhooks/jira) — to upsert data from Jira
 * 2. The admin user management API (/api/admin/users) — to create/manage users
 *
 * NEVER import this in client components or expose it to the browser.
 */

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. " +
      "Check your .env file."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // We don't need to persist sessions for the admin client.
      // It runs server-side only.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
