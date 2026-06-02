/**
 * (dashboard)/board/page.tsx
 * --------------------------
 * Sprint Board page — the main data table view.
 * This is a Server Component that fetches tasks from Supabase
 * based on the current sprint filter and passes them to the
 * client-side DataTable component.
 *
 * Wrapped in a Suspense boundary so users see a skeleton while data loads.
 *
 * Filters are read from URL search params:
 * - sprint: Sprint ID to filter by
 * - type: Work type filter
 * - priority: Priority filter
 * - status: Status filter
 * - search: Text search
 */

import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchTasks, fetchSprints } from "@/lib/actions/tasks";
import { DataTable } from "@/components/data-table/data-table";
import { TableSkeleton } from "@/components/loading-skeleton";

interface BoardPageProps {
  searchParams: Promise<{
    sprint?: string;
    type?: string;
    priority?: string;
    status?: string;
    search?: string;
  }>;
}

// The actual data-fetching component — extracted so Suspense can wrap it
async function BoardContent({ searchParams }: BoardPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // Layout handles redirect
  }

  // Get active project from cookies
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get("active_project_id")?.value;

  // Fetch available sprints for the default selection
  const sprints = await fetchSprints(activeProjectId);

  // If no sprint is specified in the URL, default to the most recent one
  const selectedSprintId = params.sprint || (sprints.length > 0 ? sprints[0].sprint_id : null);
  const selectedSprint = sprints.find((s) => s.sprint_id === selectedSprintId);

  // Build the filter object from URL search params
  const tasks = await fetchTasks({
    project_id: activeProjectId || null,
    sprint_id: params.sprint === "all" ? null : selectedSprintId,
    work_type: params.type || null,
    priority: params.priority || null,
    status: params.status || null,
    search: params.search || "",
  });

  return (
    <DataTable
      tasks={tasks}
      currentUserId={user.id}
      sprintName={selectedSprint?.sprint_name}
    />
  );
}

export default function BoardPage({ searchParams }: BoardPageProps) {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <BoardContent searchParams={searchParams} />
    </Suspense>
  );
}
