-- ====================================================================
-- IPTV Streaming Hub - Supabase Schema v2 (Alta Performance & VOD/EPG)
-- Script 100% Retrocompatível (Pode ser executado sobre o banco atual)
-- ====================================================================

-- 1. Habilitar extensão pg_trgm para busca ultra-rápida com ILIKE '%termo%'
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Evolução da Tabela iptv_channels (Sem apagar dados existentes)
ALTER TABLE public.iptv_channels
    ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES public.iptv_playlists(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS series_name TEXT,
    ADD COLUMN IF NOT EXISTS season_number INTEGER,
    ADD COLUMN IF NOT EXISTS episode_number INTEGER,
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS stream_health TEXT DEFAULT 'unknown' CHECK (stream_health IN ('unknown', 'online', 'offline')),
    ADD COLUMN IF NOT EXISTS last_watched_at TIMESTAMPTZ;

-- 3. Novos Índices de Alta Performance (Covering & Partial Indexes)

-- 3.1 Índice Trigram para busca instantânea por nome com ILIKE '%texto%' no Painel e na TV
CREATE INDEX IF NOT EXISTS idx_iptv_channels_name_trgm
    ON public.iptv_channels USING gin (name gin_trgm_ops);

-- 3.2 Índice Composto Principal para Catálogo da TV (filtra visíveis + tipo + grupo + ordenação)
CREATE INDEX IF NOT EXISTS idx_iptv_tv_catalog_group_sort
    ON public.iptv_channels (content_type, group_title, sort_order ASC, id ASC)
    WHERE is_hidden = false;

-- 3.3 Índice Composto Principal para Catálogo da TV ("Todos" os grupos de um tipo)
CREATE INDEX IF NOT EXISTS idx_iptv_tv_catalog_all_sort
    ON public.iptv_channels (content_type, sort_order ASC, id ASC)
    WHERE is_hidden = false;

-- 3.4 Índice Composto para Painel Web (ordenação por sort_order e name)
CREATE INDEX IF NOT EXISTS idx_iptv_manager_sort_name
    ON public.iptv_channels (content_type, sort_order ASC, name ASC);

-- 3.5 Índice Parcial Otimizado para Favoritos na TV
CREATE INDEX IF NOT EXISTS idx_iptv_tv_favorites_sort
    ON public.iptv_channels (sort_order ASC, id ASC)
    WHERE is_favorite = true AND is_hidden = false;

-- 3.6 Índice para Agrupamento de Séries (Série -> Temporada -> Episódio)
CREATE INDEX IF NOT EXISTS idx_iptv_series_hierarchy
    ON public.iptv_channels (series_name, season_number ASC, episode_number ASC)
    WHERE content_type = 'series' AND is_hidden = false;

-- 4. Tabela de Progresso de Reprodução (Continue Watching / Histórico da TV)
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

-- 5. Tabela de Guia Eletrônico de Programação (EPG / XMLTV na Nuvem)
CREATE TABLE IF NOT EXISTS public.iptv_epg_programmes (
    id BIGSERIAL PRIMARY KEY,
    channel_tvg_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    stop_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar rapidamente a programação atual e futura de um canal
CREATE INDEX IF NOT EXISTS idx_iptv_epg_channel_time
    ON public.iptv_epg_programmes (channel_tvg_id, start_time, stop_time);

-- 6. Função RPC 1: Contadores Instantâneos para o Hub da TV e Painel Web
-- Substitui 5 requisições HTTP lentas por 1 única consulta agregada no banco
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

-- 7. Função RPC 2: Listagem Agregada de Grupos/Categorias sem limite de 1000 linhas
-- Resolve definitivamente o bug onde categorias somem em listas com >1.000 itens
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

-- 8. Função RPC 3: Limpeza de EPG expirado (mantém o banco leve no plano Free do Supabase)
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

-- 9. Permissões para as novas tabelas e RPCs
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
