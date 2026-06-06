/**
 * data-table/row-actions.tsx
 * --------------------------
 * Per-row action dropdown menu (TableCN style).
 * Clean ··· trigger, standard shadcn dropdown items.
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
import { MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { duplicateTask, deleteTask } from "@/lib/actions/tasks";
import { toast } from "sonner";
import type { ProjectTask } from "@/lib/types";

interface RowActionsProps {
  task: ProjectTask;
  isOwner: boolean;
}

export function RowActions({ task, isOwner }: RowActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleCopyToMyBoard() {
    setLoading(true);
    try {
      const result = await duplicateTask(task.id);
      if (result.success) {
        toast.success("Task copied to your board!");
      } else {
        toast.error(result.error || "Failed to copy task.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete ${task.jira_key}?`)) return;
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
          size="icon"
          disabled={loading}
          className="h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        {/* Copy To My Board — available on rows you DON'T own */}
        {!isOwner && (
          <DropdownMenuItem onClick={handleCopyToMyBoard}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy To My Board
          </DropdownMenuItem>
        )}

        {/* Delete — only on rows you own */}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
