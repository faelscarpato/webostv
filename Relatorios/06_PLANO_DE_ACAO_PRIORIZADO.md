# 🚀 Relatório 06: Plano de Ação Priorizado (Roadmap de Correções e Melhorias)

> Este documento consolida todas as descobertas dos Relatórios **01 a 05** em uma ordem prática de execução, classificada pelo impacto no uso real na sua TV LG e no Painel Web Online.

---

## 🔥 Prioridade P0 — Correções Críticas Imediatas (Bugs que afetam funções atuais)

Estes itens corrigem funcionalidades que já estão na tela mas falham no uso real com o Supabase:

- [ ] **1. Executar o Script SQL de Otimização no Supabase (`Relatorios/01_ANALISE_SQL_E_PERFORMANCE_SUPABASE.md`)**
  - **O que resolve:**
    - Cria as funções RPC `get_iptv_groups` e `get_iptv_counts`, acabando com o corte de 1.000 linhas que esconde categorias de Filmes e Séries.
    - Ativa a extensão `pg_trgm` e o índice GIN Trigram para busca instantânea por nome (`ILIKE`).
    - Cria os índices compostos exatos para a ordenação da TV e do Painel.
    - Cria as tabelas `iptv_epg_programmes` (EPG na nuvem) e `iptv_watch_progress` (Continue Watching).

- [ ] **2. Conectar o Favoritar da TV (`toggleInspectorFavorite`) ao Supabase (`BUG-01`)**
  - **Arquivo:** [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L824-L837)
  - **Ação:** Trocar a chamada `PUT ${state.serverUrl}/api/channels/${ch.id}` por `PATCH iptv_channels?id=eq.${ch.id}` no Supabase (mantendo o servidor local apenas como fallback).

- [ ] **3. Usar IDs Determinísticos no Upload do Manager e Preservar Favoritos no Re-upload (`BUG-04`)**
  - **Arquivo:** [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html#L943-L1045)
  - **Ação:**
    - Substituir `Math.random()` por hash determinístico (`content_type + original_name + stream_url`).
    - No modo `"Substituir Conteúdo"`, salvar em memória o mapa de canais com `is_favorite = true` / `is_hidden = true` antes do `DELETE` e restaurar essas flags nos canais reimportados.

- [ ] **4. Gerar `public/config.js` automaticamente no `build.js` da Vercel (`BUG-03`)**
  - **Arquivo:** [`apps/manager/build.js`](file:///D:/PROJETOS/iptv/apps/manager/build.js)
  - **Ação:** Gerar `public/config.js` durante o build na Vercel caso o arquivo não exista, lendo `process.env.SUPABASE_URL` e `process.env.SUPABASE_ANON_KEY`.

- [ ] **5. Corrigir Escape de Aspas e Parser de Vírgulas em Nomes de Canais no Manager (`BUG-07` e `BUG-08`)**
  - **Arquivo:** [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html#L811-L831)
  - **Ação:** Sanitizar caracteres HTML ao renderizar a lista e corrigir a extração do título após `#EXTINF:` para não cortar nomes de filmes que possuem vírgula.

---

## ⚡ Prioridade P1 — Melhorias de Streaming, Controle Remoto e UX na TV LG

Estes itens deixam a experiência na TV física (`LG 43UA7500PSA`) fluida, completa e sem armadilhas de controle remoto:

- [ ] **6. Ajustar Buffer do `Hls.js` e Detecção de Streams `.ts` / `.mp4` / `.mkv` (`Relatório 04`)**
  - **Arquivo:** [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L724-L772)
  - **Ação:**
    - Desativar `lowLatencyMode: true` (evita engasgos em listas IPTV comuns).
    - Limitar `maxMaxBufferLength: 45` e `maxBufferSize: 35MB` para proteger a memória RAM da TV LG.
    - Adicionar fallback automático para o player nativo `<video>` da LG caso o `Hls.js` sofra erro fatal (CORS ou stream MPEG-TS direto).
    - Limpar o player (`stopPlayer`) sempre que `switchToView()` sair da tela do player.

- [ ] **7. Aperfeiçoar Navegação D-Pad (Spatial Navigation Completa na TV) (`Relatório 03`)**
  - **Arquivo:** [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L1091-L1170)
  - **Ação:**
    - Evitar que apertar `◄` ou `►` na grade de canais troque acidentalmente a categoria inteira.
    - Permitir subir com a seta `▲` da linha 0 de canais para o **Trilho de Categorias** (`focusSection = 'categories'`) e, mais um `▲`, para as **Abas do Topo** (`focusSection = 'tabs'`).
    - Permitir ir com `►` da coluna direita de canais para o botão **Assistir em Tela Cheia** e **Favoritar** no Inspector.
    - Implementar navegação por setas na tela de **Guia EPG** e na tela de **Ajustes**.

- [ ] **8. Ativar o Mini-Player PiP / Poster Preview com Debounce de 1.2s (`BUG-06`)**
  - **Arquivo:** [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L611-L636)
  - **Ação:**
    - Para **Filmes e Séries**, exibir o Poster/Capa do filme em alta resolução no quadro de preview à direita.
    - Para **TV Ao Vivo**, iniciar o preview mudo no `<video id="pip-video-player">` após o cursor permanecer parado por `1.200ms` sobre o canal.

- [ ] **9. Corrigir Salto Numérico de Canais em Múltiplas Páginas (`BUG-12`)**
  - **Arquivo:** [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L1066-L1089)
  - **Ação:** Permitir digitar qualquer número de canal (ex: `125`) e saltar automaticamente para a página correspondente (`catalogPage = 7`, item `5`).

---

## 🛠️ Prioridade P2 — Recursos Essenciais de VOD (Filmes/Séries) e Painel Web

- [ ] **10. Controles de VOD no Player da TV (Barra de Progresso, Avanço `◄◄`/`►►` e Retomada)**
  - **Ação:**
    - Quando `content_type` for `movies` ou `series`, exibir barra de progresso com tempo atual/total (`00:35:10 / 01:45:00`) no HUD do player.
    - Permitir usar as setas `◄` e `►` no player de VOD para retroceder `-15s` e avançar `+30s`.
    - Salvar a posição a cada 15 segundos na tabela `iptv_watch_progress` para retomar de onde parou.

- [ ] **11. Busca de Canais/Filmes na TV e Agrupamento de Séries por Temporada**
  - **Ação:**
    - Adicionar barra de busca rápida no topo do catálogo da TV.
    - Agrupar títulos de séries (`Nome da Série S01E01`) para não poluir a grade com milhares de episódios soltos.

- [ ] **12. Gerenciamento em Massa de Categorias e Preview de Stream no Painel Web**
  - **Arquivo:** [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html)
  - **Ação:**
    - Adicionar botão para ocultar/exibir ou apagar uma categoria (`group_title`) inteira.
    - Adicionar botão `▶️ Testar` no painel para reproduzir o canal em um modal de preview no navegador.
    - Adicionar aba de upload de `XMLTV / EPG` enviando para a tabela `iptv_epg_programmes` no Supabase.

---

## 🛡️ Prioridade P3 — Blindagem de Segurança e Empacotamento Offline

- [ ] **13. Proteger RLS do Supabase com Passcode/Cabeçalho Secreto (`SEC-01`)**
  - **Ação:** Evitar que a `ANON_KEY` pública permita leitura de URLs de stream ou deleção de tabelas por terceiros sem o cabeçalho `x-iptv-passcode`.
- [ ] **14. Embutir Tailwind CSS e Fontes Localmente no Pacote `.ipk` da TV (`Gargalo 5`)**
  - **Ação:** Remover a dependência de `cdn.tailwindcss.com` e `fonts.googleapis.com` em `apps/webos-tv/index.html`, garantindo carregamento instantâneo (<0.3s) e funcionamento offline na LAN.
