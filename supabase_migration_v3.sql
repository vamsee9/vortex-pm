-- ============================================================================
-- JIRA SPRINT METRICS DASHBOARD — MIGRATION V3 (MULTI-TENANT HIERARCHY)
-- ============================================================================
-- Introduces Organizations and Projects.
-- Upgrades the data model from Single-Tenant to Multi-Tenant.
-- Existing data is preserved via ADD COLUMN.
-- ============================================================================

-- 1. Create Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Organization Members table
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- 3. Create Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  jira_project_key TEXT NOT NULL,
  webhook_secret TEXT DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, slug),
  UNIQUE(org_id, jira_project_key)
);

-- 4. Alter existing tables to become project-aware
ALTER TABLE public.jira_tasks_snapshot
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_metadata
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.jira_tasks_snapshot(project_id);
CREATE INDEX IF NOT EXISTS idx_metadata_project ON public.project_metadata(project_id);

-- 5. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- organizations: members can select their own orgs
CREATE POLICY "Users can view orgs they belong to"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = id AND user_id = auth.uid())
  );

-- organizations: only system admins (or owner role) can update/delete
CREATE POLICY "System admins can modify orgs"
  ON public.organizations FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- org_members: members can view members of their orgs
CREATE POLICY "Users can view members of their orgs"
  ON public.org_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members AS om WHERE om.org_id = org_id AND om.user_id = auth.uid())
  );

-- org_members: system admins can modify
CREATE POLICY "System admins can modify org members"
  ON public.org_members FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- projects: members of the parent org can view projects
CREATE POLICY "Org members can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = projects.org_id AND user_id = auth.uid())
  );

-- projects: system admins can modify
CREATE POLICY "System admins can modify projects"
  ON public.projects FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
