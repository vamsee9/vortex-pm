"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const MOCK_ORG_ID = "demo-org-123";
const MOCK_PROJECT_ID = "demo-proj-123";

declare global {
  var _demoData: any;
}

function getDemoData() {
  if (!globalThis._demoData) {
    globalThis._demoData = {
      organizations: [{ id: MOCK_ORG_ID, name: "Acme Corp (Demo)", slug: "acme-demo", status: "active" }],
      projects: [{ id: MOCK_PROJECT_ID, org_id: MOCK_ORG_ID, name: "Mobile App (Demo)", jira_project_key: "MOB", status: "active" }],
      sprints: [{ sprint_id: "sprint-1", project_id: MOCK_PROJECT_ID, sprint_name: "Sprint 1", state: "active" }],
      tasks: [
        { 
          id: "task-1", 
          project_id: MOCK_PROJECT_ID, 
          jira_key: "MOB-1", 
          sprint_id: "sprint-1", 
          custom_fields: {
            summary: "Design Login Screen", 
            status: "Done", 
            priority: "High", 
            work_type: "Story", 
            story_points: 5, 
            assignees: ["Alice"]
          } 
        },
        { 
          id: "task-2", 
          project_id: MOCK_PROJECT_ID, 
          jira_key: "MOB-2", 
          sprint_id: "sprint-1",
          custom_fields: {
            summary: "Setup API Gateway", 
            status: "In Progress", 
            priority: "Highest", 
            work_type: "Task", 
            story_points: 8, 
            assignees: ["Bob"]
          }
        }
      ],
      metadata: [
        { id: "m1", project_id: MOCK_PROJECT_ID, category: "status", label: "To Do", display_order: 1 },
        { id: "m2", project_id: MOCK_PROJECT_ID, category: "status", label: "In Progress", display_order: 2 },
        { id: "m3", project_id: MOCK_PROJECT_ID, category: "status", label: "Done", display_order: 3 }
      ],
      columns: [
        { id: "c1", project_id: MOCK_PROJECT_ID, key: "summary", label: "Summary", data_type: "text", is_editable: true, is_visible: true, display_order: 1, width_px: 250 },
        { id: "c2", project_id: MOCK_PROJECT_ID, key: "status", label: "Status", data_type: "select", is_editable: true, is_visible: true, display_order: 2, width_px: 120, options: [{ value: "To Do", label: "To Do", color: "#6b7280" }, { value: "In Progress", label: "In Progress", color: "#3b82f6" }, { value: "Done", label: "Done", color: "#10b981" }] },
        { id: "c3", project_id: MOCK_PROJECT_ID, key: "priority", label: "Priority", data_type: "select", is_editable: true, is_visible: true, display_order: 3, width_px: 100, options: [{ value: "High", label: "High", color: "#ef4444" }] }
      ]
    };
  }
  return globalThis._demoData;
}

export async function isDemoModeActive() {
  const cookieStore = await cookies();
  return cookieStore.has("preview_mode");
}

export async function getPreviewRole() {
  const cookieStore = await cookies();
  return cookieStore.get("preview_mode")?.value;
}

export async function enableDemoMode(role: "admin" | "member") {
  const cookieStore = await cookies();
  cookieStore.set("preview_mode", role, { path: "/" });
  cookieStore.set("active_project_id", MOCK_PROJECT_ID, { path: "/" });
  revalidatePath("/");
}

export async function disableDemoMode() {
  const cookieStore = await cookies();
  cookieStore.delete("preview_mode");
  cookieStore.delete("active_project_id");
  revalidatePath("/");
}

// --------------------------------------------------------
// Mock Interceptors
// --------------------------------------------------------

export function getMockOrganizations() {
  return getDemoData().organizations;
}

export function getMockProjects(orgId?: string) {
  return getDemoData().projects.filter((p: any) => !orgId || p.org_id === orgId);
}

export function getMockProject(id: string) {
  return getDemoData().projects.find((p: any) => p.id === id);
}

export function getMockSprints(projectId?: string) {
  return getDemoData().sprints.filter((s: any) => !projectId || s.project_id === projectId);
}

export function getMockTasks(projectId?: string | null, sprintId?: string | null) {
  let tasks = getDemoData().tasks;
  if (projectId) tasks = tasks.filter((t: any) => t.project_id === projectId);
  if (sprintId === "all") return tasks;
  if (sprintId) tasks = tasks.filter((t: any) => t.sprint_id === sprintId);
  return tasks;
}

export function addDemoTask(task: any) {
  const data = getDemoData();
  data.tasks.unshift(task);
}

export function updateMockTask(taskId: string, updates: any) {
  const data = getDemoData();
  const idx = data.tasks.findIndex((t: any) => t.id === taskId);
  if (idx > -1) {
    data.tasks[idx] = { ...data.tasks[idx], ...updates };
  }
  return data.tasks[idx];
}

export function deleteMockTask(taskId: string) {
  const data = getDemoData();
  data.tasks = data.tasks.filter((t: any) => t.id !== taskId);
}

export function getMockMetadata(projectId: string, category?: string) {
  let meta = getDemoData().metadata.filter((m: any) => m.project_id === projectId);
  if (category) meta = meta.filter((m: any) => m.category === category);
  return meta;
}

export function getMockColumnDefinitions(projectId: string) {
  return getDemoData().columns.filter((c: any) => c.project_id === projectId);
}
