/**
 * (dashboard)/layout.tsx
 * ----------------------
 * Dashboard shell layout — wraps all authenticated pages.
 * Provides the sidebar + header structure.
 * Always shows sidebar (role-based nav items handled by sidebar component).
 *
 * Enforces the "forced password change" redirect via banner.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchSprints } from "@/lib/actions/tasks";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Breadcrumbs, BreadcrumbItem } from "@/components/breadcrumbs";
import { isDemoModeActive, getPreviewRole, getMockProject, getMockSprints } from "@/lib/demo-mode";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const mustChangePassword = user.user_metadata?.must_change_password === true;

  const userEmail = user.email || "";
  const userName = user.user_metadata?.display_name || user.email || "User";
  let userRole = user.user_metadata?.role || "member";

  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get("active_project_id")?.value;

  let userOrgRole = userRole;

  const isDemo = await isDemoModeActive();
  if (isDemo) {
    const previewRole = await getPreviewRole();
    if (previewRole) {
      userRole = previewRole;
      userOrgRole = previewRole;
    }
  }

  let pageTitle = "Vortex PM";
  const breadcrumbs: BreadcrumbItem[] = [];

  // Build context based on role
  if (userRole === "owner") {
    pageTitle = "Platform Dashboard";
    breadcrumbs.push({ label: "Dashboard", href: "/dashboard", icon: "Home" });
  } else if (userRole === "admin") {
    pageTitle = "Organization Dashboard";
    breadcrumbs.push({ label: "Dashboard", href: "/dashboard", icon: "Home" });
  } else {
    breadcrumbs.push({ label: "Sprint Board", href: "/board", icon: "Home" });
  }

  if (activeProjectId) {
    let project = null;

    if (isDemo) {
      const demoProject = getMockProject(activeProjectId);
      if (demoProject) {
        project = {
          ...demoProject,
          organizations: { name: "Acme Corp (Demo)" },
        };
      }
    } else {
      const { data } = await supabase
        .from("projects")
        .select(`
          name,
          org_id,
          organizations (
            name
          )
        `)
        .eq("id", activeProjectId)
        .single();
      project = data;
    }

    if (project) {
      const orgName = Array.isArray(project.organizations)
        ? project.organizations[0]?.name
        : (project.organizations as any)?.name || "Organization";

      pageTitle = `${orgName} / ${project.name}`;

      if (userRole !== "member") {
        breadcrumbs.push({ label: orgName, href: `/orgs/${(project as any).org_id}`, icon: "Building2" });
      }
      breadcrumbs.push({ label: project.name, icon: "FolderKanban" });

      // Resolve org-specific role for non-owners
      if (userRole !== "owner" && !isDemo) {
        const { data: member } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", (project as any).org_id)
          .eq("user_id", user.id)
          .single();
        if (member) {
          userOrgRole = member.role;
        }
      }
    }
  }

  // Fetch sprints for header dropdown (only relevant for board/reporting pages)
  let sprints: any[] = [];
  if (isDemo) {
    sprints = getMockSprints(activeProjectId);
  } else if (activeProjectId) {
    sprints = await fetchSprints(activeProjectId);
  }

  const defaultSprintId = sprints.length > 0 ? sprints[0].sprint_id : null;

  // Determine if sprint selector should show
  const showSprintSelector = !!activeProjectId && (userRole === "member" || userRole === "admin");

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Sidebar — always visible, role-aware */}
      <Sidebar
        userEmail={userEmail}
        userName={userName}
        userRole={userOrgRole}
        activeProjectId={activeProjectId}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          sprints={sprints}
          currentSprintId={defaultSprintId}
          pageTitle={pageTitle}
          showSprintSelector={showSprintSelector}
          userName={userName}
          userEmail={userEmail}
        />

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-auto p-6">
          <Breadcrumbs items={breadcrumbs} />
          {mustChangePassword && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
              ⚠️ You must change your password before continuing.{" "}
              <a href="/change-password" className="underline font-medium">
                Change it now →
              </a>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

