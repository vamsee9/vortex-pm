"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ColumnDefinition } from "@/lib/types";
import { isDemoModeActive, getMockColumnDefinitions } from "@/lib/demo-mode";

export async function fetchColumnDefinitions(projectId: string): Promise<ColumnDefinition[]> {
  if (await isDemoModeActive()) {
    return getMockColumnDefinitions(projectId);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_column_definitions")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch column definitions:", error.message);
    return [];
  }

  return (data as ColumnDefinition[]) || [];
}

export async function createColumnDefinition(
  projectId: string,
  def: Partial<ColumnDefinition>
): Promise<{ success: boolean; data?: ColumnDefinition; error?: string }> {
  const supabase = await createClient();

  // Validate that key is unique for this project (db will also enforce this)
  const { data: existing } = await supabase
    .from("project_column_definitions")
    .select("id")
    .eq("project_id", projectId)
    .eq("key", def.key!)
    .single();

  if (existing) {
    return { success: false, error: "A column with this key already exists." };
  }

  // Get next display order
  const { data: cols } = await supabase
    .from("project_column_definitions")
    .select("display_order")
    .eq("project_id", projectId)
    .order("display_order", { ascending: false })
    .limit(1);
    
  const nextOrder = cols && cols.length > 0 ? cols[0].display_order + 1 : 0;

  const { data, error } = await supabase
    .from("project_column_definitions")
    .insert([{
      ...def,
      project_id: projectId,
      display_order: def.display_order ?? nextOrder,
      is_system: false,
    }])
    .select()
    .single();

  if (error) {
    console.error("Failed to create column:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/board");
  return { success: true, data: data as ColumnDefinition };
}

export async function updateColumnDefinition(
  id: string,
  updates: Partial<ColumnDefinition>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Prevent modifying is_system columns in dangerous ways
  if (updates.is_system !== undefined) {
      delete updates.is_system;
  }

  const { error } = await supabase
    .from("project_column_definitions")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Failed to update column:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/board");
  return { success: true };
}

export async function deleteColumnDefinition(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Ensure it's not a system column
  const { data: col } = await supabase
    .from("project_column_definitions")
    .select("is_system")
    .eq("id", id)
    .single();

  if (col?.is_system) {
    return { success: false, error: "Cannot delete system columns." };
  }

  const { error } = await supabase
    .from("project_column_definitions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete column:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/board");
  return { success: true };
}

export async function reorderColumnDefinitions(
  projectId: string,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // This should ideally be a Postgres RPC transaction, but we can do it via a loop
  // for this scale since column counts are small.
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from("project_column_definitions")
      .update({ display_order: i })
      .eq("id", orderedIds[i])
      .eq("project_id", projectId);
  }

  revalidatePath("/settings");
  revalidatePath("/board");
  return { success: true };
}

export async function seedDefaultColumns(projectId: string): Promise<void> {
  const supabase = await createClient();
  
  const defaultCols: Partial<ColumnDefinition>[] = [
    {
      key: "summary",
      label: "Summary",
      data_type: "text",
      is_required: true,
      is_sortable: true,
      is_filterable: true,
      is_editable: true,
      is_system: true,
      width_px: 250,
      display_order: 1,
    },
    {
      key: "status",
      label: "Status",
      data_type: "select",
      is_required: true,
      is_sortable: true,
      is_filterable: true,
      is_editable: true,
      is_system: true,
      width_px: 120,
      display_order: 2,
      options: [
        { value: "To Do", label: "To Do", color: "#6b7280" },
        { value: "In Progress", label: "In Progress", color: "#3b82f6" },
        { value: "Done", label: "Done", color: "#10b981" }
      ]
    },
    {
      key: "priority",
      label: "Priority",
      data_type: "select",
      is_required: true,
      is_sortable: true,
      is_filterable: true,
      is_editable: true,
      is_system: true,
      width_px: 100,
      display_order: 3,
      options: [
        { value: "Highest", label: "Highest", color: "#ef4444" },
        { value: "High", label: "High", color: "#f97316" },
        { value: "Medium", label: "Medium", color: "#f59e0b" },
        { value: "Low", label: "Low", color: "#3b82f6" },
      ]
    },
    {
      key: "work_type",
      label: "Type",
      data_type: "select",
      is_required: false,
      is_sortable: true,
      is_filterable: true,
      is_editable: true,
      is_system: true,
      width_px: 100,
      display_order: 4,
      options: [
        { value: "Story", label: "Story" },
        { value: "Task", label: "Task" },
        { value: "Bug", label: "Bug" },
      ]
    },
    {
      key: "assignees",
      label: "Assignees",
      data_type: "user",
      is_required: false,
      is_sortable: false,
      is_filterable: false,
      is_editable: true,
      is_system: true,
      width_px: 120,
      display_order: 5,
    },
    {
      key: "story_points",
      label: "SP",
      data_type: "number",
      is_required: false,
      is_sortable: true,
      is_filterable: false,
      is_editable: true,
      is_system: true,
      width_px: 60,
      display_order: 6,
    },
    {
      key: "planned_in_sprint",
      label: "Planned",
      data_type: "boolean",
      is_required: false,
      is_sortable: false,
      is_filterable: false,
      is_editable: false,
      is_system: true,
      width_px: 70,
      display_order: 7,
      auto_source: "computed",
    },
    {
      key: "added_mid_sprint",
      label: "Ad-hoc",
      data_type: "boolean",
      is_required: false,
      is_sortable: false,
      is_filterable: false,
      is_editable: false,
      is_system: true,
      width_px: 70,
      display_order: 8,
      auto_source: "computed",
    },
    {
      key: "carry_forward",
      label: "Carry",
      data_type: "boolean",
      is_required: false,
      is_sortable: false,
      is_filterable: false,
      is_editable: false,
      is_system: true,
      width_px: 70,
      display_order: 9,
      auto_source: "computed",
    },
    {
      key: "lead_time_days",
      label: "Lead Time",
      data_type: "number",
      is_required: false,
      is_sortable: true,
      is_filterable: false,
      is_editable: false,
      is_system: true,
      width_px: 90,
      display_order: 10,
      auto_source: "computed",
    }
  ];

  const toInsert = defaultCols.map(col => ({
    ...col,
    project_id: projectId
  }));

  await supabase.from("project_column_definitions").insert(toInsert);
}
