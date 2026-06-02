/**
 * metrics.ts
 * ----------
 * Pure utility functions for computing sprint metrics.
 * These are used by the webhook ingestion engine to calculate
 * derived columns before saving to the database.
 *
 * All functions here are stateless and side-effect free —
 * you give them inputs, they give you outputs. Easy to test.
 */

// ─── Finalized statuses that mean "this ticket is done" ───
const FINALIZED_STATUSES = ["Done", "Resolved", "Verified", "Closed"];

/**
 * Calculate which week numbers a date falls into within a sprint window.
 * Week 1 = first 7 days of sprint, Week 2 = next 7 days, etc.
 *
 * Example: Sprint starts Jan 1, ends Jan 14.
 *   - A task updated on Jan 3 → [1]
 *   - A task updated on Jan 10 → [2]
 */
export function computeWeekNumbers(
  sprintStart: string | null,
  sprintEnd: string | null,
  currentDate: string | null
): number[] {
  if (!sprintStart || !sprintEnd || !currentDate) return [];

  const start = new Date(sprintStart);
  const end = new Date(sprintEnd);
  const current = new Date(currentDate);

  // If the date is outside the sprint window, return empty
  if (current < start || current > end) return [];

  const daysSinceStart = Math.floor(
    (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Week number is 1-indexed
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  return [weekNumber];
}

/**
 * Count business days (Monday to Friday) between two dates.
 * This mirrors the PostgreSQL calculate_business_days() function.
 *
 * Used for Lead Time calculation: how many working days from
 * "In Progress" to "Done".
 */
export function computeBusinessDays(
  startDate: string | null,
  endDate: string | null
): number | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) return 0;

  let businessDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return businessDays;
}

/**
 * Was this issue in the sprint when it officially started?
 * If the issue was added to the sprint before or on the start date → true.
 */
export function isPlannedInSprint(
  bindingTimestamp: string | null,
  sprintStart: string | null
): boolean {
  if (!bindingTimestamp || !sprintStart) return false;
  return new Date(bindingTimestamp) <= new Date(sprintStart);
}

/**
 * Was this issue added AFTER the sprint already started?
 * These are the "ad-hoc" or "mid-sprint injection" tasks.
 */
export function isAddedMidSprint(
  bindingTimestamp: string | null,
  sprintStart: string | null
): boolean {
  if (!bindingTimestamp || !sprintStart) return false;
  return new Date(bindingTimestamp) > new Date(sprintStart);
}

/**
 * Should this issue be marked as "carry forward"?
 * Carry forward = the sprint closed, but this issue didn't reach
 * a finalized state (Done/Resolved/Verified/Closed).
 */
export function isCarryForward(
  sprintState: string | null,
  issueStatus: string
): boolean {
  // Only flag carry forward if the sprint is actually closed
  if (sprintState !== "closed") return false;
  return !FINALIZED_STATUSES.includes(issueStatus);
}

/**
 * Check if a task was reopened — i.e., it went from a Done/Resolved/Verified
 * status BACK to an active status like "In Progress" or "To Do".
 *
 * We look through the Jira changelog for status transitions where:
 * - fromString was a finalized status
 * - toString is NOT a finalized status
 */
export function detectReopened(
  changelog: { field: string; fromString: string | null; toString: string | null }[]
): boolean {
  if (!changelog || changelog.length === 0) return false;

  return changelog.some((item) => {
    if (item.field !== "status") return false;

    const from = item.fromString || "";
    const to = item.toString || "";

    // Went from a "done" state back to an active state
    return FINALIZED_STATUSES.includes(from) && !FINALIZED_STATUSES.includes(to);
  });
}
