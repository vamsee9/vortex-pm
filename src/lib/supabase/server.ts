/**
 * supabase/server.ts
 * ------------------
 * Server-side Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Uses cookies to maintain the user session.
 *
 * IMPORTANT: This must be called inside an async context (server component
 * or server action) because it reads cookies from the request.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // This will throw in Server Components because you can't set
            // cookies after the response headers are sent. That's fine —
            // the middleware will handle the session refresh instead.
          }
        },
      },
    }
  );
}
