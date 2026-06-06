-- ============================================================
-- Vortex PM — Migration V6: Phase 3 (Role-Based Experience)
-- ============================================================
-- Adds:
--   1. projects.status column (draft/active/archived) for wizard gating
--   2. profiles.temp_password_changed for credential tracking
--   3. organizations.subscription_plan for owner dashboard display
--   4. Draft project auto-cleanup (projects older than 7 days in draft)
-- ============================================================

-- 1. Project status for wizard gating
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('draft', 'active', 'archived'));

-- Backfill: all existing projects are active
UPDATE projects SET status = 'active' WHERE status IS NULL;

-- 2. Credential tracking on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS temp_password_changed boolean NOT NULL DEFAULT false;

-- Backfill: If a user has logged in and their must_change_password is false,
-- mark their temp_password_changed as true
UPDATE profiles p
SET temp_password_changed = true
WHERE EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.id = p.id
    AND (u.raw_user_meta_data->>'must_change_password')::boolean IS DISTINCT FROM true
);

-- 3. Subscription plan on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free';

-- 4. Wizard step tracking on projects (which steps are complete)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS wizard_step integer NOT NULL DEFAULT 0;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS wizard_completed_at timestamptz;

-- 5. Index for finding draft projects to auto-cleanup
CREATE INDEX IF NOT EXISTS idx_projects_draft_cleanup
  ON projects (status, created_at)
  WHERE status = 'draft';

-- 6. Function to auto-delete draft projects older than 7 days
-- Can be called by a cron job or pg_cron
CREATE OR REPLACE FUNCTION cleanup_draft_projects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM projects
  WHERE status = 'draft'
    AND created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 7. RLS: Members cannot see draft projects (only admin/owner)
CREATE OR REPLACE FUNCTION can_view_project(project_row projects)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  viewer_role text;
  viewer_org_role text;
BEGIN
  -- Get global role
  SELECT raw_user_meta_data->>'role' INTO viewer_role
  FROM auth.users WHERE id = auth.uid();
  
  -- Owners can see everything
  IF viewer_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Active projects visible to all org members
  IF project_row.status = 'active' THEN
    RETURN EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = project_row.org_id
        AND user_id = auth.uid()
    );
  END IF;
  
  -- Draft/archived projects only visible to org admins
  SELECT role INTO viewer_org_role
  FROM org_members
  WHERE org_id = project_row.org_id
    AND user_id = auth.uid();
  
  RETURN viewer_org_role = 'admin';
END;
$$;
