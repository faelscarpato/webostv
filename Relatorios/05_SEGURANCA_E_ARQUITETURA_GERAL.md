# 🔒 Relatório 05: Auditoria de Segurança, Privacidade e Arquitetura Geral

> **Escopo Auditado:** [`supabase/schema.sql`](file:///D:/PROJETOS/iptv/supabase/schema.sql), [`apps/local-server/src/server.ts`](file:///D:/PROJETOS/iptv/apps/local-server/src/server.ts), [`packages/shared/src/ssrf.ts`](file:///D:/PROJETOS/iptv/packages/shared/src/ssrf.ts), [`apps/manager/index.html`](file:///D:/PROJETOS/iptv/apps/manager/index.html) e Raiz do Workspace (`D:\PROJETOS\iptv`).

---

## 1. Achados de Segurança no Banco de Dados (Supabase RLS & Exposição de URLs de Stream)

### 🔴 SEC-01: Políticas RLS (Row Level Security) totalmente abertas (`USING (true)`) para a role `anon`

- **Onde acontece ([`supabase/schema.sql` linhas 76–107](file:///D:/PROJETOS/iptv/supabase/schema.sql#L76-L107)):**
  ```sql
  CREATE POLICY "Permitir leitura publica de canais" ON public.iptv_channels FOR SELECT TO anon, authenticated, service_role USING (true);
  CREATE POLICY "Permitir insercao de canais" ON public.iptv_channels FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);
  CREATE POLICY "Permitir atualizacao de canais" ON public.iptv_channels FOR UPDATE TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  CREATE POLICY "Permitir delecao de canais" ON public.iptv_channels FOR DELETE TO anon, authenticated, service_role USING (true);
  ```
- **Risco Real:**
  1. Como o Painel Web está publicado na **Vercel (público na internet)** e a URL do projeto Supabase (`https://qzwunvyrozubfgwlkenh.supabase.co`) está visível no código-fonte de `apps/manager/index.html` (linha 637) e no repositório público do GitHub (`faelscarpato/webostv`), qualquer pessoa ou bot que descubra a `ANON_KEY` (ou acesse sua URL da Vercel) pode:
     - Ler toda a tabela `iptv_channels`, **extraindo todas as suas URLs de `stream_url` (que contêm seu usuário e senha do provedor de IPTV!)**.
     - Apagar todos os seus canais (`DELETE /rest/v1/iptv_channels`).
- **Como Corrigir (2 Camadas Simples e Eficazes):**
  1. **Camada 1 — Cabeçalho de Segredo Personalizado (PIN/Passcode Doméstico) no RLS do PostgreSQL:**
     O Supabase permite ler cabeçalhos HTTP customizados dentro das políticas RLS usando `current_setting('request.headers', true)::json->>'x-iptv-secret'`.
     Você pode definir uma senha/PIN pessoal (ex: `MinhaSenhaSecreta123`) que você digita uma única vez na TV e no Painel Web:
     ```sql
     -- Função que verifica se a requisição enviou o cabeçalho x-iptv-passcode correto
     CREATE OR REPLACE FUNCTION public.check_iptv_access()
     RETURNS BOOLEAN
     LANGUAGE sql
     STABLE
     AS $$
       SELECT COALESCE(
         (current_setting('request.headers', true)::json->>'x-iptv-passcode') = 'SEU_PIN_SECRETO_AQUI',
         false
       );
     $$;
     ```
     Com isso, **mesmo que alguém tenha a `ANON_KEY` e a URL do Supabase**, qualquer consulta sem o cabeçalho `x-iptv-passcode` retornará `0 linhas` e bloqueará `INSERT/UPDATE/DELETE`!
  2. **Camada 2 — Supabase Auth (Login com E-mail/Senha no Painel Web):**
     Restringir `INSERT`, `UPDATE` e `DELETE` apenas para a role `authenticated`, adicionando uma tela simples de login no `apps/manager`.

---

## 2. Achados de Segurança no Servidor Local (`apps/local-server`)

### 🟠 SEC-02: Tokens de Pareamento são gerados, mas nunca verificados nas rotas da API!

- **Onde acontece ([`apps/local-server/src/server.ts` linhas 138–292](file:///D:/PROJETOS/iptv/apps/local-server/src/server.ts#L138-L292) e [`storage.ts` linha 330](file:///D:/PROJETOS/iptv/apps/local-server/src/storage.ts#L330)):**
- **Diagnóstico:** A classe `LocalStorageManager` possui o método `validateDeviceToken(token)` (linha 330 de `storage.ts`) prontinho, e a TV envia `headers: { 'Authorization': 'Bearer ' + state.deviceToken }`. Porém, **nenhuma rota em `server.ts` chama `storage.validateDeviceToken()`**!
- Qualquer dispositivo na rede local pode chamar `GET /api/channels`, `POST /api/playlists/upload` ou `DELETE /api/devices/:id` sem enviar token algum.
- **Como Corrigir:** Adicionar a verificação do `Bearer token` nas rotas de leitura da TV (ou permitir acesso local do Manager via sessão/token administrativo).

---

### 🟠 SEC-03: Bypass de Anti-SSRF via Redirecionamento HTTP (`redirect: 'follow'`)

- **Onde acontece ([`apps/local-server/src/server.ts` linhas 188–194](file:///D:/PROJETOS/iptv/apps/local-server/src/server.ts#L188-L194)):**
  ```typescript
  const response = await fetch(targetUrl, {
    signal: controller.signal,
    headers: { 'User-Agent': 'IPTV-Local-Player/1.0' },
    redirect: 'follow',
  });
  ```
- **Diagnóstico:** O servidor faz uma excelente validação de URL e DNS antes do `fetch` (linhas 164–181). Porém, como passa `redirect: 'follow'` para o `fetch` nativo do Node.js, se um servidor externo malicioso (`https://site-publico.com/lista.m3u`) responder com um redirecionamento `HTTP 302 Found -> Location: http://192.168.18.1/admin` ou `http://169.254.169.254/latest/meta-data/`, o `fetch` segue o redirecionamento automaticamente **sem revalidar o novo destino contra `validateUrlPreflight` e `isRestrictedIP`**!
- **Como Corrigir:** Alterar para `redirect: 'manual'` dentro de um loop de até `3` redirecionamentos máximos, validando `validateUrlPreflight` e `dns.lookup` + `isRestrictedIP` em cada salto (`301`, `302`, `303`, `307`, `308`).

---

### 🟠 SEC-04: Sanitização de Logs Incompleta para URLs no Formato Xtream Codes

- **Onde acontece ([`packages/shared/src/ssrf.ts` linhas 107–116](file:///D:/PROJETOS/iptv/packages/shared/src/ssrf.ts#L107-L116)):**
  ```typescript
  export function sanitizeLog(text: string): string {
    if (!text) return '';
    return text
      .replace(/(https?:\/\/)([^:\s\/]+):([^@\s\/]+)@/gi, '$1$2:***REDACTED***@')
      .replace(/([?&](?:password|token|secret|key|auth|pass)=)([^&\s]+)/gi, '$1***REDACTED***')
      .replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1***REDACTED***');
  }
  ```
- **Diagnóstico:** A grande maioria dos servidores IPTV usa URLs no padrão Xtream Codes onde o usuário e a senha **vêm no path da URL**, e não na query string:
  - Exemplo Ao Vivo: `http://servidor.com:8080/live/meu_usuario/minha_senha/12345.m3u8`
  - Exemplo Filme: `http://servidor.com:8080/movie/meu_usuario/minha_senha/98765.mp4`
  - Exemplo Série: `http://servidor.com:8080/series/meu_usuario/minha_senha/54321.mp4`
  A função `sanitizeLog` atual **não mascara senhas nesse formato de path**!
- **Como Corrigir:** Adicionar a regra regex para paths Xtream Codes em `sanitizeLog`:
  ```typescript
  .replace(/(\/(?:live|movie|series)\/[^\/]+\/)([^\/]+)(\/)/gi, '$1***REDACTED***$3')
  ```

---

## 3. Higiene do Workspace e Arquivos Sensíveis na Raiz

Durante a inspeção da raiz do projeto (`D:\PROJETOS\iptv`), observamos os seguintes arquivos locais:
- `LOGINS _BLESSEDPLAYER_Hits.txt` (12.7 KB)
- `link_lista.txt` (662 bytes)
- `wagner123_playlist.m3u` (~62.6 MB) / `wagner123_playlist.txt` (~71.5 MB)
- `series.m3u` (~59 MB) / `series.txt` (~59 MB)
- `filmes.m3u` (~8.7 MB)
- `canais.m3u` (~131 KB) / `canais.txt` (~131 KB)
- `epg-br.xml` (~15.9 MB)

**Status no Git:**
- Felizmente, o seu [`.gitignore`](file:///D:/PROJETOS/iptv/.gitignore) **já bloqueia `*.m3u`, `*.txt`, `*.xml`, `.env` e `**/config.js`**, e confirmamos via `git ls-files` que **nenhum desses arquivos foi enviado ao GitHub**.
- **Recomendação de Organização:** Mova todas as suas listas `.m3u`, `.txt` e `.xml` da raiz para uma subpasta dedicada `D:\PROJETOS\iptv\uploads\` (que também já está no `.gitignore`). Isso evita que ferramentas de empacotamento, scripts de backup ou buscas globais na IDE travem lendo mais de **270 MB de arquivos de texto na raiz do projeto**.
