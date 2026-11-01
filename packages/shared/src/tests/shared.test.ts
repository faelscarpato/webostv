import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U } from '../m3u.js';
import { parseXMLTV, parseXmltvDate } from '../xmltv.js';
import { isRestrictedIP, validateUrlPreflight, sanitizeLog } from '../ssrf.js';

describe('M3U Parser', () => {
  test('deve processar M3U simples e tolerar BOM e quebras CRLF', () => {
    const rawM3U = '\uFEFF#EXTM3U\r\n#EXTINF:-1 tvg-id="Globo.br" tvg-name="TV Globo" tvg-logo="http://example.com/logo.png" group-title="Abertos",Globo HD\r\nhttp://stream.example.com/globo.m3u8\r\n';
    const result = parseM3U(rawM3U);

    assert.equal(result.totalParsed, 1);
    assert.equal(result.channels[0].name, 'Globo HD');
    assert.equal(result.channels[0].tvgId, 'Globo.br');
    assert.equal(result.channels[0].groupTitle, 'Abertos');
    assert.equal(result.channels[0].url, 'http://stream.example.com/globo.m3u8');
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].name, 'Abertos');
  });

  test('deve tolerar atributos sem aspas, nomes com vírgulas e linhas extras', () => {
    const rawM3U = `#EXTM3U
# Linha de comentário irrelevante

#EXTINF:-1 tvg-id=SBT.br group-title=Variedades,SBT, A TV Mais Feliz
http://stream.example.com/sbt/live.m3u8
`;
    const result = parseM3U(rawM3U);

    assert.equal(result.totalParsed, 1);
    assert.equal(result.channels[0].name, 'SBT, A TV Mais Feliz');
    assert.equal(result.channels[0].tvgId, 'SBT.br');
    assert.equal(result.channels[0].groupTitle, 'Variedades');
  });

  test('deve aplicar sobreposição de overlay sem alterar dados originais', () => {
    const rawM3U = `#EXTM3U
#EXTINF:-1 tvg-id="ch1" group-title="Esportes",Canal Esporte
http://stream.example.com/esporte.m3u8
`;
    const tempParse = parseM3U(rawM3U);
    const channelId = tempParse.channels[0].id;

    const overlay = {
      version: 1,
      updatedAt: new Date().toISOString(),
      customNames: { [channelId]: 'Meu Canal Favorito de Futebol' },
      favorites: [channelId],
      hiddenChannels: [],
      hiddenGroups: [],
      channelOrders: { [channelId]: 0 },
      groupOrders: {},
      epgOverrides: {},
    };

    const finalResult = parseM3U(rawM3U, { overlay });
    assert.equal(finalResult.channels[0].originalName, 'Canal Esporte');
    assert.equal(finalResult.channels[0].name, 'Meu Canal Favorito de Futebol');
    assert.equal(finalResult.channels[0].isFavorite, true);
    assert.equal(finalResult.channels[0].isHidden, false);
  });
});

describe('XMLTV Parser', () => {
  test('deve converter data XMLTV para ISO 8601 corretamente', () => {
    const iso = parseXmltvDate('20261101180000 -0300');
    assert.equal(iso, '2026-11-01T18:00:00-03:00');
  });

  test('deve extrair canais e programação com entidades XML decodificadas', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tv>
  <channel id="Globo.br">
    <display-name>Globo</display-name>
  </channel>
  <programme start="20261101180000 -0300" stop="20261101190000 -0300" channel="Globo.br">
    <title>Jornal &amp; Notícias</title>
    <desc>Resumo &lt;especial&gt;</desc>
  </programme>
</tv>`;
    const { programmes, channelIds } = parseXMLTV(xml);

    assert.equal(channelIds.length, 1);
    assert.equal(channelIds[0], 'Globo.br');
    assert.equal(programmes.length, 1);
    assert.equal(programmes[0].channelTvgId, 'Globo.br');
    assert.equal(programmes[0].title, 'Jornal & Notícias');
    assert.equal(programmes[0].description, 'Resumo <especial>');
  });
});

describe('SSRF e Sanitização de Segurança', () => {
  test('deve detectar e bloquear faixas restritas de IP', () => {
    assert.equal(isRestrictedIP('127.0.0.1'), true);
    assert.equal(isRestrictedIP('127.0.0.5'), true);
    assert.equal(isRestrictedIP('10.0.1.20'), true);
    assert.equal(isRestrictedIP('172.16.0.1'), true);
    assert.equal(isRestrictedIP('172.31.255.255'), true);
    assert.equal(isRestrictedIP('192.168.1.1'), true);
    assert.equal(isRestrictedIP('169.254.169.254'), true);
    assert.equal(isRestrictedIP('::1'), true);
    assert.equal(isRestrictedIP('::ffff:127.0.0.1'), true);

    // IP público legítimo
    assert.equal(isRestrictedIP('8.8.8.8'), false);
    assert.equal(isRestrictedIP('1.1.1.1'), false);
  });

  test('deve rejeitar URLs com hostnames perigosos', () => {
    assert.equal(validateUrlPreflight('http://localhost:8080/m3u').isSafe, false);
    assert.equal(validateUrlPreflight('http://127.0.0.1/lista.m3u').isSafe, false);
    assert.equal(validateUrlPreflight('ftp://provedor.com/lista.m3u').isSafe, false);
    assert.equal(validateUrlPreflight('http://169.254.169.254/metadata').isSafe, false);

    assert.equal(validateUrlPreflight('https://meu-servidor-autorizado.com/playlist.m3u8').isSafe, true);
  });

  test('deve sanitizar senhas e tokens em strings de log', () => {
    const rawUrl = 'http://usuario:minhasenha123@servidor.com:8080/live.m3u8?token=XYZ999&auth=ABC';
    const clean = sanitizeLog(rawUrl);

    assert.ok(!clean.includes('minhasenha123'));
    assert.ok(!clean.includes('XYZ999'));
    assert.ok(clean.includes('***REDACTED***'));
  });
});
