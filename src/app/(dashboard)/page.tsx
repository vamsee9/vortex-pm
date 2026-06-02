/**
 * (dashboard)/page.tsx
 * --------------------
 * Root dashboard page — just redirects to /board.
 * This ensures that visiting "/" after login lands on the Sprint Board.
 */

import { redirect } from "next/navigation";

export default function DashboardRootPage() {
  redirect("/board");
}
