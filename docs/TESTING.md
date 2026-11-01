# Estratégia de Testes e Validação - IPTV Local

## 1. Níveis de Teste

Para garantir a confiabilidade sem depender exclusivamente da TV física durante todo o ciclo de desenvolvimento, adotamos a seguinte pirâmide:

1. **Testes Unitários Automatizados (`tests/unit`):**
   - Parser M3U: entradas truncadas, BOM UTF-8, atributos mal formatados, quebras `\r\n` e `\n`, grupos sem nome, caracteres especiais.
   - Parser XMLTV: formato de datas EPG, extração de título e descrição de programas, canais sem correspondência.
   - Validador Anti-SSRF: rejeição de IPs de loopback, ranges privados, IPv6 formatados, metadados AWS/GCP, aceitação de IPs públicos legítimos.
   - Pareamento: geração de PIN, validação de tempo de expiração e bloqueio após 3 tentativas incorretas.

2. **Testes de Integração da API (`tests/integration`):**
   - Upload de arquivo M3U via HTTP multipart.
   - Criação de favoritos e verificação de que o arquivo fonte original não foi alterado.
   - Rotas autenticadas da TV exigindo Bearer Token.

3. **Verificação Estática e Empacotamento:**
   - Typechecking TypeScript (`tsc --noEmit`).
   - Linting e formatação de código.
   - Validação do pacote `.ipk` gerado por `ares-package` (tamanho do arquivo, presença de `appinfo.json`, `index.html`, ícones de aplicativo).

4. **Validação na TV Física (LG 43UA7500PSA):**
   - O teste físico é reservado para a homologação final do MVP e requer autorização prévia.
   - Critérios validados na TV:
     - Instalação limpa via `ares-install`.
     - Lançamento sem falha de renderização via `ares-launch`.
     - Navegação fluida com o Magic Remote (setas, OK, voltar).
     - Reprodução estável de um stream HLS de teste de domínio público/autorizado.
     - Comportamento de saída limpa (Back button).

---

## 2. Execução dos Testes Automatizados

Comandos previstos:
```bash
# Executar todos os testes unitários e de integração
npm test

# Executar verificação de tipos e lint
npm run check

# Empacotar o app webOS para validação estrutural
npm run build:tv
npm run package:tv
```

---

## 3. Matriz de Rastreabilidade de Testes

| Componente | Caso de Teste | Critério de Aceite |
|---|---|---|
| `shared/m3u` | Lista com 5.000 canais | Parsing concluído em menos de 100ms sem vazamento de memória |
| `shared/m3u` | Linhas com `#EXTINF:-1 tvg-id="" tvg-name="A" ,Nome` | Extração correta mesmo com campos vazios e vírgula deslocada |
| `local-server/ssrf` | URL `http://127.0.0.1:8080/malicious.m3u` | Rejeição com erro `SSRF_DETECTED_LOOPBACK` |
| `local-server/ssrf` | URL `http://169.254.169.254/latest/meta-data/` | Rejeição com erro `SSRF_DETECTED_METADATA` |
| `local-server/pairing` | Tentativa com PIN expirado (> 5min) | Rejeição com status `401 Unauthorized` |
| `webos-tv/player` | Stream offline (HTTP 404 / timeout) | Exibição de banner amigável de erro sem travar o app |
