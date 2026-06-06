/**
 * (dashboard)/projects/[projectId]/members/[memberId]/page.tsx
 * -------------------------------------------------------------
 * Admin view of a specific team member's sprint data.
 * Read-only sprint table filtered by owner_id = memberId.
 * Supports filtering, reporting, and data export.
 */

import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchTasks } from "@/lib/actions/tasks";
import { fetchColumnDefinitions } from "@/lib/actions/column-definitions";
import { DataTable } from "@/components/data-table/data-table";
import { TableSkeleton } from "@/components/loading-skeleton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface MemberWorkspaceProps {
  params: Promise<{ projectId: string; memberId: string }>;
  searchParams: Promise<{
    sprint?: string;
    page?: string;
    per_page?: string;
    sort?: string;
    dir?: "asc" | "desc";
  }>;
}

async function MemberWorkspaceContent({ params, searchParams }: MemberWorkspaceProps) {
  const { projectId, memberId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();

  // Get member info
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, email")
    .eq("id", memberId)
    .single();

  // Fetch tasks owned by this member
  const { data: tasks, count: totalCount } = await fetchTasks({
    project_id: projectId,
    owner_id: memberId,
    sprint_id: sp.sprint || null,
    page: sp.page ? parseInt(sp.page, 10) : 1,
    per_page: sp.per_page ? parseInt(sp.per_page, 10) : 25,
    sort_key: sp.sort || "updated_at",
    sort_dir: sp.dir || "desc",
  });

  const columnDefs = await fetchColumnDefinitions(projectId);

  return (
    <div className="max-w-full mx-auto space-y-6">
      <Link href={`/projects/${projectId}`} className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center w-fit">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Team Members
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-neutral-50">
          {profile?.username || "Member"}'s Workspace
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Viewing sprint data for {profile?.email || memberId}
        </p>
      </div>

      <DataTable
        tasks={tasks}
        totalCount={totalCount}
        currentUserId={memberId}
        columnDefs={columnDefs}
        projectId={projectId}
        readOnly
      />
    </div>
  );
}

export default function MemberWorkspacePage(props: MemberWorkspaceProps) {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <MemberWorkspaceContent {...props} />
    </Suspense>
  );
}
