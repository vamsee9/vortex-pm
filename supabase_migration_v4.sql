-- ============================================================================
-- JIRA SPRINT METRICS DASHBOARD — MIGRATION V4 (LIFECYCLE & RBAC)
-- ============================================================================
-- Introduces profiles (username mapping), statuses, and removal requests.
-- ============================================================================

-- 1. Add Status Columns to existing tables
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused'));

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

-- 2. Create Profiles table (for Username Auth & RBAC)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We make username globally unique to simplify the login flow (user only enters username, we look up the rest).

-- 3. Create Removal Requests table
CREATE TABLE IF NOT EXISTS public.removal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Org members can read profiles of their org"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = profiles.org_id AND user_id = auth.uid())
  );

CREATE POLICY "System admins can modify profiles"
  ON public.profiles FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 5. RLS for Removal Requests
ALTER TABLE public.removal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view their orgs requests"
  ON public.removal_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = removal_requests.org_id AND user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Org admins can insert requests"
  ON public.removal_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members WHERE org_id = removal_requests.org_id AND user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System admins can manage all requests"
  ON public.removal_requests FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
