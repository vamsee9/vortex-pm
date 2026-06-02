/**
 * (dashboard)/qbr/page.tsx
 * ------------------------
 * QBR (Quarterly Business Review) Presentation page.
 * Shows high-level visualizations: Absorption Rate and Velocity Trends.
 * This aggregates data across ALL sprints and users to give managers
 * a bird's-eye view of team performance.
 *
 * Wrapped in a Suspense boundary to show ChartSkeleton while data aggregates.
 */

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ChartCard } from "@/components/charts/chart-card";
import { AbsorptionChart } from "@/components/charts/absorption-chart";
import { VelocityChart } from "@/components/charts/velocity-chart";
import { ChartSkeleton } from "@/components/loading-skeleton";
import type { AbsorptionDataPoint, VelocityDataPoint } from "@/lib/types";

// The actual data-fetching component
async function QBRContent() {
  const supabase = await createClient();

  // Ensure user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // ── Fetch data for charts ──
  const { data: allTasks, error } = await supabase
    .from("jira_tasks_snapshot")
    .select("*")
    .order("sprint_start_date", { ascending: false });

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

    if (task.planned_in_sprint) {
      aggregated.planned_count += 1;
      aggregated.planned_points += Number(task.story_points || 0);
    }

    if (task.added_mid_sprint) {
      aggregated.adhoc_count += 1;
      aggregated.adhoc_points += Number(task.story_points || 0);
    }
  });

  const absorptionData = Array.from(sprintMap.values()).slice(0, 10);

  // ── Aggregate Data: Velocity ──
  const monthMap = new Map<string, VelocityDataPoint>();
  const finalizedStatuses = ["Done", "Resolved", "Verified", "Closed"];

  allTasks.forEach((task) => {
    if (!finalizedStatuses.includes(task.status) || !task.done_at) return;

    const date = new Date(task.done_at);
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
    aggregated.completed_points += Number(task.story_points || 0);
  });

  const velocityData = Array.from(monthMap.values()).sort((a, b) => {
    return new Date(a.month).getTime() - new Date(b.month).getTime();
  });

  return (
    <>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

export default function QBRPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-100">QBR Presentation</h2>
        <p className="text-neutral-400 mt-1">
          High-level metrics aggregated across all sprints and team members.
        </p>
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <QBRContent />
      </Suspense>
    </div>
  );
}
