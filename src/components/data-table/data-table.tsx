/**
 * data-table/data-table.tsx
 * -------------------------
 * The main interactive data table for the Sprint Board.
 * Renders tasks in a sortable, filterable table with row actions.
 *
 * Features:
 * - Client-side sorting by clicking column headers
 * - Resizable columns (click and drag borders)
 * - Row actions dropdown (duplicate, comment, delete)
 * - Comments dialog integration
 * - Empty state for when no tasks match filters
 *
 * Sorting is done client-side for speed — the data is already
 * fetched and filtered by the server component.
 */

"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columns, SortableHeader } from "./columns";
import { DataTableToolbar } from "./toolbar";
import { RowActions } from "./row-actions";
import { CommentsDialog } from "@/components/comments-dialog";
import type { JiraTask } from "@/lib/types";
import { Inbox } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataTableProps {
  tasks: JiraTask[];
  currentUserId: string;
  sprintName?: string;
}

export function DataTable({ tasks, currentUserId, sprintName }: DataTableProps) {
  // Sorting state
  const [sortKey, setSortKey] = useState<string>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Comments dialog state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string>("");

  // ─── Column Resizing State ───
  // Default widths parsed from the Tailwind classes in columns.tsx,
  // or a fallback of 100px.
  const initialWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    columns.forEach((col) => {
      // Very naive parser to convert Tailwind w-[100px] or min-w-[200px] to numbers
      let w = 100;
      if (col.width) {
        const match = col.width.match(/\[(\d+)px\]/);
        if (match) w = parseInt(match[1], 10);
      }
      widths[col.key] = w;
    });
    return widths;
  }, []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialWidths);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
  // Refs to track drag state across mouse events without triggering re-renders
  const resizeState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    setIsResizing(colKey);
    resizeState.current = {
      startX: e.clientX,
      startWidth: columnWidths[colKey],
    };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeState.current) return;
    
    const delta = e.clientX - resizeState.current.startX;
    const newWidth = Math.max(50, resizeState.current.startWidth + delta); // Minimum 50px

    setColumnWidths((prev) => ({
      ...prev,
      [isResizing]: newWidth,
    }));
  }, [isResizing]);

  const onMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(null);
      resizeState.current = null;
    }
  }, [isResizing]);

  // Bind global mouse events for the drag interaction
  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      // Change cursor globally so it doesn't flicker when leaving the handle
      document.body.style.cursor = "col-resize";
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing, onMouseMove, onMouseUp]);


  // Handle column sort toggling
  function handleSort(key: string) {
    if (sortKey === key) {
      // Same column — toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column — default to ascending
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  // Sort the tasks client-side
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const aValue = a[sortKey as keyof JiraTask];
      const bValue = b[sortKey as keyof JiraTask];

      // Handle null/undefined values — push them to the end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // String comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Number comparison
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Boolean comparison
      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return sortDirection === "asc"
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      return 0;
    });

    return sorted;
  }, [tasks, sortKey, sortDirection]);

  // Open comments dialog for a specific task
  function openComments(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    setSelectedTaskId(taskId);
    setSelectedTaskKey(task?.jira_key || "");
    setCommentsOpen(true);
  }

  return (
    <div>
      {/* Filter toolbar */}
      <DataTableToolbar tasks={sortedTasks} sprintName={sprintName} />

      {/* Table — overflow-x-auto allows horizontal scrolling if columns get too wide */}
      <div className="rounded-lg border border-neutral-800 overflow-x-auto">
        <Table className="table-fixed min-w-max">
          <TableHeader>
            <TableRow className="border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900/50">
              {columns.map((col) => {
                const width = columnWidths[col.key];
                return (
                  <TableHead
                    key={col.key}
                    className="text-neutral-400 relative group"
                    style={{ width: `${width}px` }}
                  >
                    <div className="truncate pr-4">
                      {col.sortable ? (
                        <SortableHeader
                          label={col.label}
                          sortKey={col.key}
                          currentSort={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          tooltip={col.tooltip}
                        />
                      ) : col.tooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs font-medium uppercase tracking-wider cursor-default">
                              {col.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                            {col.tooltip}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs font-medium uppercase tracking-wider">
                          {col.label}
                        </span>
                      )}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className={`col-resize-handle ${isResizing === col.key ? "is-resizing" : ""}`}
                      onMouseDown={(e) => onMouseDown(e, col.key)}
                    />
                  </TableHead>
                );
              })}
              {/* Actions column (fixed width, not resizable) */}
              <TableHead className="w-[50px] sticky right-0 bg-neutral-900/50 backdrop-blur border-l border-neutral-800" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-[200px] text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-neutral-500">
                    <Inbox className="w-10 h-10" />
                    <p className="text-sm">No tasks found</p>
                    <p className="text-xs">
                      Try adjusting your filters or wait for webhook data.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedTasks.map((task) => {
                const isOwner = task.owner_id === currentUserId;

                return (
                  <TableRow
                    key={task.id}
                    className="border-neutral-800 hover:bg-neutral-800/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <TableCell 
                        key={col.key} 
                        style={{ width: `${columnWidths[col.key]}px` }}
                        className="truncate overflow-hidden"
                      >
                        {col.render(task, isOwner)}
                      </TableCell>
                    ))}
                    <TableCell className="sticky right-0 bg-neutral-950 border-l border-neutral-800 p-0 text-center">
                      <div className="flex items-center justify-center h-full">
                        <RowActions
                          task={task}
                          isOwner={isOwner}
                          onOpenComments={openComments}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Task count footer */}
      <div className="flex items-center justify-between pt-3 text-xs text-neutral-500">
        <span>
          Showing {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
        </span>
        {sortedTasks.length > 0 && (
          <span>
            Total SP:{" "}
            {sortedTasks
              .reduce((sum, t) => sum + (t.story_points || 0), 0)
              .toFixed(1)}
          </span>
        )}
      </div>

      {/* Comments Dialog */}
      <CommentsDialog
        taskId={selectedTaskId}
        taskKey={selectedTaskKey}
        currentUserId={currentUserId}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </div>
  );
}
