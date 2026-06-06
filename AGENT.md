# AGENT.md — Vortex PM Source of Truth

## 📑 Project Overview

**Vortex PM** is a multi-tenant Jira Sprint Metrics Dashboard built with **Next.js 16 (App Router, Turbopack)**, **Supabase (PostgreSQL + Auth)**, **shadcn/ui**, and **Recharts**. It ingests Jira webhook data, stores it against dynamically-defined project schemas, and provides sprint boards, QBR charts, and Excel exports. Deployed as a single Next.js app; Supabase handles DB, Auth, and RLS.

---

## 🗺️ High-Level Architecture & Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7 (App Router, RSC, Server Actions) |
| Language | TypeScript 5 |
| Database | Supabase PostgreSQL (RLS-enabled) |
| Auth | Supabase Auth (email/password, admin-created accounts) |
| UI | shadcn/ui (Radix + Tailwind CSS v4), Lucide icons |
| Charts | Recharts 3 |
| Export | SheetJS (xlsx) |
| Testing | Vitest 4 + Testing Library |
| Package Mgr | pnpm |

**Architecture:** Monolith — Next.js handles both the dashboard SPA and the API routes (webhooks, admin user management). Supabase client is used in three modes: `server` (RSC/Server Actions), `client` (browser), `admin` (Service Role for bypassing RLS).

**Multi-Tenant Hierarchy:** `Organization → Project → ProjectTask`. Each project has its own dynamic column schema (`column_definitions`) and tasks use a JSONB `custom_fields` column for flexible data storage.

**RLS Recursion Fix:** `org_members` policies use a `SECURITY DEFINER` function `get_user_orgs(uuid)` to avoid infinite recursion when querying cross-table membership.

---

## 📂 Critical Directory Mapping

```
E:\Projekts\vortex-pm\
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # Auth-gated dashboard route group
│   │   │   ├── layout.tsx         # Fetches active org/project/sprint, renders sidebar+header
│   │   │   ├── admin/page.tsx     # App Admin: create users, view team members
│   │   │   ├── board/page.tsx     # Sprint board (data table view)
│   │   │   ├── orgs/page.tsx      # Org listing + atomic create (org + admin)
│   │   │   ├── orgs/[orgId]/      # Org detail: projects list, danger zone
│   │   │   ├── qbr/page.tsx       # QBR charts (absorption, velocity)
│   │   │   ├── settings/page.tsx  # Metadata config + Table Schema (column builder)
│   │   │   └── change-password/   # Force password change on first login
│   │   ├── api/
│   │   │   ├── admin/users/route.ts   # Admin user CRUD (Service Role)
│   │   │   └── webhooks/jira/route.ts # Jira webhook ingestion (dynamic field mapping)
│   │   ├── auth/callback/route.ts     # Supabase auth callback
│   │   └── login/page.tsx             # Login page (email/password only)
│   ├── components/
│   │   ├── data-table/            # Dynamic data table (columns, toolbar, row-actions, cell-editor)
│   │   ├── charts/                # Recharts wrappers (absorption, velocity, chart-card)
│   │   ├── column-builder.tsx     # Dynamic schema builder for project columns
│   │   ├── comments-dialog.tsx    # Task comments modal
│   │   ├── sidebar.tsx            # Navigation sidebar
│   │   ├── header.tsx             # Top header with sprint/project selectors
│   │   └── ui/                    # shadcn/ui primitives (dialog, button, input, etc.)
│   ├── lib/
│   │   ├── actions/               # Server Actions (CRUD for each domain)
│   │   │   ├── organizations.ts   # createOrganizationWithAdmin, deleteOrganizationCascading
│   │   │   ├── projects.ts        # CRUD for projects within an org
│   │   │   ├── tasks.ts           # fetchTasks, updateTask, duplicateTask, deleteTask
│   │   │   ├── column-definitions.ts # Dynamic column schema CRUD
│   │   │   ├── comments.ts        # Task comments CRUD
│   │   │   ├── metadata.ts        # Work type/priority/status config
│   │   │   ├── lifecycle.ts       # checkIsOrgAdmin, checkIsGlobalAdmin, archiving pipeline
│   │   │   └── auth.ts            # Username availability check
│   │   ├── supabase/              # Supabase client factories (server, client, admin, middleware)
│   │   ├── types.ts               # All TypeScript interfaces (mirrors DB schema)
│   │   ├── metrics.ts             # Sprint metric computations (week numbers, carry-forward, etc.)
│   │   ├── demo-mode.ts           # Mock data for sandbox demo mode
│   │   ├── excel-export.ts        # XLSX export with auto-column widths
│   │   └── utils.ts               # cn() helper
│   └── middleware.ts              # Auth guard: redirects unauthenticated users to /login
├── supabase_migration.sql         # V1: Base schema (tasks, metadata, profiles, comments)
├── supabase_migration_v2.sql      # V2: Username auth, profiles
├── supabase_migration_v3.sql      # V3: Multi-tenant (organizations, org_members, projects)
├── supabase_migration_v4.sql      # V4: Profiles RLS, removal requests
└── package.json                   # pnpm workspace, Next.js 16, Supabase, Recharts, xlsx
```

---

## 🔑 Key Roles & Auth Model

| Role | Scope | Capabilities |
|---|---|---|
| **Owner** | Global (`user_metadata.role = 'owner'`) | Manage platform organizations, read-only org access for support, demo sandbox |
| **Org Admin** | Per-org (`org_members.role = 'admin'`) | Manage organization projects, team members, define table schema |
| **Team Member** | Per-org (`org_members.role = 'member'`) | View sprint boards, add comments, export data |

- All users created by admins with temp password + `must_change_password: true`.
- First login forces password change via `/change-password`.

---

## 🗄️ Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `organizations` | Multi-tenant root entity |
| `org_members` | User ↔ Org membership + role |
| `projects` | Org's projects with `field_mappings` JSONB for webhook mapping |
| `project_tasks` | Task rows with `custom_fields` JSONB for dynamic data |
| `column_definitions` | Per-project dynamic column schema (type, options, display order) |
| `task_comments` | Comments on tasks |
| `project_metadata` | Config items (work types, priorities, statuses) |
| `profiles` | Extended user profiles linked to auth.users |

---

## 🔄 Current State & Recent Changes

1. **Atomic Org Creation (Jun 4):** `createOrganizationWithAdmin` — creates org + admin user + profile + org_member in one action with full rollback compensation on any step failure. Returns temp credentials.
2. **Cascading Org Deletion (Jun 4):** `deleteOrganizationCascading` — deletes org (cascades to projects/tasks via FK), then deletes the Org Admin's user account (unless they are a global Owner). Custom Dialog confirmation UI.
3. **Instant Project Management (Jun 4):** Org Admins can delete projects instantly via Dialog confirmation (no approval workflow). Delete org button disabled if `projects.length > 0`.
4. **RLS Recursion Fix (Jun 3):** Created `get_user_orgs(uuid)` SECURITY DEFINER function to break infinite recursion in `org_members` SELECT policies. Org creation uses `adminClient` to bypass RLS during setup.
5. **Dynamic Table Schema (Jun 3):** Migrated from hardcoded `jira_tasks_snapshot` to `project_tasks` + `column_definitions` + `custom_fields` JSONB. Column Builder UI in settings. Webhook route dynamically maps fields via `projects.field_mappings`.
6. **User Role Model Refactoring (Jun 6):** Resolved admin role conflict by separating `Application Admin` into `Owner` (global platform level) and standardizing `Organization Admin` (per-org). Owners have read-only visibility into all projects for support, and do not inherit modification rights over org resources. Updated RLS policies in `supabase_migration_v5.sql`.
7. **Phase 2: Vortex Transformation (Jun 6):**
   - **Rebranding:** Renamed application to Vortex PM ("Plan. Track. Deliver.").
   - **Reporting Module:** Added multi-sprint selectors and client-side Excel export via `xlsx` sheet.js.
   - **Dynamic Metadata:** Expanded `column_definitions` with `is_reportable` and `validation_rules`. Source of truth is now fully dynamic.
   - **Sprint Table Modernization:** Refactored Data Table for server-side pagination, sorting, and dynamic dropdown filtering. Implemented row selection with Bulk Actions, and column visibility/ordering saved to `localStorage`.

---

## 📌 Active Focus & Next Steps

- **Action Testing:** Validate edit/delete/duplicate operations on mock and live data for stability (NOT STARTED).
- **Security & Webhook Robustness:** Implement security testing for Jira webhooks/API routes (NOT STARTED).
