-- ==============================================================================
-- GOMROK & WAREHOUSE MANAGEMENT SYSTEM - SUPABASE POSTGRESQL SCHEMA (v4.0)
-- ==============================================================================
-- Run this idempotent SQL script in the Supabase SQL Editor
-- (https://supabase.com/dashboard) to create/migrate all tables, indexes & RLS.
-- ==============================================================================

-- 1. ENTRY DOCS TABLE (اسناد ورود و وضعیت ۹۰/۱۰)
CREATE TABLE IF NOT EXISTS public.entry_docs (
    id TEXT PRIMARY KEY,
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
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS mdf_thickness TEXT DEFAULT '';
ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS clearance JSONB DEFAULT '{}'::jsonb;

-- 2. CONSOLIDATION BATCHES TABLE (تجمیع‌ها)
CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY,
    goods TEXT DEFAULT '',
    file TEXT DEFAULT '',
    created_at JSONB DEFAULT '{"jy": 1402, "jm": 1, "jd": 1}'::jsonb,
    doc_ids JSONB DEFAULT '[]'::jsonb,
    finalized BOOLEAN DEFAULT false,
    exited BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. LAB RECORDS TABLE (سوابق آزمایشگاه)
CREATE TABLE IF NOT EXISTS public.lab_records (
    id TEXT PRIMARY KEY,
    goods TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    sample_date JSONB DEFAULT '{"jy": 1402, "jm": 1, "jd": 1}'::jsonb,
    validity INTEGER DEFAULT 6,
    comment TEXT DEFAULT '',
    exit_id TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. EXIT DOCS TABLE (اسناد خروج)
CREATE TABLE IF NOT EXISTS public.exit_docs (
    id TEXT PRIMARY KEY,
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
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.exit_docs ADD COLUMN IF NOT EXISTS partial_exit JSONB DEFAULT NULL;
ALTER TABLE public.exit_docs ADD COLUMN IF NOT EXISTS entry_doc_id TEXT DEFAULT '';

-- 5. LOOKUP OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.lookup_options (
    id TEXT PRIMARY KEY DEFAULT 'global_options',
    importers JSONB DEFAULT '[]'::jsonb,
    carriers JSONB DEFAULT '[]'::jsonb,
    goods_list JSONB DEFAULT '[]'::jsonb,
    brands JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. PHYSICAL EXITS TABLE (تراکنش‌های خروج فیزیکی ۹۰/۱۰)
CREATE TABLE IF NOT EXISTS public.physical_exits (
    id TEXT PRIMARY KEY,
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
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. DAILY TASKS TABLE (مدیریت کارهای روزانه)
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    cottage TEXT DEFAULT '',
    related_record_type TEXT DEFAULT '',
    related_record_id TEXT DEFAULT '',
    assigned_to TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    due_date JSONB NOT NULL,
    created_at_date JSONB NOT NULL,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    notes TEXT DEFAULT '',
    completion_date JSONB DEFAULT NULL,
    completed_at BIGINT DEFAULT NULL,
    created_by TEXT DEFAULT '',
    is_auto BOOLEAN DEFAULT false,
    auto_source_key TEXT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. NOTIFICATION STATES TABLE (وضعیت خوانده‌شده / بایگانی اعلان‌ها)
CREATE TABLE IF NOT EXISTS public.notification_states (
    dedupe_key TEXT PRIMARY KEY,
    read BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    read_at BIGINT DEFAULT NULL,
    archived_at BIGINT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==============================================================================
-- INDEXES FOR FAST SEARCHING AND DEDUPLICATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_entry_docs_cottage ON public.entry_docs(cottage);
CREATE INDEX IF NOT EXISTS idx_entry_docs_file ON public.entry_docs(file);
CREATE INDEX IF NOT EXISTS idx_entry_docs_bl ON public.entry_docs(bl);
CREATE INDEX IF NOT EXISTS idx_entry_docs_importer ON public.entry_docs(importer);

CREATE INDEX IF NOT EXISTS idx_exit_docs_cottage ON public.exit_docs(cottage);
CREATE INDEX IF NOT EXISTS idx_exit_docs_file ON public.exit_docs(file);
CREATE INDEX IF NOT EXISTS idx_exit_docs_batch ON public.exit_docs(batch_id);

CREATE INDEX IF NOT EXISTS idx_batches_file ON public.batches(file);

CREATE INDEX IF NOT EXISTS idx_physical_exits_entry ON public.physical_exits(entry_doc_id);
CREATE INDEX IF NOT EXISTS idx_physical_exits_cottage ON public.physical_exits(cottage);
CREATE INDEX IF NOT EXISTS idx_physical_exits_exit_doc ON public.physical_exits(exit_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_physical_exits_fingerprint ON public.physical_exits(entry_doc_id, fingerprint) WHERE fingerprint <> '';

CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON public.daily_tasks(status);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_cottage ON public.daily_tasks(cottage);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_auto_key ON public.daily_tasks(auto_source_key) WHERE auto_source_key IS NOT NULL;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & SECURITY NOTE
-- ==============================================================================
-- IMPORTANT SECURITY NOTICE:
-- Because this SPA currently uses client-side passcode authentication with the
-- public Supabase anon key, active policies permit anon CRUD for client sync.
-- For true database-level RBAC enforcement in production, enable Supabase Auth,
-- maintain a public.app_users role table, and switch policies to authenticated JWT checks.

ALTER TABLE public.entry_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookup_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on entry_docs" ON public.entry_docs;
CREATE POLICY "Allow anon full access on entry_docs" ON public.entry_docs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on batches" ON public.batches;
CREATE POLICY "Allow anon full access on batches" ON public.batches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on lab_records" ON public.lab_records;
CREATE POLICY "Allow anon full access on lab_records" ON public.lab_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on exit_docs" ON public.exit_docs;
CREATE POLICY "Allow anon full access on exit_docs" ON public.exit_docs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on lookup_options" ON public.lookup_options;
CREATE POLICY "Allow anon full access on lookup_options" ON public.lookup_options FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on physical_exits" ON public.physical_exits;
CREATE POLICY "Allow anon full access on physical_exits" ON public.physical_exits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on daily_tasks" ON public.daily_tasks;
CREATE POLICY "Allow anon full access on daily_tasks" ON public.daily_tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on notification_states" ON public.notification_states;
CREATE POLICY "Allow anon full access on notification_states" ON public.notification_states FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.lookup_options (id, importers, carriers, goods_list, brands)
VALUES ('global_options', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
