/**
 * types.ts
 * --------
 * All TypeScript interfaces for the project live here.
 * These types mirror the Supabase PostgreSQL tables exactly.
 * When you add a new column to the DB, update these types too.
 */

// ─── Main task row from jira_tasks_snapshot table ───
export interface JiraTask {
  id: string;
  owner_id: string;

  // Jira core fields
  jira_key: string;
  summary: string;
  description: string;
  status: string;
  resolution: string | null;
  priority: string;
  work_type: string;
  story_points: number;
  labels: string[];
  assignees: string[];
  reporter: string;

  // Sprint context
  sprint_id: string | null;
  sprint_name: string | null;
  sprint_start_date: string | null;
  sprint_end_date: string | null;
  sprint_binding_timestamp: string | null;

  // Multi-tenant context
  project_id?: string | null;

  // Transition timestamps (set by webhook)
  in_progress_at: string | null;
  done_at: string | null;
  issue_created_at: string | null;
  issue_updated_at: string | null;

  // Computed metric columns (set by webhook engine)
  week_numbers: number[];
  planned_in_sprint: boolean;
  added_mid_sprint: boolean;
  carry_forward: boolean;
  lead_time_days: number | null;
  reopened: boolean;

  // Raw Jira changelog for audit trail
  changelog_json: Record<string, unknown>[];

  // Housekeeping
  created_at: string;
  updated_at: string;
}

// ─── Comment on a task row ───
export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

// ─── User profile info (from Supabase auth.users + metadata) ───
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "moderator" | "member";
  must_change_password: boolean;
}

// ─── Dynamic Metadata (Settings) ───
export interface MetadataItem {
  id: string;
  category: "work_type" | "priority" | "status";
  label: string;
  display_order: number;
  color: string | null;
  is_active: boolean;
  project_id?: string | null;
  created_at: string;
}

// ─── Multi-Tenant Hierarchy (Orgs & Projects) ───
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  status: "active" | "paused";
  created_by: string;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "moderator" | "member";
  joined_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  jira_project_key: string;
  webhook_secret: string | null;
  status: "active" | "archived";
  created_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  email: string;
  org_id: string | null;
  role: string;
  created_at: string;
}

export interface RemovalRequest {
  id: string;
  org_id: string;
  requested_by: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

// ─── Filters for the data table ───
export interface TaskFilters {
  sprint_id?: string | null;
  project_id?: string | null;
  work_type?: string | null;
  priority?: string | null;
  status?: string | null;
  owner_id?: string | null;
  search?: string;
}

// ─── Sprint info for the dropdown selector ───
export interface SprintOption {
  sprint_id: string;
  sprint_name: string;
  sprint_start_date: string | null;
  sprint_end_date: string | null;
}

// ─── Chart data shapes for QBR reports ───
export interface AbsorptionDataPoint {
  sprint_name: string;
  planned_count: number;
  adhoc_count: number;
  planned_points: number;
  adhoc_points: number;
}

export interface VelocityDataPoint {
  month: string;
  completed_points: number;
  completed_count: number;
}

// ─── Webhook payload types (from Jira) ───
export interface JiraWebhookPayload {
  webhookEvent: string;
  issue?: {
    key: string;
    fields: Record<string, unknown>;
    changelog?: {
      items: JiraChangelogItem[];
    };
  };
  sprint?: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    state: string;
  };
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}
