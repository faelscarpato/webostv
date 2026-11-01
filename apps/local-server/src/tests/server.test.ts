import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLocalServer } from '../server.js';

describe('Local Server API Tests', () => {
  let serverInstance: ReturnType<typeof createLocalServer>;
  let testPort = 39123;
  let baseUrl: string;
  let tempDir: string;

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iptv-test-'));
    serverInstance = createLocalServer({
      port: testPort,
      host: '127.0.0.1',
      dataDir: tempDir,
    });
    await serverInstance.start();
    baseUrl = `http://127.0.0.1:${testPort}`;
  });

  after(async () => {
    await serverInstance.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('GET /api/status deve retornar status inicial vazio', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    assert.equal(res.status, 200);
    const data: any = await res.json();
    assert.equal(data.hasPlaylist, false);
    assert.equal(data.totalChannels, 0);
  });

  test('POST /api/playlists/upload deve processar lista M3U', async () => {
    const sampleM3U = `#EXTM3U
#EXTINF:-1 tvg-id="Globo.br" group-title="Abertos",TV Globo HD
http://streams.local/globo.m3u8
#EXTINF:-1 tvg-id="SBT.br" group-title="Abertos",SBT HD
http://streams.local/sbt.m3u8
`;
    const res = await fetch(`${baseUrl}/api/playlists/upload`, {
      method: 'POST',
      body: sampleM3U,
    });
    assert.equal(res.status, 200);
    const data: any = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status.totalChannels, 2);
  });

  test('GET /api/channels deve listar canais e suportar filtros', async () => {
    const res = await fetch(`${baseUrl}/api/channels?group=Abertos`);
    assert.equal(res.status, 200);
    const data: any = await res.json();
    assert.equal(data.total, 2);
    assert.equal(data.channels[0].name, 'TV Globo HD');
  });

  test('PUT /api/channels/:id deve permitir renomear e favoritar canal', async () => {
    const listRes = await fetch(`${baseUrl}/api/channels`);
    const listData: any = await listRes.json();
    const ch = listData.channels[0];

    const updateRes = await fetch(`${baseUrl}/api/channels/${ch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Globo Editada',
        isFavorite: true,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateData: any = await updateRes.json();
    assert.equal(updateData.channel.name, 'Globo Editada');
    assert.equal(updateData.channel.isFavorite, true);
    // Fonte original deve continuar intacta
    assert.equal(updateData.channel.originalName, 'TV Globo HD');
  });

  test('Fluxo de Pareamento: gerar PIN, parear TV e revogar', async () => {
    // 1. Gerar PIN
    const pinRes = await fetch(`${baseUrl}/api/devices/pair/request`, { method: 'POST' });
    assert.equal(pinRes.status, 200);
    const pinData: any = await pinRes.json();
    assert.ok(pinData.pin);
    assert.equal(pinData.pin.length, 6);

    // 2. Confirmar com PIN incorreto
    const badConfirm = await fetch(`${baseUrl}/api/devices/pair/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '000000',
        deviceId: 'tv-lg-test-1',
      }),
    });
    assert.equal(badConfirm.status, 401);

    // 3. Confirmar com PIN correto
    const okConfirm = await fetch(`${baseUrl}/api/devices/pair/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: pinData.pin,
        deviceId: 'tv-lg-test-1',
        deviceName: 'TV LG Sala',
      }),
    });
    assert.equal(okConfirm.status, 200);
    const okData: any = await okConfirm.json();
    assert.ok(okData.token);

    // 4. Listar dispositivos pareados
    const listDevRes = await fetch(`${baseUrl}/api/devices`);
    const devData: any = await listDevRes.json();
    assert.equal(devData.devices.length, 1);
    assert.equal(devData.devices[0].deviceId, 'tv-lg-test-1');

    // 5. Revogar dispositivo
    const revokeRes = await fetch(`${baseUrl}/api/devices/tv-lg-test-1`, { method: 'DELETE' });
    assert.equal(revokeRes.status, 200);
    const afterRevoke: any = await (await fetch(`${baseUrl}/api/devices`)).json();
    assert.equal(afterRevoke.devices.length, 0);
  });

  test('Proteção Anti-SSRF deve bloquear importação de IPs restritos', async () => {
    const res = await fetch(`${baseUrl}/api/playlists/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:8080/malicious.m3u' }),
    });
    assert.equal(res.status, 400);
    const data: any = await res.json();
    assert.ok(data.error.includes('Bloqueio de Segurança SSRF'));
  });
});
