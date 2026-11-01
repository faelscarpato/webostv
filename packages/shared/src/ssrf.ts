/**
 * Security and SSRF Prevention Utilities
 */

export interface SSRFValidationResult {
  isSafe: boolean;
  reason?: string;
}

/**
 * Checks whether an IP address belongs to any restricted or private network ranges.
 */
export function isRestrictedIP(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase();

  // IPv6 Loopback & Link-local
  if (cleanIp === '::1' || cleanIp === '::' || cleanIp.startsWith('fe80:') || cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) {
    return true;
  }

  // IPv6 mapped IPv4 (e.g. ::ffff:127.0.0.1)
  if (cleanIp.startsWith('::ffff:')) {
    const v4 = cleanIp.substring(7);
    return isRestrictedIP(v4);
  }

  // Check if string is a valid IPv4 address (4 numeric octets 0-255)
  const parts = cleanIp.split('.');
  if (parts.length !== 4) {
    return false; // Not an IPv4 literal
  }

  const nums = parts.map(p => {
    if (!/^\d+$/.test(p)) return -1;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255 ? n : -1;
  });

  if (nums.some(n => n === -1)) {
    return false; // Not a valid IPv4 literal
  }

  const [a, b, c, d] = nums;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 224.0.0.0/4 (Multicast 224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Validates a URL scheme and hostname structure before making an external fetch.
 */
export function validateUrlPreflight(urlString: string): SSRFValidationResult {
  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isSafe: false, reason: `Protocolo '${parsed.protocol}' não suportado. Apenas http: e https: são permitidos.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check direct IP literals
    if (isRestrictedIP(hostname)) {
      return { isSafe: false, reason: `Endereço IP '${hostname}' pertence a uma faixa restrita (loopback, privada ou metadados).` };
    }

    // Check special localhost names
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
      return { isSafe: false, reason: `Hostname '${hostname}' não permitido por segurança.` };
    }

    return { isSafe: true };
  } catch (err) {
    return { isSafe: false, reason: 'URL inválida ou malformada.' };
  }
}

/**
 * Sanitizes URLs and sensitive parameters for logging, stripping passwords, tokens and secrets.
 */
export function sanitizeLog(text: string): string {
  if (!text) return '';

  return text
    // Redact password in user:pass@host
    .replace(/(https?:\/\/)([^:\s\/]+):([^@\s\/]+)@/gi, '$1$2:***REDACTED***@')
    // Redact sensitive query parameters
    .replace(/([?&](?:password|token|secret|key|auth|pass)=)([^&\s]+)/gi, '$1***REDACTED***')
    // Redact bearer tokens
    .replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1***REDACTED***');
}
