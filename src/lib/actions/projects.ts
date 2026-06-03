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
