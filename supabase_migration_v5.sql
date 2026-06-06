-- ============================================================================
-- JIRA SPRINT METRICS DASHBOARD — MIGRATION V5 (USER ROLE MODEL REFACTORING)
-- ============================================================================
-- Resolves the admin role conflict by separating Platform Owner from Org Admin.
--
-- 1. Updates existing global 'admin' users to 'owner'.
-- 2. Updates existing org_members with 'owner' role to 'admin'.
-- 3. Updates RLS policies to use 'owner' instead of 'admin' and 
--    grants Owners read-only access to organizations and projects for support.
-- ============================================================================

-- 1. Migrate existing users with metadata role 'admin' to 'owner'
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"owner"'
)
WHERE raw_user_meta_data->>'role' = 'admin';

-- 2. Update existing org_members where role is 'owner' to 'admin'
-- (Since Owner is now exclusively for global platform owners)
UPDATE public.org_members
SET role = 'admin'
WHERE role = 'owner';

-- 3. Update RLS policies for organizations
DROP POLICY IF EXISTS "System admins can modify orgs" ON public.organizations;
CREATE POLICY "Owners can modify orgs"
  ON public.organizations FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- Grant Owners read-only visibility to all organizations (if not already covered by ALL)
CREATE POLICY "Owners can view all orgs"
  ON public.organizations FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- 4. Update RLS policies for org_members
DROP POLICY IF EXISTS "System admins can modify org members" ON public.org_members;
CREATE POLICY "Owners can modify org members"
  ON public.org_members FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- 5. Update RLS policies for projects
DROP POLICY IF EXISTS "System admins can modify projects" ON public.projects;

-- Owners have read-only visibility into organization projects for support/troubleshooting
CREATE POLICY "Owners can view all projects"
  ON public.projects FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- Org admins can modify their organization's projects
CREATE POLICY "Org admins can modify projects"
  ON public.projects FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = projects.org_id AND user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = projects.org_id AND user_id = auth.uid() AND role = 'admin')
  );

-- 6. Update RLS policies for profiles
DROP POLICY IF EXISTS "System admins can modify profiles" ON public.profiles;
CREATE POLICY "Owners can modify profiles"
  ON public.profiles FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- Owners can read all profiles for support
CREATE POLICY "Owners can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- 7. Update RLS policies for removal_requests
DROP POLICY IF EXISTS "System admins can manage all requests" ON public.removal_requests;
CREATE POLICY "Owners can manage all requests"
  ON public.removal_requests FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- 8. (Optional) If there are other tables like project_tasks, owners will also need read-only policies.
-- Assuming project_tasks has RLS enabled:
-- CREATE POLICY "Owners can view all project tasks" ON public.project_tasks FOR SELECT TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');
