/**
 * excel-export.ts
 * ---------------
 * Client-side Excel export utility.
 * Uses the 'xlsx' library to generate a proper .xlsx file
 * from whatever data is currently showing in the data table.
 *
 * The user clicks "Export to Excel" → this function runs in the browser
 * → downloads an .xlsx file instantly. No server round-trip needed.
 */

import * as XLSX from "xlsx";
import type { JiraTask } from "@/lib/types";

/**
 * Export the given tasks array to an Excel file and trigger download.
 * @param tasks - The filtered/sorted array of tasks currently visible
 * @param sheetName - Name for the Excel sheet (usually sprint name)
 */
export function exportToExcel(tasks: JiraTask[], sheetName: string = "Sprint Data") {
  // Map the raw data to clean, human-readable column names
  const exportData = tasks.map((task) => ({
    "Jira Key": task.jira_key,
    "Summary": task.summary,
    "Status": task.status,
    "Priority": task.priority,
    "Work Type": task.work_type,
    "Story Points": task.story_points,
    "Assignees": (task.assignees || []).join(", "),
    "Reporter": task.reporter,
    "Sprint": task.sprint_name || "—",
    "Week Numbers": (task.week_numbers || []).join(", "),
    "Planned in Sprint": task.planned_in_sprint ? "Yes" : "No",
    "Added Mid-Sprint": task.added_mid_sprint ? "Yes" : "No",
    "Carry Forward": task.carry_forward ? "Yes" : "No",
    "Lead Time (Days)": task.lead_time_days ?? "—",
    "Reopened": task.reopened ? "Yes" : "No",
    "Resolution": task.resolution || "—",
    "Labels": (task.labels || []).join(", "),
    "Created": formatDate(task.issue_created_at),
    "Updated": formatDate(task.issue_updated_at),
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-size columns based on content width
  const columnWidths = Object.keys(exportData[0] || {}).map((key) => {
    // Find the longest value in this column (including the header)
    const maxContentLength = Math.max(
      key.length,
      ...exportData.map((row) => String(row[key as keyof typeof row] || "").length)
    );
    return { wch: Math.min(maxContentLength + 2, 50) }; // cap at 50 chars
  });
  worksheet["!cols"] = columnWidths;

  // Add the worksheet to the workbook
  const safeName = sheetName.substring(0, 31); // Excel sheet names max 31 chars
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName);

  // Generate the file and trigger browser download
  const fileName = `sprint-metrics-${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Format an ISO date string to a readable format.
 * Returns "—" if the date is null/undefined.
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}
