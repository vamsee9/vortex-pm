"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

export function ExportReportButton({ 
  absorptionData, 
  velocityData 
}: { 
  absorptionData: any[]; 
  velocityData: any[]; 
}) {
  const handleExport = () => {
    const workbook = XLSX.utils.book_new();

    // Absorption Sheet
    const absorptionSheet = XLSX.utils.json_to_sheet(
      absorptionData.map(d => ({
        "Sprint Name": d.sprint_name,
        "Planned Count": d.planned_count,
        "Adhoc Count": d.adhoc_count,
        "Planned Points": d.planned_points,
        "Adhoc Points": d.adhoc_points
      }))
    );
    XLSX.utils.book_append_sheet(workbook, absorptionSheet, "Sprint Absorption");

    // Velocity Sheet
    const velocitySheet = XLSX.utils.json_to_sheet(
      velocityData.map(d => ({
        "Month": d.month,
        "Completed Count": d.completed_count,
        "Completed Points": d.completed_points
      }))
    );
    XLSX.utils.book_append_sheet(workbook, velocitySheet, "Velocity Trends");

    XLSX.writeFile(workbook, `vortex-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleExport}
      className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50"
    >
      <Download className="w-4 h-4 mr-2" />
      Export to Excel
    </Button>
  );
}
