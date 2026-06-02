-- ============================================================================
-- JIRA SPRINT METRICS DASHBOARD — MIGRATION V2 (SETTINGS & RBAC)
-- ============================================================================
-- Adds dynamic metadata management (work types, priorities, statuses)
-- and prepares for the moderator role.
-- ============================================================================

-- 1. Create project_metadata table
CREATE TABLE IF NOT EXISTS public.project_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('work_type', 'priority', 'status')),
  label TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  color TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate labels within the same category
  UNIQUE(category, label)
);

-- 2. Enable RLS
ALTER TABLE public.project_metadata ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone logged in can read metadata
CREATE POLICY "Authenticated users can read metadata"
  ON public.project_metadata
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and moderators can modify metadata
-- (We check the user_metadata JSONB in the auth.users table via an auth() function if available,
-- but standard Supabase practice is to use the JWT `auth.jwt() -> 'user_metadata' ->> 'role'`)
CREATE POLICY "Admins and moderators can modify metadata"
  ON public.project_metadata
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'moderator')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'moderator')
  );

-- 4. Seed default data (matching the hardcoded values previously used)
INSERT INTO public.project_metadata (category, label, display_order) VALUES
  ('work_type', 'Story', 10),
  ('work_type', 'Bug', 20),
  ('work_type', 'Task', 30),
  ('work_type', 'Sub-task', 40),
  ('work_type', 'Epic', 50),
  
  ('priority', 'Highest', 10),
  ('priority', 'High', 20),
  ('priority', 'Medium', 30),
  ('priority', 'Low', 40),
  ('priority', 'Lowest', 50),
  
  ('status', 'To Do', 10),
  ('status', 'In Progress', 20),
  ('status', 'In Review', 30),
  ('status', 'Done', 40),
  ('status', 'Resolved', 50),
  ('status', 'Blocked', 60),
  ('status', 'Closed', 70)
ON CONFLICT DO NOTHING;
