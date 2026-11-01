export interface Channel {
  id: string; // Unique hash or ID generated locally
  name: string; // User-facing name (can be customized)
  originalName: string; // Original name from M3U
  url: string; // Stream URL
  groupTitle: string; // Category or group
  logoUrl?: string; // tvg-logo
  tvgId?: string; // tvg-id for EPG mapping
  tvgName?: string; // tvg-name
  order: number; // Position in list
  isFavorite: boolean; // Marked as favorite
  isHidden: boolean; // Hidden from player
}

export interface ChannelGroup {
  name: string;
  count: number;
  isHidden: boolean;
  order: number;
}

export interface PlaylistOverlay {
  version: number;
  updatedAt: string;
  customNames: Record<string, string>; // channelId -> customized name
  favorites: string[]; // array of channelIds
  hiddenChannels: string[]; // array of channelIds
  hiddenGroups: string[]; // array of group names
  channelOrders: Record<string, number>; // channelId -> order
  groupOrders: Record<string, number>; // groupName -> order
  epgOverrides: Record<string, string>; // channelId -> custom tvgId
}

export interface EPGProgramme {
  id: string;
  channelTvgId: string;
  title: string;
  description?: string;
  start: string; // ISO 8601 string
  stop: string; // ISO 8601 string
}

export interface DevicePairingSession {
  pin: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  isUsed: boolean;
}

export interface PairedDevice {
  deviceId: string;
  name: string;
  token: string;
  pairedAt: string;
  lastSeenAt: string;
}

export interface SystemStatus {
  hasPlaylist: boolean;
  totalChannels: number;
  totalGroups: number;
  activeChannels: number;
  activeGroups: number;
  favoriteChannels: number;
  hasEpg: boolean;
  totalProgrammes: number;
  pairedDevicesCount: number;
  serverTime: string;
}
