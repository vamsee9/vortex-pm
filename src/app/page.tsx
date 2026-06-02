/**
 * page.tsx (Root Page)
 * --------------------
 * The root "/" page just redirects users:
 * - If authenticated → /board (handled by middleware + dashboard layout)
 * - If not authenticated → /login (handled by middleware)
 *
 * This redirect works because the middleware intercepts the request
 * and checks the session before this page even renders.
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/board");
}
