/**
 * components/charts/absorption-chart.tsx
 * --------------------------------------
 * Absorption Bar Chart for QBR Presentation.
 * Shows "Planned Work" vs "Ad-hoc Mid-Sprint Injections" across sprints.
 * Uses Recharts for rendering.
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AbsorptionDataPoint } from "@/lib/types";
import { useMemo } from "react";

interface AbsorptionChartProps {
  data: AbsorptionDataPoint[];
  usePoints?: boolean; // If true, shows story points instead of issue count
}

export function AbsorptionChart({ data, usePoints = false }: AbsorptionChartProps) {
  // Sort data chronologically (assuming sprint_name has some chronological order,
  // but ideally passed in sorted order from DB)
  const chartData = useMemo(() => {
    return [...data].reverse(); // Assuming recent sprints come first, reverse for chronological
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-neutral-500 text-sm">
        No sprint data available.
      </div>
    );
  }

  const plannedKey = usePoints ? "planned_points" : "planned_count";
  const adhocKey = usePoints ? "adhoc_points" : "adhoc_count";
  const yAxisLabel = usePoints ? "Story Points" : "Issue Count";

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          stackOffset="sign"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
          <XAxis
            dataKey="sprint_name"
            stroke="#737373"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="#737373"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dx={-10}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#737373",
              fontSize: 12,
            }}
          />
          <Tooltip
            cursor={{ fill: "#262626", opacity: 0.4 }}
            contentStyle={{
              backgroundColor: "#171717",
              borderColor: "#262626",
              borderRadius: "8px",
              color: "#e5e5e5",
            }}
            itemStyle={{ color: "#e5e5e5" }}
            labelStyle={{ color: "#a3a3a3", marginBottom: "8px" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          <Bar
            dataKey={plannedKey}
            name="Planned Work"
            fill="#10b981" // Emerald 500
            stackId="a"
            radius={[0, 0, 4, 4]}
            maxBarSize={50}
          />
          <Bar
            dataKey={adhocKey}
            name="Ad-hoc Injections"
            fill="#f59e0b" // Amber 500
            stackId="a"
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
