"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ProjectTask, TaskFilters, SprintOption } from "@/lib/types";
import { isDemoModeActive, getMockTasks, getMockSprints, updateMockTask, deleteMockTask, addDemoTask } from "@/lib/demo-mode";

// ─── Fetch tasks with optional filters ───
export async function fetchTasks(filters: TaskFilters = {}): Promise<ProjectTask[]> {
  if (await isDemoModeActive()) {
    return getMockTasks(filters.project_id, filters.sprint_id);
  }

  const supabase = await createClient();

  let query = supabase
    .from("project_tasks")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filters.project_id) {
    query = query.eq("project_id", filters.project_id);
  }
  if (filters.sprint_id) {
    query = query.eq("sprint_id", filters.sprint_id);
  }
  if (filters.owner_id) {
    query = query.eq("owner_id", filters.owner_id);
  }
  
  // Custom field filters
  if (filters.work_type) {
    query = query.filter("custom_fields->>work_type", "eq", filters.work_type);
  }
  if (filters.priority) {
    query = query.filter("custom_fields->>priority", "eq", filters.priority);
  }
  if (filters.status) {
    query = query.filter("custom_fields->>status", "eq", filters.status);
  }
  
  if (filters.search) {
    const sanitized = filters.search.replace(/[(),.%\\]/g, "");
    if (sanitized.length > 0) {
      // Searching across jira_key and custom_fields->>summary
      query = query.or(
        `jira_key.ilike.%${sanitized}%,custom_fields->>summary.ilike.%${sanitized}%`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch tasks:", error.message);
    return [];
  }

  return (data as ProjectTask[]) || [];
}

// ─── Get list of unique sprints for the dropdown selector ───
export async function fetchSprints(projectId?: string): Promise<SprintOption[]> {
  if (await isDemoModeActive()) {
    return getMockSprints(projectId);
  }

  const supabase = await createClient();

  let query = supabase
    .from("project_tasks")
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

// ─── Update a core field on a task ───
export async function updateTask(
  taskId: string,
  updates: Partial<ProjectTask>
): Promise<{ success: boolean; error?: string }> {
  if (await isDemoModeActive()) {
    updateMockTask(taskId, updates);
    revalidatePath("/board");
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("project_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    console.error("Failed to update task:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}

// ─── Update a custom field inside JSONB ───
export async function updateTaskCustomField(
  taskId: string,
  fieldKey: string,
  value: any
): Promise<{ success: boolean; error?: string }> {
  if (await isDemoModeActive()) {
    const tasks = getMockTasks();
    const task = tasks.find((t: any) => t.id === taskId);
    if (task) {
      if (!task.custom_fields) task.custom_fields = {};
      task.custom_fields[fieldKey] = value;
      updateMockTask(taskId, task);
    }
    revalidatePath("/board");
    return { success: true };
  }

  const supabase = await createClient();

  // Due to PostgREST limitations with deep JSONB updates on single keys, 
  // it's safest to read the row, modify the object, and write it back
  // in a high-contention environment we'd use an RPC, but this is fine here.
  const { data: task, error: fetchErr } = await supabase
    .from("project_tasks")
    .select("custom_fields")
    .eq("id", taskId)
    .single();
    
  if (fetchErr || !task) {
    return { success: false, error: fetchErr?.message || "Task not found" };
  }
  
  const newCustomFields = { ...task.custom_fields, [fieldKey]: value };

  const { error } = await supabase
    .from("project_tasks")
    .update({ 
      custom_fields: newCustomFields, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", taskId);

  if (error) {
    console.error("Failed to update custom field:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}

// ─── Duplicate a task to "My Sheet" ───
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in to duplicate a task." };
  }

  const { data: original, error: fetchError } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !original) {
    return { success: false, error: "Could not find the original task." };
  }

  // Clone it with the current user as owner, reset tracking metrics
  const newCustomFields = { ...original.custom_fields };
  newCustomFields.planned_in_sprint = false;
  newCustomFields.added_mid_sprint = false;
  newCustomFields.carry_forward = false;
  newCustomFields.lead_time_days = null;
  newCustomFields.reopened = false;

  const clonedTask = {
    ...original,
    owner_id: user.id,
    custom_fields: newCustomFields,
    changelog_json: [],
  };

  delete (clonedTask as any).id;
  delete (clonedTask as any).created_at;
  delete (clonedTask as any).updated_at;

  const { error: insertError } = await supabase
    .from("project_tasks")
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
    .from("project_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("Failed to delete task:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}
