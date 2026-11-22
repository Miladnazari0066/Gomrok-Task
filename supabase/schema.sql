-- ==============================================================================
-- CUSTOMS TASK MANAGEMENT — MULTI-TENANT SAAS MIGRATION & STRICT RLS (v5.0)
-- ==============================================================================
-- Safe, idempotent, non-destructive PostgreSQL migration for Supabase.
-- Run this script in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql
--
-- GUARANTEES:
--   1. Never drops existing tables or truncates production data.
--   2. Preserves all existing records by assigning legacy rows to a deterministic
--      initial company workspace (slug: 'initial-company') that can be claimed
--      by the first administrator.
--   3. Enforces strict company isolation, disabled-user blocking, operational
--      module activation (Import / Export), and RBAC at the PostgreSQL RLS layer.
--   4. Prevents removing, disabling, or demoting the last active Company Owner.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 1. MULTI-TENANT CORE TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT DEFAULT '',
    registration_number TEXT DEFAULT '',
    national_id TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    enable_import BOOLEAN NOT NULL DEFAULT true,
    enable_export BOOLEAN NOT NULL DEFAULT true,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    onboarding_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_owner_role BOOLEAN NOT NULL DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (company_id, key)
);

CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT DEFAULT '',
    role_id UUID NOT NULL REFERENCES public.company_roles(id) ON DELETE RESTRICT,
    permission_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    is_owner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customs_letters (
    id TEXT PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    letter_number TEXT DEFAULT '',
    letter_date JSONB NOT NULL DEFAULT '{"jy": 1403, "jm": 1, "jd": 1}'::jsonb,
    sender TEXT DEFAULT '',
    recipient TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    cottage_number TEXT DEFAULT '',
    cargo_name TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    notes TEXT DEFAULT '',
    image_data TEXT DEFAULT '',
    image_name TEXT DEFAULT '',
    image_size_kb INTEGER DEFAULT 0,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 2. ENSURE EXISTING BUSINESS TABLES EXIST (NON-DESTRUCTIVE)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.entry_docs (
    id TEXT PRIMARY KEY,
    company_id UUID,
    cottage TEXT NOT NULL,
    bl TEXT DEFAULT '',
    file TEXT DEFAULT '',
    importer TEXT DEFAULT '',
    carrier TEXT DEFAULT '',
    goods TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    mdf_thickness TEXT DEFAULT '',
    unload_date JSONB DEFAULT '{"jy": 1402, "jm": 1, "jd": 1}'::jsonb,
    trailers INTEGER DEFAULT 0,
    unloaded INTEGER DEFAULT 0,
    pallets INTEGER DEFAULT 0,
    invoice_paid BOOLEAN DEFAULT false,
    receipt JSONB DEFAULT '{"number": "", "count": ""}'::jsonb,
    tasks JSONB DEFAULT '{"bl": false, "arr": false, "tali": false}'::jsonb,
    clearance JSONB DEFAULT '{}'::jsonb,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY,
    company_id UUID,
    goods TEXT DEFAULT '',
    file TEXT DEFAULT '',
    created_at JSONB DEFAULT '{"jy": 1402, "jm": 1, "jd": 1}'::jsonb,
    doc_ids JSONB DEFAULT '[]'::jsonb,
    finalized BOOLEAN DEFAULT false,
    exited BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_records (
    id TEXT PRIMARY KEY,
    company_id UUID,
    goods TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    sample_date JSONB DEFAULT '{"jy": 1402, "jm": 1, "jd": 1}'::jsonb,
    validity INTEGER DEFAULT 6,
    comment TEXT DEFAULT '',
    exit_id TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exit_docs (
    id TEXT PRIMARY KEY,
    company_id UUID,
    cottage TEXT DEFAULT '',
    bl TEXT DEFAULT '',
    file TEXT DEFAULT '',
    unload_date JSONB DEFAULT '{"jy": 1402, "jm": 1, "jd": 1}'::jsonb,
    importer TEXT DEFAULT '',
    carrier TEXT DEFAULT '',
    goods TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    trailers INTEGER DEFAULT 0,
    pallets INTEGER DEFAULT 0,
    batch_id TEXT DEFAULT '',
    entry_doc_id TEXT DEFAULT '',
    route TEXT DEFAULT 'yellow',
    partial_exit JSONB DEFAULT NULL,
    evaluator JSONB DEFAULT '{"done": false, "comment": ""}'::jsonb,
    jihad JSONB DEFAULT '{"done": false, "comment": ""}'::jsonb,
    lab JSONB DEFAULT '{"needed": false, "sampled": false, "sampleDate": null, "sent": false, "tested": false, "comment": "", "reusedFrom": null, "recordId": null, "validity": 6}'::jsonb,
    expert JSONB DEFAULT '{"done": false}'::jsonb,
    gate JSONB DEFAULT '{"done": false}'::jsonb,
    invoice JSONB DEFAULT '{"paid": false}'::jsonb,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lookup_options (
    id TEXT PRIMARY KEY,
    company_id UUID,
    importers JSONB DEFAULT '[]'::jsonb,
    carriers JSONB DEFAULT '[]'::jsonb,
    goods_list JSONB DEFAULT '[]'::jsonb,
    brands JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.physical_exits (
    id TEXT PRIMARY KEY,
    company_id UUID,
    entry_doc_id TEXT NOT NULL,
    exit_doc_id TEXT DEFAULT '',
    cottage TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('first_90', 'remaining_10')),
    exit_date JSONB NOT NULL,
    truck_info TEXT NOT NULL,
    pallets INTEGER NOT NULL CHECK (pallets > 0),
    driver_info TEXT DEFAULT '',
    documents JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    responsible_user TEXT DEFAULT '',
    fingerprint TEXT DEFAULT '',
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id TEXT PRIMARY KEY,
    company_id UUID,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    cottage TEXT DEFAULT '',
    related_record_type TEXT DEFAULT '',
    related_record_id TEXT DEFAULT '',
    assigned_to TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    due_date JSONB NOT NULL,
    created_at_date JSONB NOT NULL,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    notes TEXT DEFAULT '',
    completion_date JSONB DEFAULT NULL,
    completed_at BIGINT DEFAULT NULL,
    created_by TEXT DEFAULT '',
    is_auto BOOLEAN DEFAULT false,
    auto_source_key TEXT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_states (
    dedupe_key TEXT NOT NULL,
    company_id UUID,
    read BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    read_at BIGINT DEFAULT NULL,
    archived_at BIGINT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==============================================================================
-- 3. ADD TENANT COLUMNS & PRESERVE LEGACY DATA SAFELY
-- ==============================================================================

ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS mdf_thickness TEXT DEFAULT '';
ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS clearance JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.lab_records ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.exit_docs ADD COLUMN IF NOT EXISTS partial_exit JSONB DEFAULT NULL;
ALTER TABLE public.exit_docs ADD COLUMN IF NOT EXISTS entry_doc_id TEXT DEFAULT '';
ALTER TABLE public.exit_docs ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.lookup_options ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.physical_exits ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.notification_states ADD COLUMN IF NOT EXISTS company_id UUID;

DO $$
DECLARE
    legacy_company_id CONSTANT UUID := '00000000-0000-4000-8000-000000000001';
    has_unowned_rows BOOLEAN := false;
    pk_name TEXT;
    pk_col_count INTEGER;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.entry_docs WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.batches WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.lab_records WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.exit_docs WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.lookup_options WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.physical_exits WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.daily_tasks WHERE company_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.notification_states WHERE company_id IS NULL)
    INTO has_unowned_rows;

    IF has_unowned_rows THEN
        INSERT INTO public.companies (
            id, name, slug, enable_import, enable_export, onboarding_completed
        )
        VALUES (
            legacy_company_id,
            'شرکت اولیه (داده‌های منتقل‌شده)',
            'initial-company',
            true,
            true,
            false
        )
        ON CONFLICT (id) DO NOTHING;

        UPDATE public.entry_docs SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.batches SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.lab_records SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.exit_docs SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.lookup_options SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.physical_exits SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.daily_tasks SET company_id = legacy_company_id WHERE company_id IS NULL;
        UPDATE public.notification_states SET company_id = legacy_company_id WHERE company_id IS NULL;
    END IF;

    -- Safely upgrade notification_states primary key to composite (company_id, dedupe_key)
    SELECT c.conname, array_length(c.conkey, 1)
    INTO pk_name, pk_col_count
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'notification_states'
      AND c.contype = 'p'
    LIMIT 1;

    IF pk_name IS NOT NULL AND pk_col_count = 1 THEN
        EXECUTE format('ALTER TABLE public.notification_states DROP CONSTRAINT %I', pk_name);
        pk_name := NULL;
    END IF;

    ALTER TABLE public.entry_docs ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.batches ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.lab_records ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.exit_docs ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.lookup_options ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.physical_exits ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.daily_tasks ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE public.notification_states ALTER COLUMN company_id SET NOT NULL;

    IF pk_name IS NULL THEN
        ALTER TABLE public.notification_states ADD PRIMARY KEY (company_id, dedupe_key);
    END IF;

    -- Attach non-destructive foreign keys if not yet present
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_entry_docs_company') THEN
        ALTER TABLE public.entry_docs ADD CONSTRAINT fk_entry_docs_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_batches_company') THEN
        ALTER TABLE public.batches ADD CONSTRAINT fk_batches_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lab_records_company') THEN
        ALTER TABLE public.lab_records ADD CONSTRAINT fk_lab_records_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_exit_docs_company') THEN
        ALTER TABLE public.exit_docs ADD CONSTRAINT fk_exit_docs_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lookup_options_company') THEN
        ALTER TABLE public.lookup_options ADD CONSTRAINT fk_lookup_options_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_physical_exits_company') THEN
        ALTER TABLE public.physical_exits ADD CONSTRAINT fk_physical_exits_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_daily_tasks_company') THEN
        ALTER TABLE public.daily_tasks ADD CONSTRAINT fk_daily_tasks_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_states_company') THEN
        ALTER TABLE public.notification_states ADD CONSTRAINT fk_notification_states_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 4. TENANT-SCOPED INDEXES & UNIQUENESS
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_company_roles_company ON public.company_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_username ON public.company_members(lower(username)) WHERE username <> '';
CREATE INDEX IF NOT EXISTS idx_company_audit_logs_company ON public.company_audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customs_letters_company ON public.customs_letters(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entry_docs_company_cottage ON public.entry_docs(company_id, cottage);
CREATE INDEX IF NOT EXISTS idx_entry_docs_company_file ON public.entry_docs(company_id, file);
CREATE INDEX IF NOT EXISTS idx_exit_docs_company_cottage ON public.exit_docs(company_id, cottage);
CREATE INDEX IF NOT EXISTS idx_exit_docs_company_batch ON public.exit_docs(company_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_company_file ON public.batches(company_id, file);
CREATE INDEX IF NOT EXISTS idx_lab_records_company ON public.lab_records(company_id);
CREATE INDEX IF NOT EXISTS idx_physical_exits_company_entry ON public.physical_exits(company_id, entry_doc_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_company_status ON public.daily_tasks(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lookup_options_company ON public.lookup_options(company_id);

-- Replace legacy global unique indexes with tenant-scoped unique indexes
DROP INDEX IF EXISTS public.idx_physical_exits_fingerprint;
CREATE UNIQUE INDEX IF NOT EXISTS idx_physical_exits_company_fingerprint
    ON public.physical_exits(company_id, entry_doc_id, fingerprint)
    WHERE fingerprint <> '';

DROP INDEX IF EXISTS public.idx_daily_tasks_auto_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_company_auto_key
    ON public.daily_tasks(company_id, auto_source_key)
    WHERE auto_source_key IS NOT NULL;

-- ==============================================================================
-- 5. SECURITY DEFINER HELPERS & LAST-OWNER PROTECTION TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_active_company_member(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_members m
        WHERE m.company_id = p_company_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_members m
        WHERE m.company_id = p_company_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
          AND m.is_owner = true
    );
$$;

CREATE OR REPLACE FUNCTION public.company_module_enabled(p_company_id UUID, p_module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = p_company_id
          AND (
              (p_module = 'import' AND c.enable_import = true)
              OR (p_module = 'export' AND c.enable_export = true)
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_company_permission(p_company_id UUID, p_perm TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_owner BOOLEAN;
    v_role_perms JSONB;
    v_overrides JSONB;
    v_override_val TEXT;
    v_role_val TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT m.is_owner, r.permissions, m.permission_overrides
    INTO v_is_owner, v_role_perms, v_overrides
    FROM public.company_members m
    JOIN public.company_roles r ON r.id = m.role_id
    WHERE m.company_id = p_company_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_is_owner THEN
        RETURN true;
    END IF;

    IF v_overrides IS NOT NULL AND v_overrides ? p_perm THEN
        v_override_val := v_overrides ->> p_perm;
        RETURN v_override_val = 'true';
    END IF;

    IF v_role_perms IS NOT NULL AND v_role_perms ? p_perm THEN
        v_role_val := v_role_perms ->> p_perm;
        RETURN v_role_val = 'true';
    END IF;

    RETURN false;
END;
$$;

-- Trigger: prevent deleting, disabling, or demoting the last active Company Owner
CREATE OR REPLACE FUNCTION public.guard_last_company_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    remaining_owners INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.is_owner = true AND OLD.status = 'active' THEN
            SELECT COUNT(*) INTO remaining_owners
            FROM public.company_members
            WHERE company_id = OLD.company_id
              AND id <> OLD.id
              AND is_owner = true
              AND status = 'active';
            IF remaining_owners = 0 THEN
                RAISE EXCEPTION 'Cannot remove the last active Company Owner';
            END IF;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_owner = true AND OLD.status = 'active' AND (NEW.is_owner = false OR NEW.status <> 'active') THEN
            SELECT COUNT(*) INTO remaining_owners
            FROM public.company_members
            WHERE company_id = OLD.company_id
              AND id <> OLD.id
              AND is_owner = true
              AND status = 'active';
            IF remaining_owners = 0 THEN
                RAISE EXCEPTION 'Cannot disable or demote the last active Company Owner';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_company_owner ON public.company_members;
CREATE TRIGGER trg_guard_last_company_owner
    BEFORE UPDATE OR DELETE ON public.company_members
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_last_company_owner();

-- ==============================================================================
-- 6. STRICT ROW LEVEL SECURITY (RLS) POLICIES ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookup_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_states ENABLE ROW LEVEL SECURITY;

-- Drop legacy permissive policies
DROP POLICY IF EXISTS "Allow anon full access on entry_docs" ON public.entry_docs;
DROP POLICY IF EXISTS "Allow anon full access on batches" ON public.batches;
DROP POLICY IF EXISTS "Allow anon full access on lab_records" ON public.lab_records;
DROP POLICY IF EXISTS "Allow anon full access on exit_docs" ON public.exit_docs;
DROP POLICY IF EXISTS "Allow anon full access on lookup_options" ON public.lookup_options;
DROP POLICY IF EXISTS "Allow anon full access on physical_exits" ON public.physical_exits;
DROP POLICY IF EXISTS "Allow anon full access on daily_tasks" ON public.daily_tasks;
DROP POLICY IF EXISTS "Allow anon full access on notification_states" ON public.notification_states;

-- COMPANIES
DROP POLICY IF EXISTS "companies_select_member" ON public.companies;
CREATE POLICY "companies_select_member" ON public.companies
    FOR SELECT TO authenticated
    USING (public.is_active_company_member(id));

DROP POLICY IF EXISTS "companies_update_admin" ON public.companies;
CREATE POLICY "companies_update_admin" ON public.companies
    FOR UPDATE TO authenticated
    USING (public.has_company_permission(id, 'canManageCompanySettings'))
    WITH CHECK (public.has_company_permission(id, 'canManageCompanySettings'));

-- COMPANY ROLES
DROP POLICY IF EXISTS "company_roles_select_member" ON public.company_roles;
CREATE POLICY "company_roles_select_member" ON public.company_roles
    FOR SELECT TO authenticated
    USING (public.is_active_company_member(company_id));

DROP POLICY IF EXISTS "company_roles_manage_admin" ON public.company_roles;
CREATE POLICY "company_roles_manage_admin" ON public.company_roles
    FOR ALL TO authenticated
    USING (public.has_company_permission(company_id, 'canManageRoles'))
    WITH CHECK (public.has_company_permission(company_id, 'canManageRoles') AND is_owner_role = false);

-- COMPANY MEMBERS
DROP POLICY IF EXISTS "company_members_select_own_company" ON public.company_members;
CREATE POLICY "company_members_select_own_company" ON public.company_members
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_company_permission(company_id, 'canManageUsers')
    );

DROP POLICY IF EXISTS "company_members_update_admin" ON public.company_members;
CREATE POLICY "company_members_update_admin" ON public.company_members
    FOR UPDATE TO authenticated
    USING (public.has_company_permission(company_id, 'canManageUsers') AND (is_owner = false OR public.is_company_owner(company_id)))
    WITH CHECK (public.has_company_permission(company_id, 'canManageUsers') AND (is_owner = false OR public.is_company_owner(company_id)));

-- COMPANY AUDIT LOGS
DROP POLICY IF EXISTS "company_audit_logs_select_admin" ON public.company_audit_logs;
CREATE POLICY "company_audit_logs_select_admin" ON public.company_audit_logs
    FOR SELECT TO authenticated
    USING (
        public.has_company_permission(company_id, 'canManageCompanySettings')
        OR public.has_company_permission(company_id, 'canManageUsers')
    );

DROP POLICY IF EXISTS "company_audit_logs_insert_member" ON public.company_audit_logs;
CREATE POLICY "company_audit_logs_insert_member" ON public.company_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_company_member(company_id) AND actor_user_id = auth.uid());

-- ENTRY DOCS (IMPORT MODULE)
DROP POLICY IF EXISTS "entry_docs_select_tenant" ON public.entry_docs;
CREATE POLICY "entry_docs_select_tenant" ON public.entry_docs
    FOR SELECT TO authenticated
    USING (
        public.company_module_enabled(company_id, 'import')
        AND (
            public.has_company_permission(company_id, 'canViewEntry')
            OR public.has_company_permission(company_id, 'canViewReports')
            OR public.has_company_permission(company_id, 'canViewSummaryModal')
        )
    );

DROP POLICY IF EXISTS "entry_docs_insert_tenant" ON public.entry_docs;
CREATE POLICY "entry_docs_insert_tenant" ON public.entry_docs
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_module_enabled(company_id, 'import')
        AND public.has_company_permission(company_id, 'canCreateEntry')
    );

DROP POLICY IF EXISTS "entry_docs_update_tenant" ON public.entry_docs;
CREATE POLICY "entry_docs_update_tenant" ON public.entry_docs
    FOR UPDATE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'import')
        AND (
            public.has_company_permission(company_id, 'canEditEntry')
            OR public.has_company_permission(company_id, 'canEditCriticalClearance')
        )
    )
    WITH CHECK (
        public.company_module_enabled(company_id, 'import')
        AND (
            public.has_company_permission(company_id, 'canEditEntry')
            OR public.has_company_permission(company_id, 'canEditCriticalClearance')
        )
    );

DROP POLICY IF EXISTS "entry_docs_delete_tenant" ON public.entry_docs;
CREATE POLICY "entry_docs_delete_tenant" ON public.entry_docs
    FOR DELETE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'import')
        AND public.has_company_permission(company_id, 'canDeleteItems')
    );

-- BATCHES / CONSOLIDATION (IMPORT / INVENTORY MODULE)
DROP POLICY IF EXISTS "batches_select_tenant" ON public.batches;
CREATE POLICY "batches_select_tenant" ON public.batches
    FOR SELECT TO authenticated
    USING (
        public.company_module_enabled(company_id, 'import')
        AND (
            public.has_company_permission(company_id, 'canViewEntry')
            OR public.has_company_permission(company_id, 'canCreateBatch')
            OR public.has_company_permission(company_id, 'canViewReports')
        )
    );

DROP POLICY IF EXISTS "batches_write_tenant" ON public.batches;
CREATE POLICY "batches_write_tenant" ON public.batches
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_module_enabled(company_id, 'import')
        AND public.has_company_permission(company_id, 'canCreateBatch')
    );

DROP POLICY IF EXISTS "batches_update_tenant" ON public.batches;
CREATE POLICY "batches_update_tenant" ON public.batches
    FOR UPDATE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'import')
        AND public.has_company_permission(company_id, 'canCreateBatch')
    )
    WITH CHECK (
        public.company_module_enabled(company_id, 'import')
        AND public.has_company_permission(company_id, 'canCreateBatch')
    );

DROP POLICY IF EXISTS "batches_delete_tenant" ON public.batches;
CREATE POLICY "batches_delete_tenant" ON public.batches
    FOR DELETE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'import')
        AND public.has_company_permission(company_id, 'canDeleteItems')
    );

-- EXIT DOCS (EXPORT MODULE)
DROP POLICY IF EXISTS "exit_docs_select_tenant" ON public.exit_docs;
CREATE POLICY "exit_docs_select_tenant" ON public.exit_docs
    FOR SELECT TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canViewExit')
            OR public.has_company_permission(company_id, 'canViewReports')
            OR public.has_company_permission(company_id, 'canViewSummaryModal')
        )
    );

DROP POLICY IF EXISTS "exit_docs_insert_tenant" ON public.exit_docs;
CREATE POLICY "exit_docs_insert_tenant" ON public.exit_docs
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canCreateExit')
    );

DROP POLICY IF EXISTS "exit_docs_update_tenant" ON public.exit_docs;
CREATE POLICY "exit_docs_update_tenant" ON public.exit_docs
    FOR UPDATE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canUpdateExitStages')
            OR public.has_company_permission(company_id, 'canCreateExit')
        )
    )
    WITH CHECK (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canUpdateExitStages')
            OR public.has_company_permission(company_id, 'canCreateExit')
        )
    );

DROP POLICY IF EXISTS "exit_docs_delete_tenant" ON public.exit_docs;
CREATE POLICY "exit_docs_delete_tenant" ON public.exit_docs
    FOR DELETE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canDeleteItems')
    );

-- LAB RECORDS (EXPORT MODULE)
DROP POLICY IF EXISTS "lab_records_select_tenant" ON public.lab_records;
CREATE POLICY "lab_records_select_tenant" ON public.lab_records
    FOR SELECT TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canViewLab')
            OR public.has_company_permission(company_id, 'canViewExit')
            OR public.has_company_permission(company_id, 'canViewReports')
        )
    );

DROP POLICY IF EXISTS "lab_records_insert_tenant" ON public.lab_records;
CREATE POLICY "lab_records_insert_tenant" ON public.lab_records
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canCreateLab')
    );

DROP POLICY IF EXISTS "lab_records_update_tenant" ON public.lab_records;
CREATE POLICY "lab_records_update_tenant" ON public.lab_records
    FOR UPDATE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canCreateLab')
    )
    WITH CHECK (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canCreateLab')
    );

DROP POLICY IF EXISTS "lab_records_delete_tenant" ON public.lab_records;
CREATE POLICY "lab_records_delete_tenant" ON public.lab_records
    FOR DELETE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canDeleteItems')
    );

-- PHYSICAL EXITS 90/10 (EXPORT MODULE)
DROP POLICY IF EXISTS "physical_exits_select_tenant" ON public.physical_exits;
CREATE POLICY "physical_exits_select_tenant" ON public.physical_exits
    FOR SELECT TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canViewExit')
            OR public.has_company_permission(company_id, 'canViewReports')
        )
    );

DROP POLICY IF EXISTS "physical_exits_insert_tenant" ON public.physical_exits;
CREATE POLICY "physical_exits_insert_tenant" ON public.physical_exits
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canUpdateExitStages')
            OR public.has_company_permission(company_id, 'canEditCriticalClearance')
        )
    );

DROP POLICY IF EXISTS "physical_exits_update_tenant" ON public.physical_exits;
CREATE POLICY "physical_exits_update_tenant" ON public.physical_exits
    FOR UPDATE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canModifyCompletedExits')
    )
    WITH CHECK (
        public.company_module_enabled(company_id, 'export')
        AND public.has_company_permission(company_id, 'canModifyCompletedExits')
    );

DROP POLICY IF EXISTS "physical_exits_delete_tenant" ON public.physical_exits;
CREATE POLICY "physical_exits_delete_tenant" ON public.physical_exits
    FOR DELETE TO authenticated
    USING (
        public.company_module_enabled(company_id, 'export')
        AND (
            public.has_company_permission(company_id, 'canModifyCompletedExits')
            OR public.has_company_permission(company_id, 'canDeleteItems')
        )
    );

-- LOOKUP OPTIONS
DROP POLICY IF EXISTS "lookup_options_select_tenant" ON public.lookup_options;
CREATE POLICY "lookup_options_select_tenant" ON public.lookup_options
    FOR SELECT TO authenticated
    USING (public.is_active_company_member(company_id));

DROP POLICY IF EXISTS "lookup_options_write_tenant" ON public.lookup_options;
CREATE POLICY "lookup_options_write_tenant" ON public.lookup_options
    FOR ALL TO authenticated
    USING (
        public.is_active_company_member(company_id)
        AND (
            public.has_company_permission(company_id, 'canCreateEntry')
            OR public.has_company_permission(company_id, 'canCreateExit')
            OR public.has_company_permission(company_id, 'canManageCompanySettings')
        )
    )
    WITH CHECK (
        public.is_active_company_member(company_id)
        AND (
            public.has_company_permission(company_id, 'canCreateEntry')
            OR public.has_company_permission(company_id, 'canCreateExit')
            OR public.has_company_permission(company_id, 'canManageCompanySettings')
        )
    );

-- DAILY TASKS
DROP POLICY IF EXISTS "daily_tasks_select_tenant" ON public.daily_tasks;
CREATE POLICY "daily_tasks_select_tenant" ON public.daily_tasks
    FOR SELECT TO authenticated
    USING (public.is_active_company_member(company_id));

DROP POLICY IF EXISTS "daily_tasks_write_tenant" ON public.daily_tasks;
CREATE POLICY "daily_tasks_write_tenant" ON public.daily_tasks
    FOR INSERT TO authenticated
    WITH CHECK (public.has_company_permission(company_id, 'canManageTasks'));

DROP POLICY IF EXISTS "daily_tasks_update_tenant" ON public.daily_tasks;
CREATE POLICY "daily_tasks_update_tenant" ON public.daily_tasks
    FOR UPDATE TO authenticated
    USING (public.has_company_permission(company_id, 'canManageTasks'))
    WITH CHECK (public.has_company_permission(company_id, 'canManageTasks'));

DROP POLICY IF EXISTS "daily_tasks_delete_tenant" ON public.daily_tasks;
CREATE POLICY "daily_tasks_delete_tenant" ON public.daily_tasks
    FOR DELETE TO authenticated
    USING (
        public.has_company_permission(company_id, 'canManageTasks')
        AND public.has_company_permission(company_id, 'canDeleteItems')
    );

-- NOTIFICATION STATES
DROP POLICY IF EXISTS "notification_states_select_tenant" ON public.notification_states;
CREATE POLICY "notification_states_select_tenant" ON public.notification_states
    FOR SELECT TO authenticated
    USING (public.is_active_company_member(company_id));

DROP POLICY IF EXISTS "notification_states_write_tenant" ON public.notification_states;
CREATE POLICY "notification_states_write_tenant" ON public.notification_states
    FOR ALL TO authenticated
    USING (public.has_company_permission(company_id, 'canManageNotifications'))
    WITH CHECK (public.has_company_permission(company_id, 'canManageNotifications'));

-- CUSTOMS LETTERS
DROP POLICY IF EXISTS "customs_letters_select_tenant" ON public.customs_letters;
CREATE POLICY "customs_letters_select_tenant" ON public.customs_letters
    FOR SELECT TO authenticated
    USING (public.has_company_permission(company_id, 'canViewLetters'));

DROP POLICY IF EXISTS "customs_letters_write_tenant" ON public.customs_letters;
CREATE POLICY "customs_letters_write_tenant" ON public.customs_letters
    FOR INSERT TO authenticated
    WITH CHECK (public.has_company_permission(company_id, 'canManageLetters'));

DROP POLICY IF EXISTS "customs_letters_update_tenant" ON public.customs_letters;
CREATE POLICY "customs_letters_update_tenant" ON public.customs_letters
    FOR UPDATE TO authenticated
    USING (public.has_company_permission(company_id, 'canManageLetters'))
    WITH CHECK (public.has_company_permission(company_id, 'canManageLetters'));

DROP POLICY IF EXISTS "customs_letters_delete_tenant" ON public.customs_letters;
CREATE POLICY "customs_letters_delete_tenant" ON public.customs_letters
    FOR DELETE TO authenticated
    USING (public.has_company_permission(company_id, 'canManageLetters'));

COMMIT;
