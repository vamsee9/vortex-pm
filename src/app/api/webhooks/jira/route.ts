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
    const webhookSecret = request.headers.get("x-webhook-secret");
    const projectId = request.nextUrl.searchParams.get("projectId");
    
    if (!projectId || !webhookSecret) {
      console.error("Webhook auth failed: missing projectId or secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: project } = await supabase
      .from("projects")
      .select("webhook_secret, field_mappings")
      .eq("id", projectId)
      .single();

    if (!project || project.webhook_secret !== webhookSecret) {
      console.error("Webhook auth failed: invalid secret for project");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: any = await request.json();
    const eventType = payload.webhookEvent;

    console.log(`[Webhook] Received event: ${eventType}`);

    if (eventType === "jira:issue_updated" && payload.issue) {
      return await handleIssueUpdated(payload, projectId, project.field_mappings || {});
    }

    if (eventType === "sprint_closed" && payload.sprint) {
      return await handleSprintClosed(payload, projectId);
    }

    return NextResponse.json({ status: "ignored", event: eventType });
  } catch (error) {
    console.error("[Webhook] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper to resolve nested json paths
function resolvePath(obj: any, path: string) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

// Helper to extract value considering Jira's object structure
function extractJiraValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map(v => extractJiraValue(v));
  }
  if (typeof val === "object") {
    // Jira often wraps values in objects with name, value, or displayName
    if (val.displayName) return val.displayName;
    if (val.name) return val.name;
    if (val.value) return val.value;
  }
  return val;
}

async function handleIssueUpdated(payload: any, projectId: string, fieldMappings: Record<string, string>) {
  const supabase = createAdminClient();
  const issue = payload.issue;
  const fields = issue.fields;

  const webhookTimestamp = payload.timestamp
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();

  // ── Extract sprint info (Core System Fields) ──
  const rawSprint = fields.sprint || resolvePath(payload, fieldMappings['sprint'] || 'issue.fields.sprint');
  let activeSprint: Record<string, unknown> | null = null;

  if (Array.isArray(rawSprint) && rawSprint.length > 0) {
    activeSprint = rawSprint[rawSprint.length - 1];
  } else if (rawSprint && typeof rawSprint === "object") {
    activeSprint = rawSprint;
  }

  const sprintId = activeSprint ? String(activeSprint.id) : null;
  const sprintName = activeSprint ? String(activeSprint.name || "") : null;
  const sprintStartDate = activeSprint ? String(activeSprint.startDate || "") : null;
  const sprintEndDate = activeSprint ? String(activeSprint.endDate || "") : null;
  const sprintState = activeSprint ? String(activeSprint.state || "") : null;

  // ── Extract changelog ──
  const changelogItems: JiraChangelogItem[] =
    payload.changelog?.items || issue.changelog?.items || [];

  // ── Map Custom Fields Dynamically ──
  const customFields: Record<string, any> = {};

  // For every mapping defined by the project admin, resolve the path from the payload
  for (const [colKey, payloadPath] of Object.entries(fieldMappings)) {
    const rawVal = resolvePath(payload, payloadPath);
    customFields[colKey] = extractJiraValue(rawVal);
  }

  // Fallbacks for core Jira fields if they aren't explicitly mapped
  if (!customFields.summary) customFields.summary = extractJiraValue(fields.summary) || "";
  if (!customFields.status) customFields.status = extractJiraValue(fields.status) || "To Do";
  if (!customFields.priority) customFields.priority = extractJiraValue(fields.priority) || "Medium";
  if (!customFields.work_type) customFields.work_type = extractJiraValue(fields.issuetype) || "Story";
  if (customFields.story_points === undefined) {
    customFields.story_points = Number(fields.story_points || fields.customfield_10028 || fields.customfield_10016 || 0);
  }
  if (!customFields.assignees) {
    const assigneeField = fields.assignee;
    customFields.assignees = (typeof assigneeField === "object" && assigneeField !== null)
      ? [String(assigneeField.displayName || assigneeField.name || "")]
      : [];
  }

  // ── Compute Metrics ──
  const inProgressAt = findTransitionTimestamp(changelogItems, "In Progress", webhookTimestamp);
  const doneAt = findTransitionTimestamp(changelogItems, "Done", webhookTimestamp) ||
    findTransitionTimestamp(changelogItems, "Resolved", webhookTimestamp) ||
    findTransitionTimestamp(changelogItems, "Verified", webhookTimestamp);

  const sprintBindingTimestamp = findSprintBindingTimestamp(changelogItems, webhookTimestamp) ||
    (fields.created ? String(fields.created) : null);

  customFields.planned_in_sprint = isPlannedInSprint(sprintBindingTimestamp, sprintStartDate);
  customFields.added_mid_sprint = isAddedMidSprint(sprintBindingTimestamp, sprintStartDate);
  customFields.carry_forward = isCarryForward(sprintState, customFields.status);
  customFields.lead_time_days = computeBusinessDays(inProgressAt, doneAt);
  customFields.reopened = detectReopened(changelogItems);

  // ── Build the upsert payload ──
  const taskData = {
    project_id: projectId,
    jira_key: issue.key,
    sprint_id: sprintId,
    sprint_name: sprintName,
    sprint_start_date: sprintStartDate || null,
    sprint_end_date: sprintEndDate || null,
    custom_fields: customFields,
    changelog_json: changelogItems,
  };

  const { data: adminUsers } = await supabase.auth.admin.listUsers();
  const firstAdmin = adminUsers?.users?.[0];

  if (!firstAdmin) {
    return NextResponse.json({ error: "No users found in system" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_tasks")
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

async function handleSprintClosed(payload: any, projectId: string) {
  const supabase = createAdminClient();
  const sprint = payload.sprint;
  const sprintId = String(sprint.id);

  console.log(`[Webhook] Sprint closed: ${sprint.name} (${sprintId})`);

  // We need to use JSONB operators to find open tasks
  const { data: openTasks, error: fetchError } = await supabase
    .from("project_tasks")
    .select("id, custom_fields")
    .eq("project_id", projectId)
    .eq("sprint_id", sprintId)
    // Basic filter: not Done, Resolved, etc. We could do this in code if PostgREST JSONB filtering is tricky for 'not in'
    ;

  if (fetchError) {
    console.error("[Webhook] Failed to fetch open tasks:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const finalizedStatuses = ["Done", "Resolved", "Verified", "Closed"];
  const tasksToUpdate = openTasks?.filter(t => !finalizedStatuses.includes(t.custom_fields?.status)) || [];

  if (tasksToUpdate.length > 0) {
    for (const task of tasksToUpdate) {
      const newCustomFields = { ...task.custom_fields, carry_forward: true };
      await supabase
        .from("project_tasks")
        .update({ custom_fields: newCustomFields })
        .eq("id", task.id);
    }
    console.log(`[Webhook] Marked ${tasksToUpdate.length} tasks as carry forward`);
  }

  return NextResponse.json({
    status: "ok",
    sprint: sprint.name,
    carry_forward_count: tasksToUpdate.length,
  });
}

function findTransitionTimestamp(changelog: JiraChangelogItem[], targetStatus: string, webhookTimestamp: string): string | null {
  const transition = changelog.find(item => item.field === "status" && item.toString === targetStatus);
  return transition ? webhookTimestamp : null;
}

function findSprintBindingTimestamp(changelog: JiraChangelogItem[], webhookTimestamp: string): string | null {
  const sprintChange = changelog.find((item) => item.field === "Sprint");
  return sprintChange ? webhookTimestamp : null;
}
