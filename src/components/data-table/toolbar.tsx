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
import type { ProjectTask, ColumnDefinition } from "@/lib/types";
import { exportTasksToExcel } from "@/lib/excel-export";

interface ToolbarProps {
  tasks: ProjectTask[];
  sprintName?: string;
  columnDefs: ColumnDefinition[];
}

export function DataTableToolbar({ tasks, sprintName, columnDefs }: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Controlled search input with proper debounce
  const currentSearch = searchParams.get("search") || "";
  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

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

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setFilter("search", value);
    }, 400);
  }

  function resetFilters() {
    setSearchValue("");
    const params = new URLSearchParams();
    const sprint = searchParams.get("sprint");
    if (sprint) params.set("sprint", sprint);
    router.push(`?${params.toString()}`);
  }

  // Get dynamic filterable select columns
  const filterableSelects = columnDefs.filter(
    (c) => c.is_filterable && c.data_type === "select"
  );

  const hasActiveFilters = 
    currentSearch || 
    filterableSelects.some(c => !!searchParams.get(c.key));

  return (
    <div className="flex flex-wrap items-center gap-3 pb-4">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <Input
          placeholder="Search by key or summary..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-neutral-900 border-neutral-700 text-neutral-200 placeholder:text-neutral-500"
        />
      </div>

      {/* Dynamic Filters */}
      {filterableSelects.map((col) => {
        const currentVal = searchParams.get(col.key) || "";
        return (
          <Select 
            key={col.key} 
            value={currentVal || "all"} 
            onValueChange={(v) => setFilter(col.key, v)}
          >
            <SelectTrigger className="w-auto min-w-[130px] bg-neutral-900 border-neutral-700 text-neutral-300">
              <SelectValue placeholder={col.label} />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-700">
              <SelectItem value="all" className="text-neutral-300">
                All {col.label}s
              </SelectItem>
              {col.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-neutral-300">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTasksToExcel(tasks, sprintName || "All Sprints")}
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
