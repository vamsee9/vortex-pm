"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SprintOption } from "@/lib/types";

export function SprintSelector({ sprints }: { sprints: SprintOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const selectedSprintsParam = searchParams.get("sprints");
  const selectedSprints = selectedSprintsParam ? selectedSprintsParam.split(",") : [];

  const handleToggle = (sprintId: string) => {
    let newSelection = [...selectedSprints];
    if (newSelection.includes(sprintId)) {
      newSelection = newSelection.filter((id) => id !== sprintId);
    } else {
      newSelection.push(sprintId);
    }

    const params = new URLSearchParams(searchParams.toString());
    if (newSelection.length > 0) {
      params.set("sprints", newSelection.join(","));
    } else {
      params.delete("sprints");
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-neutral-900 border-neutral-700 text-neutral-200 w-[240px] justify-between">
          {selectedSprints.length === 0
            ? "All Sprints"
            : `${selectedSprints.length} sprint(s) selected`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px] bg-neutral-900 border-neutral-800 text-neutral-200 max-h-[300px] overflow-y-auto">
        <DropdownMenuLabel>Select Sprints</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-neutral-800" />
        {sprints.map((sprint) => (
          <DropdownMenuCheckboxItem
            key={sprint.sprint_id}
            checked={selectedSprints.includes(sprint.sprint_id)}
            onCheckedChange={() => handleToggle(sprint.sprint_id)}
            className="focus:bg-neutral-800 focus:text-neutral-100"
          >
            {sprint.sprint_name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
