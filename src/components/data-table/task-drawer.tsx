/**
 * components/data-table/task-drawer.tsx
 * --------------------------------------
 * TableCN-inspired side panel editor for task rows.
 * Opens as a Sheet from the right on desktop, full-screen on mobile.
 *
 * Features:
 * - Dynamic field rendering based on column definitions
 * - Metadata-aware validation
 * - Inline save with debounce
 * - Change tracking (highlights modified fields)
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  X,
  Pencil,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ProjectTask, ColumnDefinition } from "@/lib/types";
import { toast } from "sonner";

interface TaskDrawerProps {
  task: ProjectTask | null;
  columnDefs: ColumnDefinition[];
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, key: string, value: any) => void;
  readOnly?: boolean;
}

export function TaskDrawer({ task, columnDefs, open, onClose, onSave, readOnly = false }: TaskDrawerProps) {
  const [localFields, setLocalFields] = useState<Record<string, any>>({});
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Initialize local state when task changes
  useEffect(() => {
    if (task) {
      setLocalFields(task.custom_fields || {});
      setChangedFields(new Set());
    }
  }, [task]);

  const handleFieldChange = useCallback(
    (key: string, value: any) => {
      setLocalFields((prev) => ({ ...prev, [key]: value }));
      setChangedFields((prev) => new Set(prev).add(key));

      // Auto-save with debounce (500ms)
      if (!readOnly && task) {
        if (debounceTimers.current[key]) {
          clearTimeout(debounceTimers.current[key]);
        }
        debounceTimers.current[key] = setTimeout(() => {
          onSave(task.id, key, value);
          toast.success(`${key} saved`, { duration: 1500 });
        }, 800);
      }
    },
    [task, readOnly, onSave]
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  if (!task) return null;

  const editableDefs = columnDefs.filter((d) => !d.is_system || d.is_editable);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[520px] bg-neutral-950 border-neutral-800 p-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-neutral-100 text-lg">
                {task.jira_key || "Task Details"}
              </SheetTitle>
              <SheetDescription className="text-neutral-500 text-xs mt-1">
                {readOnly ? "Read-only view" : "Click any field to edit · Auto-saves"}
              </SheetDescription>
            </div>
            {changedFields.size > 0 && !readOnly && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {changedFields.size} changed
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* System fields */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">System</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-neutral-500 text-xs">Sprint</Label>
                <p className="text-sm text-neutral-300">{task.sprint_name || "—"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-neutral-500 text-xs">Created</Label>
                <p className="text-sm text-neutral-300">
                  {new Date(task.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-neutral-800/50" />

          {/* Dynamic fields */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">Fields</h3>

            {editableDefs.map((def) => {
              const value = localFields[def.key];
              const isChanged = changedFields.has(def.key);
              const isEditable = def.is_editable && !readOnly;

              return (
                <div
                  key={def.key}
                  className={`space-y-1.5 p-3 rounded-lg transition-colors ${
                    isChanged
                      ? "bg-emerald-500/5 border border-emerald-500/20"
                      : "hover:bg-neutral-900/50"
                  }`}
                >
                  <Label className="text-neutral-400 text-xs flex items-center gap-1.5">
                    {def.label}
                    {def.is_required && <span className="text-red-400">*</span>}
                    {isChanged && <Pencil className="w-3 h-3 text-emerald-500" />}
                  </Label>

                  {/* Render based on data_type */}
                  {def.data_type === "text" && (
                    isEditable ? (
                      <Textarea
                        value={value || ""}
                        onChange={(e) => handleFieldChange(def.key, e.target.value)}
                        placeholder={`Enter ${def.label.toLowerCase()}...`}
                        className="bg-neutral-900 border-neutral-800 text-neutral-200 resize-none min-h-[80px] text-sm"
                      />
                    ) : (
                      <p className="text-sm text-neutral-300 whitespace-pre-wrap">{value || "—"}</p>
                    )
                  )}

                  {def.data_type === "number" && (
                    isEditable ? (
                      <Input
                        type="number"
                        value={value ?? ""}
                        onChange={(e) => handleFieldChange(def.key, e.target.value ? Number(e.target.value) : null)}
                        className="bg-neutral-900 border-neutral-800 text-neutral-200 font-mono text-sm"
                      />
                    ) : (
                      <p className="text-sm text-neutral-300 font-mono">{value ?? "—"}</p>
                    )
                  )}

                  {def.data_type === "boolean" && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!value}
                        disabled={!isEditable}
                        onCheckedChange={(checked) => handleFieldChange(def.key, !!checked)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <span className="text-sm text-neutral-400">{value ? "Yes" : "No"}</span>
                    </div>
                  )}

                  {def.data_type === "select" && (
                    isEditable ? (
                      <Select
                        value={value || ""}
                        onValueChange={(v) => handleFieldChange(def.key, v)}
                      >
                        <SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-200 text-sm">
                          <SelectValue placeholder={`Select ${def.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800">
                          {def.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-neutral-300">
                              <div className="flex items-center gap-2">
                                {opt.color && (
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                                )}
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2">
                        {def.options?.find((o) => o.value === value)?.color && (
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: def.options.find((o) => o.value === value)?.color }}
                          />
                        )}
                        <span className="text-sm text-neutral-300">{value || "—"}</span>
                      </div>
                    )
                  )}

                  {def.data_type === "date" && (
                    isEditable ? (
                      <Input
                        type="date"
                        value={value || ""}
                        onChange={(e) => handleFieldChange(def.key, e.target.value)}
                        className="bg-neutral-900 border-neutral-800 text-neutral-200 text-sm"
                      />
                    ) : (
                      <p className="text-sm text-neutral-300">{value || "—"}</p>
                    )
                  )}

                  {(def.data_type === "user" || def.data_type === "multi_select") && (
                    <p className="text-sm text-neutral-300">
                      {Array.isArray(value) ? value.join(", ") : value || "—"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <Clock className="w-3 h-3" />
            Updated {new Date(task.updated_at).toLocaleString("en-IN")}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-400">
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
