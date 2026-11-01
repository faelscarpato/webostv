# Registros de Decisões de Arquitetura (ADR) - IPTV Local

## ADR 001: Escolha da Estrutura em Monorepo com NPM Workspaces
- **Status:** Aprovado
- **Contexto:** O projeto abrange três módulos correlacionados: o servidor local, o painel de gerenciamento web e o cliente para a TV LG, além de schemas e parsers que precisam ser idênticos entre os nós.
- **Decisão:** Utilizar Monorepo com `npm workspaces` na raiz (`apps/*`, `packages/*`).
- **Consequências:** Permite reuso direto de tipos e validadores em TypeScript sem duplicação de código e sem necessidade de publicar pacotes externos no NPM.

---

## ADR 002: Framework Leve para o App da TV (webOS)
- **Status:** Aprovado
- **Contexto:** Smart TVs possuem CPUs de baixo consumo com limites severos de memória e processamento. Frameworks de alta abstração (como React completo ou Next.js) no cliente da TV podem introduzir gargalos de inicialização, alto consumo de RAM e latência na navegação com o controle remoto.
- **Decisão:** Desenvolver o app webOS (`apps/webos-tv`) em TypeScript compilado para JavaScript Vanilla e CSS puro, utilizando manipulação de DOM direta e Spatial Navigation leve baseado em coordenadas.
- **Consequências:** Inicialização instantânea (<1s), zero overhead de Virtual DOM, navegação a 60 FPS com setas do controle remoto e baixo risco de descarte por falta de memória do webOS.

---

## ADR 003: Separação entre Lista Fonte Original e Camada de Organização
- **Status:** Aprovado
- **Contexto:** Ao importar um arquivo `.m3u` com milhares de canais, o usuário frequentemente renomeia canais, oculta categorias e marca favoritos. Se o arquivo original for regravado, qualquer atualização posterior da playlist pelo provedor perderá essas edições ou corromperá metadados desconhecidos.
- **Decisão:** O arquivo original é salvo como `source.m3u` intacto. Toda organização (favoritos, nomes customizados, ocultos, ordem) é gravada em um arquivo `overlay.json` indexado por `tvg-id` ou hash do canal.
- **Consequências:** Preservação estrita da fonte; se o usuário atualizar a lista ou reverter configurações, a origem permanece intacta.

---

## ADR 004: Modelo de Pareamento Local por PIN de Curta Duração
- **Status:** Aprovado
- **Contexto:** Em uma rede residencial, não se deve presumir que todos os dispositivos conectados tenham permissão para alterar canais ou interagir com o player. Além disso, a TV não possui teclado físico confortável para digitar senhas complexas.
- **Decisão:** A TV exibe uma tela com um campo de PIN de 6 dígitos. O usuário gera esse PIN no painel web (que possui sessão autenticada). O PIN tem validade de 5 minutos e, após confirmado pela TV, o servidor emite um token persistente para aquele `deviceId`.
- **Consequências:** Experiência prática para digitação no controle remoto, combinada com segurança de rede sólida e revogação imediata via painel web.
