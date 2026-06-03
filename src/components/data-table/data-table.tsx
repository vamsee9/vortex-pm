"use client";

import { useState, useMemo, useRef, useEffect, useCallback, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildColumnsFromDefinitions, SortableHeader, DataTableColumnDef } from "./columns";
import { DataTableToolbar } from "./toolbar";
import { RowActions } from "./row-actions";
import { CommentsDialog } from "@/components/comments-dialog";
import type { ProjectTask, ColumnDefinition } from "@/lib/types";
import { Inbox, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { updateTaskCustomField } from "@/lib/actions/tasks";
import { toast } from "sonner";

interface DataTableProps {
  tasks: ProjectTask[];
  currentUserId: string;
  sprintName?: string;
  columnDefs: ColumnDefinition[];
}

export function DataTable({ tasks, currentUserId, sprintName, columnDefs }: DataTableProps) {
  // Sorting state
  const [sortKey, setSortKey] = useState<string>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Comments dialog state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Re-build column renderers whenever schema changes
  const columns = useMemo(() => {
    return buildColumnsFromDefinitions(columnDefs);
  }, [columnDefs]);

  // ─── Column Resizing State ───
  const initialWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    columns.forEach((col) => {
      widths[col.key] = col.def.width_px || 120;
    });
    return widths;
  }, [columns]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialWidths);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
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
    const newWidth = Math.max(50, resizeState.current.startWidth + delta);
    setColumnWidths((prev) => ({ ...prev, [isResizing]: newWidth }));
  }, [isResizing]);

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
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
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

  // Sort the tasks client-side
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      // First check core fields, then custom_fields
      const aValue = (a as any)[sortKey] ?? a.custom_fields?.[sortKey];
      const bValue = (b as any)[sortKey] ?? b.custom_fields?.[sortKey];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return sortDirection === "asc"
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      return 0;
    });

    return sorted;
  }, [tasks, sortKey, sortDirection]);

  function openComments(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    setSelectedTaskId(taskId);
    setSelectedTaskKey(task?.jira_key || "");
    setCommentsOpen(true);
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filter toolbar */}
      <DataTableToolbar tasks={sortedTasks} sprintName={sprintName} columnDefs={columnDefs} />

      {/* Table — Excel-style grid layout */}
      <div className="relative border border-[#4F62C0]/30 overflow-x-auto shadow-xl bg-neutral-950">
        <Table className="table-fixed min-w-max border-collapse">
          <TableHeader>
            <TableRow className="bg-[#4F62C0] hover:bg-[#4F62C0] border-b-0 border-[#4F62C0]/50">
              {columns.map((col) => {
                const width = columnWidths[col.key] || col.def.width_px || 120;
                return (
                  <TableHead
                    key={col.key}
                    className="text-white relative group h-10 p-0 border-r border-[#ffffff20] last:border-r-0"
                    style={{ width: `${width}px` }}
                  >
                    <div className="truncate px-2 flex items-center h-full">
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
                            <span className="text-xs font-semibold uppercase tracking-wider cursor-default">
                              {col.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                            {col.tooltip}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          {col.label}
                        </span>
                      )}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className={`absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-white/30 z-10 ${isResizing === col.key ? "bg-white/50" : ""}`}
                      onMouseDown={(e) => onMouseDown(e, col.key)}
                    />
                  </TableHead>
                );
              })}
              <TableHead className="w-[50px] sticky right-0 bg-[#4F62C0] border-l border-[#ffffff20] p-0" />
            </TableRow>
          </TableHeader>
          <TableBody className="bg-neutral-900/50">
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-[200px] text-center border-b border-neutral-800"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-neutral-500">
                    <Inbox className="w-10 h-10" />
                    <p className="text-sm">No tasks found</p>
                    <p className="text-xs">
                      Try adjusting your filters or add a new task.
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
                    className="border-b border-neutral-800/80 hover:bg-neutral-800 transition-colors group/row"
                  >
                    {columns.map((col) => (
                      <TableCell 
                        key={col.key} 
                        style={{ width: `${columnWidths[col.key] || col.def.width_px || 120}px` }}
                        className="truncate overflow-hidden p-1 px-2 border-r border-neutral-800/50 last:border-r-0 h-10"
                      >
                        {col.render(task, isOwner, handleEditCell)}
                      </TableCell>
                    ))}
                    <TableCell className="sticky right-0 bg-neutral-900 group-hover/row:bg-neutral-800 border-l border-neutral-800 p-0 text-center transition-colors">
                      <div className="flex items-center justify-center h-full">
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                        ) : (
                          <RowActions
                            task={task}
                            isOwner={isOwner}
                            onOpenComments={openComments}
                          />
                        )}
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
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          Showing {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
        </span>
        {sortedTasks.length > 0 && (
          <span>
            Total SP:{" "}
            {sortedTasks
              .reduce((sum, t) => sum + (Number(t.custom_fields?.story_points) || 0), 0)
              .toFixed(1)}
          </span>
        )}
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
