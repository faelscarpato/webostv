# 📋 Índice Geral da Auditoria Profunda — Ecossistema IPTV (LG webOS + Painel Web + Supabase)

> **Data da Auditoria:** 02 de Novembro de 2026  
> **Escopo Analisado:** Aplicativo Nativo LG webOS ([`apps/webos-tv/`](file:///D:/PROJETOS/iptv/apps/webos-tv)), Painel Web Online ([`apps/manager/`](file:///D:/PROJETOS/iptv/apps/manager)), Banco de Dados Supabase ([`supabase/schema.sql`](file:///D:/PROJETOS/iptv/supabase/schema.sql)), Serviço Local ([`apps/local-server/`](file:///D:/PROJETOS/iptv/apps/local-server)) e Biblioteca Compartilhada ([`packages/shared/`](file:///D:/PROJETOS/iptv/packages/shared)).

---

## 📂 Estrutura dos Relatórios Gerados

Esta pasta contém o diagnóstico técnico completo dividido em **6 relatórios especializados**, detalhando exatamente os erros encontrados no código atual, os riscos para o uso real na TV LG e no navegador, scripts SQL prontos para otimização no Supabase e o plano de evolução de UI/UX:

1. 📄 **[`01_ANALISE_SQL_E_PERFORMANCE_SUPABASE.md`](./01_ANALISE_SQL_E_PERFORMANCE_SUPABASE.md)**
   - Diagnóstico profundo do [`supabase/schema.sql`](file:///D:/PROJETOS/iptv/supabase/schema.sql).
   - Gargalos críticos em listas grandes (50k a 275k itens): por que `loadGroups()` baixa milhares de linhas repetidas pela rede e trava na paginação de `1000` registros do PostgREST.
   - Incompatibilidade do índice `GIN to_tsvector` atual com a busca `ILIKE` usada pelo painel (causando *Sequential Scan*) e ausência do índice Trigram (`pg_trgm`).
   - Falta de tabelas para **EPG (XMLTV)**, **Histórico de Reprodução (Continue Watching / Resume VOD)** e **Telemetria de Saúde de Streams**.
   - **Script SQL Completo (`schema_v2_otimizado.sql`)** pronto para colar no SQL Editor do Supabase (incluindo funções RPC `get_channel_groups`, `get_hub_counts`, índices compostos parciais e tabelas de EPG/Progresso).

2. 📄 **[`02_BUGS_ATUAIS_E_CORRECOES_USO_REAL.md`](./02_BUGS_ATUAIS_E_CORRECOES_USO_REAL.md)**
   - Catálogo de **14 bugs reais confirmados no código-fonte** (com arquivo e linha exata) que afetam o uso diário na TV e no Painel Web.
   - **Destaque Crítico 1:** Favoritar canais na TV ([`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L824-L837)) e abrir o Guia EPG ([`app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L875-L909)) estão chamando apenas o `local-server` (`192.168.18.7:3001`) sem atualizar nem ler do **Supabase**!
   - **Destaque Crítico 2:** Na Vercel, o [`apps/manager/build.js`](file:///D:/PROJETOS/iptv/apps/manager/build.js) não gera o `config.js` (que está no `.gitignore`), resultando em erro `404` e deixando `supabaseKey` vazio no deploy online.
   - **Destaque Crítico 3:** O Mini-Player PiP ([`apps/webos-tv/index.html`](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html#L274)) nunca é acionado pelo JavaScript da TV (fica sempre estático).
   - **Destaque Crítico 4:** Geração de IDs aleatórios no upload do Manager (`Math.random()`) apaga todos os favoritos quando uma lista é reimportada e quebra nomes com vírgula ou apóstrofo.

3. 📄 **[`03_AUDITORIA_UI_UX_TV_E_WEBAPP.md`](./03_AUDITORIA_UI_UX_TV_E_WEBAPP.md)**
   - Análise ergonômica da interface 10-foot na TV LG (`Cinematic Lumina`) e do Painel Web Responsivo (`apps/manager`).
   - Lacunas de navegação por controle remoto D-Pad: impossibilidade de focar nas abas superiores (`Início`, `Catálogo`, `Player`, `Guia EPG`, `Ajustes`), nos botões de paginação (`Anterior`/`Próximo`) ou dentro da grade de EPG e tela de Ajustes usando apenas as setas.
   - Tratamento inadequado de **Filmes e Séries (VOD)**: ausência de barra de progresso (seek/scrubber), tempo decorrido/restante, avanço rápido (`◄◄` / `►►`) e agrupamento por Série → Temporada → Episódio.
   - Problemas no Painel Web: falta de busca na TV, falta de edição em massa (ocultar grupo inteiro), uso de `prompt()`/`alert()` bloqueantes e vulnerabilidade de quebra de HTML/XSS em nomes de canais.

4. 📄 **[`04_PERFORMANCE_STREAMING_E_PLAYER_WEBOS.md`](./04_PERFORMANCE_STREAMING_E_PLAYER_WEBOS.md)**
   - Análise do motor de vídeo HTML5 + `Hls.js` no webOS 25 (LG 43UA7500PSA).
   - Problema de **Mixed Content (HTTPS vs HTTP)** quando o painel ou player interage com streams HTTP puros (`http://...:8080/...`) e bloqueios de CORS em listas M3U remotas.
   - Detecção falha de formato de stream em [`app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L724): streams MPEG-TS puros (`.ts`), `.mkv` ou URLs sem extensão que entram no `Hls.js` indevidamente ou falham no player nativo.
   - Otimização de consumo de RAM e Buffer do `Hls.js` para o processador ARM da TV LG (`maxBufferLength`, `maxMaxBufferLength`, limpeza de MSE) evitando fechamento por falta de memória (*Out-Of-Memory*).
   - Perda de conectividade caso a TV abra sem internet temporária (pois Tailwind CSS e Google Fonts estão via CDN externo em [`apps/webos-tv/index.html`](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html#L11-L16)).

5. 📄 **[`05_SEGURANCA_E_ARQUITETURA_GERAL.md`](./05_SEGURANCA_E_ARQUITETURA_GERAL.md)**
   - Auditoria das políticas **RLS (Row Level Security)** no Supabase: atualmente a role `anon` possui permissão irrestrita de `DELETE` e `UPDATE` sem autenticação ou chave de proteção.
   - Exposição de rotas no `local-server`: endpoints `/api/channels`, `/api/playlists/upload` e `/api/devices` não validam o `Bearer token` gerado no pareamento.
   - SSRF em Redirecionamentos HTTP (`redirect: 'follow'` no `local-server`) e falta de proxy na importação via URL no Manager.
   - Higiene do diretório local (arquivos sensíveis na raiz do workspace).

6. 📄 **[`06_PLANO_DE_ACAO_PRIORIZADO.md`](./06_PLANO_DE_ACAO_PRIORIZADO.md)**
   - Checklist executivo passo a passo ordenado por prioridade (**P0 Crítico**, **P1 Alto**, **P2 Médio**, **P3 Evolução**) para aplicar as correções com segurança sem quebrar o que já está funcionando na TV e na Vercel.

---

## 🎯 Resumo Executivo dos Achados (Visão Rápida)

| Dimensão | Status Atual | Principais Pontos que Precisam de Ajuste |
| :--- | :---: | :--- |
| **Banco de Dados (Supabase)** | ⚠️ Funcional com Gargalos | Falta RPC para agregar grupos/contagens (limite de 1000 linhas do PostgREST corta categorias em listas grandes); falta índice `pg_trgm` para busca `ILIKE`; faltam tabelas de EPG e Continue Watching. |
| **Integração TV ↔ Supabase** | 🔴 Parcialmente Quebrada | Favoritar canal na TV (`toggleInspectorFavorite`) e abrir o Guia EPG (`loadEpgTimeline`) ainda chamam o IP local `192.168.18.7:3001` em vez do Supabase. |
| **Deploy Vercel (WebApp)** | ⚠️ Requer Configuração Manual | `config.js` está no `.gitignore`, então o build da Vercel não inclui a `supabaseAnonKey` por padrão, exigindo digitar a chave manualmente ou injetar via variável de ambiente no `build.js`. |
| **Navegação Controle Remoto** | ⚠️ Incompleta em Subtelas | O Hub de 4 Cards e a Grade de Canais funcionam bem no D-Pad, mas o usuário não consegue navegar com as setas até o menu superior, tela de EPG, tela de Ajustes ou botões do HUD do player. |
| **Player de Vídeo & VOD** | ⚠️ Focado só em Live TV | Não possui barra de progresso/seek para avançar ou retroceder Filmes e Séries (`.mp4`), nem salva onde o usuário parou de assistir. |
| **Mini-Player PiP na TV** | 🔴 Desativado no Código | O elemento `<video id="pip-video-player">` existe no HTML do catálogo, mas nenhuma função no `app.js` carrega o stream nele. |
| **Persistência de Favoritos** | 🔴 Perde no Re-upload | O Manager gera IDs com `Math.random()` (`ch_xyz_0`) e usa `DELETE` antes de substituir a categoria, apagando todos os favoritos e renomeações feitas anteriormente. |
