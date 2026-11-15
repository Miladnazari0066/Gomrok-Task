export const SUPABASE_SQL_SCHEMA = `-- SUPABASE SQL SCHEMA & MIGRATION FOR CUSTOMS MANAGEMENT SYSTEM (v4.0 - 90/10 Clearance, Notifications & Daily Tasks)
-- Copy and run this idempotent script in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. ENTRY DOCS TABLE
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

-- Backward-compatible column migrations for existing entry_docs tables
ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS mdf_thickness TEXT DEFAULT '';
ALTER TABLE public.entry_docs ADD COLUMN IF NOT EXISTS clearance JSONB DEFAULT '{}'::jsonb;

-- 2. CONSOLIDATION BATCHES TABLE
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

-- 3. LAB RECORDS TABLE
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

-- 4. EXIT DOCS TABLE
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

-- Backward-compatible column migrations for existing exit_docs tables
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

-- INDEXES
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
-- Because this application currently uses client-side passcode login without
-- Supabase Auth JWT sessions, the active policies below allow anon key access
-- for SPA compatibility. Client-side RBAC/Master Password gates enforce UX rules
-- but CANNOT protect against direct API calls using the public anon key.
-- For true database-level enforcement in production, enable Supabase Auth,
-- create a public.app_users(user_id uuid PRIMARY KEY, role text) table, and
-- replace the USING (true) policies with the authenticated JWT policies below.

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

-- OPTIONAL PRODUCTION-HARDENED SUPABASE AUTH + RLS TEMPLATE (Uncomment after enabling Supabase Auth):
-- CREATE TABLE IF NOT EXISTS public.app_users (
--     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--     display_name TEXT NOT NULL,
--     role TEXT NOT NULL CHECK (role IN ('master_admin', 'operator', 'viewer')),
--     can_confirm_sata BOOLEAN DEFAULT false,
--     can_close_case BOOLEAN DEFAULT false
-- );
-- CREATE POLICY "Authenticated read only for viewers" ON public.entry_docs FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Operators & admins insert/update entry_docs" ON public.entry_docs FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (SELECT 1 FROM public.app_users u WHERE u.user_id = auth.uid() AND u.role IN ('master_admin', 'operator')));
-- CREATE POLICY "Only master_admin deletes" ON public.entry_docs FOR DELETE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.app_users u WHERE u.user_id = auth.uid() AND u.role = 'master_admin'));

-- INITIAL GLOBAL OPTIONS ROW
INSERT INTO public.lookup_options (id, importers, carriers, goods_list, brands)
VALUES ('global_options', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
`;
