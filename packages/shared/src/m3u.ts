import { Channel, ChannelGroup, PlaylistOverlay } from './types.js';

export interface ParseM3UOptions {
  overlay?: PlaylistOverlay;
}

export interface ParseM3UResult {
  channels: Channel[];
  groups: ChannelGroup[];
  totalParsed: number;
}

// Simple hash function for deterministic channel IDs without external dependencies
export function generateChannelId(url: string, index: number, name: string): string {
  let hash = 0;
  const str = `${index}:${name}:${url}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'ch_' + Math.abs(hash).toString(36) + '_' + index.toString(36);
}

/**
 * Robust and tolerant parser for extended M3U / M3U8 playlists.
 * Handles BOM, Windows/Unix line breaks, unquoted attributes, missing group titles,
 * and comments between EXTINF and URLs.
 */
export function parseM3U(content: string, options: ParseM3UOptions = {}): ParseM3UResult {
  if (!content) {
    return { channels: [], groups: [], totalParsed: 0 };
  }

  // Remove BOM if present
  let cleanContent = content;
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1);
  }

  const lines = cleanContent.split(/\r?\n/);
  const channels: Channel[] = [];
  const groupCountMap = new Map<string, number>();

  let currentExtInf: {
    duration: number;
    tvgId?: string;
    tvgName?: string;
    tvgLogo?: string;
    groupTitle?: string;
    name: string;
  } | null = null;

  let channelIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      // Parse #EXTINF line
      currentExtInf = parseExtInfLine(line);
      continue;
    }

    // Ignore other directives / comments
    if (line.startsWith('#')) {
      continue;
    }

    // If we have an EXTINF waiting and this line is a URL
    if (currentExtInf && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.includes('://'))) {
      const channelId = generateChannelId(line, channelIndex, currentExtInf.name);
      const groupTitle = currentExtInf.groupTitle || 'Geral';
      
      const overlay = options.overlay;
      const isCustomHidden = overlay?.hiddenChannels?.includes(channelId) ?? false;
      const isGroupHidden = overlay?.hiddenGroups?.includes(groupTitle) ?? false;
      const isFavorite = overlay?.favorites?.includes(channelId) ?? false;
      const customName = overlay?.customNames?.[channelId];
      const customTvgId = overlay?.epgOverrides?.[channelId];
      const customOrder = overlay?.channelOrders?.[channelId];

      const channel: Channel = {
        id: channelId,
        name: customName || currentExtInf.name,
        originalName: currentExtInf.name,
        url: line,
        groupTitle,
        logoUrl: currentExtInf.tvgLogo,
        tvgId: customTvgId || currentExtInf.tvgId,
        tvgName: currentExtInf.tvgName,
        order: customOrder !== undefined ? customOrder : channelIndex,
        isFavorite,
        isHidden: isCustomHidden || isGroupHidden,
      };

      channels.push(channel);
      groupCountMap.set(groupTitle, (groupCountMap.get(groupTitle) || 0) + 1);

      channelIndex++;
      currentExtInf = null;
    }
  }

  // Build groups list
  const groups: ChannelGroup[] = [];
  let groupOrder = 0;
  for (const [groupName, count] of groupCountMap.entries()) {
    const isHidden = options.overlay?.hiddenGroups?.includes(groupName) ?? false;
    const customOrder = options.overlay?.groupOrders?.[groupName];

    groups.push({
      name: groupName,
      count,
      isHidden,
      order: customOrder !== undefined ? customOrder : groupOrder++,
    });
  }

  // Sort groups and channels according to order
  groups.sort((a, b) => a.order - b.order);
  channels.sort((a, b) => a.order - b.order);

  return {
    channels,
    groups,
    totalParsed: channels.length,
  };
}

/**
 * Extracts attributes and channel name from an #EXTINF line.
 * Example: #EXTINF:-1 tvg-id="Globo.br" tvg-name="TV Globo" tvg-logo="http://..." group-title="Abertos",Globo HD
 */
function parseExtInfLine(line: string): {
  duration: number;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
  name: string;
} {
  const content = line.substring(8); // Remove '#EXTINF:'
  const commaIndex = content.indexOf(',');

  let attributesPart = '';
  let name = 'Sem Nome';

  if (commaIndex !== -1) {
    attributesPart = content.substring(0, commaIndex).trim();
    name = content.substring(commaIndex + 1).trim() || 'Sem Nome';
  } else {
    attributesPart = content.trim();
  }

  // Parse duration (first token)
  const durationMatch = attributesPart.match(/^([-\d]+)/);
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : -1;

  // Extract key="value" or key='value' or key=value
  const tvgId = extractAttribute(attributesPart, 'tvg-id');
  const tvgName = extractAttribute(attributesPart, 'tvg-name');
  const tvgLogo = extractAttribute(attributesPart, 'tvg-logo');
  const groupTitle = extractAttribute(attributesPart, 'group-title');

  return {
    duration,
    tvgId: tvgId || undefined,
    tvgName: tvgName || undefined,
    tvgLogo: tvgLogo || undefined,
    groupTitle: groupTitle || undefined,
    name,
  };
}

function extractAttribute(text: string, attribute: string): string | null {
  // Regex supporting quotes and unquoted values
  const regex = new RegExp(`${attribute}=(?:"([^"]*)"|'([^']*)'|([^\\s,]+))`, 'i');
  const match = text.match(regex);
  if (match) {
    return match[1] ?? match[2] ?? match[3] ?? null;
  }
  return null;
}
