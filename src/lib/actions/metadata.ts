/**
 * lib/actions/metadata.ts
 * -----------------------
 * Server actions for managing dynamic project metadata
 * (Work Types, Priorities, Statuses).
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { isDemoModeActive, getMockMetadata } from "@/lib/demo-mode";
import { revalidatePath } from "next/cache";
import type { MetadataItem } from "@/lib/types";

export async function fetchMetadata(category?: "work_type" | "priority" | "status") {
  if (await isDemoModeActive()) {
    const cookieStore = await cookies();
    const projectId = cookieStore.get("active_project_id")?.value;
    if (projectId) return getMockMetadata(projectId, category);
    return [];
  }

  const supabase = await createClient();
  const cookieStore = await cookies();
  const projectId = cookieStore.get("active_project_id")?.value;

  if (!projectId) return [];

  let query = supabase
    .from("project_metadata")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching metadata:", error);
    return [];
  }

  return data as MetadataItem[];
}

export async function createMetadataItem(
  category: "work_type" | "priority" | "status",
  label: string,
  display_order: number = 0
) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const projectId = cookieStore.get("active_project_id")?.value;

  if (!projectId) throw new Error("No active project selected");

  const { data, error } = await supabase
    .from("project_metadata")
    .insert([
      { category, label, display_order, project_id: projectId }
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/board"); // In case it affects filters
  return data as MetadataItem;
}

export async function deleteMetadataItem(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_metadata")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/board");
}
