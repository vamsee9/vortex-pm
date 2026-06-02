-- ============================================================================
-- JIRA SPRINT METRICS DASHBOARD — SUPABASE MIGRATION
-- ============================================================================
-- Run this in the Supabase SQL Editor or via `supabase db push`.
-- Prerequisites: Supabase project with Auth enabled.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. HELPER FUNCTION — Business-Day Lead Time Calculator
--    Counts weekdays (Mon–Fri) between two timestamps, excluding weekends.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_business_days(
  start_date TIMESTAMPTZ,
  end_date   TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  total_days   INTEGER := 0;
  current_date DATE   := start_date::DATE;
  end_d        DATE   := end_date::DATE;
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF end_d < current_date THEN
    RETURN 0;
  END IF;

  WHILE current_date <= end_d LOOP
    -- ISODOW: Mon=1 … Sun=7; weekdays are 1–5
    IF EXTRACT(ISODOW FROM current_date) <= 5 THEN
      total_days := total_days + 1;
    END IF;
    current_date := current_date + INTERVAL '1 day';
  END LOOP;

  RETURN total_days;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. MASTER TABLE — jira_tasks_snapshot
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jira_tasks_snapshot (
  -- Identity
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Jira Core Fields
  jira_key                TEXT NOT NULL,            -- e.g. "PROJ-123"
  summary                 TEXT NOT NULL DEFAULT '',
  description             TEXT DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'To Do',
  resolution              TEXT DEFAULT NULL,
  priority                TEXT DEFAULT 'Major',
  work_type               TEXT DEFAULT 'Story',     -- Story | Bug | Task | Sub-task | Epic
  story_points            NUMERIC(5,1) DEFAULT 0,
  labels                  TEXT[] DEFAULT '{}',
  assignees               TEXT[] DEFAULT '{}',       -- Descriptive text array per spec
  reporter                TEXT DEFAULT '',

  -- Sprint Context
  sprint_id               TEXT DEFAULT NULL,
  sprint_name             TEXT DEFAULT NULL,
  sprint_start_date       TIMESTAMPTZ DEFAULT NULL,
  sprint_end_date         TIMESTAMPTZ DEFAULT NULL,
  sprint_binding_timestamp TIMESTAMPTZ DEFAULT NULL, -- When issue was added to sprint

  -- Transition Timestamps (populated by webhook)
  in_progress_at          TIMESTAMPTZ DEFAULT NULL,
  done_at                 TIMESTAMPTZ DEFAULT NULL,
  issue_created_at        TIMESTAMPTZ DEFAULT NULL,
  issue_updated_at        TIMESTAMPTZ DEFAULT NULL,

  -- ── Computed Metric Columns ──
  -- These are written by the webhook ingestion engine, NOT by client code.

  week_numbers            INT[] DEFAULT '{}',        -- Dynamic week indices within sprint
  planned_in_sprint       BOOLEAN DEFAULT FALSE,     -- Present at sprint kickoff
  added_mid_sprint        BOOLEAN DEFAULT FALSE,     -- Injected after sprint start
  carry_forward           BOOLEAN DEFAULT FALSE,     -- Sprint closed, issue not finalized
  lead_time_days          INTEGER DEFAULT NULL,      -- Business days: In Progress → Done
  reopened                BOOLEAN DEFAULT FALSE,     -- Reverted from Done/Resolved/Verified

  -- Raw changelog for audit / recomputation
  changelog_json          JSONB DEFAULT '[]'::JSONB,

  -- Housekeeping
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one snapshot per Jira key per owner per sprint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jira_tasks_unique_key
  ON public.jira_tasks_snapshot (owner_id, jira_key, sprint_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. COMMENTS TABLE — task_comments
--    Any authenticated team member can append notes to any task row.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES public.jira_tasks_snapshot(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES — Query Performance
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_owner       ON public.jira_tasks_snapshot (owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint      ON public.jira_tasks_snapshot (sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_jira_key    ON public.jira_tasks_snapshot (jira_key);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.jira_tasks_snapshot (status);
CREATE INDEX IF NOT EXISTS idx_tasks_work_type   ON public.jira_tasks_snapshot (work_type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority    ON public.jira_tasks_snapshot (priority);
CREATE INDEX IF NOT EXISTS idx_comments_task     ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_comments_author   ON public.task_comments (author_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. AUTO-UPDATE TRIGGER — updated_at
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.jira_tasks_snapshot;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.jira_tasks_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 6. ROW-LEVEL SECURITY — jira_tasks_snapshot
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.jira_tasks_snapshot ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (Supabase service role bypasses via service key)
ALTER TABLE public.jira_tasks_snapshot FORCE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read ALL rows (cross-team visibility)
CREATE POLICY "tasks_select_authenticated"
  ON public.jira_tasks_snapshot
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can only insert rows they own
CREATE POLICY "tasks_insert_own"
  ON public.jira_tasks_snapshot
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Users can only modify rows they own
CREATE POLICY "tasks_update_own"
  ON public.jira_tasks_snapshot
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: Users can only delete their own rows
CREATE POLICY "tasks_delete_own"
  ON public.jira_tasks_snapshot
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. ROW-LEVEL SECURITY — task_comments
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments FORCE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read all comments
CREATE POLICY "comments_select_authenticated"
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can comment on any task
CREATE POLICY "comments_insert_authenticated"
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- UPDATE: Users can only edit their own comments
CREATE POLICY "comments_update_own"
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- DELETE: Users can only delete their own comments
CREATE POLICY "comments_delete_own"
  ON public.task_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. GRANT PERMISSIONS — Expose to Supabase API roles
-- ────────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.jira_tasks_snapshot TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.jira_tasks_snapshot TO authenticated;
GRANT ALL ON public.jira_tasks_snapshot TO service_role;

GRANT SELECT ON public.task_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

GRANT EXECUTE ON FUNCTION public.calculate_business_days TO authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
