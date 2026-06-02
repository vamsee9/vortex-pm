/**
 * middleware.ts
 * -------------
 * Next.js middleware — runs on EVERY request before it hits your pages.
 * Its only job is to refresh the Supabase auth session and redirect
 * unauthenticated users to /login.
 *
 * The matcher config below tells Next.js which routes this should run on.
 * We exclude static files, images, and favicon to keep things fast.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     * - Public assets like images/svgs
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
