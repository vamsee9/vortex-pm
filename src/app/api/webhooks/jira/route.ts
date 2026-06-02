/**
 * api/webhooks/jira/route.ts
 * --------------------------
 * Secure webhook endpoint that receives events from client's Jira instance.
 * This is the core "data translation layer" — it takes raw Jira payloads
 * and computes all the sprint metrics automatically.
 *
 * Security:
 * - Protected by x-webhook-secret header (shared secret with Jira)
 * - Uses Supabase Service Role key to bypass RLS (server-only)
 *
 * Handles two event types:
 * 1. jira:issue_updated — When any issue field changes
 * 2. sprint_closed — When a sprint is completed
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeWeekNumbers,
  computeBusinessDays,
  isPlannedInSprint,
  isAddedMidSprint,
  isCarryForward,
  detectReopened,
} from "@/lib/metrics";
import type { JiraChangelogItem } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Validate the webhook secret ──
    const webhookSecret = request.headers.get("x-webhook-secret");
    const projectId = request.nextUrl.searchParams.get("projectId");
    
    if (!projectId || !webhookSecret) {
      console.error("Webhook auth failed: missing projectId or secret");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { data: project } = await supabase
      .from("projects")
      .select("webhook_secret")
      .eq("id", projectId)
      .single();

    if (!project || project.webhook_secret !== webhookSecret) {
      console.error("Webhook auth failed: invalid secret for project");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── Step 2: Parse the incoming payload ──
    // Using 'any' here because Jira payloads are deeply nested and vary
    // across Jira versions. We extract what we need safely below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = await request.json();
    const eventType = payload.webhookEvent;

    console.log(`[Webhook] Received event: ${eventType}`);

    // ── Step 3: Route to the right handler ──
    if (eventType === "jira:issue_updated" && payload.issue) {
      return await handleIssueUpdated(payload, projectId);
    }

    if (eventType === "sprint_closed" && payload.sprint) {
      return await handleSprintClosed(payload, projectId);
    }

    // We don't handle other events — just acknowledge receipt
    return NextResponse.json({ status: "ignored", event: eventType });
  } catch (error) {
    console.error("[Webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// Handler: Issue Updated
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleIssueUpdated(payload: any, projectId: string) {
  const supabase = createAdminClient();
  const issue = payload.issue;
  const fields = issue.fields;

  // The webhook timestamp tells us when the event happened in Jira
  const webhookTimestamp = payload.timestamp
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();

  // ── Extract sprint info ──
  // Jira sends sprint data in different ways depending on the config:
  //   - fields.sprint (single object or array)
  //   - fields.customfield_xxxxx (board-specific custom field)
  // We handle both patterns safely.
  const rawSprint = fields.sprint;
  let activeSprint: Record<string, unknown> | null = null;

  if (Array.isArray(rawSprint) && rawSprint.length > 0) {
    // Array of sprints — take the last (most recent) one
    activeSprint = rawSprint[rawSprint.length - 1];
  } else if (rawSprint && typeof rawSprint === "object") {
    // Single sprint object
    activeSprint = rawSprint;
  }

  const sprintId = activeSprint ? String(activeSprint.id) : null;
  const sprintName = activeSprint ? String(activeSprint.name || "") : null;
  const sprintStartDate = activeSprint ? String(activeSprint.startDate || "") : null;
  const sprintEndDate = activeSprint ? String(activeSprint.endDate || "") : null;
  const sprintState = activeSprint ? String(activeSprint.state || "") : null;

  // ── Extract changelog items ──
  // Jira may send changelog at the top-level OR nested under issue.
  // Check both locations to be safe.
  const changelogItems: JiraChangelogItem[] =
    payload.changelog?.items ||
    issue.changelog?.items ||
    [];

  // ── Extract the current status ──
  // IMPORTANT: Jira sends fields.status as an OBJECT {id, name, ...}
  // not as a plain string. We need .name specifically.
  const statusField = fields.status;
  const currentStatus = (typeof statusField === "object" && statusField !== null)
    ? String(statusField.name || "To Do")
    : String(statusField || "To Do");

  // ── Find transition timestamps from changelog ──
  const inProgressAt = findTransitionTimestamp(changelogItems, "In Progress", webhookTimestamp);
  const doneAt = findTransitionTimestamp(changelogItems, "Done", webhookTimestamp) ||
    findTransitionTimestamp(changelogItems, "Resolved", webhookTimestamp) ||
    findTransitionTimestamp(changelogItems, "Verified", webhookTimestamp);

  // When was this issue added to the current sprint?
  const sprintBindingTimestamp = findSprintBindingTimestamp(changelogItems, webhookTimestamp) ||
    (fields.created ? String(fields.created) : null);

  // ── Compute all the derived metrics ──
  const weekNumbers = computeWeekNumbers(
    sprintStartDate,
    sprintEndDate,
    new Date().toISOString()
  );

  const plannedInSprint = isPlannedInSprint(sprintBindingTimestamp, sprintStartDate);
  const addedMidSprint = isAddedMidSprint(sprintBindingTimestamp, sprintStartDate);
  const carryForward = isCarryForward(sprintState, currentStatus);
  const leadTimeDays = computeBusinessDays(inProgressAt, doneAt);
  const reopened = detectReopened(changelogItems);

  // ── Extract assignees as a text array ──
  const assigneeField = fields.assignee;
  const assignees = (typeof assigneeField === "object" && assigneeField !== null)
    ? [String(assigneeField.displayName || assigneeField.name || "")]
    : [];

  // ── Extract other object-type fields safely ──
  const resolutionField = fields.resolution;
  const resolution = (typeof resolutionField === "object" && resolutionField !== null)
    ? String(resolutionField.name || "")
    : null;

  const priorityField = fields.priority;
  const priority = (typeof priorityField === "object" && priorityField !== null)
    ? String(priorityField.name || "Medium")
    : "Medium";

  const issueTypeField = fields.issuetype;
  const workType = (typeof issueTypeField === "object" && issueTypeField !== null)
    ? String(issueTypeField.name || "Story")
    : "Story";

  const reporterField = fields.reporter;
  const reporter = (typeof reporterField === "object" && reporterField !== null)
    ? String(reporterField.displayName || "")
    : "";

  // Story points can live in different custom fields depending on Jira config
  const storyPoints = Number(
    fields.story_points || fields.customfield_10028 || fields.customfield_10016 || 0
  );

  // ── Build the upsert payload ──
  const taskData = {
    project_id: projectId,
    jira_key: issue.key,
    summary: String(fields.summary || ""),
    description: String(fields.description || ""),
    status: currentStatus,
    resolution,
    priority,
    work_type: workType,
    story_points: storyPoints,
    labels: (fields.labels as string[]) || [],
    assignees,
    reporter,
    sprint_id: sprintId,
    sprint_name: sprintName,
    sprint_start_date: sprintStartDate || null,
    sprint_end_date: sprintEndDate || null,
    sprint_binding_timestamp: sprintBindingTimestamp,
    in_progress_at: inProgressAt,
    done_at: doneAt,
    issue_created_at: fields.created ? String(fields.created) : null,
    issue_updated_at: fields.updated ? String(fields.updated) : null,
    week_numbers: weekNumbers,
    planned_in_sprint: plannedInSprint,
    added_mid_sprint: addedMidSprint,
    carry_forward: carryForward,
    lead_time_days: leadTimeDays,
    reopened,
    changelog_json: changelogItems,
  };

  // ── Determine the owner ──
  // TODO: Implement a lookup table mapping Jira display names → Supabase user IDs.
  // For now, webhook data is assigned to the first admin user in the system.
  // Individual users can "Duplicate to My Sheet" to copy it to their own worksheet.
  const { data: adminUsers } = await supabase.auth.admin.listUsers();
  const firstAdmin = adminUsers?.users?.[0];

  if (!firstAdmin) {
    return NextResponse.json(
      { error: "No users found in system to assign task to" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("jira_tasks_snapshot")
    .upsert(
      { ...taskData, owner_id: firstAdmin.id },
      { onConflict: "owner_id,jira_key,sprint_id" }
    );

  if (error) {
    console.error("[Webhook] Upsert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Webhook] Upserted issue ${issue.key} successfully`);
  return NextResponse.json({ status: "ok", key: issue.key });
}

// ────────────────────────────────────────────────────────────
// Handler: Sprint Closed
// When a sprint closes, mark all non-finalized issues as carry_forward
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSprintClosed(payload: any, projectId: string) {
  const supabase = createAdminClient();
  const sprint = payload.sprint;
  const sprintId = String(sprint.id);

  console.log(`[Webhook] Sprint closed: ${sprint.name} (${sprintId})`);

  // Fetch all tasks in this sprint that are NOT in a finalized status
  const { data: openTasks, error: fetchError } = await supabase
    .from("jira_tasks_snapshot")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("sprint_id", sprintId)
    .not("status", "in", '("Done","Resolved","Verified","Closed")');

  if (fetchError) {
    console.error("[Webhook] Failed to fetch open tasks:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Mark them all as carry forward
  if (openTasks && openTasks.length > 0) {
    const taskIds = openTasks.map((t) => t.id);

    const { error: updateError } = await supabase
      .from("jira_tasks_snapshot")
      .update({ carry_forward: true })
      .in("id", taskIds);

    if (updateError) {
      console.error("[Webhook] Failed to update carry forward:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[Webhook] Marked ${taskIds.length} tasks as carry forward`);
  }

  return NextResponse.json({
    status: "ok",
    sprint: sprint.name,
    carry_forward_count: openTasks?.length || 0,
  });
}

// ────────────────────────────────────────────────────────────
// Helper: Find when a specific status transition happened
// Uses the webhook-level timestamp (payload.timestamp) as the
// event time, which is when Jira recorded the change.
// For even more precision, the full Jira REST changelog API
// provides per-history-item timestamps — but the webhook payload
// only gives us the top-level event timestamp.
// ────────────────────────────────────────────────────────────
function findTransitionTimestamp(
  changelog: JiraChangelogItem[],
  targetStatus: string,
  webhookTimestamp: string
): string | null {
  const transition = changelog.find(
    (item) => item.field === "status" && item.toString === targetStatus
  );
  // Return the webhook event timestamp (when Jira recorded the change)
  return transition ? webhookTimestamp : null;
}

// ────────────────────────────────────────────────────────────
// Helper: Find when an issue was added to a sprint
// ────────────────────────────────────────────────────────────
function findSprintBindingTimestamp(
  changelog: JiraChangelogItem[],
  webhookTimestamp: string
): string | null {
  const sprintChange = changelog.find((item) => item.field === "Sprint");
  return sprintChange ? webhookTimestamp : null;
}
