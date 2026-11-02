# 🐛 Relatório 02: Bugs Atuais Confirmados e Correções para Uso Real

> **Escopo:** Inspeção linha a linha de [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js), [`apps/webos-tv/index.html`](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html), [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html), [`apps/manager/build.js`](file:///D:/PROJETOS/iptv/apps/manager/build.js) e [`apps/local-server/src/server.ts`](file:///D:/PROJETOS/iptv/apps/local-server/src/server.ts).

---

## Resumo dos 14 Bugs Identificados

| ID | Severidade | Componente | Resumo do Bug |
| :--- | :---: | :--- | :--- |
| **BUG-01** | 🔴 Crítico | TV (`app.js`) | Botão de Favoritar na TV (Inspector, Player e Tecla Vermelha) chama apenas `local-server` e **não salva no Supabase**. |
| **BUG-02** | 🔴 Crítico | TV (`app.js`) | Guia EPG na TV (`loadEpgTimeline`) ignora o Supabase e tenta buscar de `http://192.168.18.7:3001`, falhando quando o PC está desligado. |
| **BUG-03** | 🔴 Crítico | Manager (`build.js`) | `config.js` está no `.gitignore`; o deploy na Vercel retorna `404` para `config.js` e inicia com `supabaseKey = ''`. |
| **BUG-04** | 🔴 Crítico | Manager (`index.html`) | IDs de canais gerados com `Math.random()` + `DELETE` total na substituição **apagam todos os favoritos e renomeações** a cada atualização de lista. |
| **BUG-05** | 🔴 Crítico | TV & Manager | `loadGroups()` sofre truncamento silencioso em 1.000 itens no Supabase (categorias desaparecem em listas grandes). |
| **BUG-06** | 🟠 Alto | TV (`app.js`) | O Mini-Player PiP (`<video id="pip-video-player">`) no painel direito do catálogo **nunca é inicializado** no código JS. |
| **BUG-07** | 🟠 Alto | Manager (`index.html`) | Nomes de canais com aspas duplas (`"`), apóstrofos (`'`) ou HTML quebram os botões de ação e permitem injeção de DOM no painel. |
| **BUG-08** | 🟠 Alto | Manager (`index.html`) | Parser M3U do painel usa `line.lastIndexOf(',')`, cortando nomes de canais/filmes que possuem vírgula no título (ex: `"Monstros S.A., O Filme"` vira `"O Filme"`). |
| **BUG-09** | 🟠 Alto | Manager (`index.html`) | Importação de M3U via URL faz `fetch(url)` direto pelo navegador, falhando em 95% dos provedores IPTV por bloqueio de **CORS** ou **Mixed Content (HTTPS → HTTP)**. |
| **BUG-10** | 🟠 Alto | Manager (`index.html`) | Botão `"Gerar Novo PIN"` chama a rota errada (`/api/pairing/pin` em vez de `/api/devices/pair/request`) e com IP hardcoded `192.168.18.7`. |
| **BUG-11** | 🟡 Médio | TV (`app.js`) | Clicar em um canal dentro do Guia EPG chama `playChannelByObject(state.channels[i], i)`, tocando o canal errado se a lista de EPG diferir da página atual do catálogo. |
| **BUG-12** | 🟡 Médio | TV (`app.js`) | Digitar número do canal no controle remoto (`numericBuffer`) só funciona de `1` a `20` (itens da página atual), ignorando canais de outras páginas (ex: canal `045`). |
| **BUG-13** | 🟡 Médio | TV (`app.js`) | Nos cards do catálogo da TV, `ch.tvgName` aparece sempre como `'Transmissão Ao Vivo'` porque `loadCatalogChannels()` esqueceu de mapear `tvgName: c.tvg_name`. |
| **BUG-14** | 🟡 Médio | Manager (`index.html`) | `fetchChannelsPage()` no Manager não filtra `is_hidden=eq.false`, enquanto `loadCounts()` filtra — causando divergência entre o contador do topo e a paginação. |

---

## Detalhamento Técnico e Código de Correção

---

### 🔴 BUG-01: Favoritar Canal na TV não funciona com o Supabase

- **Localização:** [`apps/webos-tv/js/app.js` linhas 824–837](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L824-L837)
- **Código Atual com Defeito:**
  ```javascript
  async function toggleInspectorFavorite() {
    if (!state.selectedChannel) return;
    const ch = state.selectedChannel;
    const newFav = !ch.isFavorite;

    await fetch(`${state.serverUrl}/api/channels/${ch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: newFav }),
    });

    ch.isFavorite = newFav;
    renderChannelsMatrix();
  }
  ```
- **O que acontece no uso real:** Quando você aperta a **Tecla Vermelha** do controle da LG ou clica na estrela de Favorito no Player/Catálogo com o PC desligado, o `fetch` para `http://192.168.18.7:3001` falha com erro de rede (`ERR_CONNECTION_REFUSED`). Como não há `try/catch`, a função lança uma exceção não tratada (`Uncaught (in promise) TypeError: Failed to fetch`), **não atualiza o Supabase** e nem sequer atualiza o ícone de estrela na tela!
- **Como Corrigir:**
  ```javascript
  async function toggleInspectorFavorite() {
    if (!state.selectedChannel) return;
    const ch = state.selectedChannel;
    const newFav = !ch.isFavorite;

    try {
      const res = await fetchFromSupabase(`iptv_channels?id=eq.${encodeURIComponent(ch.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFav }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn('Fallback para servidor local ao favoritar:', err);
      try {
        await fetch(`${state.serverUrl}/api/channels/${encodeURIComponent(ch.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: newFav }),
        });
      } catch (e) {
        console.error('Falha ao salvar favorito:', e);
      }
    }

    ch.isFavorite = newFav;
    renderChannelsMatrix();
    loadHubCounts(); // Atualiza contador do Card 4 (Favoritos)
  }
  ```

---

### 🔴 BUG-02: Guia EPG na TV (`loadEpgTimeline`) não consulta o Supabase

- **Localização:** [`apps/webos-tv/js/app.js` linhas 875–909](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L875-L909)
- **Código Atual com Defeito:**
  ```javascript
  async function loadEpgTimeline() {
    dom.epgTimelineContainer.innerHTML = '...';
    try {
      const headers = { 'Authorization': `Bearer ${state.deviceToken}` };
      const res = await fetch(`${state.serverUrl}/api/channels?limit=15`, { headers });
  ```
- **O que acontece no uso real:** Ao apertar a **Tecla Verde** no controle remoto para abrir o Guia EPG, a TV tenta conectar no servidor local (`192.168.18.7:3001`). Se você estiver usando apenas o Supabase, a tela exibe `"Falha ao carregar EPG: Failed to fetch"`. Além disso, o horário `"18:00 - 20:00 · Transmissão Principal"` está fixo (hardcoded) na linha 899!
- **Como Corrigir:** Buscar os canais de `live` diretamente do Supabase (`iptv_channels?content_type=eq.live&is_hidden=eq.false&limit=20`) e cruzar com a nova tabela `iptv_epg_programmes` (detalhada no Relatório 01).

---

### 🔴 BUG-03: `config.js` ausente no Deploy da Vercel (Credenciais Vazias em Produção)

- **Localização:** [`.gitignore` linha 22](file:///D:/PROJETOS/iptv/.gitignore#L22), [`apps/manager/build.js` linhas 12–20](file:///D:/PROJETOS/iptv/apps/manager/build.js#L12-L20) e [`apps/manager/index.html` linhas 637–638](file:///D:/PROJETOS/iptv/apps/manager/index.html#L637-L638)
- **O que acontece no uso real:**
  1. O arquivo `config.js` está listado no `.gitignore` (`**/config.js`), portanto **não sobe para o GitHub**.
  2. Quando a Vercel faz o clone do GitHub e roda `node build.js`, o arquivo `apps/manager/config.js` não existe no container de build da Vercel.
  3. O `<script src="config.js"></script>` no navegador falha com `404 Not Found`.
  4. Em `index.html`:
     ```javascript
     let supabaseUrl = localStorage.getItem('iptv_supabase_url') || cfg.supabaseUrl || 'https://qzwunvyrozubfgwlkenh.supabase.co';
     let supabaseKey = localStorage.getItem('iptv_supabase_key') || cfg.supabaseAnonKey || '';
     ```
     Se o usuário abrir a URL da Vercel em um celular novo ou aba anônima (onde `localStorage` está vazio), `supabaseKey` será `''` (vazio) e o painel exibirá **Supabase Offline (HTTP 401)** até que o usuário copie e cole a Anon Key manualmente na aba "Deploy & Supabase"!
- **Como Corrigir em [`apps/manager/build.js`](file:///D:/PROJETOS/iptv/apps/manager/build.js):**
  Se `config.js` não existir durante o build na Vercel, o `build.js` deve gerá-lo automaticamente a partir das variáveis de ambiente da Vercel (`process.env.SUPABASE_URL` e `process.env.SUPABASE_ANON_KEY`):
  ```javascript
  // Adicionar ao final de apps/manager/build.js:
  const destConfig = path.join(outDir, 'config.js');
  if (!fs.existsSync(destConfig)) {
    const envUrl = process.env.SUPABASE_URL || 'https://qzwunvyrozubfgwlkenh.supabase.co';
    const envKey = process.env.SUPABASE_ANON_KEY || '';
    fs.writeFileSync(
      destConfig,
      `window.IPTV_CONFIG = {\n  supabaseUrl: ${JSON.stringify(envUrl)},\n  supabaseAnonKey: ${JSON.stringify(envKey)}\n};\n`,
      'utf-8'
    );
    console.log('Generated public/config.js from environment variables.');
  }
  ```

---

### 🔴 BUG-04: Perda Total de Favoritos e Customizações ao Atualizar Playlist no Painel

- **Localização:** [`apps/manager/index.html` linhas 977 e 1015–1018](file:///D:/PROJETOS/iptv/apps/manager/index.html#L977)
- **Código Atual com Defeito:**
  ```javascript
  pending.id = 'ch_' + Math.random().toString(36).substring(2, 11) + '_' + items.length;
  ```
  E no upload com modo `"Substituir Conteúdo"`:
  ```javascript
  if (replaceMode) {
    await fetchSupabase(`iptv_channels?content_type=eq.${currentSelectedType}`, { method: 'DELETE' });
  }
  ```
- **O que acontece no uso real:**
  1. Como o ID usa `Math.random()`, o mesmo canal (`"Globo HD"`) recebe um ID diferente toda vez que o arquivo M3U é processado. Assim, o cabeçalho `'Prefer': 'resolution=merge-duplicates'` na linha 1036 **nunca faz merge de nada** — no modo "Mesclar", ele duplica todos os canais!
  2. No modo "Substituir", ele executa um `DELETE` em todos os canais da categoria, **apagando todos os favoritos (`is_favorite`), canais ocultos (`is_hidden`) e nomes editados** que você configurou com tanto trabalho!
- **Como Corrigir:**
  1. Usar uma função de hash determinístico baseada em `content_type + original_name + stream_url` (ou `tvg_id + original_name`) em vez de `Math.random()`, exatamente como já existe em [`packages/shared/src/m3u.ts`](file:///D:/PROJETOS/iptv/packages/shared/src/m3u.ts#L14-L23).
  2. Antes de deletar no modo `replace`, buscar os IDs (ou `original_name`) que estão com `is_favorite=true` ou `is_hidden=true` no Supabase e reaplicar esses estados nos novos itens antes do `POST`!

---

### 🟠 BUG-06: Mini-Player PiP no Catálogo da TV está Morto (Nunca Toca)

- **Localização:** [`apps/webos-tv/index.html` linha 274](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html#L274) e [`apps/webos-tv/js/app.js` linhas 611–636](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L611-L636)
- **Diagnóstico:** No HTML do catálogo existe `<video id="pip-video-player" class="w-full h-full object-cover" muted playsinline></video>`, mas em `app.js` **não há nenhuma referência a `pip-video-player`**. O painel direito mostra apenas o ícone cinza de TV estático.
- **Como Corrigir (com Segurança para não Travar a TV):**
  - **Importante:** Não inicie o PiP imediatamente a cada movimento de seta (`updateInspectorDetails`), pois se o usuário segurar a seta para baixo passando por 10 canais em 2 segundos, a TV criará 10 instâncias HLS e travará!
  - Use um **Debounce de 1.200ms** quando o foco parar sobre um canal ao vivo (`live`), ou exiba o poster/logo (`channel.logoUrl`) em alta definição no quadro de preview para Filmes/Séries, iniciando o preview de vídeo apenas após 1.2s de foco parado (e destruindo a instância HLS do PiP antes de abrir o player em tela cheia).

---

### 🟠 BUG-07 & BUG-08: Quebra de HTML/JS por Aspas e Corte de Nomes com Vírgula no Painel Web

- **Localização:** [`apps/manager/index.html` linhas 811–830 e 957–958](file:///D:/PROJETOS/iptv/apps/manager/index.html#L811-L830)
- **Problema 1 (Linha 825):**
  ```javascript
  <button class="icon-btn" title="Renomear" onclick="renameItem('${c.id}', '${c.name.replace(/'/g, "\\'")}')">✏️</button>
  ```
  Se o nome do filme ou série contiver aspas duplas (ex: `Velozes & Furiosos "Hobbs & Shaw"`), o atributo `onclick="..."` fecha prematuramente no HTML, quebrando o botão de renomear e a renderização do card!
- **Problema 2 (Linha 957):**
  ```javascript
  const commaIdx = line.lastIndexOf(',');
  const name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Canal Sem Nome';
  ```
  Como usa `lastIndexOf(',')`, se o título do canal ou filme tiver uma vírgula (ex: `#EXTINF:-1 group-title="Filmes",Eu, Robô (2004)`), o painel corta tudo antes da última vírgula e salva o filme apenas como `"Robô (2004)"`!
- **Como Corrigir:**
  - Para separar os atributos `#EXTINF:` do nome do canal, encontrar a **primeira vírgula fora de aspas** (ou usar regex `/^#EXTINF:[-0-9.]+\s*(?:[a-zA-Z0-9_-]+="[^"]*"\s*)*,(.*)$/`).
  - Criar uma função `escapeHtml(str)` no Manager e passar apenas o `id` no `onclick="renameItem('${c.id}')"`, buscando o nome atual em `currentChannels.find(x => x.id === id)`.

---

### 🟠 BUG-09: Importação por URL no Manager (`importM3UUrlToSupabase`) falha por CORS e falta de barra de progresso

- **Localização:** [`apps/manager/index.html` linhas 1059–1087](file:///D:/PROJETOS/iptv/apps/manager/index.html#L1059-L1087)
- **Diagnóstico:**
  1. A função faz `const res = await fetch(url);` diretamente no navegador. Provedores de listas M3U raramente enviam o cabeçalho `Access-Control-Allow-Origin: *`, fazendo o navegador bloquear o download por **CORS**. Além disso, como o painel na Vercel roda em **HTTPS**, o navegador bloqueia qualquer URL de lista **HTTP** por política de *Mixed Content*.
  2. Ao contrário do upload de arquivo, `importM3UUrlToSupabase` não verifica o modo `replaceMode` (Substituir vs. Mesclar) e não atualiza a barra de progresso visual.
- **Como Corrigir:**
  - Adicionar uma **Serverless Function na Vercel (`api/proxy-m3u.js`)** protegida pelo validador Anti-SSRF (`packages/shared/src/ssrf.ts`) ou uma **Supabase Edge Function** para baixar a lista no servidor e entregá-la ao navegador sem bloqueio de CORS/Mixed Content, e unificar a função de envio em lotes com `uploadM3UFileToSupabase`.

---

### 🟡 BUG-10, BUG-12 e BUG-13: Ajustes Rápidos de Integração

1. **Rota de PIN incorreta no Manager ([`apps/manager/index.html` linha 1107](file:///D:/PROJETOS/iptv/apps/manager/index.html#L1107)):**
   - Está chamando `POST http://192.168.18.7:3001/api/pairing/pin`, mas no [`apps/local-server/src/server.ts` linha 295](file:///D:/PROJETOS/iptv/apps/local-server/src/server.ts#L295) a rota real é `POST /api/devices/pair/request`.
2. **Atalho Numérico de Canal na TV ([`apps/webos-tv/js/app.js` linhas 1083–1086](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L1083-L1086)):**
   - Quando você digita `045` no controle remoto, `targetNum = 45`. Como `state.channels.length` é `20` (limite da página), `targetNum <= state.channels.length` dá `false` e nada acontece!
   - **Correção:** Calcular a página onde está o canal `targetNum`:
     ```javascript
     const targetPage = Math.ceil(targetNum / state.catalogLimit);
     const indexInPage = (targetNum - 1) % state.catalogLimit;
     if (targetPage !== state.catalogPage) {
       state.catalogPage = targetPage;
       await loadCatalogChannels();
     }
     if (indexInPage < state.channels.length) {
       state.channelIndex = indexInPage;
       updateChannelFocus();
     }
     ```
3. **Mapeamento de `tvgName` ausente na TV ([`apps/webos-tv/js/app.js` linhas 471–480](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L471-L480)):**
   - Adicionar `tvgName: c.tvg_name,` e `contentType: c.content_type,` no `.map()` de `loadCatalogChannels()`.
