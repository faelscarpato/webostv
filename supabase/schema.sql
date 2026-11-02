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
