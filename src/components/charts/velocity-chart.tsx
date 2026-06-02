/**
 * components/charts/velocity-chart.tsx
 * ------------------------------------
 * Velocity Trends Line Chart for QBR Presentation.
 * Tracks total story points completed by calendar month.
 * Uses Recharts for rendering.
 */

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { VelocityDataPoint } from "@/lib/types";

interface VelocityChartProps {
  data: VelocityDataPoint[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-neutral-500 text-sm">
        No velocity data available.
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <defs>
            <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
          <XAxis
            dataKey="month"
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
              value: "Story Points",
              angle: -90,
              position: "insideLeft",
              fill: "#737373",
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              borderColor: "#262626",
              borderRadius: "8px",
              color: "#e5e5e5",
            }}
            itemStyle={{ color: "#3b82f6" }}
            labelStyle={{ color: "#a3a3a3", marginBottom: "8px" }}
          />
          <Area
            type="monotone"
            dataKey="completed_points"
            name="Velocity (SP)"
            stroke="#3b82f6" // Blue 500
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorVelocity)"
            activeDot={{ r: 6, fill: "#3b82f6", stroke: "#171717", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
