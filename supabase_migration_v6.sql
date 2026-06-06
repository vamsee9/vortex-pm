-- supabase_migration_v6.sql
-- Add new fields to column_definitions to support Phase 2 dynamic metadata

ALTER TABLE public.column_definitions
ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_reportable BOOLEAN DEFAULT false;

-- Grant permissions (if needed, though RLS on column_definitions probably handles it)
