# 🎨 Relatório 03: Auditoria Completa de UI/UX (TV LG 10-Foot & Painel Web)

> **Arquivos Auditados:** [`DESIGN.md`](file:///D:/PROJETOS/iptv/DESIGN.md), [`apps/webos-tv/index.html`](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html), [`apps/webos-tv/css/app.css`](file:///D:/PROJETOS/iptv/apps/webos-tv/css/app.css), [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js) e [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html).

---

## Parte 1: Auditoria UI/UX do Aplicativo da TV LG (`apps/webos-tv`)

A direção estética escolhida (**Cinematic Lumina 10-Foot UI**) é excelente: fundo escuro (`#0a0e19`), alto contraste, anel de foco ciano (`#00d2ff`) com brilho neon e o Hub Inicial de 4 Cards trouxeram uma experiência visual digna de plataformas de streaming modernas.

Contudo, ao testar todos os fluxos de interação **usando exclusivamente as setas direcionais (D-Pad) do controle remoto da LG** (sem usar o ponteiro do Magic Remote), identificamos **8 falhas críticas de usabilidade e ergonomia**:

---

### 🔴 1. "Ilhas Inacessíveis" pelo D-Pad (Falta de Spatial Navigation Completa)

No código atual ([`apps/webos-tv/js/app.js` linhas 1091–1169](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L1091-L1169)), o evento `handleKeyDown` só move o foco entre os 4 cards do Hub (`view === 'hub'`) ou entre os cards de canais (`view === 'catalog'`). **Não é possível chegar com as setas do controle remoto nos seguintes elementos:**
1. **Menu de Navegação Superior (`Início`, `Catálogo`, `Player`, `Guia EPG`, `Ajustes`):** Embora tenham a classe `.focusable`, apertar a seta `▲ (Cima)` quando você está no Hub ou na primeira linha de canais **não sobe o foco para a barra de navegação do topo**.
2. **Trilho de Categorias (`#category-rail`):** Quando o usuário está na linha `0` da grade de canais e aperta `▲ (Cima)` (linhas 1153–1156):
   ```javascript
   } else {
     // Jump to category rail
     state.categoryIndex = Math.max(0, state.categoryIndex - 1);
     updateCategorySelection();
   }
   ```
   Em vez de subir o foco para o trilho de categorias para que o usuário navegue com `◄` / `►` e aperte `OK`, o código apenas volta uma categoria para trás sem recarregar os canais (`loadCatalogChannels()` nem é chamado ali!).
3. **Troca acidental de Categoria ao navegar na Grade de 2 Colunas (Linhas 1127–1147):**
   - Na grade de 2 colunas, quando o foco está na coluna da esquerda (`channelIndex % 2 === 0`) e o usuário aperta `◄`, o código **troca imediatamente de categoria inteira** e recarrega a lista! O mesmo acontece ao apertar `►` na coluna da direita (`channelIndex % 2 === 1`).
   - **Impacto UX:** No uso real, o usuário aperta `►` achando que vai para o painel da direita (Inspector / botão Favoritar / Assistir em Tela Cheia) ou aperta `◄` uma vez a mais sem querer e perde a categoria em que estava navegando, gerando enorme frustração.
4. **Tela de Guia EPG (`view-epg`) e Tela de Servidor (`view-server`):** Não possuem nenhum tratamento em `handleKeyDown`! Se o usuário entrar em "Guia EPG" ou "Ajustes" usando apenas as setas do controle, as setas `▲▼◄►` e `OK` não fazem absolutamente nada.
5. **Controles do HUD do Player em Tela Cheia (`view-player`):** Quando o vídeo está tocando e o usuário aperta `OK`, o HUD aparece com os botões `Voltar`, `Anterior`, `Play/Pause`, `Próximo`, `Favoritar` e `Lista de Canais`. Porém, as setas `◄` e `►` não navegam entre esses botões (apertar `◄` fecha o player imediatamente na linha 1108!).

---

### 🔴 2. Falta de Busca e Teclado Virtual na TV

- **Problema:** Quando o usuário entra em **Filmes** (ex: 12.000 títulos) ou **Séries** (ex: 30.000 episódios), não existe um botão ou barra de **Busca (`🔍 Buscar Filme/Canal`)** na TV. Rolar de 20 em 20 itens pelo controle remoto para achar um filme específico é inviável.
- **Melhoria Recomendada:** Adicionar um botão focável `🔍 Buscar` ao lado do seletor de categorias que abre um teclado rápido na tela (grade compacta `A-Z`, `0-9`, `Espaço`, `Apagar`) operável pelo D-Pad ou pelo teclado nativo do webOS (`<input type="text">`) consultando o índice Trigram do Supabase em tempo real.

---

### 🔴 3. Experiência de Filmes e Séries (VOD) tratada igual a Canal Ao Vivo

Atualmente, quando o usuário abre **Filmes** ou **Séries**:
1. **Rótulos incorretos nos Cards:** Todos os cards de Filmes e Séries exibem a tag `"HLS"`, a bolinha vermelha `"Transmissão Ao Vivo"` e uma **barra de progresso falsa travada em `65%`** (`<div class="bg-primary h-full rounded-full" style="width: 65%;"></div>` na linha 584 de `app.js`).
2. **Formato do Card:** Filmes e Séries usam capas verticais (proporção **2:3 Poster**, ex: `300x450`), mas na grade atual são espremidos em uma miniatura quadrada de `40x40px` (`w-10 h-10`).
3. **Falta de Controles de VOD no Player:** Ao assistir a um Filme ou Episódio de Série:
   - Não há barra de tempo (Scrubber / Seek Bar) mostrando `00:42:15 / 01:58:00`.
   - Não há suporte para avançar/retroceder (`◄◄ -10s` / `►► +30s`) com as setas esquerda/direita do controle.
   - O HUD do Player mostra `"AO VIVO"` e `"CH 001"` mesmo durante um filme sob demanda.
4. **Séries sem Agrupamento por Temporadas:** Listas M3U de séries trazem centenas de linhas como `Breaking Bad S01E01`, `Breaking Bad S01E02`, etc. Na UI atual, cada episódio ocupa um card separado na lista principal.
   - **Melhoria Recomendada:** Agrupar automaticamente pelo nome base da série (ex: `Breaking Bad`) e, ao clicar na série, exibir o seletor de **Temporada 1, Temporada 2...** e a lista de **Episódios**.

---

### 🟠 4. Inconsistência na Legenda das 4 Teclas Coloridas (`DESIGN.md` vs `index.html`)

- No rodapé da TV ([`apps/webos-tv/index.html` linhas 476–493](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html#L476-L493)):
  - 🔴 `[Vermelho]` Favoritar
  - 🟢 `[Verde]` Guia EPG
  - 🟡 `[Amarelo]` Só Favoritos
  - 🔵 `[Azul]` Servidor Local
- **Problema:** Quando o usuário aperta **Amarelo (`Só Favoritos`)**, `state.isOnlyFavorites` muda para `true`, mas **não há nenhum indicador visual ativo no botão Amarelo ou no topo do catálogo** avisando que o filtro "Só Favoritos" está ligado! Se a categoria atual não tiver favoritos, a lista fica vazia ("Nenhum canal encontrado") e o usuário acha que os canais sumiram.

---

## Parte 2: Auditoria UI/UX do Painel Web (`apps/manager`)

O Painel Web em [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html) é rápido, limpo e direto ao ponto, especialmente com o seletor visual de 3 cards na aba de importação. No entanto, para gerenciar listas grandes no celular ou computador, apresenta **7 pontos críticos de melhoria**:

### 1. Falta de Ações em Lote (Bulk Actions) e Gerenciamento de Categorias Inteiras
- **Problema:** Se uma playlist importada tiver 80 categorias (incluindo 20 categorias que você não quer ver na TV, como canais internacionais ou adultos), hoje você teria que ocultar **canal por canal** (clicando milhares de vezes em `🚫`).
- **Melhoria:** Adicionar uma sub-aba ou modal **"Gerenciar Categorias/Grupos"** onde o usuário possa ocultar/exibir ou excluir uma **categoria inteira (`group_title`)** com 1 único clique (`UPDATE iptv_channels SET is_hidden = true WHERE group_title = '...'`).

### 2. Falta de Filtro de Visibilidade (Ver Ocultos vs. Visíveis)
- **Problema:** Quando você oculta um canal (`🚫`), ele fica apenas com `opacity: 0.45` na lista, mas **não existe um filtro "Mostrar Apenas Ocultos" ou "Ocultar Itens Inativos"**. Além disso, o contador no topo soma apenas `is_hidden = false`, enquanto a lista embaixo mostra todos (`is_hidden = true` e `false`), confundindo a contagem.

### 3. Falta de Preview de Vídeo / Teste de Stream no Painel Web
- **Problema:** Ao organizar canais pelo PC ou celular, o usuário não sabe qual canal está funcionando (online) ou qual é FHD/HD/SD sem ir até a TV.
- **Melhoria:** Adicionar um botão `▶️ Testar` em cada linha do painel que abre um mini modal com player HTML5/`Hls.js` para testar o stream diretamente no navegador antes de favoritá-lo.

### 4. Uso de `prompt()`, `confirm()` e `alert()` nativos do navegador
- **Problema:** Para renomear um canal (linha 899), o painel usa `prompt('Novo nome...')`. Além de ter aparência datada e bloquear a thread do navegador no celular, não permite editar outros campos importantes do item ao mesmo tempo, como **mudar a Categoria (`group_title`)**, **alterar a URL do Logo (`logo_url`)** ou **ajustar o `tvg_id` do EPG**.
- **Melhoria:** Substituir o `prompt()` por um **Modal de Edição Rápida** (Nome, Categoria, URL do Logo, TVG-ID e Ordem).

### 5. Ausência de Upload de EPG (XMLTV) para o Supabase
- **Problema:** O projeto possui um parser XMLTV pronto em [`packages/shared/src/xmltv.ts`](file:///D:/PROJETOS/iptv/packages/shared/src/xmltv.ts) e um arquivo `epg-br.xml` na raiz, mas **o Painel Web (`apps/manager/index.html`) não tem nenhuma aba ou campo para importar o arquivo XMLTV/EPG para o Supabase**!

### 6. Falta de Feedback Otimista (Optimistic UI) nos Botões de Ação
- **Problema:** Quando o usuário clica na estrela `⭐` para favoritar um canal no painel (linha 879), a UI fica parada esperando o `PATCH` no Supabase + `loadCounts()` + `fetchChannelsPage()` (3 viagens de rede!) para só então pintar a estrela de amarelo.
- **Melhoria:** Alternar a classe `.active-fav` instantaneamente no clique (Optimistic UI) e atualizar o banco em background, deixando o painel com resposta imediata (0ms de percepção).

### 7. Responsividade Mobile nos Cards de Canais
- **Problema:** Em telas de celular (`< 480px`), `.channel-name` tem `max-width: 380px` e `.channel-item` coloca logo, título, tags e 4 botões de ação na mesma linha horizontal sem `flex-wrap`, comprimindo os botões para fora do card em smartphones menores.
