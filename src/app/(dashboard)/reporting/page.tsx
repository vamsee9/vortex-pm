import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ChartCard } from "@/components/charts/chart-card";
import { AbsorptionChart } from "@/components/charts/absorption-chart";
import { VelocityChart } from "@/components/charts/velocity-chart";
import { ChartSkeleton } from "@/components/loading-skeleton";
import { SprintSelector } from "./sprint-selector";
import { ExportReportButton } from "./export-button";
import type { AbsorptionDataPoint, VelocityDataPoint, SprintOption } from "@/lib/types";
import { fetchSprints } from "@/lib/actions/tasks";
import { cookies } from "next/headers";

// The actual data-fetching component
async function ReportingContent({ selectedSprints }: { selectedSprints: string[] }) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get("active_project_id")?.value;

  // Ensure user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch tasks
  let query = supabase.from("project_tasks").select("*");
  if (activeProjectId) {
    query = query.eq("project_id", activeProjectId);
  }
  if (selectedSprints.length > 0) {
    query = query.in("sprint_id", selectedSprints);
  } else {
    query = query.not("sprint_id", "is", null);
  }

  const { data: allTasks, error } = await query;

  if (error || !allTasks) {
    return (
      <div className="p-6 text-red-400">
        Failed to load chart data: {error?.message}
      </div>
    );
  }

  // ── Aggregate Data: Absorption ──
  const sprintMap = new Map<string, AbsorptionDataPoint>();

  allTasks.forEach((task) => {
    if (!task.sprint_name) return;

    const sprintName = task.sprint_name;
    if (!sprintMap.has(sprintName)) {
      sprintMap.set(sprintName, {
        sprint_name: sprintName,
        planned_count: 0,
        adhoc_count: 0,
        planned_points: 0,
        adhoc_points: 0,
      });
    }

    const aggregated = sprintMap.get(sprintName)!;
    const storyPoints = Number(task.custom_fields?.story_points || 0);

    if (task.custom_fields?.planned_in_sprint) {
      aggregated.planned_count += 1;
      aggregated.planned_points += storyPoints;
    }

    if (task.custom_fields?.added_mid_sprint) {
      aggregated.adhoc_count += 1;
      aggregated.adhoc_points += storyPoints;
    }
  });

  const absorptionData = Array.from(sprintMap.values()).slice(0, 10);

  // ── Aggregate Data: Velocity ──
  const monthMap = new Map<string, VelocityDataPoint>();
  const finalizedStatuses = ["Done", "Resolved", "Verified", "Closed", "Completed"];

  allTasks.forEach((task) => {
    const status = task.custom_fields?.status;
    const doneAt = task.custom_fields?.done_at || task.updated_at;
    
    if (!status || !finalizedStatuses.includes(status) || !doneAt) return;

    const date = new Date(doneAt);
    const monthKey = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        completed_points: 0,
        completed_count: 0,
      });
    }

    const aggregated = monthMap.get(monthKey)!;
    aggregated.completed_count += 1;
    aggregated.completed_points += Number(task.custom_fields?.story_points || 0);
  });

  const velocityData = Array.from(monthMap.values()).sort((a, b) => {
    return new Date(a.month).getTime() - new Date(b.month).getTime();
  });

  return (
    <>
      <div className="flex justify-end mb-4">
        <ExportReportButton absorptionData={absorptionData} velocityData={velocityData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Sprint Absorption"
          description="Planned Work vs Ad-hoc Injections (Last 10 Sprints, by Issue Count)"
        >
          <AbsorptionChart data={absorptionData} usePoints={false} />
        </ChartCard>

        <ChartCard
          title="Velocity Trends"
          description="Total Story Points completed per month"
        >
          <VelocityChart data={velocityData} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
         <ChartCard
          title="Sprint Absorption (Story Points)"
          description="Planned Work vs Ad-hoc Injections (Last 10 Sprints, by SP)"
        >
          <AbsorptionChart data={absorptionData} usePoints={true} />
        </ChartCard>
      </div>
    </>
  );
}

export default async function ReportingPage(props: { searchParams: Promise<{ sprints?: string }> }) {
  const searchParams = await props.searchParams;
  const sprintsParam = searchParams.sprints;
  const selectedSprints = sprintsParam ? sprintsParam.split(",") : [];

  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get("active_project_id")?.value;
  const allSprints = await fetchSprints(activeProjectId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-100">Reporting</h2>
          <p className="text-neutral-400 mt-1">
            High-level metrics aggregated across your sprints and team members.
          </p>
        </div>
        <SprintSelector sprints={allSprints} />
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <ReportingContent selectedSprints={selectedSprints} />
      </Suspense>
    </div>
  );
}
