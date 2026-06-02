/**
 * data-table/toolbar.tsx
 * ----------------------
 * Filter toolbar for the Sprint Board data table.
 * Provides dropdown filters for Work Type, Priority, and Status,
 * plus a search bar and Excel export button.
 *
 * All filters are controlled via URL search params so they survive
 * page refreshes and can be shared via URL.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Download, RotateCcw } from "lucide-react";
import type { JiraTask } from "@/lib/types";
import { exportToExcel } from "@/lib/excel-export";

interface ToolbarProps {
  tasks: JiraTask[];
  sprintName?: string;
}

// Available filter options — add new values here as needed
const WORK_TYPES = ["Story", "Bug", "Task", "Sub-task", "Epic"];
const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];
const STATUSES = ["To Do", "In Progress", "In Review", "Done", "Resolved", "Blocked", "Closed"];

export function DataTableToolbar({ tasks, sprintName }: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read current filter values from URL
  const currentType = searchParams.get("type") || "";
  const currentPriority = searchParams.get("priority") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentSearch = searchParams.get("search") || "";

  // Controlled search input with proper debounce
  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync search input when URL changes externally (e.g. reset filters)
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  // Update a single filter param in the URL
  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Debounced search — waits 400ms after the user stops typing before
  // updating the URL. This prevents hammering the server on every keystroke.
  function handleSearchChange(value: string) {
    setSearchValue(value);

    // Clear the previous timer if the user is still typing
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set a new timer
    debounceTimer.current = setTimeout(() => {
      setFilter("search", value);
    }, 400);
  }

  // Clear all filters
  function resetFilters() {
    setSearchValue(""); // Clear the controlled input too
    const params = new URLSearchParams();
    // Keep the sprint param if it exists
    const sprint = searchParams.get("sprint");
    if (sprint) params.set("sprint", sprint);
    router.push(`?${params.toString()}`);
  }

  // Check if any filters are active
  const hasActiveFilters = currentType || currentPriority || currentStatus || currentSearch;

  return (
    <div className="flex flex-wrap items-center gap-3 pb-4">
      {/* Search bar — controlled input with debounce */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <Input
          placeholder="Search by key or summary..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-neutral-900 border-neutral-700 text-neutral-200 placeholder:text-neutral-500"
        />
      </div>

      {/* Work Type filter */}
      <Select value={currentType || "all"} onValueChange={(v) => setFilter("type", v)}>
        <SelectTrigger className="w-[140px] bg-neutral-900 border-neutral-700 text-neutral-300">
          <SelectValue placeholder="Work Type" />
        </SelectTrigger>
        <SelectContent className="bg-neutral-900 border-neutral-700">
          <SelectItem value="all" className="text-neutral-300">
            All Types
          </SelectItem>
          {WORK_TYPES.map((type) => (
            <SelectItem key={type} value={type} className="text-neutral-300">
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select value={currentPriority || "all"} onValueChange={(v) => setFilter("priority", v)}>
        <SelectTrigger className="w-[130px] bg-neutral-900 border-neutral-700 text-neutral-300">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent className="bg-neutral-900 border-neutral-700">
          <SelectItem value="all" className="text-neutral-300">
            All Priorities
          </SelectItem>
          {PRIORITIES.map((priority) => (
            <SelectItem key={priority} value={priority} className="text-neutral-300">
              {priority}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={currentStatus || "all"} onValueChange={(v) => setFilter("status", v)}>
        <SelectTrigger className="w-[140px] bg-neutral-900 border-neutral-700 text-neutral-300">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="bg-neutral-900 border-neutral-700">
          <SelectItem value="all" className="text-neutral-300">
            All Statuses
          </SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status} className="text-neutral-300">
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset filters button */}
      {hasActiveFilters && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-neutral-400 hover:text-neutral-200"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
            Clear all active filters
          </TooltipContent>
        </Tooltip>
      )}

      {/* Export to Excel button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel(tasks, sprintName || "All Sprints")}
            disabled={tasks.length === 0}
            className="ml-auto border-neutral-700 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Excel
          </Button>
        </TooltipTrigger>
        <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
          Download current view as Excel (.xlsx)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
