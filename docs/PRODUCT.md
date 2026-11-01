# IPTV Local - Visão Geral do Produto e Escopo

## 1. Propósito
O **IPTV Local** é uma solução privada e de rede local composta por:
1. **App webOS para TV LG:** Player de IPTV otimizado para controle remoto (10-foot UI) com navegação fluida em grupos, canais, favoritos, guia de programação (EPG) e reprodução de streams autorizados (HLS).
2. **Painel Web de Administração (Manager):** Interface web responsiva para desktop e smartphone para carregar playlists M3U/M3U8 locais ou remotas (com proteção SSRF), organizar grupos, favoritar canais, mapear fontes EPG e autorizar pareamento de TVs.
3. **Serviço Local (Local Server):** Backend executado em um computador doméstico da LAN que armazena as playlists, organiza metadados, sincroniza estado com a TV e realiza proxy/parsing seguro sem depender de serviços em nuvem ou expor portas à internet.

> **Importante:** Este projeto é estritamente um organizador e reprodutor pessoal de mídias e transmissões às quais o usuário possui legítimo direito de acesso. Não inclui canais pré-carregados, não fornece conteúdo protegido por direitos autorais nem quebra restrições de DRM/paywall.

---

## 2. Usuários e Cenários de Uso

### Cenário A: Gerenciamento pelo Computador ou Celular
1. O usuário acessa `http://<ip-do-servidor>:3001` no navegador do celular ou computador conectado ao Wi-Fi doméstico.
2. Faz o upload de um arquivo `.m3u` ou `.m3u8` com sua lista autorizada (ou insere a URL da playlist após validação estrita anti-SSRF).
3. Visualiza os canais agrupados por categoria (`group-title`).
4. Reorganiza canais: oculta categorias irrelevantes, renomeia canais, seleciona canais favoritos e associa IDs de EPG.
5. Gera um código PIN efêmero de pareamento para autorizar a TV LG na rede local.

### Cenário B: Uso na TV LG (webOS)
1. O usuário abre o app na TV LG.
2. Na primeira inicialização, a TV solicita o endereço IP do servidor local ou realiza descoberta/pareamento via PIN de 6 dígitos.
3. Após pareada com sucesso, a TV exibe a interface de 10 pés com foco controlado pelas setas do controle remoto:
   - Barra lateral: Favoritos, Categorias/Grupos, Todos os Canais, Configurações.
   - Grade ou lista de canais com logos, nomes e programa atual do EPG (se houver).
   - Tela de reprodução em tela cheia com overlay temporário de informações (canal, programa, barra de buffer).
4. O usuário troca de canais usando setas para cima/baixo, OK e Ch+/Ch-, e volta ao menu com a tecla Back.

---

## 3. Requisitos Funcionais

| Código | Requisito | Descrição |
|---|---|---|
| **RF01** | Importação M3U/M3U8 | Suporte a arquivos M3U estendidos com metadados `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`. Tolerância a formatos imperfeitos. |
| **RF02** | Importação por URL Segura | Download opcional de listas remotas com proteção SSRF e anti-DNS rebinding em nível de servidor. |
| **RF03** | Preservação de Fonte Original | A lista M3U original nunca é modificada ou corrompida. As personalizações (favoritos, nomes customizados, ordem) são salvas como camada de sobreposição (*overlay*). |
| **RF04** | Suporte a EPG/XMLTV | Importação de arquivos XMLTV locais/remotos e associação com canais via `tvg-id`. |
| **RF05** | Navegação 10-foot UI | Toda a interface da TV deve ser operável via D-Pad (Up, Down, Left, Right, Enter, Back). |
| **RF06** | Player HLS Resiliente | Reprodução de streams HLS (`.m3u8`) via elemento nativo HTML5 compatível com webOS 25, com tratamento de reconexão, timeout e feedback claro de erro. |
| **RF07** | Pareamento Seguro por PIN | Conexão autenticada da TV com o servidor através de PIN de curta duração, revogável a qualquer momento no painel. |

---

## 4. Requisitos Não Funcionais

- **Privacidade Total:** Zero telemetria, zero conexão com serviços de terceiros para upload de dados, analytics ou autenticação em nuvem.
- **Rede Local Exclusiva:** Nenhuma porta externa necessária; funcionamento restrito à LAN.
- **Tolerância a Falhas:** Falhas de rede ou canais fora do ar não travam a interface da TV; são exibidos estados vazios claros e informativos.
