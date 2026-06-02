/**
 * actions/tasks.ts
 * ----------------
 * Server Actions for managing Jira tasks.
 * These run on the server and are called from client components
 * using Next.js Server Actions pattern.
 *
 * RLS is enforced automatically by Supabase — the authenticated user
 * can only modify rows where owner_id matches their user ID.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { JiraTask, TaskFilters, SprintOption } from "@/lib/types";
import { isDemoModeActive, getMockTasks, getMockSprints, updateMockTask, deleteMockTask, addDemoTask } from "@/lib/demo-mode";

// ─── Fetch tasks with optional filters ───
export async function fetchTasks(filters: TaskFilters = {}): Promise<JiraTask[]> {
  if (await isDemoModeActive()) {
    return getMockTasks(filters.project_id, filters.sprint_id);
  }

  const supabase = await createClient();

  let query = supabase
    .from("jira_tasks_snapshot")
    .select("*")
    .order("updated_at", { ascending: false });

  // Apply filters only if they have values
  if (filters.project_id) {
    query = query.eq("project_id", filters.project_id);
  }
  if (filters.sprint_id) {
    query = query.eq("sprint_id", filters.sprint_id);
  }
  if (filters.work_type) {
    query = query.eq("work_type", filters.work_type);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.owner_id) {
    query = query.eq("owner_id", filters.owner_id);
  }
  if (filters.search) {
    // Sanitize the search term to prevent PostgREST query breakage.
    // Strip characters that have special meaning in PostgREST filters:
    // parentheses, commas, dots, and percent signs.
    const sanitized = filters.search.replace(/[(),.%\\]/g, "");
    if (sanitized.length > 0) {
      query = query.or(
        `jira_key.ilike.%${sanitized}%,summary.ilike.%${sanitized}%`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch tasks:", error.message);
    return [];
  }

  return (data as JiraTask[]) || [];
}

// ─── Get list of unique sprints for the dropdown selector ───
export async function fetchSprints(projectId?: string): Promise<SprintOption[]> {
  if (await isDemoModeActive()) {
    return getMockSprints(projectId);
  }

  const supabase = await createClient();

  let query = supabase
    .from("jira_tasks_snapshot")
    .select("sprint_id, sprint_name, sprint_start_date, sprint_end_date")
    .not("sprint_id", "is", null)
    .order("sprint_start_date", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch sprints:", error.message);
    return [];
  }

  // Remove duplicates — we might have many rows per sprint
  const uniqueSprints = new Map<string, SprintOption>();
  for (const row of data || []) {
    if (row.sprint_id && !uniqueSprints.has(row.sprint_id)) {
      uniqueSprints.set(row.sprint_id, {
        sprint_id: row.sprint_id,
        sprint_name: row.sprint_name || `Sprint ${row.sprint_id}`,
        sprint_start_date: row.sprint_start_date,
        sprint_end_date: row.sprint_end_date,
      });
    }
  }

  return Array.from(uniqueSprints.values());
}

// ─── Update a task (only works on your own rows due to RLS) ───
export async function updateTask(
  taskId: string,
  updates: Partial<JiraTask>
): Promise<{ success: boolean; error?: string }> {
  if (await isDemoModeActive()) {
    updateMockTask(taskId, updates);
    revalidatePath("/board");
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("jira_tasks_snapshot")
    .update(updates)
    .eq("id", taskId);

  if (error) {
    console.error("Failed to update task:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}

// ─── Duplicate a task to "My Sheet" ───
// Clones someone else's row and makes it yours.
// Strips out user-specific tracking metrics so you start fresh.
export async function duplicateTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  if (await isDemoModeActive()) {
    const tasks = getMockTasks();
    const task = tasks.find((t: any) => t.id === taskId);
    if (task) {
      const { id, ...rest } = task;
      const duplicated = {
        ...rest,
        id: `mock-dup-${Date.now()}`,
      };
      addDemoTask(duplicated);
      revalidatePath("/board");
      return { success: true };
    }
    return { success: false, error: "Could not find task" };
  }

  const supabase = await createClient();

  // First, get the current user's ID
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in to duplicate a task." };
  }

  // Fetch the original task
  const { data: original, error: fetchError } = await supabase
    .from("jira_tasks_snapshot")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !original) {
    return { success: false, error: "Could not find the original task." };
  }

  // Clone it with the current user as owner, reset tracking metrics
  const clonedTask = {
    ...original,
    id: undefined, // Let Supabase generate a new UUID
    owner_id: user.id,
    // Reset user-specific status tracking metrics
    planned_in_sprint: false,
    added_mid_sprint: false,
    carry_forward: false,
    lead_time_days: null,
    reopened: false,
    in_progress_at: null,
    done_at: null,
    changelog_json: [],
    created_at: undefined, // Let DB set these
    updated_at: undefined,
  };

  // Remove the id field entirely so Supabase auto-generates it
  delete clonedTask.id;
  delete clonedTask.created_at;
  delete clonedTask.updated_at;

  const { error: insertError } = await supabase
    .from("jira_tasks_snapshot")
    .insert(clonedTask);

  if (insertError) {
    console.error("Failed to duplicate task:", insertError.message);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/board");
  return { success: true };
}

// ─── Delete a task (only works on your own rows due to RLS) ───
export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("jira_tasks_snapshot")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("Failed to delete task:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}
