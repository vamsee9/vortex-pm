/**
 * components/header.tsx
 * ---------------------
 * Top header bar for the dashboard.
 * Shows the sprint selector dropdown and page title.
 * The sprint selector lets users switch between sprints,
 * defaulting to the most recent active sprint.
 *
 * Includes tooltips on the calendar icon and sprint selector
 * for better accessibility and discoverability.
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SprintOption } from "@/lib/types";
import { Calendar, LogOut, Settings as SettingsIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  sprints: SprintOption[];
  currentSprintId: string | null;
  pageTitle: string;
  hideSidebar?: boolean;
  userName?: string;
  userEmail?: string;
}

export function Header({ sprints, currentSprintId, pageTitle, hideSidebar, userName, userEmail }: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSprintChange(sprintId: string) {
    // Update the URL search params to reflect the selected sprint
    const params = new URLSearchParams(searchParams.toString());

    if (sprintId === "all") {
      params.delete("sprint");
    } else {
      params.set("sprint", sprintId);
    }

    router.push(`?${params.toString()}`);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const hasSprints = sprints.length > 0;

  return (
    <header className="h-16 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-neutral-100">{pageTitle}</h1>

      {/* Sprint selector (hidden if no project is active, disabled if no sprints) */}
      {!hideSidebar && (
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

      {/* Global Owner User Menu (Only shown when sidebar is hidden) */}
      {hideSidebar && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold shrink-0 hover:bg-emerald-500/30 transition-colors outline-none focus:ring-2 focus:ring-emerald-500/50">
              {userName?.charAt(0)?.toUpperCase() || "A"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-neutral-900 border-neutral-800 text-neutral-200">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-neutral-100">{userName}</p>
                <p className="text-xs leading-none text-neutral-500">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-neutral-800" />
            <DropdownMenuItem className="focus:bg-neutral-800 focus:text-neutral-100 cursor-pointer text-neutral-300">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleLogout}
              className="focus:bg-red-500/10 focus:text-red-400 text-red-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
