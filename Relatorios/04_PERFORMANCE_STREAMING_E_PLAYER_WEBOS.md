# 📡 Relatório 04: Performance de Streaming, Rede e Motor de Vídeo no webOS 25

> **Hardware Alvo:** Smart TV LG `43UA7500PSA.AWZFLJZ` (webOS 25 / SDK 10.3.2 / Firmware 33.31.80)  
> **Motor de Reprodução Auditado:** [`apps/webos-tv/js/app.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L645-L774) e [`apps/webos-tv/js/hls.min.js`](file:///D:/PROJETOS/iptv/apps/webos-tv/js/hls.min.js)

---

## 1. Diagnóstico do Motor de Reprodução Atual

O aplicativo na TV utiliza uma abordagem híbrida inteligente: **`Hls.js` (via Media Source Extensions - MSE)** com fallback para o player nativo HTML5 `<video>` da LG. No entanto, analisando a configuração atual do `Hls.js` e o ciclo de vida dos streams na TV, identificamos **6 gargalos técnicos** que podem causar travamentos (buffering infinito), falha ao abrir canais MPEG-TS/VOD e estouro de memória RAM na TV após algumas horas de uso.

---

### 🔴 Gargalo 1: Detecção Imperfeita de Formato de Stream (`.ts`, `.mp4`, `.mkv` e URLs sem extensão)

**Onde acontece ([`apps/webos-tv/js/app.js` linha 724](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L724)):**
```javascript
if (window.Hls && Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('live') || !streamUrl.includes('.mp4'))) {
```

**Por que isso causa falhas de reprodução no uso real:**
1. **Streams `.mkv` e `.avi` (Filmes/Séries VOD):** Muitos filmes e séries em listas M3U terminam em `.mkv` ou `.mp4`. Pela condição `!streamUrl.includes('.mp4')`, qualquer filme `.mkv` entra no `Hls.js`! O `Hls.js` tenta baixar o arquivo `.mkv` inteiro achando que é um manifesto texto `.m3u8`, falha com `MANIFEST_LOAD_ERROR` ou estoura a memória da TV!
2. **Streams MPEG-TS Contínuos (`.ts` ou `/live/user/pass/12345.ts`):** Muitos servidores Xtream Codes entregam streams ao vivo em formato `.ts` bruto contínuo (HTTP MPEG-TS progressive stream) e não `.m3u8`. O `Hls.js` **não toca streams `.ts` diretos sem manifesto `.m3u8`** (ele espera `#EXTM3U` no início da resposta). No webOS da LG, streams `.ts` diretos ou precisam ser convertidos na URL (trocando `.ts` por `.m3u8` no final da URL Xtream Codes) ou passados diretamente para o decoder de hardware nativo `<video src="...">` da LG!

**Solução Recomendada para Detecção de Protocolo na TV:**
```javascript
function detectStreamStrategy(rawUrl, contentType) {
  const url = rawUrl.trim();
  const lower = url.toLowerCase();

  // 1. Se for VOD (Filme/Série) com extensão de container direto (.mp4, .mkv, .avi, .mov)
  if (/\.(mp4|mkv|avi|mov|webm)(\?.*)?$/i.test(lower)) {
    return { engine: 'native', url };
  }

  // 2. Se for URL padrão Xtream Codes terminando em .ts (ex: http://host:port/live/u/p/123.ts ou http://host:port/u/p/123)
  // A maioria dos servidores aceita trocar .ts por .m3u8 para entregar HLS segmentado!
  if (lower.endsWith('.ts')) {
    return {
      engine: 'hls',
      url: url.replace(/\.ts$/i, '.m3u8'),
      fallbackNativeUrl: url // Se o .m3u8 der 404, tenta o .ts nativo no hardware da LG
    };
  }

  // 3. Se já contém .m3u8
  if (lower.includes('.m3u8')) {
    return { engine: 'hls', url };
  }

  // 4. Caso geral: se for Live TV tenta HLS com fallback automático para Nativo
  return {
    engine: contentType === 'live' ? 'hls' : 'native',
    url,
    fallbackNativeUrl: url
  };
}
```

---

### 🔴 Gargalo 2: Configuração de Buffer do `Hls.js` pode causar *Out-Of-Memory (OOM)* na TV LG

**Onde acontece ([`apps/webos-tv/js/app.js` linhas 726–733](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L726-L733)):**
```javascript
hlsInstance = new Hls({
  enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 30,
  manifestLoadingTimeOut: 10000,
  levelLoadingTimeOut: 10000,
  fragLoadingTimeOut: 15000,
});
```

**Análise de Performance no Hardware `K25LP_ATSC_BR` (LG 43UA7500PSA):**
1. **`lowLatencyMode: true` em IPTV comum:** O modo `lowLatencyMode` do `Hls.js` é projetado para **LL-HLS (Low-Latency HLS com Partial Segments de 0.2s)**. Provedores de IPTV tradicionais usam HLS padrão com segmentos de 4 a 10 segundos. Ativar `lowLatencyMode: true` em HLS normal faz o player tentar reproduzir colado na borda do último segmento disponível; qualquer oscilação de 500ms na internet faz o vídeo engasgar (*micro-stuttering* / *rebuffering*).
2. **Limite de Buffer Forward (`maxBufferLength` e `maxMaxBufferLength`):** Por padrão no `Hls.js`, `maxMaxBufferLength` é **600 segundos (10 minutos)**. Em um canal Full HD / 4K de alto bitrate (8 a 15 Mbps), 10 minutos de vídeo em RAM dentro do MSE do Chromium da TV consomem mais de **600 MB de RAM**, fazendo o webOS matar o aplicativo repentinamente (voltando para a Home da TV).

**Configuração Ideal de `Hls.js` para Smart TV LG webOS:**
```javascript
hlsInstance = new Hls({
  enableWorker: true,
  lowLatencyMode: false,            // Desativar para evitar engasgos em servidores IPTV padrão
  backBufferLength: 15,             // Manter apenas 15s de histórico na RAM da TV
  maxBufferLength: 20,              // Buffer alvo de 20s à frente (equilíbrio entre fluidez e RAM)
  maxMaxBufferLength: 45,           // Teto estrito de 45s na RAM para nunca causar crash OOM na TV
  maxBufferSize: 35 * 1000 * 1000,  // Limite máximo de 35 MB de buffer MSE na memória da TV
  maxBufferHole: 0.5,               // Pula pequenos buracos de timestamp em streams mal encodados
  liveSyncDurationCount: 3,         // Mantém 3 segmentos de margem segura no ao vivo
   liveMaxLatencyDurationCount: 8,   // Se atrasar mais de 8 segmentos, ressincroniza suave
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 3,
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 3,
  fragLoadingTimeOut: 15000,
  fragLoadingMaxRetry: 4,
});
```

---

### 🔴 Gargalo 3: Falta de Fallback Automático para o Player Nativo da LG quando o `Hls.js` falha por CORS

**O que acontece no uso real:**
- O `Hls.js` usa `fetch` / `XMLHttpRequest` via JavaScript para baixar os arquivos `.m3u8` e `.ts`. Por usar XHR/Fetch, o Chromium do webOS aplica verificação de **CORS (`Access-Control-Allow-Origin`)** se o aplicativo estiver em contexto web ou se o servidor de stream redirecionar sem cabeçalhos CORS.
- Já a tag nativa `<video src="http://...">` da LG **NÃO sofre restrição de CORS** (a menos que tenha o atributo `crossorigin`) e usa o decodificador de hardware direto do SoC da TV (`Starfish Media Pipeline` da LG)!
- Hoje, nas linhas 756–760 de `app.js`:
  ```javascript
  default:
    if (streamTimeout) clearTimeout(streamTimeout);
    showLoading(false);
    showError(`Falha na transmissão: ${data.details || 'Stream indisponível'}`);
    break;
  ```
  Quando o `Hls.js` encontra um erro fatal (por exemplo, bloqueio de CORS no manifesto ou stream `.ts` contínuo), ele exibe imediatamente a tela de erro em vez de **tentar automaticamente reproduzir no player nativo `<video src="...">` da TV antes de desistir**!

**Solução:** No bloco `default` de erro fatal do `Hls.js`, destruir o `hlsInstance` e tentar `dom.videoPlayer.src = streamUrl; dom.videoPlayer.play();` como segunda chance transparente para o usuário.

---

### 🟠 Gargalo 4: Loop Infinito de Reconexão em Erros de Rede Fatais (`Hls.ErrorTypes.NETWORK_ERROR`)

- **Onde acontece ([`apps/webos-tv/js/app.js` linhas 749–751](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L749-L751)):**
  ```javascript
  case Hls.ErrorTypes.NETWORK_ERROR:
    hlsInstance.startLoad();
    break;
  ```
- **Problema:** Se um canal estiver realmente fora do ar (`HTTP 404` ou `403 Forbidden`), o `Hls.js` emite `NETWORK_ERROR` fatal. O código atual chama `hlsInstance.startLoad()` infinitamente sem contador de tentativas, inundando o servidor de stream de requisições até o watchdog de 15s estourar — e se o erro ocorrer *após* o canal já ter começado a tocar (quando `streamTimeout` já foi limpo na linha 649), a TV fica congelada no último frame tentando `startLoad()` para sempre sem mostrar aviso!
- **Solução:** Limitar a 2 tentativas de `startLoad()` e, se falhar na 3ª vez, acionar o fallback para o player nativo ou exibir a tela de erro.

---

### 🟠 Gargalo 5: Dependência de CDN Externo no App Instalado na TV (`Tailwind CDN` e `Google Fonts`)

- **Onde acontece ([`apps/webos-tv/index.html` linhas 9–16](file:///D:/PROJETOS/iptv/apps/webos-tv/index.html#L9-L16)):**
  ```html
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono...&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined..." rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  ```
- **Impacto na Performance de Inicialização da TV:**
  1. Toda vez que você abre o app na TV LG, o navegador interno precisa baixar o script compilador JIT do Tailwind (`cdn.tailwindcss.com`, ~400 KB de JS) e compilar todas as classes CSS em tempo de execução no processador da TV, além de baixar a fonte de ícones `Material Symbols Outlined` da Google.
  2. Isso adiciona **1,5 a 3 segundos** no tempo de abertura do app na TV e causa um breve *Flash of Unstyled Content (FOUC)*.
  3. Se a internet oscilar no momento de abrir o app (mesmo que o servidor local na LAN esteja ativo), **a interface inteira da TV quebra** (fica sem CSS e os ícones viram palavras em texto puro como `live_tv`, `star`, `arrow_back`).
- **Solução Recomendada:** Compilar o CSS do Tailwind durante o `npm run build:tv` para um arquivo local `css/tailwind.min.css` empacotado dentro do `.ipk` e incluir a fonte `Material-Symbols-Outlined.woff2` em `apps/webos-tv/assets/fonts/`.

---

### 🟠 Gargalo 6: Watchdog Timer de 15s não é cancelado se o usuário mudar de tela pelo menu superior

- **Onde acontece ([`apps/webos-tv/js/app.js` linhas 305–348](file:///D:/PROJETOS/iptv/apps/webos-tv/js/app.js#L305-L348)):**
- Se o usuário iniciar a reprodução de um canal lento e clicar em "Início (Hub)" ou "Catálogo" pelo topo (que chama `switchToView('hub')` direto sem passar por `stopPlayerAndReturn()`), o vídeo continua tentando carregar em segundo plano e, 15 segundos depois, o `streamTimeout` dispara e abre o modal de erro `"O canal demorou mais de 15 segundos"` em cima do Hub inicial!
- **Solução:** Dentro de `switchToView(viewName)`, se `viewName !== 'player'`, chamar sempre a rotina de limpeza do player (`cleanupPlayer()`).
