Você é o agente principal de engenharia responsável por planejar, implementar, documentar e testar um player de IPTV autorizado para minha TV LG, acompanhado de um painel web privado e de um serviço local. Trabalhe no workspace atual da Antigravity CLI. Faça análise e implementação no projeto existente, preservando arquivos e entendendo sua finalidade antes de modificá-los. Não publique o app nem exponha o painel à internet.

<objetivo>
Entregue um MVP local composto por:

1. Um app webOS instalável na TV, operável pelo controle remoto, para navegar por listas, grupos, canais e favoritos, consultar programação quando houver EPG/XMLTV e reproduzir streams autorizados.
2. Um painel web responsivo para administrar listas, canais, grupos, metadados, favoritos, associações de EPG e conexão com a TV, usando celular ou computador na mesma rede local.
3. Um serviço local instalado no computador que eu escolher como servidor inicial. O painel e a TV devem consumir a mesma configuração, sem nuvem, analytics, login externo ou publicação pública como padrão.

O app é apenas player e organizador. Use somente playlists e streams a que eu tenha direito de acesso. Não forneça conteúdo pirata nem implemente bypass de DRM, paywall ou restrições do provedor.
</objetivo>

<contexto_da_tv>
- Modelo: LG 43UA7500PSA
- Código do modelo informado: 43UA7500PSA.AWZFLJZ
- webOS informado: webOS 25, versão 10.3.2-34
- Software informado: 33.31.80
- Instalação de teste: Developer Mode oficial da LG, sem publicação na LG Content Store.
- IP Address: 192.168.18.4
- Passphrase: B3EA28

Trate esses dados como informações fornecidas por mim, não como compatibilidade já comprovada. Ao conectar a TV, confirme modelo e sistema pelas ferramentas oficiais disponíveis. Não deduza compatibilidade de um simulador: valide HLS e controle remoto no aparelho físico e relate claramente o que não pôde ser testado.
</contexto_da_tv>

<pesquisa_e_compatibilidade>
Antes de escolher APIs, codecs, estrutura do app ou comandos, consulte a documentação oficial atual da LG e da Antigravity. Confirme se os comandos, ferramentas, limitações e versões citados ainda se aplicam. Se documentação oficial e ferramenta instalada divergirem, informe a divergência e siga o que for realmente suportado no ambiente, sem inventar comandos.

Referências oficiais iniciais:
- LG webOS CLI Developer Guide: https://webostv.developer.lge.com/develop/tools/cli-dev-guide
- LG Developer Mode App: https://webostv.developer.lge.com/develop/getting-started/developer-mode-app
- LG Streaming Protocol and DRM: https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm
- Antigravity custom subagents: https://antigravity.google/docs/subagents/
- Antigravity teamwork: https://antigravity.google/docs/teamwork/

Use HLS como primeiro protocolo, mas confira as limitações da matriz oficial para a versão da TV. Não presuma que toda playlist M3U/M3U8 ou todo stream vai tocar. O emulador não substitui o teste no modelo real.
</pesquisa_e_compatibilidade>

<seguranca_e_privacidade>
- Mantenha o serviço acessível apenas pela rede local e, quando possível, vinculado à interface/IP local escolhido. Não abra portas no roteador, não faça port forwarding, não publique painel ou API e não altere firewall, rede, permissões do sistema ou configurações de segurança sem mostrar o comando, explicar o motivo e esperar minha aprovação.
- Proteja as rotas de gerenciamento com autenticação apropriada para uma rede doméstica. Faça o pareamento TV–serviço com PIN de uso único e curta duração; limite tentativas, proteja contra repetição e invalide/permita revogar dispositivos pareados. A rede local não deve ser tratada como confiável por padrão.
- Nunca registre, imprima ou inclua em relatórios URLs completas de playlists, parâmetros de autenticação, chaves, senhas, tokens ou conteúdo sensível. Redija valores de credenciais em erros, logs, screenshots e documentação. Não coloque segredos no código, no repositório ou em arquivos públicos.
- URLs de playlists podem conter credenciais. Se for implementada importação por URL, proteja o servidor contra SSRF: valide esquema, destino, DNS e todos os endereços IPv4/IPv6; bloqueie loopback, link-local, multicast, metadata e redes privadas, exceto quando o usuário tiver autorizado explicitamente uma fonte local; valide novamente cada redirecionamento e proteja contra DNS rebinding. A validação no navegador, sozinha, não basta. Limite tamanho, tempo e quantidade de redirecionamentos.
- Prefira armazenamento local com proteção adequada para credenciais. Se o sistema operacional ou ambiente não oferecer uma maneira segura e viável de armazená-las, pare e explique a escolha necessária; não grave segredos em texto puro por conveniência.
- Não envie playlists, canais, EPG, URLs, credenciais ou dados da rede para provedores externos, analytics ou modelos de IA. Leia documentação pública e instale dependências apenas quando necessário e permitido pelo ambiente.
- Antes de parear com a TV, instalar nela ou executar comandos que alterem seu estado, mostre o dispositivo exato, o comando e o efeito esperado, e peça minha confirmação específica. Nunca tente root, jailbreak ou bypass do Developer Mode.
</seguranca_e_privacidade>

<funcionalidades>
O painel deve:
- Importar arquivo M3U/M3U8 e, se a proteção SSRF descrita acima estiver pronta, oferecer importação opcional por URL.
- Preservar a playlist original e metadados como `tvg-id`, `tvg-name`, `tvg-logo` e `group-title`. Separe fonte original de organização editável; permita ordenar, renomear, ocultar e favoritar sem corromper a origem.
- Oferecer busca e filtros simples, além de importar XMLTV/EPG opcional e associar programação por `tvg-id`.
- Informar claramente lista vazia, importação com erros, EPG ausente, serviço inacessível, canal indisponível e falha de sincronização.

O app da TV deve:
- Ter navegação de dez pés com setas, OK, voltar, play/pause, busca e foco destacado; tipografia grande, alto contraste, alvos visíveis e layout legível à distância.
- Funcionar sem mouse, teclado físico ou touch. Tratar carregamento lento, stream inválido, desconexão e retorno ao menu sem travar.
- Manter favoritos, grupos e busca acessíveis pelo controle remoto. Se não houver EPG, continuar funcionando e explicar que a programação não está disponível.
- Usar o player e as APIs suportados pela versão verificada do webOS. Não acrescente biblioteca de reprodução ou dependências pesadas sem justificar e validar compatibilidade real.
</funcionalidades>

<processo>
1. **Descoberta:** inspecione o workspace, arquivos existentes, sistema operacional, versões instaladas e ferramentas webOS. Não suponha que CLI, SDK, Developer Mode, IP da TV ou servidor estejam configurados. Não altere nada durante a inspeção.
2. **Plano:** apresente arquitetura proposta, estrutura de pastas, decisões, riscos, critérios de aceite e dependências externas. Faça somente perguntas que bloqueiem a próxima etapa. O computador servidor, IP da TV e playlist/stream de teste só são necessários quando essa etapa chegar; não peça credenciais no chat.
3. **Orquestração:** verifique na CLI instalada e na documentação atual se `/teamwork`, `/teamwork-preview` ou subagentes estão realmente disponíveis e acessíveis. Use apenas os comandos e recursos confirmados. Se usar equipe, delimite propriedade dos arquivos, passe contexto completo e peça revisões independentes. Se não houver orquestração disponível, faça as revisões sequencialmente e diga isso, sem fingir que usou agentes. Se a ferramenta exigir aprovação para iniciar a execução, aguarde essa aprovação, sem tentar contornar a etapa.
4. **Arquitetura e esqueleto:** escolha stack depois de inspecionar o ambiente. Prefira código simples e compatível com o runtime real da TV; use TypeScript no painel/serviço quando compatível. Evite dependências desnecessárias. Uma estrutura possível é `apps/webos-tv`, `apps/manager`, `apps/local-server`, `packages/shared`, `docs` e `tests`, mas adapte-a ao projeto existente.
5. **Modelo e persistência:** defina schema validado e versionado para listas, canais, grupos, favoritos e EPG. Preserve o arquivo de origem. Use armazenamento local adequado ao volume e operação doméstica; trate imagens/logos e credenciais sem colocar tudo indiscriminadamente em JSON ou `localStorage`.
6. **M3U/XMLTV:** implemente parsing tolerante a entradas inválidas, metadados, grupos vazios, caracteres escapados e arquivos grandes. Escreva testes antes de considerar o parser completo. Não invente canais, logos, EPG ou resultados de reprodução.
7. **Player e controle:** implemente navegação remota, reprodução HLS, estados de carregamento/erro, retorno ao menu e recuperação de desconexão. Registre compatibilidade somente depois de testar o aparelho físico com um stream autorizado.
8. **Validação:** execute testes, lint e build disponíveis, com resultados reais e comandos observados. Teste visual e funcional o painel no navegador. Separe claramente testes unitários, emulador e TV física. Não declare a instalação ou reprodução na LG validada apenas por build, simulador ou inspeção de código.
9. **Instalação de teste:** antes de qualquer pareamento, instalação, lançamento ou atualização na TV, apresente o IP/modelo confirmado, o comando exato e o que acontecerá; aguarde minha confirmação. Não publique na loja.
10. **Fechamento:** documente o que foi implementado, o que foi de fato testado, falhas, limitações, comandos e etapas que ainda dependem de mim. Não deixe informações fictícias ou testes simulados descritos como reais.
</processo>

<documentacao>
Mantenha atualizados, sem substituir documentos úteis existentes:
- `README.md`: propósito, requisitos, execução local, configuração e limitações.
- `docs/PRODUCT.md`: escopo e fluxos.
- `docs/ARCHITECTURE.md`: TV, painel, serviço, armazenamento e comunicação.
- `docs/PLAN.md`: etapas, critérios de aceite e pendências.
- `docs/SECURITY.md`: riscos, pareamento, credenciais, rede local, importação por URL e privacidade.
- `docs/TESTING.md`: testes automatizados e validação na TV.
- `docs/INSTALL-WEBOS.md`: Developer Mode, conexão, empacotamento IPK, instalação, atualização, expiração e reinstalação.
- `docs/DECISIONS.md`: decisões técnicas e alternativas consideradas.
- `AGENTS.md`: regras duradouras para futuros agentes que trabalharem no repositório.
</documentacao>

<criterios_de_aceite>
- Importo uma playlist M3U/M3U8 de teste, preservo metadados e organizo canais no painel sem alterar a fonte original.
- A TV recebe a configuração atualizada pela rede local, sem enviar os dados a serviços externos.
- Navego pelo controle remoto e reproduzo um stream HLS autorizado na TV indicada, ou recebo a causa objetiva da falha.
- XMLTV/EPG é opcional; quando disponível, posso associar canais e consultar programação; sem EPG, o player continua utilizável.
- Painel e TV mostram estado de conexão e se recuperam de uma interrupção sem travar.
- Credenciais não aparecem em logs, código versionado, screenshots ou documentação.
- Resultados de teste, build, lint, empacotamento e instalação são descritos de acordo com o que realmente aconteceu.
- A documentação explica que o Developer Mode é temporário e pode remover apps de teste quando expira, seguindo a instrução oficial vigente da LG.
</criterios_de_aceite>

<interacao>
Tome decisões técnicas reversíveis sem me interromper por detalhes menores. Comece inspecionando o workspace e apresentando o plano. Pergunte apenas quando faltar algo indispensável para a próxima etapa, por exemplo o computador que hospedará o serviço, o IP da TV ou um arquivo/stream de teste autorizado. Peça um dado de cada vez e nunca solicite senhas, tokens ou URLs com credenciais em texto de chat.

Não pare após escrever o plano: avance até o MVP enquanto estiver dentro das permissões acima. Pare para pedir minha aprovação antes de instalar ou operar a TV, alterar firewall/rede, instalar ferramentas globalmente, executar algo com privilégios ou mudar controles de segurança. Ao concluir cada etapa importante, informe brevemente arquivos alterados, decisões, verificações realmente executadas e próximo bloqueio.

Antes de encerrar, revise os critérios de aceite e diferencie fatos observados, suposições e itens ainda não testados. Verifique cada afirmação de conclusão contra a saída real das ferramentas.
