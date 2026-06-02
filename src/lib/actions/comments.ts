/**
 * actions/comments.ts
 * -------------------
 * Server Actions for managing task comments.
 * Any authenticated user can add a comment to any task.
 * Users can only delete their own comments (enforced by RLS).
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import type { TaskComment } from "@/lib/types";
import { revalidatePath } from "next/cache";

// ─── Fetch all comments for a specific task ───
export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch comments:", error.message);
    return [];
  }

  return (data as TaskComment[]) || [];
}

// ─── Add a new comment to a task ───
export async function addComment(
  taskId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get the current user info
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in to comment." };
  }

  // Get the display name from user metadata, fall back to email
  const authorName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Unknown User";

  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: user.id,
    author_name: authorName,
    content: content.trim(),
  });

  if (error) {
    console.error("Failed to add comment:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}

// ─── Delete a comment (only your own, enforced by RLS) ───
export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Failed to delete comment:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/board");
  return { success: true };
}
