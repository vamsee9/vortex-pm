/**
 * (dashboard)/layout.tsx
 * ----------------------
 * Dashboard shell layout — wraps all authenticated pages.
 * Provides the sidebar + header structure.
 *
 * IMPORTANT: This layout also enforces the "forced password change"
 * redirect. If the user's metadata says must_change_password = true,
 * they get sent to /change-password before accessing anything else.
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

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in, redirect to login
  if (!user) {
    redirect("/login");
  }

  // If the user must change their password, redirect them
  // But don't redirect if they're already on the change-password page
  // (otherwise it creates an infinite redirect loop)
  const mustChangePassword = user.user_metadata?.must_change_password === true;

  // We can't check the current path in a server layout easily,
  // so we pass the flag to the client and handle it there.
  // Actually, we can allow the change-password page to render normally.

  // Get user info for the sidebar
  const userEmail = user.email || "";
  const userName = user.user_metadata?.display_name || user.email || "User";
  let userRole = user.user_metadata?.role || "member";

  // Multi-tenant project context
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

  const hideSidebar = !activeProjectId && userRole === "owner";
  let projectName = hideSidebar ? "Owner Dashboard" : "Sprint Board";

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/orgs", icon: "Home" }
  ];

  if (activeProjectId) {
    let project = null;

    if (isDemo) {
      const demoProject = getMockProject(activeProjectId);
      if (demoProject) {
        project = {
          ...demoProject,
          organizations: { name: "Acme Corp (Demo)" }
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
        
      projectName = `${orgName} / ${project.name}`;
      breadcrumbs.push({ label: orgName, href: `/orgs/${project.org_id}`, icon: "Building2" });
      breadcrumbs.push({ label: project.name, icon: "FolderKanban" });

      // If not global owner, check org-specific role (skip if demo)
      if (userRole !== "owner" && !isDemo) {
        const { data: member } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", project.org_id)
          .eq("user_id", user.id)
          .single();
        if (member) {
          userOrgRole = member.role;
        }
      }
    }
  }

  // Fetch available sprints for the header dropdown
  let sprints: any[] = [];
  if (isDemo) {
    sprints = getMockSprints(activeProjectId);
  } else {
    sprints = await fetchSprints(activeProjectId);
  }

  // Default to the most recent sprint (first in the list, already sorted desc)
  const defaultSprintId = sprints.length > 0 ? sprints[0].sprint_id : null;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Sidebar */}
      {!hideSidebar && (
        <Sidebar
          userEmail={userEmail}
          userName={userName}
          userRole={userOrgRole}
          activeProjectId={activeProjectId}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          sprints={sprints}
          currentSprintId={defaultSprintId}
          pageTitle={projectName}
          hideSidebar={hideSidebar}
          userName={userName}
          userEmail={userEmail}
        />

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-auto p-6">
          <Breadcrumbs items={breadcrumbs} />
          {/* If password change is required, show a warning banner */}
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
