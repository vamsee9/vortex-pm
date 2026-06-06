"use client";

import { useState, useMemo, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildColumnsFromDefinitions, SortableHeader } from "./columns";
import { DataTableToolbar } from "./toolbar";
import { RowActions } from "./row-actions";
import { CommentsDialog } from "@/components/comments-dialog";
import { DataTablePagination } from "./pagination";
import { useColumnPreferences } from "./use-column-preferences";
import type { ProjectTask, ColumnDefinition } from "@/lib/types";
import { Loader2, Trash2, X, Inbox } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { updateTaskCustomField, deleteTask } from "@/lib/actions/tasks";
import { toast } from "sonner";

interface DataTableProps {
  tasks: ProjectTask[];
  totalCount: number;
  currentUserId: string;
  sprintName?: string;
  columnDefs: ColumnDefinition[];
  projectId?: string;
}

export function DataTable({ tasks, totalCount, currentUserId, sprintName, columnDefs, projectId }: DataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven Sorting state
  const sortKey = searchParams.get("sort") || "updated_at";
  const sortDirection = (searchParams.get("dir") as "asc" | "desc") || "desc";

  // Comments dialog state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Row Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Preferences hook
  const { preferences, updatePreference, isLoaded } = useColumnPreferences(projectId || "default", columnDefs);

  // Re-build column renderers whenever schema or preferences change
  const columns = useMemo(() => {
    return buildColumnsFromDefinitions(columnDefs, preferences);
  }, [columnDefs, preferences]);

  // ─── Column Resizing State ───
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const resizeState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent, colKey: string, currentWidth: number) => {
    e.preventDefault();
    setIsResizing(colKey);
    resizeState.current = { startX: e.clientX, startWidth: currentWidth };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeState.current) return;
    const delta = e.clientX - resizeState.current.startX;
    const newWidth = Math.max(50, resizeState.current.startWidth + delta);
    updatePreference(isResizing, { width: newWidth });
  }, [isResizing, updatePreference]);

  const onMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(null);
      resizeState.current = null;
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onMouseMove, onMouseUp]);

  // Handle column sort toggling via URL
  function handleSort(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortKey === key) {
      params.set("dir", sortDirection === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", key);
      params.set("dir", "asc");
    }
    router.push(`?${params.toString()}`);
  }

  // Handle inline edits
  const handleEditCell = (taskId: string, key: string, value: any) => {
    startTransition(async () => {
      const res = await updateTaskCustomField(taskId, key, value);
      if (!res.success) {
        toast.error(`Failed to update ${key}: ${res.error}`);
      } else {
        toast.success(`Updated successfully`);
      }
    });
  };

  // Row selection toggles
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(tasks.map((t) => t.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (taskId: string, checked: boolean) => {
    const next = new Set(selectedRows);
    if (checked) next.add(taskId);
    else next.delete(taskId);
    setSelectedRows(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} task(s)?`)) return;
    startTransition(async () => {
      let errCount = 0;
      for (const id of Array.from(selectedRows)) {
        const res = await deleteTask(id);
        if (!res.success) errCount++;
      }
      if (errCount > 0) {
        toast.error(`Failed to delete ${errCount} task(s). You may only delete your own.`);
      } else {
        toast.success(`Deleted ${selectedRows.size} task(s)`);
      }
      setSelectedRows(new Set());
    });
  };

  function openComments(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    setSelectedTaskId(taskId);
    setSelectedTaskKey(task?.jira_key || "");
    setCommentsOpen(true);
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Empty State (no table, no pagination) ───
  if (tasks.length === 0 && totalCount === 0) {
    return (
      <div className="flex w-full flex-col gap-2.5 overflow-auto p-1">
        {/* Toolbar always shown so user can adjust filters */}
        <DataTableToolbar
          tasks={tasks}
          sprintName={sprintName}
          columnDefs={columnDefs}
          preferences={preferences}
          updatePreference={updatePreference}
        />

        {/* Empty state card */}
        <div className="rounded-md border border-border">
          <div className="flex h-[450px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <Inbox className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-foreground">No tasks found</h3>
              <p className="text-sm text-muted-foreground max-w-[420px]">
                Try adjusting your filters, changing the sprint, or add a new task to get started.
              </p>
            </div>
          </div>
        </div>

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

  const allSelected = selectedRows.size === tasks.length && tasks.length > 0;
  const someSelected = selectedRows.size > 0 && selectedRows.size < tasks.length;

  return (
    <div className="flex w-full flex-col gap-2.5 overflow-auto p-1">
      {/* ─── Toolbar ─── */}
      <DataTableToolbar
        tasks={tasks}
        sprintName={sprintName}
        columnDefs={columnDefs}
        preferences={preferences}
        updatePreference={updatePreference}
      />

      {/* ─── Table ─── */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="relative w-full overflow-x-auto">
          <Table className="table-fixed min-w-max">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                {/* Select-all checkbox */}
                <TableHead
                  className="h-10 w-[40px] px-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                >
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(c) => handleSelectAll(!!c)}
                    aria-label="Select all"
                  />
                </TableHead>

                {/* Dynamic column headers */}
                {columns.map((col) => {
                  const width = preferences[col.key]?.width || col.def.width_px || 120;
                  return (
                    <TableHead
                      key={col.key}
                      className="h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-foreground relative group"
                      style={{ width: `${width}px`, minWidth: `${Math.min(width, 80)}px` }}
                    >
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
                            <span className="text-sm font-medium cursor-default">
                              {col.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{col.tooltip}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm font-medium">{col.label}</span>
                      )}

                      {/* Resize handle */}
                      <div
                        className={`absolute right-0 top-0 w-[3px] h-full cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity ${
                          isResizing === col.key
                            ? "opacity-100 bg-primary"
                            : "hover:bg-border"
                        }`}
                        onMouseDown={(e) => onMouseDown(e, col.key, width)}
                      />
                    </TableHead>
                  );
                })}

                {/* Actions column */}
                <TableHead className="h-10 w-[50px] px-2" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {tasks.map((task) => {
                const isOwner = task.owner_id === currentUserId;
                const isSelected = selectedRows.has(task.id);

                return (
                  <TableRow
                    key={task.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="border-b transition-colors data-[state=selected]:bg-muted/50 hover:bg-muted/40"
                  >
                    {/* Row checkbox */}
                    <TableCell className="w-[40px] whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => handleSelectRow(task.id, !!c)}
                        aria-label={`Select ${task.jira_key}`}
                      />
                    </TableCell>

                    {/* Data cells */}
                    {columns.map((col) => {
                      const width = preferences[col.key]?.width || col.def.width_px || 120;
                      return (
                        <TableCell
                          key={col.key}
                          style={{ width: `${width}px`, minWidth: `${Math.min(width, 80)}px` }}
                          className="whitespace-nowrap p-2 align-middle"
                        >
                          {col.render(task, isOwner, handleEditCell)}
                        </TableCell>
                      );
                    })}

                    {/* Row actions */}
                    <TableCell className="w-[50px] whitespace-nowrap p-2 align-middle">
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                      ) : (
                        <RowActions
                          task={task}
                          isOwner={isOwner}
                          onOpenComments={openComments}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ─── Pagination ─── */}
      <DataTablePagination totalCount={totalCount} selectedCount={selectedRows.size} />

      {/* ─── Floating Selection Action Bar (TableCN style) ─── */}
      {selectedRows.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit">
          <div className="flex items-center gap-4 rounded-lg border bg-background px-4 py-2.5 shadow-2xl">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              <span className="font-semibold tabular-nums text-foreground">{selectedRows.size}</span>
              {" "}of{" "}
              <span className="font-semibold tabular-nums text-foreground">{tasks.length}</span>
              {" "}row(s) selected
            </span>

            <div className="h-4 w-px bg-border" />

            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedRows(new Set())}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        </div>
      )}

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
