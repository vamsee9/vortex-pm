/**
 * components/charts/chart-card.tsx
 * --------------------------------
 * A reusable wrapper card for QBR charts.
 * Provides a consistent border, background, and header structure.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, children, className }: ChartCardProps) {
  return (
    <Card className={`bg-neutral-900/80 border-neutral-800 ${className || ""}`}>
      <CardHeader>
        <CardTitle className="text-lg text-neutral-100">{title}</CardTitle>
        <CardDescription className="text-neutral-400">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}
