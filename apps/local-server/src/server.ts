import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import { URL } from 'node:url';
import { LocalStorageManager } from './storage.js';
import { isRestrictedIP, validateUrlPreflight, sanitizeLog } from '@iptv/shared';

export interface ServerConfig {
  port: number;
  host: string;
  dataDir: string;
}

export function createLocalServer(config: ServerConfig) {
  const storage = new LocalStorageManager(config.dataDir);

  const server = http.createServer(async (req, res) => {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const safeUrl = sanitizeLog(req.url || '/');
    console.log(`[${new Date().toISOString()}] ${req.method} ${safeUrl}`);

    try {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      // JSON Helper functions
      const sendJson = (status: number, data: any) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      const sendError = (status: number, message: string) => {
        sendJson(status, { error: message });
      };

      // Read Body helper
      const readBody = async (maxBytes = 250 * 1024 * 1024): Promise<string> => {
        return new Promise((resolve, reject) => {
          let body = '';
          let totalBytes = 0;
          req.setEncoding('utf-8');

          req.on('data', chunk => {
            totalBytes += Buffer.byteLength(chunk, 'utf-8');
            if (totalBytes > maxBytes) {
              reject(new Error('Tamanho máximo da requisição excedido (limite 250MB)'));
              req.destroy();
              return;
            }
            body += chunk;
          });

          req.on('end', () => resolve(body));
          req.on('error', err => reject(err));
        });
      };

      // Read JSON Body
      const readJsonBody = async <T>(): Promise<T> => {
        const raw = await readBody();
        try {
          return JSON.parse(raw) as T;
        } catch {
          throw new Error('Corpo da requisição não é um JSON válido');
        }
      };

      // Serve Manager Web UI
      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        const candidatePaths = [
          path.resolve(process.cwd(), 'apps/manager/index.html'),
          path.resolve(config.dataDir, '../apps/manager/index.html'),
          path.resolve(config.dataDir, '../../apps/manager/index.html'),
          path.resolve(config.dataDir, 'apps/manager/index.html'),
        ];

        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate)) {
            const html = fs.readFileSync(candidate, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
        }
      }

      // Serve Manager Static Assets (Logo, Favicon, Config)
      if (req.method === 'GET' && pathname === '/config.js') {
        const candidatePaths = [
          path.resolve(process.cwd(), 'apps/manager/config.js'),
          path.resolve(process.cwd(), 'config.js'),
          path.resolve(config.dataDir, '../apps/manager/config.js'),
        ];
        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate)) {
            const js = fs.readFileSync(candidate, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            res.end(js);
            return;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end('window.IPTV_CONFIG = {};\n');
        return;
      }

      if (req.method === 'GET' && (pathname === '/logo.png' || pathname === '/logo-ui.png' || pathname === '/favicon.ico')) {
        const fileName = pathname === '/favicon.ico' ? 'logo-ui.png' : pathname.slice(1);
        const candidatePaths = [
          path.resolve(process.cwd(), 'apps/manager', fileName),
          path.resolve(process.cwd(), fileName),
          path.resolve(config.dataDir, '../apps/manager', fileName),
          path.resolve(config.dataDir, fileName),
        ];

        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate)) {
            const img = fs.readFileSync(candidate);
            res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
            res.end(img);
            return;
          }
        }
      }

      // Route handling
      // GET /api/status
      if (req.method === 'GET' && pathname === '/api/status') {
        return sendJson(200, storage.getStatus());
      }

      // POST /api/playlists/upload
      if (req.method === 'POST' && pathname === '/api/playlists/upload') {
        const body = await readBody();
        if (!body || !body.includes('#EXT')) {
          return sendError(400, 'Conteúdo da playlist inválido ou sem cabeçalho #EXT');
        }
        storage.setSourceM3U(body);
        return sendJson(200, {
          success: true,
          status: storage.getStatus(),
        });
      }

      // POST /api/playlists/import-url (with strict SSRF mitigation)
      if (req.method === 'POST' && pathname === '/api/playlists/import-url') {
        const json = await readJsonBody<{ url: string }>();
        const targetUrl = json?.url?.trim();
        if (!targetUrl) {
          return sendError(400, 'URL da playlist é obrigatória');
        }

        // 1. Preflight URL syntax check
        const preflight = validateUrlPreflight(targetUrl);
        if (!preflight.isSafe) {
          return sendError(400, `Bloqueio de Segurança SSRF: ${preflight.reason}`);
        }

        // 2. DNS resolution check (anti-SSRF and anti-rebinding)
        const parsedTarget = new URL(targetUrl);
        try {
          const addresses = await dns.lookup(parsedTarget.hostname, { all: true });
          for (const addr of addresses) {
            if (isRestrictedIP(addr.address)) {
              return sendError(403, `Bloqueio de Segurança SSRF: O endereço IP ${addr.address} do host '${parsedTarget.hostname}' pertence a uma faixa restrita (loopback/privada).`);
            }
          }
        } catch (dnsErr: any) {
          return sendError(400, `Falha ao resolver DNS do domínio '${parsedTarget.hostname}': ${dnsErr.message}`);
        }

        // 3. Fetch remote file with timeout & limit
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

          const response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'IPTV-Local-Player/1.0',
            },
            redirect: 'follow',
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            return sendError(502, `Servidor remoto respondeu com status ${response.status}: ${response.statusText}`);
          }

          const text = await response.text();
          if (!text.includes('#EXT')) {
            return sendError(422, 'O arquivo baixado não contém uma playlist M3U válida (cabeçalho #EXT ausente)');
          }

          storage.setSourceM3U(text);
          return sendJson(200, {
            success: true,
            status: storage.getStatus(),
          });
        } catch (fetchErr: any) {
          return sendError(504, `Falha ao baixar playlist remota: ${fetchErr.message}`);
        }
      }

      // GET /api/channels
      if (req.method === 'GET' && pathname === '/api/channels') {
        const group = parsedUrl.searchParams.get('group') || undefined;
        const favoritesOnly = parsedUrl.searchParams.get('favorites') === 'true';
        const search = parsedUrl.searchParams.get('search') || undefined;
        const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);

        const result = storage.getChannels({ group, favoritesOnly, search, page, limit });
        return sendJson(200, result);
      }

      // GET /api/channels/:id
      if (req.method === 'GET' && pathname.startsWith('/api/channels/')) {
        const id = pathname.substring('/api/channels/'.length);
        const channel = storage.getChannelById(id);
        if (!channel) {
          return sendError(404, 'Canal não encontrado');
        }

        const epg = channel.tvgId ? storage.getEPGForChannel(channel.tvgId) : [];
        return sendJson(200, {
          channel,
          epg,
        });
      }

      // PUT /api/channels/:id
      if (req.method === 'PUT' && pathname.startsWith('/api/channels/')) {
        const id = pathname.substring('/api/channels/'.length);
        const body = await readJsonBody<{
          name?: string;
          isFavorite?: boolean;
          isHidden?: boolean;
          order?: number;
          tvgId?: string;
        }>();

        const updated = storage.updateChannel(id, body);
        if (!updated) {
          return sendError(404, 'Canal não encontrado');
        }
        return sendJson(200, { success: true, channel: updated });
      }

      // GET /api/groups
      if (req.method === 'GET' && pathname === '/api/groups') {
        return sendJson(200, { groups: storage.getGroups() });
      }

      // PUT /api/groups/:name
      if (req.method === 'PUT' && pathname.startsWith('/api/groups/')) {
        const groupName = decodeURIComponent(pathname.substring('/api/groups/'.length));
        const body = await readJsonBody<{ isHidden?: boolean; order?: number }>();
        const updated = storage.updateGroup(groupName, body);
        if (!updated) {
          return sendError(404, 'Grupo não encontrado');
        }
        return sendJson(200, { success: true, group: updated });
      }

      // POST /api/epg/upload
      if (req.method === 'POST' && pathname === '/api/epg/upload') {
        const body = await readBody();
        if (!body || !body.includes('<tv')) {
          return sendError(400, 'Arquivo EPG XMLTV inválido ou tag <tv> ausente');
        }
        storage.setEPG(body);
        return sendJson(200, { success: true, status: storage.getStatus() });
      }

      // GET /api/epg/:tvgId
      if (req.method === 'GET' && pathname.startsWith('/api/epg/')) {
        const tvgId = decodeURIComponent(pathname.substring('/api/epg/'.length));
        const programmes = storage.getEPGForChannel(tvgId);
        return sendJson(200, { programmes });
      }

      // POST /api/devices/pair/request (Generates new PIN)
      if (req.method === 'POST' && pathname === '/api/devices/pair/request') {
        const pin = storage.createPairingPIN();
        const active = storage.getActivePIN();
        return sendJson(200, {
          pin,
          expiresAt: active?.expiresAt,
        });
      }

      // GET /api/devices/pair/status
      if (req.method === 'GET' && pathname === '/api/devices/pair/status') {
        const active = storage.getActivePIN();
        return sendJson(200, { activePin: active ? { pin: active.pin, expiresAt: active.expiresAt } : null });
      }

      // POST /api/devices/pair/confirm (TV sends PIN to pair)
      if (req.method === 'POST' && pathname === '/api/devices/pair/confirm') {
        const body = await readJsonBody<{ pin: string; deviceId: string; deviceName?: string }>();
        if (!body.pin || !body.deviceId) {
          return sendError(400, 'PIN e deviceId são obrigatórios');
        }

        const result = storage.confirmPairing(body.pin, body.deviceId, body.deviceName || 'LG webOS TV');
        if (!result.success) {
          return sendError(401, result.error || 'Falha no pareamento');
        }
        return sendJson(200, { success: true, token: result.token });
      }

      // GET /api/devices (List paired TVs)
      if (req.method === 'GET' && pathname === '/api/devices') {
        return sendJson(200, { devices: storage.getPairedDevices() });
      }

      // DELETE /api/devices/:deviceId (Revoke TV)
      if (req.method === 'DELETE' && pathname.startsWith('/api/devices/')) {
        const deviceId = pathname.substring('/api/devices/'.length);
        const revoked = storage.revokeDevice(deviceId);
        return sendJson(200, { success: revoked });
      }

      // Fallback 404
      sendError(404, `Rota não encontrada: ${pathname}`);
    } catch (err: any) {
      console.error('Erro na requisição:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Erro interno no servidor' }));
    }
  });

  return {
    start: () => {
      return new Promise<void>((resolve) => {
        server.listen(config.port, config.host, () => {
          console.log(`[Serviço Local] Rodando em http://${config.host}:${config.port}`);
          resolve();
        });
      });
    },
    stop: () => {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
    storage,
    server,
  };
}
