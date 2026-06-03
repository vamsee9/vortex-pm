"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProjectTask, ColumnDefinition } from "@/lib/types";
import {
  ArrowUpDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CellEditor } from "./cell-editor";

// ─── Priority icons mapping (fallback/default style) ───
export function PriorityIcon({ priority }: { priority: string }) {
  if (!priority) return <Minus className="w-3.5 h-3.5 text-neutral-400" />;
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

// ─── Lead time colour (green = fast, yellow = ok, red = slow) ───
export function getLeadTimeColor(days: number | null): string {
  if (days === null || days === undefined) return "text-neutral-500";
  if (days <= 3) return "text-emerald-400";
  if (days <= 7) return "text-amber-400";
  return "text-red-400";
}

// ─── Column definition interface for React Table ───
export interface DataTableColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  width?: string;
  tooltip?: string;
  def: ColumnDefinition; // The underlying schema definition
  render: (
    task: ProjectTask, 
    isOwner: boolean, 
    onEdit: (taskId: string, key: string, value: any) => void
  ) => React.ReactNode;
}

// ─── Dynamic Column Builder ───
export function buildColumnsFromDefinitions(
  columnDefs: ColumnDefinition[]
): DataTableColumnDef[] {
  // Sort columns by display_order, filter out invisible ones
  const visibleDefs = columnDefs
    .filter(c => c.is_visible)
    .sort((a, b) => a.display_order - b.display_order);

  const columns: DataTableColumnDef[] = [];

  // Always prepend Jira Key if it's not explicitly in the custom definitions
  // (We could also make jira_key a required custom field)
  
  for (const def of visibleDefs) {
    columns.push({
      key: def.key,
      label: def.label,
      sortable: def.is_sortable,
      width: `w-[${def.width_px}px]`,
      tooltip: def.tooltip || undefined,
      def,
      render: (task, isOwner, onEdit) => {
        // Read the value from custom_fields safely
        const val = task.custom_fields ? task.custom_fields[def.key] : undefined;

        // System fallbacks for specific known computed metrics
        if (def.is_system && def.auto_source === "computed") {
          if (def.key === "planned_in_sprint") {
            return (
              <div className="flex justify-center">
                <Checkbox
                  checked={!!val}
                  disabled
                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
              </div>
            );
          }
          if (def.key === "added_mid_sprint") {
            return (
              <div className="flex justify-center">
                {!!val && (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs rounded-none">
                    Yes
                  </Badge>
                )}
              </div>
            );
          }
          if (def.key === "carry_forward") {
            return (
              <div className="flex justify-center">
                {!!val && (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
            );
          }
          if (def.key === "lead_time_days") {
            return (
              <span className={`text-sm font-mono ${getLeadTimeColor(val as number)}`}>
                {val !== null && val !== undefined ? `${val}d` : "—"}
              </span>
            );
          }
        }

        // Display based on data_type
        switch (def.data_type) {
          case "boolean":
            return (
              <div className="flex justify-center">
                <Checkbox
                  checked={!!val}
                  disabled={!def.is_editable || !isOwner}
                  onCheckedChange={(checked) => {
                    if (def.is_editable && isOwner) {
                      onEdit(task.id, def.key, !!checked);
                    }
                  }}
                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
              </div>
            );

          case "select": {
            // Find option to get color
            const opt = def.options?.find(o => o.value === val);
            // Default styling if no explicit color
            let colorStyle = {
              backgroundColor: opt?.color ? `${opt.color}1a` : "rgba(107, 114, 128, 0.1)",
              color: opt?.color || "#9ca3af",
              borderColor: opt?.color ? `${opt.color}33` : "rgba(107, 114, 128, 0.2)"
            };

            // Custom UI override for priority
            if (def.key === "priority") {
              return (
                <CellEditor def={def} value={val} onSave={(newVal) => onEdit(task.id, def.key, newVal)}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <PriorityIcon priority={val as string} />
                    <span className="text-sm text-neutral-300">{val || "—"}</span>
                  </div>
                </CellEditor>
              );
            }

            return (
              <CellEditor def={def} value={val} onSave={(newVal) => onEdit(task.id, def.key, newVal)}>
                <Badge 
                  variant="secondary" 
                  style={colorStyle}
                  className="cursor-pointer font-medium rounded-none border"
                >
                  {val || "—"}
                </Badge>
              </CellEditor>
            );
          }

          case "user": {
            const assignees = Array.isArray(val) ? val : (val ? [val] : []);
            return (
              <div className="flex items-center gap-1 cursor-pointer">
                {assignees.length > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex -space-x-2">
                        {assignees.slice(0, 3).map((name: string, idx: number) => (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded-full bg-neutral-700 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-neutral-300 font-medium"
                          >
                            {name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {assignees.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-neutral-600 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-neutral-300">
                            +{assignees.length - 3}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                      {assignees.join(", ")}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-neutral-500">Unassigned</span>
                )}
              </div>
            );
          }

          case "number":
            return (
              <CellEditor def={def} value={val} onSave={(newVal) => onEdit(task.id, def.key, newVal)}>
                <span className="text-sm text-neutral-300 font-mono cursor-pointer">
                  {val !== null && val !== undefined ? val : "—"}
                </span>
              </CellEditor>
            );

          case "text":
          default:
            return (
              <CellEditor def={def} value={val} onSave={(newVal) => onEdit(task.id, def.key, newVal)}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-neutral-200 truncate block cursor-pointer">
                      {val || "—"}
                    </span>
                  </TooltipTrigger>
                  {val && (
                    <TooltipContent side="bottom" className="max-w-sm bg-neutral-800 border-neutral-700 text-neutral-200">
                      {val}
                    </TooltipContent>
                  )}
                </Tooltip>
              </CellEditor>
            );
        }
      }
    });
  }

  return columns;
}

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
      className="text-neutral-200 hover:text-white -ml-3 font-medium uppercase text-xs rounded-none h-8 px-2 tracking-wider"
    >
      {label}
      <ArrowUpDown
        className={`ml-1 w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-neutral-400"}`}
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
