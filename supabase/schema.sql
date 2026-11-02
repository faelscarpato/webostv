-- ====================================================================
-- IPTV Streaming Hub - Supabase Schema
-- Suporte completo a TV Ao Vivo (live), Filmes (movies) e Séries (series)
-- ====================================================================

-- 1. Tabela de Listas / Playlists
CREATE TABLE IF NOT EXISTS public.iptv_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('live', 'movies', 'series', 'all')),
    channel_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela Central de Conteúdos (Canais Ao Vivo, Filmes e Séries)
CREATE TABLE IF NOT EXISTS public.iptv_channels (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL CHECK (content_type IN ('live', 'movies', 'series')),
    name TEXT NOT NULL,
    original_name TEXT,
    group_title TEXT NOT NULL DEFAULT 'Geral',
    stream_url TEXT NOT NULL,
    logo_url TEXT,
    tvg_id TEXT,
    tvg_name TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de Alto Desempenho (para paginação rápida na TV e Manager)
CREATE INDEX IF NOT EXISTS idx_iptv_content_type_group 
    ON public.iptv_channels (content_type, group_title);

CREATE INDEX IF NOT EXISTS idx_iptv_content_type_fav 
    ON public.iptv_channels (content_type, is_favorite) 
    WHERE is_favorite = true;

CREATE INDEX IF NOT EXISTS idx_iptv_content_type_hidden 
    ON public.iptv_channels (content_type, is_hidden);

CREATE INDEX IF NOT EXISTS idx_iptv_content_type_sort 
    ON public.iptv_channels (content_type, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_iptv_search_name 
    ON public.iptv_channels USING gin (to_tsvector('simple', name));

-- 4. Função para Atualização Automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_iptv_channels_updated_at ON public.iptv_channels;
CREATE TRIGGER tr_iptv_channels_updated_at
    BEFORE UPDATE ON public.iptv_channels
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE public.iptv_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_channels ENABLE ROW LEVEL SECURITY;

-- 6. Concessões de Permissão para Roles Supabase (anon e authenticated)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.iptv_channels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.iptv_playlists TO anon, authenticated, service_role;

-- 7. Políticas de Acesso (Leitura e Gravação para Anon e Authenticated)
DROP POLICY IF EXISTS "Permitir leitura publica de canais" ON public.iptv_channels;
CREATE POLICY "Permitir leitura publica de canais"
    ON public.iptv_channels FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Permitir insercao de canais" ON public.iptv_channels;
CREATE POLICY "Permitir insercao de canais"
    ON public.iptv_channels FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de canais" ON public.iptv_channels;
CREATE POLICY "Permitir atualizacao de canais"
    ON public.iptv_channels FOR UPDATE
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir delecao de canais" ON public.iptv_channels;
CREATE POLICY "Permitir delecao de canais"
    ON public.iptv_channels FOR DELETE
    TO anon, authenticated, service_role
    USING (true);

-- Políticas para Playlists
DROP POLICY IF EXISTS "Permitir acesso completo a playlists" ON public.iptv_playlists;
CREATE POLICY "Permitir acesso completo a playlists"
    ON public.iptv_playlists FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- ====================================================================
-- Evolução v2: Alta Performance (pg_trgm, RPCs, VOD Watch Progress & EPG)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.iptv_channels
    ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES public.iptv_playlists(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS series_name TEXT,
    ADD COLUMN IF NOT EXISTS season_number INTEGER,
    ADD COLUMN IF NOT EXISTS episode_number INTEGER,
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS stream_health TEXT DEFAULT 'unknown' CHECK (stream_health IN ('unknown', 'online', 'offline')),
    ADD COLUMN IF NOT EXISTS last_watched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_iptv_channels_name_trgm
    ON public.iptv_channels USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_iptv_tv_catalog_group_sort
    ON public.iptv_channels (content_type, group_title, sort_order ASC, id ASC)
    WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_iptv_tv_catalog_all_sort
    ON public.iptv_channels (content_type, sort_order ASC, id ASC)
    WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_iptv_manager_sort_name
    ON public.iptv_channels (content_type, sort_order ASC, name ASC);

CREATE INDEX IF NOT EXISTS idx_iptv_tv_favorites_sort
    ON public.iptv_channels (sort_order ASC, id ASC)
    WHERE is_favorite = true AND is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_iptv_series_hierarchy
    ON public.iptv_channels (series_name, season_number ASC, episode_number ASC)
    WHERE content_type = 'series' AND is_hidden = false;

CREATE TABLE IF NOT EXISTS public.iptv_watch_progress (
    channel_id TEXT PRIMARY KEY REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,
    position_seconds INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iptv_watch_progress_recent
    ON public.iptv_watch_progress (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.iptv_epg_programmes (
    id BIGSERIAL PRIMARY KEY,
    channel_tvg_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    stop_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iptv_epg_channel_time
    ON public.iptv_epg_programmes (channel_tvg_id, start_time, stop_time);

CREATE OR REPLACE FUNCTION public.get_iptv_counts()
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
    SELECT json_build_object(
        'total', COUNT(*) FILTER (WHERE is_hidden = false),
        'live', COUNT(*) FILTER (WHERE is_hidden = false AND content_type = 'live'),
        'movies', COUNT(*) FILTER (WHERE is_hidden = false AND content_type = 'movies'),
        'series', COUNT(*) FILTER (WHERE is_hidden = false AND content_type = 'series'),
        'favorites', COUNT(*) FILTER (WHERE is_hidden = false AND is_favorite = true)
    )
    FROM public.iptv_channels;
$$;

CREATE OR REPLACE FUNCTION public.get_iptv_groups(p_content_type TEXT DEFAULT NULL, p_only_favorites BOOLEAN DEFAULT false)
RETURNS TABLE (
    name TEXT,
    count BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        COALESCE(NULLIF(TRIM(group_title), ''), 'Geral') AS name,
        COUNT(*) AS count
    FROM public.iptv_channels
    WHERE is_hidden = false
      AND (p_content_type IS NULL OR p_content_type = '' OR content_type = p_content_type)
      AND (NOT p_only_favorites OR is_favorite = true)
    GROUP BY COALESCE(NULLIF(TRIM(group_title), ''), 'Geral')
    ORDER BY count DESC, name ASC;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_epg()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.iptv_epg_programmes
    WHERE stop_time < (now() - INTERVAL '6 hours');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

ALTER TABLE public.iptv_watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_epg_programmes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.iptv_watch_progress TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.iptv_epg_programmes TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.iptv_epg_programmes_id_seq TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_iptv_counts() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_iptv_groups(TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_epg() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Acesso publico watch_progress" ON public.iptv_watch_progress;
CREATE POLICY "Acesso publico watch_progress" ON public.iptv_watch_progress
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico epg_programmes" ON public.iptv_epg_programmes;
CREATE POLICY "Acesso publico epg_programmes" ON public.iptv_epg_programmes
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
