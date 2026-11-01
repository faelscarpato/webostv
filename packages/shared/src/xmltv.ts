import { EPGProgramme } from './types.js';

/**
 * Lightweight, fast XMLTV parser without external C-bindings.
 * Extracts channels and programme guides matching tvg-id.
 */
export function parseXMLTV(xmlContent: string): { programmes: EPGProgramme[]; channelIds: string[] } {
  if (!xmlContent) {
    return { programmes: [], channelIds: [] };
  }

  const channelIds = new Set<string>();
  const programmes: EPGProgramme[] = [];

  // Match <channel id="..."> tags
  const channelRegex = /<channel\s+[^>]*id=["']([^"']+)["'][^>]*>/gi;
  let chMatch: RegExpExecArray | null;
  while ((chMatch = channelRegex.exec(xmlContent)) !== null) {
    channelIds.add(chMatch[1]);
  }

  // Match <programme start="..." stop="..." channel="...">...</programme>
  const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi;
  let progMatch: RegExpExecArray | null;
  let progIdIndex = 0;

  while ((progMatch = programmeRegex.exec(xmlContent)) !== null) {
    const attrString = progMatch[1];
    const bodyString = progMatch[2];

    const channelAttr = extractXmlAttr(attrString, 'channel');
    const startAttr = extractXmlAttr(attrString, 'start');
    const stopAttr = extractXmlAttr(attrString, 'stop');

    if (!channelAttr || !startAttr || !stopAttr) {
      continue;
    }

    const titleMatch = bodyString.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = bodyString.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i);

    const title = titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : 'Sem Título';
    const description = descMatch ? decodeXmlEntities(descMatch[1].trim()) : undefined;

    const startISO = parseXmltvDate(startAttr);
    const stopISO = parseXmltvDate(stopAttr);

    if (startISO && stopISO) {
      programmes.push({
        id: `epg_${progIdIndex++}`,
        channelTvgId: channelAttr,
        title,
        description,
        start: startISO,
        stop: stopISO,
      });
    }
  }

  return {
    programmes,
    channelIds: Array.from(channelIds),
  };
}

function extractXmlAttr(attrString: string, name: string): string | null {
  const regex = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const match = attrString.match(regex);
  return match ? match[1] : null;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Converts XMLTV date format (YYYYMMDDhhmmss +ZZZZ) into standard ISO 8601.
 * Example: 20261101180000 -0300 -> 2026-11-01T18:00:00-03:00
 */
export function parseXmltvDate(dateStr: string): string | null {
  const clean = dateStr.trim();
  // Regex for YYYYMMDDhhmmss and optional timezone
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{2})(\d{2}))?/);
  if (!match) {
    return null;
  }

  const [_, year, month, day, hour, min, sec, tzH, tzM] = match;
  let tz = 'Z';
  if (tzH && tzM) {
    tz = `${tzH}:${tzM}`;
  }

  return `${year}-${month}-${day}T${hour}:${min}:${sec}${tz}`;
}
