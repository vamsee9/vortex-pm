/**
 * data-table/row-actions.tsx
 * --------------------------
 * Per-row action dropdown menu for the data table.
 * Shows different actions based on whether the user owns the row:
 *
 * Own rows:   Edit (future), Delete
 * Other rows: Duplicate to My Sheet
 * All rows:   Add Comment
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, MessageSquare, Trash2 } from "lucide-react";
import { duplicateTask, deleteTask } from "@/lib/actions/tasks";
import { toast } from "sonner";
import type { JiraTask } from "@/lib/types";

interface RowActionsProps {
  task: JiraTask;
  isOwner: boolean;
  onOpenComments: (taskId: string) => void;
}

export function RowActions({
  task,
  isOwner,
  onOpenComments,
}: RowActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleDuplicate() {
    setLoading(true);
    try {
      const result = await duplicateTask(task.id);
      if (result.success) {
        toast.success("Task duplicated to your sheet!");
      } else {
        toast.error(result.error || "Failed to duplicate task.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    // Confirm before deleting
    if (!confirm(`Are you sure you want to delete ${task.jira_key}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteTask(task.id);
      if (result.success) {
        toast.success("Task deleted.");
      } else {
        toast.error(result.error || "Failed to delete task.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-neutral-900 border-neutral-700"
      >
        {/* Comment action — available to everyone */}
        <DropdownMenuItem
          onClick={() => onOpenComments(task.id)}
          className="text-neutral-300 focus:bg-neutral-800 focus:text-neutral-100 cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5 mr-2" />
          Add Comment
        </DropdownMenuItem>

        {/* Duplicate — available on rows you DON'T own */}
        {!isOwner && (
          <DropdownMenuItem
            onClick={handleDuplicate}
            className="text-neutral-300 focus:bg-neutral-800 focus:text-neutral-100 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 mr-2" />
            Duplicate to My Sheet
          </DropdownMenuItem>
        )}

        {/* Delete — only on rows you own */}
        {isOwner && (
          <>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
