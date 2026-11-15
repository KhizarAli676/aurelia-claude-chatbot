-- ============================================================================
-- AURELIA AI CHATBOT — SUPABASE POSTGRESQL SCHEMA
-- Paste and run this entire script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create `chat_sessions` table (stores each conversation thread & system prompt)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Executive Dossier',
    persona_id TEXT NOT NULL DEFAULT 'concierge',
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create `chat_messages` table (stores full conversation history per session)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes for fast chronological message retrieval & session sorting
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
    ON public.chat_messages(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated
    ON public.chat_sessions(updated_at DESC);

-- 5. Auto-update `updated_at` timestamp on `chat_sessions` whenever a new message arrives
CREATE OR REPLACE FUNCTION public.touch_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_sessions
    SET updated_at = now()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_session_on_message ON public.chat_messages;
CREATE TRIGGER trg_touch_session_on_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_chat_session_updated_at();

-- 6. Row Level Security (RLS)
-- Enabled with public anon access policy so your Vite app works immediately
-- with VITE_SUPABASE_PUBLISHABLE_KEY without requiring a login screen.
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow public access to chat_sessions"
    ON public.chat_sessions
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public access to chat_messages"
    ON public.chat_messages
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
