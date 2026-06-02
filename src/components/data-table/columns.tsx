/**
 * data-table/columns.tsx
 * ----------------------
 * Column definitions for the Sprint Board data table.
 * Each column defines how a field from JiraTask should be rendered.
 *
 * Uses Shadcn/ui Badge, Checkbox, and Tooltip components for rich display.
 * Columns are modular — add or remove columns by editing this array.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JiraTask } from "@/lib/types";
import {
  ArrowUpDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Column definition type ───
export interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  width?: string;
  tooltip?: string; // Brief description shown on hover
  render: (task: JiraTask, isOwner: boolean) => React.ReactNode;
}

// ─── Priority icons mapping ───
function PriorityIcon({ priority }: { priority: string }) {
  switch (priority.toLowerCase()) {
    case "highest":
    case "critical":
      return <ArrowUp className="w-3.5 h-3.5 text-red-400" />;
    case "high":
      return <ArrowUp className="w-3.5 h-3.5 text-orange-400" />;
    case "medium":
      return <Minus className="w-3.5 h-3.5 text-amber-400" />;
    case "low":
      return <ArrowDown className="w-3.5 h-3.5 text-blue-400" />;
    case "lowest":
      return <ArrowDown className="w-3.5 h-3.5 text-neutral-400" />;
    default:
      return <Minus className="w-3.5 h-3.5 text-neutral-400" />;
  }
}

// ─── Status badge colour mapping ───
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "done":
    case "resolved":
    case "verified":
    case "closed":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "in progress":
    case "in review":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "to do":
    case "open":
    case "backlog":
      return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
    case "blocked":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
  }
}

// ─── Lead time colour (green = fast, yellow = ok, red = slow) ───
function getLeadTimeColor(days: number | null): string {
  if (days === null) return "text-neutral-500";
  if (days <= 3) return "text-emerald-400";
  if (days <= 7) return "text-amber-400";
  return "text-red-400";
}

// ────────────────────────────────────────────────────────────
// Column Definitions
// ────────────────────────────────────────────────────────────
export const columns: ColumnDef[] = [
  {
    key: "jira_key",
    label: "Key",
    sortable: true,
    tooltip: "Unique Jira issue identifier",
    width: "w-[100px]",
    render: (task) => (
      <Badge
        variant="secondary"
        className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-xs"
      >
        {task.jira_key}
      </Badge>
    ),
  },
  {
    key: "summary",
    label: "Summary",
    sortable: true,
    tooltip: "Task title from Jira",
    width: "min-w-[200px] max-w-[350px]",
    render: (task) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-neutral-200 truncate block cursor-default">
            {task.summary}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm bg-neutral-800 border-neutral-700 text-neutral-200">
          {task.summary}
        </TooltipContent>
      </Tooltip>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    tooltip: "Current workflow status of the task",
    width: "w-[120px]",
    render: (task) => (
      <Badge variant="secondary" className={getStatusColor(task.status)}>
        {task.status}
      </Badge>
    ),
  },
  {
    key: "priority",
    label: "Priority",
    sortable: true,
    tooltip: "Urgency level assigned in Jira",
    width: "w-[100px]",
    render: (task) => (
      <div className="flex items-center gap-1.5">
        <PriorityIcon priority={task.priority} />
        <span className="text-sm text-neutral-300">{task.priority}</span>
      </div>
    ),
  },
  {
    key: "work_type",
    label: "Type",
    sortable: true,
    tooltip: "Issue type — Story, Bug, Task, etc.",
    width: "w-[90px]",
    render: (task) => (
      <span className="text-sm text-neutral-400">{task.work_type}</span>
    ),
  },
  {
    key: "story_points",
    label: "SP",
    sortable: true,
    tooltip: "Story Points — effort estimate for the task",
    width: "w-[60px]",
    render: (task) => (
      <span className="text-sm text-neutral-300 font-mono">
        {task.story_points}
      </span>
    ),
  },
  {
    key: "planned_in_sprint",
    label: "Planned",
    sortable: false,
    tooltip: "Was this task present at sprint kickoff?",
    width: "w-[70px]",
    render: (task) => (
      <div className="flex justify-center">
        <Checkbox
          checked={task.planned_in_sprint}
          disabled
          className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        />
      </div>
    ),
  },
  {
    key: "added_mid_sprint",
    label: "Ad-hoc",
    sortable: false,
    tooltip: "Injected after the sprint had already started",
    width: "w-[70px]",
    render: (task) => (
      <div className="flex justify-center">
        {task.added_mid_sprint && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
            Yes
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "carry_forward",
    label: "Carry",
    sortable: false,
    tooltip: "Sprint closed but task was not completed",
    width: "w-[70px]",
    render: (task) => (
      <div className="flex justify-center">
        {task.carry_forward && (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        )}
      </div>
    ),
  },
  {
    key: "lead_time_days",
    label: "Lead Time",
    sortable: true,
    tooltip: "Business days from In Progress to Done",
    width: "w-[90px]",
    render: (task) => (
      <span className={`text-sm font-mono ${getLeadTimeColor(task.lead_time_days)}`}>
        {task.lead_time_days !== null ? `${task.lead_time_days}d` : "—"}
      </span>
    ),
  },
  {
    key: "assignees",
    label: "Assignees",
    sortable: false,
    tooltip: "Team members assigned to this task",
    width: "w-[140px]",
    render: (task) => (
      <div className="flex items-center gap-1">
        {task.assignees?.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex -space-x-2">
                {task.assignees.slice(0, 3).map((name, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full bg-neutral-700 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-neutral-300 font-medium"
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {task.assignees.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-neutral-600 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-neutral-300">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
              {task.assignees.join(", ")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-neutral-500">Unassigned</span>
        )}
      </div>
    ),
  },
];

// ─── Sortable column header ───
export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
  tooltip,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDirection: "asc" | "desc";
  onSort: (key: string) => void;
  tooltip?: string;
}) {
  const isActive = currentSort === sortKey;

  const button = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(sortKey)}
      className="text-neutral-400 hover:text-neutral-200 -ml-3 font-medium"
    >
      {label}
      <ArrowUpDown
        className={`ml-1 w-3.5 h-3.5 ${isActive ? "text-emerald-400" : ""}`}
      />
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
