/**
 * components/header.tsx
 * ---------------------
 * Top header bar for the dashboard.
 * Shows the page title and optional sprint selector.
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SprintOption } from "@/lib/types";
import { Calendar } from "lucide-react";

interface HeaderProps {
  sprints: SprintOption[];
  currentSprintId: string | null;
  pageTitle: string;
  showSprintSelector?: boolean;
  userName?: string;
  userEmail?: string;
}

export function Header({ sprints, currentSprintId, pageTitle, showSprintSelector }: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSprintChange(sprintId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (sprintId === "all") {
      params.delete("sprint");
    } else {
      params.set("sprint", sprintId);
    }

    router.push(`?${params.toString()}`);
  }

  const hasSprints = sprints.length > 0;

  return (
    <header className="h-16 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-neutral-100">{pageTitle}</h1>

      {/* Sprint selector — only shown when relevant */}
      {showSprintSelector && (
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Calendar className="w-4 h-4 text-neutral-500 cursor-default" />
            </TooltipTrigger>
            <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
              Filter tasks by sprint
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={currentSprintId || "all"}
                  onValueChange={handleSprintChange}
                  disabled={!hasSprints}
                >
                  <SelectTrigger className="w-[240px] bg-neutral-900 border-neutral-700 text-neutral-200 disabled:opacity-50">
                    <SelectValue placeholder="Select a sprint" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    <SelectItem value="all" className="text-neutral-300">
                      All Sprints
                    </SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem
                        key={sprint.sprint_id}
                        value={sprint.sprint_id}
                        className="text-neutral-300"
                      >
                        {sprint.sprint_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            {!hasSprints && (
              <TooltipContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                No sprints active. Import issues from Jira to generate sprints.
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      )}
    </header>
  );
}

