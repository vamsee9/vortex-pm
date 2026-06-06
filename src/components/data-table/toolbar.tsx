"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CirclePlus, X, Download, Settings2, Check, RotateCcw } from "lucide-react";
import type { ProjectTask, ColumnDefinition } from "@/lib/types";
import { exportTasksToExcel } from "@/lib/excel-export";
import type { ColumnPreference } from "./use-column-preferences";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  tasks: ProjectTask[];
  sprintName?: string;
  columnDefs: ColumnDefinition[];
  preferences: Record<string, ColumnPreference>;
  updatePreference: (key: string, updates: Partial<ColumnPreference>) => void;
}

export function DataTableToolbar({ tasks, sprintName, columnDefs, preferences, updatePreference }: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Search ───
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
      // Reset to page 1 when filters change
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleFilterValue = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.get(key);

      // Support multi-value filters separated by commas
      const currentValues = current ? current.split(",") : [];
      const idx = currentValues.indexOf(value);

      if (idx >= 0) {
        currentValues.splice(idx, 1);
      } else {
        currentValues.push(value);
      }

      if (currentValues.length > 0) {
        params.set(key, currentValues.join(","));
      } else {
        params.delete(key);
      }
      params.delete("page");
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
    filterableSelects.some((c) => !!searchParams.get(c.key));

  return (
    <div role="toolbar" aria-orientation="horizontal" className="flex w-full items-start justify-between gap-2 p-1">
      {/* ─── Left: Search + Filter Chips ─── */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Search titles..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-8 w-40 lg:w-56"
        />

        {/* Dynamic filter chips (TableCN style: dashed border + CirclePlus icon) */}
        {filterableSelects.map((col) => {
          const currentParamVal = searchParams.get(col.key) || "";
          const selectedValues = currentParamVal ? currentParamVal.split(",") : [];
          const hasValues = selectedValues.length > 0;

          return (
            <Popover key={col.key}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 border-dashed font-normal",
                    hasValues && "border-solid"
                  )}
                >
                  <CirclePlus className="h-3.5 w-3.5" />
                  {col.label}
                  {hasValues && (
                    <>
                      <Separator orientation="vertical" className="mx-0.5 h-4" />
                      <div className="flex gap-1">
                        {selectedValues.length > 2 ? (
                          <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                            {selectedValues.length} selected
                          </Badge>
                        ) : (
                          selectedValues.map((v) => (
                            <Badge
                              key={v}
                              variant="secondary"
                              className="rounded-sm px-1 font-normal"
                            >
                              {col.options?.find((o) => o.value === v)?.label || v}
                            </Badge>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={`Filter ${col.label.toLowerCase()}...`} />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      {col.options?.map((opt) => {
                        const isSelected = selectedValues.includes(opt.value);
                        return (
                          <CommandItem
                            key={opt.value}
                            onSelect={() => toggleFilterValue(col.key, opt.value)}
                          >
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible"
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            {opt.color && (
                              <span
                                className="mr-2 h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: opt.color }}
                              />
                            )}
                            <span>{opt.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    {hasValues && (
                      <>
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => setFilter(col.key, "")}
                            className="justify-center text-center"
                          >
                            Clear filter
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          );
        })}

        {/* Reset all filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 px-2 lg:px-3"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* ─── Right: View / Columns / Export ─── */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal">
              <Settings2 className="h-3.5 w-3.5" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columnDefs.map((col) => {
              const isVisible = preferences[col.key]?.isVisible !== false;
              return (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={isVisible}
                  onCheckedChange={(v) => updatePreference(col.key, { isVisible: v })}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportTasksToExcel(tasks, sprintName || "All Sprints")}
          disabled={tasks.length === 0}
          className="h-8 gap-1.5 font-normal"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </div>
  );
}
