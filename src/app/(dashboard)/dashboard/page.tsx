/**
 * (dashboard)/dashboard/page.tsx
 * ------------------------------
 * Universal dashboard — server component that reads user role
 * and renders the appropriate dashboard experience:
 *   Owner → Organization grid (Supabase-inspired)
 *   Admin → Project grid for their organization
 *   Member → Redirects to /board (handled by middleware, fallback here)
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OwnerDashboard } from "@/components/dashboards/owner-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = user.user_metadata?.role || "member";

  // Members should never reach here (middleware redirects to /board)
  if (role === "member") {
    redirect("/board");
  }

  // Owner experience: show all organizations
  if (role === "owner") {
    return <OwnerDashboard userId={user.id} userEmail={user.email || ""} userName={user.user_metadata?.display_name || "Owner"} />;
  }

  // Admin experience: show projects for their organization
  if (role === "admin") {
    // Find the admin's organization
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, organizations(id, name, slug)")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    const orgId = membership?.org_id;
    const org = Array.isArray(membership?.organizations)
      ? membership.organizations[0]
      : membership?.organizations;

    if (!orgId) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-neutral-400">No organization assigned. Contact the platform owner.</p>
        </div>
      );
    }

    return (
      <AdminDashboard
        orgId={orgId}
        orgName={(org as any)?.name || "Organization"}
        userId={user.id}
      />
    );
  }

  // Fallback
  redirect("/login");
}
