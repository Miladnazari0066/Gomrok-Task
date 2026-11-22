-- ==============================================================================
-- CUSTOMS TASK MANAGEMENT — MULTI-TENANT SAAS MIGRATION & STRICT RLS (v5.1)
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
--   5. Provides direct transactional SECURITY DEFINER RPCs so GitHub Pages, PWA,
--      and static hosts work natively with Supabase Auth without an Express API.
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

-- ==============================================================================
-- 7. DIRECT SUPABASE MULTI-TENANT RPCs (STATIC HOST / GITHUB PAGES / PWA READY)
-- ==============================================================================
-- All sensitive multi-tenant mutations validate auth.uid(), company membership,
-- RBAC permissions, and anti-privilege-escalation directly inside PostgreSQL.

CREATE OR REPLACE FUNCTION public.sanitize_company_logo_url(p_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_clean TEXT;
BEGIN
    v_clean := trim(COALESCE(p_url, ''));
    IF v_clean = '' THEN
        RETURN '';
    END IF;
    IF length(v_clean) > 600000 THEN
        RAISE EXCEPTION 'LOGO_TOO_LARGE';
    END IF;
    IF v_clean ~* '^https://' THEN
        RETURN v_clean;
    END IF;
    IF v_clean ~* '^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$' THEN
        RETURN v_clean;
    END IF;
    RAISE EXCEPTION 'INVALID_LOGO_URL';
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_company_slug(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_base TEXT;
    v_candidate TEXT;
    v_tries INTEGER := 0;
BEGIN
    v_base := lower(regexp_replace(COALESCE(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g'));
    v_base := trim(BOTH '-' FROM v_base);
    IF length(v_base) < 2 THEN
        v_base := 'company';
    END IF;
    v_base := left(v_base, 36);

    LOOP
        v_candidate := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.companies WHERE slug = v_candidate);
        v_tries := v_tries + 1;
        IF v_tries > 20 THEN
            v_candidate := 'company-' || replace(gen_random_uuid()::text, '-', '');
            EXIT;
        END IF;
    END LOOP;

    RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_no_privilege_escalation(p_company_id UUID, p_target_perms JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key TEXT;
    v_val TEXT;
BEGIN
    IF public.is_company_owner(p_company_id) THEN
        RETURN true;
    END IF;

    IF p_target_perms IS NULL OR jsonb_typeof(p_target_perms) <> 'object' THEN
        RETURN true;
    END IF;

    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_target_perms)
    LOOP
        IF v_val = 'true' AND NOT public.has_company_permission(p_company_id, v_key) THEN
            RAISE EXCEPTION 'PRIVILEGE_ESCALATION_DENIED:%', v_key;
        END IF;
    END LOOP;

    RETURN true;
END;
$$;

-- Public status check: verifies SQL v5.1 schema is installed and checks if legacy data awaits claiming
CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    legacy_company_id CONSTANT UUID := '00000000-0000-4000-8000-000000000001';
    v_legacy_name TEXT;
    v_member_count INTEGER := 0;
BEGIN
    SELECT c.name
    INTO v_legacy_name
    FROM public.companies c
    WHERE c.id = legacy_company_id
      AND c.onboarding_completed = false
    LIMIT 1;

    IF FOUND THEN
        SELECT COUNT(*) INTO v_member_count
        FROM public.company_members m
        WHERE m.company_id = legacy_company_id;

        IF v_member_count = 0 THEN
            RETURN jsonb_build_object(
                'schemaReady', true,
                'schemaVersion', '5.1',
                'hasUnclaimedLegacyCompany', true,
                'legacyCompanyName', COALESCE(v_legacy_name, 'شرکت اولیه')
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'schemaReady', true,
        'schemaVersion', '5.1',
        'hasUnclaimedLegacyCompany', false,
        'legacyCompanyName', ''
    );
END;
$$;

-- Safe username -> email resolver for active members during login
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean TEXT;
    v_email TEXT;
BEGIN
    v_clean := lower(trim(COALESCE(p_username, '')));
    IF v_clean = '' THEN
        RETURN NULL;
    END IF;

    SELECT m.email
    INTO v_email
    FROM public.company_members m
    WHERE lower(trim(m.username)) = v_clean
      AND m.status = 'active'
    ORDER BY m.created_at ASC
    LIMIT 1;

    RETURN v_email;
END;
$$;

-- Seed or upsert onboarding roles for a company (internal helper)
CREATE OR REPLACE FUNCTION public.seed_company_roles_internal(
    p_company_id UUID,
    p_roles JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_perms CONSTANT JSONB := jsonb_build_object(
        'canViewEntry', true, 'canCreateEntry', true, 'canEditEntry', true, 'canCreateBatch', true,
        'canViewExit', true, 'canCreateExit', true, 'canUpdateExitStages', true,
        'canViewLab', true, 'canCreateLab', true, 'canViewReports', true, 'canViewSummaryModal', true,
        'canAccessCloudDb', true, 'canDeleteItems', true, 'canViewLetters', true, 'canManageLetters', true,
        'canConfirmSata', true, 'canCloseCase', true, 'canEditCriticalClearance', true,
        'canModifyCompletedExits', true, 'canManageTasks', true, 'canManageNotifications', true,
        'canManageUsers', true, 'canManageRoles', true, 'canManageCompanySettings', true,
        'canManageSystemConfig', true
    );
    v_role JSONB;
    v_key TEXT;
    v_name TEXT;
    v_desc TEXT;
    v_is_system BOOLEAN;
    v_is_owner_role BOOLEAN;
    v_perms JSONB;
    v_owner_role_id UUID;
BEGIN
    -- Always ensure the built-in owner role exists with full permissions
    INSERT INTO public.company_roles (
        company_id, key, name, description, is_system, is_owner_role, permissions
    )
    VALUES (
        p_company_id,
        'owner',
        'مالک شرکت (مدیر کل)',
        'دسترسی کامل به تمامی بخش‌ها، تنظیمات شرکت، کاربران، نقش‌ها و اجرای مجدد راه‌اندازی',
        true,
        true,
        v_full_perms
    )
    ON CONFLICT (company_id, key) DO UPDATE
    SET is_system = true,
        is_owner_role = true,
        permissions = v_full_perms,
        updated_at = now()
    RETURNING id INTO v_owner_role_id;

    IF p_roles IS NOT NULL AND jsonb_typeof(p_roles) = 'array' THEN
        FOR v_role IN SELECT * FROM jsonb_array_elements(p_roles)
        LOOP
            v_key := lower(trim(COALESCE(v_role ->> 'key', '')));
            v_name := trim(COALESCE(v_role ->> 'name', ''));
            IF v_key = '' OR v_key = 'owner' OR length(v_name) < 2 THEN
                CONTINUE;
            END IF;

            v_desc := trim(COALESCE(v_role ->> 'description', ''));
            v_is_system := COALESCE((v_role ->> 'isSystem')::boolean, false);
            v_is_owner_role := false; -- Never allow creating secondary owner roles via draft payload
            v_perms := CASE
                WHEN jsonb_typeof(v_role -> 'permissions') = 'object' THEN v_role -> 'permissions'
                ELSE '{}'::jsonb
            END;

            INSERT INTO public.company_roles (
                company_id, key, name, description, is_system, is_owner_role, permissions
            )
            VALUES (
                p_company_id, v_key, v_name, v_desc, v_is_system, v_is_owner_role, v_perms
            )
            ON CONFLICT (company_id, key) DO UPDATE
            SET name = EXCLUDED.name,
                description = EXCLUDED.description,
                permissions = EXCLUDED.permissions,
                updated_at = now()
            WHERE public.company_roles.is_owner_role = false;
        END LOOP;
    END IF;

    RETURN v_owner_role_id;
END;
$$;

-- Complete new company onboarding atomically for the currently authenticated Supabase user
CREATE OR REPLACE FUNCTION public.complete_company_onboarding_rpc(
    p_company JSONB,
    p_operations JSONB,
    p_owner JSONB,
    p_roles JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_auth_email TEXT;
    v_company_name TEXT;
    v_logo_url TEXT;
    v_enable_import BOOLEAN;
    v_enable_export BOOLEAN;
    v_owner_name TEXT;
    v_owner_username TEXT;
    v_slug TEXT;
    v_company public.companies%ROWTYPE;
    v_owner_role_id UUID;
    v_member public.company_members%ROWTYPE;
    v_roles_json JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    SELECT lower(email) INTO v_auth_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_auth_email IS NULL THEN
        RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
    END IF;

    v_company_name := trim(COALESCE(p_company ->> 'name', ''));
    IF length(v_company_name) < 2 THEN
        RAISE EXCEPTION 'INVALID_COMPANY_NAME';
    END IF;

    v_enable_import := COALESCE((p_operations ->> 'enableImport')::boolean, false);
    v_enable_export := COALESCE((p_operations ->> 'enableExport')::boolean, false);
    IF NOT (v_enable_import OR v_enable_export) THEN
        RAISE EXCEPTION 'AT_LEAST_ONE_OPERATION_REQUIRED';
    END IF;

    v_logo_url := public.sanitize_company_logo_url(p_company ->> 'logoUrl');
    v_owner_name := trim(COALESCE(p_owner ->> 'fullName', ''));
    IF length(v_owner_name) < 2 THEN
        v_owner_name := split_part(v_auth_email, '@', 1);
    END IF;
    v_owner_username := lower(trim(COALESCE(p_owner ->> 'username', '')));

    v_slug := public.generate_unique_company_slug(v_company_name);

    INSERT INTO public.companies (
        name, slug, logo_url, registration_number, national_id, phone, email, address,
        settings, enable_import, enable_export, onboarding_completed, onboarding_completed_at
    )
    VALUES (
        v_company_name,
        v_slug,
        v_logo_url,
        trim(COALESCE(p_company ->> 'registrationNumber', '')),
        trim(COALESCE(p_company ->> 'nationalId', '')),
        trim(COALESCE(p_company ->> 'phone', '')),
        trim(COALESCE(p_company ->> 'email', '')),
        trim(COALESCE(p_company ->> 'address', '')),
        CASE WHEN jsonb_typeof(p_company -> 'settings') = 'object' THEN p_company -> 'settings' ELSE '{}'::jsonb END,
        v_enable_import,
        v_enable_export,
        true,
        now()
    )
    RETURNING * INTO v_company;

    v_owner_role_id := public.seed_company_roles_internal(v_company.id, p_roles);

    INSERT INTO public.company_members (
        company_id, user_id, full_name, email, username, role_id,
        permission_overrides, status, is_owner
    )
    VALUES (
        v_company.id,
        v_uid,
        v_owner_name,
        v_auth_email,
        v_owner_username,
        v_owner_role_id,
        '{}'::jsonb,
        'active',
        true
    )
    RETURNING * INTO v_member;

    INSERT INTO public.lookup_options (id, company_id, importers, carriers, goods_list, brands)
    VALUES ('default_' || v_company.id::text, v_company.id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
    ON CONFLICT (company_id) DO NOTHING;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        v_company.id,
        v_uid,
        'company_onboarded',
        jsonb_build_object(
            'companyName', v_company.name,
            'enableImport', v_company.enable_import,
            'enableExport', v_company.enable_export
        )
    );

    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.is_owner_role DESC, r.is_system DESC, r.created_at ASC), '[]'::jsonb)
    INTO v_roles_json
    FROM public.company_roles r
    WHERE r.company_id = v_company.id;

    RETURN jsonb_build_object(
        'company', row_to_json(v_company),
        'member', row_to_json(v_member),
        'roles', v_roles_json
    );
END;
$$;

-- Claim unclaimed legacy company atomically without deleting any historical data
CREATE OR REPLACE FUNCTION public.claim_legacy_company_rpc(
    p_company JSONB,
    p_operations JSONB,
    p_owner JSONB,
    p_roles JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    legacy_company_id CONSTANT UUID := '00000000-0000-4000-8000-000000000001';
    v_uid UUID := auth.uid();
    v_auth_email TEXT;
    v_company public.companies%ROWTYPE;
    v_member_count INTEGER := 0;
    v_company_name TEXT;
    v_logo_url TEXT;
    v_enable_import BOOLEAN;
    v_enable_export BOOLEAN;
    v_owner_name TEXT;
    v_owner_username TEXT;
    v_owner_role_id UUID;
    v_member public.company_members%ROWTYPE;
    v_roles_json JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    SELECT lower(email) INTO v_auth_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_auth_email IS NULL THEN
        RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
    END IF;

    -- Lock the legacy company row to prevent concurrent claiming
    SELECT * INTO v_company
    FROM public.companies
    WHERE id = legacy_company_id
    FOR UPDATE;

    IF NOT FOUND OR v_company.onboarding_completed = true THEN
        RAISE EXCEPTION 'LEGACY_COMPANY_ALREADY_CLAIMED';
    END IF;

    SELECT COUNT(*) INTO v_member_count
    FROM public.company_members
    WHERE company_id = legacy_company_id;

    IF v_member_count > 0 THEN
        RAISE EXCEPTION 'LEGACY_COMPANY_ALREADY_CLAIMED';
    END IF;

    v_company_name := trim(COALESCE(p_company ->> 'name', ''));
    IF length(v_company_name) < 2 THEN
        RAISE EXCEPTION 'INVALID_COMPANY_NAME';
    END IF;

    v_enable_import := COALESCE((p_operations ->> 'enableImport')::boolean, false);
    v_enable_export := COALESCE((p_operations ->> 'enableExport')::boolean, false);
    IF NOT (v_enable_import OR v_enable_export) THEN
        RAISE EXCEPTION 'AT_LEAST_ONE_OPERATION_REQUIRED';
    END IF;

    v_logo_url := public.sanitize_company_logo_url(p_company ->> 'logoUrl');
    v_owner_name := trim(COALESCE(p_owner ->> 'fullName', ''));
    IF length(v_owner_name) < 2 THEN
        v_owner_name := split_part(v_auth_email, '@', 1);
    END IF;
    v_owner_username := lower(trim(COALESCE(p_owner ->> 'username', '')));

    UPDATE public.companies
    SET name = v_company_name,
        logo_url = v_logo_url,
        registration_number = trim(COALESCE(p_company ->> 'registrationNumber', '')),
        national_id = trim(COALESCE(p_company ->> 'nationalId', '')),
        phone = trim(COALESCE(p_company ->> 'phone', '')),
        email = trim(COALESCE(p_company ->> 'email', '')),
        address = trim(COALESCE(p_company ->> 'address', '')),
        settings = CASE WHEN jsonb_typeof(p_company -> 'settings') = 'object' THEN p_company -> 'settings' ELSE settings END,
        enable_import = v_enable_import,
        enable_export = v_enable_export,
        onboarding_completed = true,
        onboarding_completed_at = now(),
        updated_at = now()
    WHERE id = legacy_company_id
    RETURNING * INTO v_company;

    v_owner_role_id := public.seed_company_roles_internal(v_company.id, p_roles);

    INSERT INTO public.company_members (
        company_id, user_id, full_name, email, username, role_id,
        permission_overrides, status, is_owner
    )
    VALUES (
        v_company.id,
        v_uid,
        v_owner_name,
        v_auth_email,
        v_owner_username,
        v_owner_role_id,
        '{}'::jsonb,
        'active',
        true
    )
    RETURNING * INTO v_member;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        v_company.id,
        v_uid,
        'legacy_company_claimed',
        jsonb_build_object(
            'companyName', v_company.name,
            'enableImport', v_company.enable_import,
            'enableExport', v_company.enable_export
        )
    );

    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.is_owner_role DESC, r.is_system DESC, r.created_at ASC), '[]'::jsonb)
    INTO v_roles_json
    FROM public.company_roles r
    WHERE r.company_id = v_company.id;

    RETURN jsonb_build_object(
        'company', row_to_json(v_company),
        'member', row_to_json(v_member),
        'roles', v_roles_json
    );
END;
$$;

-- Resolve authenticated user's active company context, roles, and memberships
CREATE OR REPLACE FUNCTION public.get_workspace_context_rpc(p_company_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_total_memberships INTEGER := 0;
    v_active_company_id UUID;
    v_company public.companies%ROWTYPE;
    v_member public.company_members%ROWTYPE;
    v_role public.company_roles%ROWTYPE;
    v_roles_json JSONB;
    v_members_json JSONB := '[]'::jsonb;
    v_all_memberships_json JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    SELECT COUNT(*) INTO v_total_memberships
    FROM public.company_members
    WHERE user_id = v_uid;

    IF v_total_memberships = 0 THEN
        RAISE EXCEPTION 'NO_COMPANY_MEMBERSHIP';
    END IF;

    -- Choose requested company ONLY if user is an active member of it
    IF p_company_id IS NOT NULL THEN
        SELECT m.company_id INTO v_active_company_id
        FROM public.company_members m
        WHERE m.user_id = v_uid
          AND m.company_id = p_company_id
          AND m.status = 'active'
        LIMIT 1;
    END IF;

    IF v_active_company_id IS NULL THEN
        SELECT m.company_id INTO v_active_company_id
        FROM public.company_members m
        WHERE m.user_id = v_uid
          AND m.status = 'active'
        ORDER BY m.is_owner DESC, m.created_at ASC
        LIMIT 1;
    END IF;

    IF v_active_company_id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_DISABLED';
    END IF;

    SELECT * INTO v_company FROM public.companies WHERE id = v_active_company_id;
    SELECT * INTO v_member FROM public.company_members WHERE company_id = v_active_company_id AND user_id = v_uid LIMIT 1;
    SELECT * INTO v_role FROM public.company_roles WHERE id = v_member.role_id;

    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.is_owner_role DESC, r.is_system DESC, r.created_at ASC), '[]'::jsonb)
    INTO v_roles_json
    FROM public.company_roles r
    WHERE r.company_id = v_active_company_id;

    IF v_member.is_owner OR public.has_company_permission(v_active_company_id, 'canManageUsers') THEN
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', m.id,
                    'company_id', m.company_id,
                    'user_id', m.user_id,
                    'full_name', m.full_name,
                    'email', m.email,
                    'username', m.username,
                    'role_id', m.role_id,
                    'role_key', r.key,
                    'role_name', r.name,
                    'permission_overrides', m.permission_overrides,
                    'status', m.status,
                    'is_owner', m.is_owner,
                    'created_at', m.created_at
                )
                ORDER BY m.is_owner DESC, m.created_at ASC
            ),
            '[]'::jsonb
        )
        INTO v_members_json
        FROM public.company_members m
        JOIN public.company_roles r ON r.id = m.role_id
        WHERE m.company_id = v_active_company_id;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'companyId', c.id,
                'companyName', c.name,
                'companySlug', c.slug,
                'logoUrl', c.logo_url,
                'roleName', r.name,
                'isOwner', m.is_owner,
                'status', m.status,
                'onboardingCompleted', c.onboarding_completed
            )
            ORDER BY m.is_owner DESC, m.created_at ASC
        ),
        '[]'::jsonb
    )
    INTO v_all_memberships_json
    FROM public.company_members m
    JOIN public.companies c ON c.id = m.company_id
    JOIN public.company_roles r ON r.id = m.role_id
    WHERE m.user_id = v_uid
      AND m.status = 'active';

    RETURN jsonb_build_object(
        'company', row_to_json(v_company),
        'member', jsonb_build_object(
            'id', v_member.id,
            'company_id', v_member.company_id,
            'user_id', v_member.user_id,
            'full_name', v_member.full_name,
            'email', v_member.email,
            'username', v_member.username,
            'role_id', v_member.role_id,
            'role_key', v_role.key,
            'role_name', v_role.name,
            'permission_overrides', v_member.permission_overrides,
            'status', v_member.status,
            'is_owner', v_member.is_owner,
            'created_at', v_member.created_at
        ),
        'role', row_to_json(v_role),
        'roles', v_roles_json,
        'members', v_members_json,
        'allMemberships', v_all_memberships_json
    );
END;
$$;

-- Update company profile safely with audit trail
CREATE OR REPLACE FUNCTION public.update_company_profile_rpc(
    p_company_id UUID,
    p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
    v_logo TEXT;
    v_company public.companies%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageCompanySettings') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    v_name := trim(COALESCE(p_patch ->> 'name', ''));
    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'INVALID_COMPANY_NAME';
    END IF;

    v_logo := public.sanitize_company_logo_url(p_patch ->> 'logoUrl');

    UPDATE public.companies
    SET name = v_name,
        logo_url = v_logo,
        registration_number = trim(COALESCE(p_patch ->> 'registrationNumber', '')),
        national_id = trim(COALESCE(p_patch ->> 'nationalId', '')),
        phone = trim(COALESCE(p_patch ->> 'phone', '')),
        email = trim(COALESCE(p_patch ->> 'email', '')),
        address = trim(COALESCE(p_patch ->> 'address', '')),
        updated_at = now()
    WHERE id = p_company_id
    RETURNING * INTO v_company;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'company_profile_updated',
        jsonb_build_object('name', v_company.name)
    );

    RETURN row_to_json(v_company)::jsonb;
END;
$$;

-- Update company operations (Import / Export toggles) without deleting historical data
CREATE OR REPLACE FUNCTION public.update_company_operations_rpc(
    p_company_id UUID,
    p_enable_import BOOLEAN,
    p_enable_export BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company public.companies%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageCompanySettings') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    IF NOT (COALESCE(p_enable_import, false) OR COALESCE(p_enable_export, false)) THEN
        RAISE EXCEPTION 'AT_LEAST_ONE_OPERATION_REQUIRED';
    END IF;

    UPDATE public.companies
    SET enable_import = p_enable_import,
        enable_export = p_enable_export,
        updated_at = now()
    WHERE id = p_company_id
    RETURNING * INTO v_company;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'company_operations_updated',
        jsonb_build_object('enableImport', p_enable_import, 'enableExport', p_enable_export)
    );

    RETURN row_to_json(v_company)::jsonb;
END;
$$;

-- Owner-only restart onboarding apply (non-destructive)
CREATE OR REPLACE FUNCTION public.apply_restart_onboarding_rpc(
    p_company_id UUID,
    p_company JSONB,
    p_operations JSONB,
    p_roles JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
    v_logo TEXT;
    v_enable_import BOOLEAN;
    v_enable_export BOOLEAN;
    v_company public.companies%ROWTYPE;
    v_roles_json JSONB;
BEGIN
    IF NOT public.is_company_owner(p_company_id) THEN
        RAISE EXCEPTION 'OWNER_ONLY';
    END IF;

    v_name := trim(COALESCE(p_company ->> 'name', ''));
    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'INVALID_COMPANY_NAME';
    END IF;

    v_enable_import := COALESCE((p_operations ->> 'enableImport')::boolean, false);
    v_enable_export := COALESCE((p_operations ->> 'enableExport')::boolean, false);
    IF NOT (v_enable_import OR v_enable_export) THEN
        RAISE EXCEPTION 'AT_LEAST_ONE_OPERATION_REQUIRED';
    END IF;

    v_logo := public.sanitize_company_logo_url(p_company ->> 'logoUrl');

    UPDATE public.companies
    SET name = v_name,
        logo_url = v_logo,
        registration_number = trim(COALESCE(p_company ->> 'registrationNumber', '')),
        national_id = trim(COALESCE(p_company ->> 'nationalId', '')),
        phone = trim(COALESCE(p_company ->> 'phone', '')),
        email = trim(COALESCE(p_company ->> 'email', '')),
        address = trim(COALESCE(p_company ->> 'address', '')),
        enable_import = v_enable_import,
        enable_export = v_enable_export,
        onboarding_completed = true,
        onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
        updated_at = now()
    WHERE id = p_company_id
    RETURNING * INTO v_company;

    PERFORM public.seed_company_roles_internal(p_company_id, p_roles);

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'onboarding_restarted',
        jsonb_build_object(
            'name', v_company.name,
            'enableImport', v_company.enable_import,
            'enableExport', v_company.enable_export
        )
    );

    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.is_owner_role DESC, r.is_system DESC, r.created_at ASC), '[]'::jsonb)
    INTO v_roles_json
    FROM public.company_roles r
    WHERE r.company_id = p_company_id;

    RETURN jsonb_build_object(
        'company', row_to_json(v_company),
        'roles', v_roles_json
    );
END;
$$;

-- Add an authenticated Supabase Auth user into a company as a member
CREATE OR REPLACE FUNCTION public.add_company_member_rpc(
    p_company_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_username TEXT,
    p_role_id UUID,
    p_status TEXT DEFAULT 'active',
    p_permission_overrides JSONB DEFAULT '{}'::jsonb,
    p_expected_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_clean_name TEXT := trim(COALESCE(p_full_name, ''));
    v_clean_username TEXT := lower(trim(COALESCE(p_username, '')));
    v_clean_status TEXT := CASE WHEN p_status = 'disabled' THEN 'disabled' ELSE 'active' END;
    v_target_user_id UUID;
    v_role public.company_roles%ROWTYPE;
    v_actor_is_owner BOOLEAN;
    v_member public.company_members%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageUsers') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    IF v_clean_email = '' OR length(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'INVALID_MEMBER_INPUT';
    END IF;

    SELECT * INTO v_role
    FROM public.company_roles
    WHERE id = p_role_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ROLE_NOT_FOUND';
    END IF;

    v_actor_is_owner := public.is_company_owner(p_company_id);

    IF v_role.is_owner_role AND NOT v_actor_is_owner THEN
        RAISE EXCEPTION 'ONLY_OWNER_CAN_ASSIGN_OWNER_ROLE';
    END IF;

    PERFORM public.assert_no_privilege_escalation(p_company_id, v_role.permissions);
    PERFORM public.assert_no_privilege_escalation(p_company_id, p_permission_overrides);

    SELECT id INTO v_target_user_id
    FROM auth.users
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_target_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
    END IF;

    IF p_expected_user_id IS NOT NULL AND v_target_user_id <> p_expected_user_id THEN
        RAISE EXCEPTION 'AUTH_USER_MISMATCH';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_id = p_company_id AND user_id = v_target_user_id
    ) THEN
        RAISE EXCEPTION 'MEMBER_ALREADY_EXISTS';
    END IF;

    INSERT INTO public.company_members (
        company_id, user_id, full_name, email, username, role_id,
        permission_overrides, status, is_owner
    )
    VALUES (
        p_company_id,
        v_target_user_id,
        v_clean_name,
        v_clean_email,
        v_clean_username,
        v_role.id,
        COALESCE(p_permission_overrides, '{}'::jsonb),
        v_clean_status,
        (v_role.is_owner_role AND v_actor_is_owner)
    )
    RETURNING * INTO v_member;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'member_added',
        jsonb_build_object('email', v_clean_email, 'roleName', v_role.name, 'status', v_clean_status)
    );

    RETURN jsonb_build_object(
        'id', v_member.id,
        'company_id', v_member.company_id,
        'user_id', v_member.user_id,
        'full_name', v_member.full_name,
        'email', v_member.email,
        'username', v_member.username,
        'role_id', v_member.role_id,
        'role_key', v_role.key,
        'role_name', v_role.name,
        'permission_overrides', v_member.permission_overrides,
        'status', v_member.status,
        'is_owner', v_member.is_owner,
        'created_at', v_member.created_at
    );
END;
$$;

-- Update an existing company member
CREATE OR REPLACE FUNCTION public.update_company_member_rpc(
    p_company_id UUID,
    p_member_id UUID,
    p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.company_members%ROWTYPE;
    v_role public.company_roles%ROWTYPE;
    v_actor_is_owner BOOLEAN;
    v_new_role_id UUID;
    v_new_overrides JSONB;
    v_updated public.company_members%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageUsers') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    SELECT * INTO v_existing
    FROM public.company_members
    WHERE id = p_member_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND';
    END IF;

    v_actor_is_owner := public.is_company_owner(p_company_id);

    IF v_existing.is_owner AND NOT v_actor_is_owner THEN
        RAISE EXCEPTION 'CANNOT_EDIT_OWNER';
    END IF;

    v_new_role_id := COALESCE((p_patch ->> 'roleId')::uuid, v_existing.role_id);
    SELECT * INTO v_role
    FROM public.company_roles
    WHERE id = v_new_role_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ROLE_NOT_FOUND';
    END IF;

    IF v_role.is_owner_role AND NOT v_actor_is_owner THEN
        RAISE EXCEPTION 'ONLY_OWNER_CAN_ASSIGN_OWNER_ROLE';
    END IF;

    v_new_overrides := CASE
        WHEN p_patch ? 'permissionOverrides' AND jsonb_typeof(p_patch -> 'permissionOverrides') = 'object'
        THEN p_patch -> 'permissionOverrides'
        ELSE v_existing.permission_overrides
    END;

    PERFORM public.assert_no_privilege_escalation(p_company_id, v_role.permissions);
    PERFORM public.assert_no_privilege_escalation(p_company_id, v_new_overrides);

    UPDATE public.company_members
    SET full_name = COALESCE(NULLIF(trim(p_patch ->> 'fullName'), ''), full_name),
        username = CASE WHEN p_patch ? 'username' THEN lower(trim(COALESCE(p_patch ->> 'username', ''))) ELSE username END,
        role_id = v_role.id,
        is_owner = CASE WHEN v_actor_is_owner THEN v_role.is_owner_role ELSE is_owner END,
        permission_overrides = v_new_overrides,
        updated_at = now()
    WHERE id = p_member_id AND company_id = p_company_id
    RETURNING * INTO v_updated;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'member_updated',
        jsonb_build_object('memberId', p_member_id, 'roleName', v_role.name)
    );

    RETURN jsonb_build_object(
        'id', v_updated.id,
        'company_id', v_updated.company_id,
        'user_id', v_updated.user_id,
        'full_name', v_updated.full_name,
        'email', v_updated.email,
        'username', v_updated.username,
        'role_id', v_updated.role_id,
        'role_key', v_role.key,
        'role_name', v_role.name,
        'permission_overrides', v_updated.permission_overrides,
        'status', v_updated.status,
        'is_owner', v_updated.is_owner,
        'created_at', v_updated.created_at
    );
END;
$$;

-- Activate / disable a company member
CREATE OR REPLACE FUNCTION public.set_company_member_status_rpc(
    p_company_id UUID,
    p_member_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.company_members%ROWTYPE;
    v_role public.company_roles%ROWTYPE;
    v_updated public.company_members%ROWTYPE;
    v_clean_status TEXT := CASE WHEN p_status = 'disabled' THEN 'disabled' ELSE 'active' END;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageUsers') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    SELECT * INTO v_existing
    FROM public.company_members
    WHERE id = p_member_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND';
    END IF;

    IF v_existing.user_id = auth.uid() AND v_clean_status = 'disabled' THEN
        RAISE EXCEPTION 'CANNOT_DISABLE_SELF';
    END IF;

    IF v_existing.is_owner AND NOT public.is_company_owner(p_company_id) THEN
        RAISE EXCEPTION 'CANNOT_EDIT_OWNER';
    END IF;

    UPDATE public.company_members
    SET status = v_clean_status,
        updated_at = now()
    WHERE id = p_member_id AND company_id = p_company_id
    RETURNING * INTO v_updated;

    SELECT * INTO v_role FROM public.company_roles WHERE id = v_updated.role_id;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'member_status_changed',
        jsonb_build_object('memberId', p_member_id, 'email', v_updated.email, 'status', v_clean_status)
    );

    RETURN jsonb_build_object(
        'id', v_updated.id,
        'company_id', v_updated.company_id,
        'user_id', v_updated.user_id,
        'full_name', v_updated.full_name,
        'email', v_updated.email,
        'username', v_updated.username,
        'role_id', v_updated.role_id,
        'role_key', v_role.key,
        'role_name', v_role.name,
        'permission_overrides', v_updated.permission_overrides,
        'status', v_updated.status,
        'is_owner', v_updated.is_owner,
        'created_at', v_updated.created_at
    );
END;
$$;

-- Remove a member from a company (last-owner trigger enforced automatically)
CREATE OR REPLACE FUNCTION public.remove_company_member_rpc(
    p_company_id UUID,
    p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.company_members%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageUsers') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    SELECT * INTO v_existing
    FROM public.company_members
    WHERE id = p_member_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND';
    END IF;

    IF v_existing.user_id = auth.uid() THEN
        RAISE EXCEPTION 'CANNOT_REMOVE_SELF';
    END IF;

    IF v_existing.is_owner AND NOT public.is_company_owner(p_company_id) THEN
        RAISE EXCEPTION 'CANNOT_EDIT_OWNER';
    END IF;

    DELETE FROM public.company_members
    WHERE id = p_member_id AND company_id = p_company_id;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'member_removed',
        jsonb_build_object('memberId', p_member_id, 'email', v_existing.email)
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Create a custom role in a company
CREATE OR REPLACE FUNCTION public.create_company_role_rpc(
    p_company_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT '',
    p_permissions JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT := trim(COALESCE(p_name, ''));
    v_key TEXT;
    v_role public.company_roles%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageRoles') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'INVALID_ROLE_NAME';
    END IF;

    PERFORM public.assert_no_privilege_escalation(p_company_id, p_permissions);

    v_key := 'custom_' || substr(md5(gen_random_uuid()::text), 1, 10);

    INSERT INTO public.company_roles (
        company_id, key, name, description, is_system, is_owner_role, permissions
    )
    VALUES (
        p_company_id,
        v_key,
        v_name,
        trim(COALESCE(p_description, '')),
        false,
        false,
        COALESCE(p_permissions, '{}'::jsonb)
    )
    RETURNING * INTO v_role;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'role_created',
        jsonb_build_object('roleId', v_role.id, 'name', v_role.name)
    );

    RETURN row_to_json(v_role)::jsonb;
END;
$$;

-- Update an existing non-owner role
CREATE OR REPLACE FUNCTION public.update_company_role_rpc(
    p_company_id UUID,
    p_role_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.company_roles%ROWTYPE;
    v_updated public.company_roles%ROWTYPE;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageRoles') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    SELECT * INTO v_existing
    FROM public.company_roles
    WHERE id = p_role_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ROLE_NOT_FOUND';
    END IF;

    IF v_existing.is_owner_role THEN
        RAISE EXCEPTION 'CANNOT_EDIT_OWNER_ROLE';
    END IF;

    IF p_permissions IS NOT NULL THEN
        PERFORM public.assert_no_privilege_escalation(p_company_id, p_permissions);
    END IF;

    UPDATE public.company_roles
    SET name = COALESCE(NULLIF(trim(p_name), ''), name),
        description = COALESCE(p_description, description),
        permissions = COALESCE(p_permissions, permissions),
        updated_at = now()
    WHERE id = p_role_id AND company_id = p_company_id
    RETURNING * INTO v_updated;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'role_updated',
        jsonb_build_object('roleId', v_updated.id, 'name', v_updated.name)
    );

    RETURN row_to_json(v_updated)::jsonb;
END;
$$;

-- Delete a custom role that is not assigned to any member
CREATE OR REPLACE FUNCTION public.delete_company_role_rpc(
    p_company_id UUID,
    p_role_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.company_roles%ROWTYPE;
    v_assigned_count INTEGER := 0;
BEGIN
    IF NOT public.has_company_permission(p_company_id, 'canManageRoles') THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    SELECT * INTO v_existing
    FROM public.company_roles
    WHERE id = p_role_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ROLE_NOT_FOUND';
    END IF;

    IF v_existing.is_system OR v_existing.is_owner_role THEN
        RAISE EXCEPTION 'CANNOT_DELETE_SYSTEM_ROLE';
    END IF;

    SELECT COUNT(*) INTO v_assigned_count
    FROM public.company_members
    WHERE company_id = p_company_id AND role_id = p_role_id;

    IF v_assigned_count > 0 THEN
        RAISE EXCEPTION 'ROLE_IN_USE';
    END IF;

    DELETE FROM public.company_roles
    WHERE id = p_role_id AND company_id = p_company_id;

    INSERT INTO public.company_audit_logs (company_id, actor_user_id, action, details)
    VALUES (
        p_company_id,
        auth.uid(),
        'role_deleted',
        jsonb_build_object('roleId', p_role_id, 'name', v_existing.name)
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Explicit EXECUTE grants for Supabase PostgREST roles
REVOKE ALL ON FUNCTION public.seed_company_roles_internal(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_unique_company_slug(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_no_privilege_escalation(UUID, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_company_onboarding_rpc(JSONB, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_legacy_company_rpc(JSONB, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_context_rpc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_profile_rpc(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_operations_rpc(UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_restart_onboarding_rpc(UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_company_member_rpc(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_member_rpc(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_member_status_rpc(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_member_rpc(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_role_rpc(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_role_rpc(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_company_role_rpc(UUID, UUID) TO authenticated;

COMMIT;

-- Ask Supabase PostgREST to reload the schema cache immediately so new RPCs work right away
NOTIFY pgrst, 'reload schema';

