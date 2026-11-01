import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Channel,
  ChannelGroup,
  PlaylistOverlay,
  EPGProgramme,
  DevicePairingSession,
  PairedDevice,
  SystemStatus,
  parseM3U,
  parseXMLTV,
} from '@iptv/shared';

export class LocalStorageManager {
  private dataDir: string;
  private sourceM3UPath: string;
  private overlayPath: string;
  private epgPath: string;
  private devicesPath: string;

  private overlay: PlaylistOverlay;
  private rawM3U: string = '';
  private rawEPG: string = '';

  private cachedChannels: Channel[] = [];
  private cachedGroups: ChannelGroup[] = [];
  private cachedProgrammes: EPGProgramme[] = [];

  private pairingSession: DevicePairingSession | null = null;
  private pairedDevices: Map<string, PairedDevice> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.sourceM3UPath = path.join(dataDir, 'source.m3u');
    this.overlayPath = path.join(dataDir, 'overlay.json');
    this.epgPath = path.join(dataDir, 'epg.xml');
    this.devicesPath = path.join(dataDir, 'devices.json');

    this.overlay = {
      version: 1,
      updatedAt: new Date().toISOString(),
      customNames: {},
      favorites: [],
      hiddenChannels: [],
      hiddenGroups: [],
      channelOrders: {},
      groupOrders: {},
      epgOverrides: {},
    };

    this.ensureDirs();
    this.loadState();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Atomic file write using temporary file and atomic rename.
   */
  private atomicWriteFileSync(filePath: string, content: string) {
    const tempPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  private loadState() {
    // 1. Load Overlay
    if (fs.existsSync(this.overlayPath)) {
      try {
        const raw = fs.readFileSync(this.overlayPath, 'utf-8');
        this.overlay = JSON.parse(raw);
      } catch (err) {
        console.error('Falha ao ler overlay.json, inicializando novo:', err);
      }
    }

    // 2. Load Devices
    if (fs.existsSync(this.devicesPath)) {
      try {
        const raw = fs.readFileSync(this.devicesPath, 'utf-8');
        const list: PairedDevice[] = JSON.parse(raw);
        for (const dev of list) {
          this.pairedDevices.set(dev.token, dev);
        }
      } catch (err) {
        console.error('Falha ao ler devices.json:', err);
      }
    }

    // 3. Load Raw M3U
    if (fs.existsSync(this.sourceM3UPath)) {
      try {
        this.rawM3U = fs.readFileSync(this.sourceM3UPath, 'utf-8');
        this.recomputeChannels();
      } catch (err) {
        console.error('Falha ao carregar source.m3u:', err);
      }
    }

    // 4. Load EPG
    if (fs.existsSync(this.epgPath)) {
      try {
        this.rawEPG = fs.readFileSync(this.epgPath, 'utf-8');
        this.recomputeEPG();
      } catch (err) {
        console.error('Falha ao carregar epg.xml:', err);
      }
    }
  }

  private recomputeChannels() {
    if (!this.rawM3U) {
      this.cachedChannels = [];
      this.cachedGroups = [];
      return;
    }
    const parsed = parseM3U(this.rawM3U, { overlay: this.overlay });
    this.cachedChannels = parsed.channels;
    this.cachedGroups = parsed.groups;
  }

  private recomputeEPG() {
    if (!this.rawEPG) {
      this.cachedProgrammes = [];
      return;
    }
    const parsed = parseXMLTV(this.rawEPG);
    this.cachedProgrammes = parsed.programmes;
  }

  public saveOverlay() {
    this.overlay.updatedAt = new Date().toISOString();
    this.atomicWriteFileSync(this.overlayPath, JSON.stringify(this.overlay, null, 2));
    this.recomputeChannels();
  }

  public saveDevices() {
    const list = Array.from(this.pairedDevices.values());
    this.atomicWriteFileSync(this.devicesPath, JSON.stringify(list, null, 2));
  }

  public setSourceM3U(content: string) {
    this.rawM3U = content;
    this.atomicWriteFileSync(this.sourceM3UPath, content);
    this.recomputeChannels();
  }

  public setEPG(xmlContent: string) {
    this.rawEPG = xmlContent;
    this.atomicWriteFileSync(this.epgPath, xmlContent);
    this.recomputeEPG();
  }

  public getChannels(filter?: {
    group?: string;
    favoritesOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): { total: number; page: number; limit: number; totalPages: number; channels: Channel[] } {
    let list = this.cachedChannels;

    if (filter?.group) {
      const g = filter.group.toLowerCase();
      list = list.filter(c => c.groupTitle.toLowerCase() === g);
    }

    if (filter?.favoritesOnly) {
      list = list.filter(c => c.isFavorite);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.groupTitle.toLowerCase().includes(q));
    }

    const total = list.length;
    const page = Math.max(1, filter?.page || 1);
    const limit = Math.max(1, Math.min(filter?.limit || 50, 200)); // Default 50, max 200 per page
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedChannels = list.slice(startIndex, startIndex + limit);

    return {
      total,
      page,
      limit,
      totalPages,
      channels: pagedChannels,
    };
  }

  public getChannelById(id: string): Channel | undefined {
    return this.cachedChannels.find(c => c.id === id);
  }

  public updateChannel(id: string, updates: { name?: string; isFavorite?: boolean; isHidden?: boolean; order?: number; tvgId?: string }): Channel | null {
    const ch = this.getChannelById(id);
    if (!ch) return null;

    if (updates.name !== undefined) {
      this.overlay.customNames[id] = updates.name.trim();
    }

    if (updates.isFavorite !== undefined) {
      const index = this.overlay.favorites.indexOf(id);
      if (updates.isFavorite && index === -1) {
        this.overlay.favorites.push(id);
      } else if (!updates.isFavorite && index !== -1) {
        this.overlay.favorites.splice(index, 1);
      }
    }

    if (updates.isHidden !== undefined) {
      const index = this.overlay.hiddenChannels.indexOf(id);
      if (updates.isHidden && index === -1) {
        this.overlay.hiddenChannels.push(id);
      } else if (!updates.isHidden && index !== -1) {
        this.overlay.hiddenChannels.splice(index, 1);
      }
    }

    if (updates.order !== undefined) {
      this.overlay.channelOrders[id] = updates.order;
    }

    if (updates.tvgId !== undefined) {
      this.overlay.epgOverrides[id] = updates.tvgId;
    }

    this.saveOverlay();
    return this.getChannelById(id) || null;
  }

  public getGroups(): ChannelGroup[] {
    return this.cachedGroups;
  }

  public updateGroup(name: string, updates: { isHidden?: boolean; order?: number }): ChannelGroup | null {
    if (updates.isHidden !== undefined) {
      const index = this.overlay.hiddenGroups.indexOf(name);
      if (updates.isHidden && index === -1) {
        this.overlay.hiddenGroups.push(name);
      } else if (!updates.isHidden && index !== -1) {
        this.overlay.hiddenGroups.splice(index, 1);
      }
    }

    if (updates.order !== undefined) {
      this.overlay.groupOrders[name] = updates.order;
    }

    this.saveOverlay();
    return this.cachedGroups.find(g => g.name === name) || null;
  }

  public getEPGForChannel(tvgId: string): EPGProgramme[] {
    if (!tvgId) return [];
    return this.cachedProgrammes.filter(p => p.channelTvgId.toLowerCase() === tvgId.toLowerCase());
  }

  /**
   * Device Pairing Logic
   */
  public createPairingPIN(): string {
    // Generate 6-digit random PIN
    const pin = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    this.pairingSession = {
      pin,
      createdAt: new Date().toISOString(),
      expiresAt,
      attempts: 0,
      isUsed: false,
    };

    return pin;
  }

  public getActivePIN(): DevicePairingSession | null {
    if (!this.pairingSession) return null;
    if (new Date() > new Date(this.pairingSession.expiresAt) || this.pairingSession.isUsed) {
      this.pairingSession = null;
      return null;
    }
    return this.pairingSession;
  }

  public confirmPairing(pin: string, deviceId: string, deviceName: string): { success: boolean; token?: string; error?: string } {
    const session = this.getActivePIN();
    if (!session) {
      return { success: false, error: 'PIN inválido ou expirado. Gere um novo PIN no painel.' };
    }

    if (session.attempts >= 3) {
      this.pairingSession = null;
      return { success: false, error: 'Limite de tentativas excedido para este PIN. Gere um novo.' };
    }

    if (session.pin !== pin.trim()) {
      session.attempts++;
      return { success: false, error: `PIN incorreto. Tentativas restantes: ${3 - session.attempts}` };
    }

    session.isUsed = true;
    this.pairingSession = null;

    const token = 'tv_tok_' + crypto.randomBytes(32).toString('hex');
    const device: PairedDevice = {
      deviceId,
      name: deviceName || 'LG webOS TV',
      token,
      pairedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    this.pairedDevices.set(token, device);
    this.saveDevices();

    return { success: true, token };
  }

  public validateDeviceToken(token: string): PairedDevice | null {
    if (!token) return null;
    const dev = this.pairedDevices.get(token);
    if (dev) {
      dev.lastSeenAt = new Date().toISOString();
      return dev;
    }
    return null;
  }

  public getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevices.values()).map(d => ({
      deviceId: d.deviceId,
      name: d.name,
      token: '***', // Redact token from public inspection
      pairedAt: d.pairedAt,
      lastSeenAt: d.lastSeenAt,
    }));
  }

  public revokeDevice(deviceId: string): boolean {
    let foundToken: string | null = null;
    for (const [tok, dev] of this.pairedDevices.entries()) {
      if (dev.deviceId === deviceId) {
        foundToken = tok;
        break;
      }
    }
    if (foundToken) {
      this.pairedDevices.delete(foundToken);
      this.saveDevices();
      return true;
    }
    return false;
  }

  public getStatus(): SystemStatus {
    const activeChans = this.cachedChannels.filter(c => !c.isHidden);
    const activeGrps = this.cachedGroups.filter(g => !g.isHidden);
    const favChans = this.cachedChannels.filter(c => c.isFavorite && !c.isHidden);

    return {
      hasPlaylist: this.cachedChannels.length > 0,
      totalChannels: this.cachedChannels.length,
      totalGroups: this.cachedGroups.length,
      activeChannels: activeChans.length,
      activeGroups: activeGrps.length,
      favoriteChannels: favChans.length,
      hasEpg: this.cachedProgrammes.length > 0,
      totalProgrammes: this.cachedProgrammes.length,
      pairedDevicesCount: this.pairedDevices.size,
      serverTime: new Date().toISOString(),
    };
  }
}
