/**
 * lib/actions/projects.ts
 * -----------------------
 * Server actions for managing Projects within an Organization.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isDemoModeActive, getMockProjects } from "@/lib/demo-mode";
import type { Project } from "@/lib/types";
import crypto from "crypto";

export async function fetchProjects(orgId: string): Promise<Project[]> {
  if (await isDemoModeActive()) {
    return getMockProjects(orgId);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return data as Project[];
}

export async function createProject(
  orgId: string, 
  name: string, 
  slug: string, 
  jiraProjectKey: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Generate a random webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  const { data, error } = await supabase
    .from("projects")
    .insert([{ 
      org_id: orgId,
      name, 
      slug, 
      jira_project_key: jiraProjectKey.toUpperCase(),
      webhook_secret: webhookSecret,
      created_by: user.id 
    }])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/orgs/${orgId}`);
  return data as Project;
}

export async function deleteProject(id: string, orgId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/orgs/${orgId}`);
}

export async function updateProjectFieldMappings(
  projectId: string,
  fieldMappings: Record<string, string>
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ field_mappings: fieldMappings })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

/**
 * Enhanced fetch for Admin dashboard — includes member count and sprint count.
 */
export async function fetchProjectsWithStats(orgId: string): Promise<Project[]> {
  if (await isDemoModeActive()) {
    return getMockProjects(orgId);
  }

  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error || !projects) {
    console.error("Error fetching projects:", error);
    return [];
  }

  // Enrich with member count and sprint count
  const enriched = await Promise.all(
    projects.map(async (project: any) => {
      // Member count (count org members who are not admins)
      const { count: memberCount } = await supabase
        .from("org_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "member");

      // Sprint count (distinct sprint_ids in project_tasks)
      const { data: sprints } = await supabase
        .from("project_tasks")
        .select("sprint_id")
        .eq("project_id", project.id)
        .not("sprint_id", "is", null);

      const uniqueSprints = new Set(sprints?.map((s: any) => s.sprint_id) || []);

      return {
        ...project,
        member_count: memberCount ?? 0,
        sprint_count: uniqueSprints.size,
      } as Project;
    })
  );

  return enriched;
}

/**
 * Create a project in draft status for the setup wizard.
 */
export async function createDraftProject(
  orgId: string,
  name: string,
  slug: string,
  jiraProjectKey: string
): Promise<Project> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const webhookSecret = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabase
    .from("projects")
    .insert([{
      org_id: orgId,
      name,
      slug,
      jira_project_key: jiraProjectKey.toUpperCase(),
      webhook_secret: webhookSecret,
      created_by: user.id,
      status: "draft",
      wizard_step: 0,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  return data as Project;
}

/**
 * Update the wizard step for a draft project.
 */
export async function updateProjectWizardStep(projectId: string, step: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ wizard_step: step })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Activate a project (transition from draft → active).
 * Only allowed if wizard_step >= 3 (all steps completed).
 */
export async function activateProject(projectId: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("wizard_step")
    .eq("id", projectId)
    .single();

  if (!project || project.wizard_step < 3) {
    throw new Error("All wizard steps must be completed before activation.");
  }

  const { error } = await supabase
    .from("projects")
    .update({
      status: "active",
      wizard_completed_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

