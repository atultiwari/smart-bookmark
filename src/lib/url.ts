const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'utm_brand',
  'utm_social',
  'utm_social-type'
]);

const DEFAULT_PORTS = new Map([
  ['http:', '80'],
  ['https:', '443']
]);

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, '');
}

function trimTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '/');
  }
  return pathname;
}

function removeTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function sanitizeParamValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.replace(/\/+$/, '');
}

export function canonicalizeUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl.trim();
  }

  url.hostname = stripWww(url.hostname.toLowerCase());

  const defaultPort = DEFAULT_PORTS.get(url.protocol);
  if (defaultPort && url.port === defaultPort) {
    url.port = '';
  }

  for (const param of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.has(param) || param.toLowerCase().startsWith('utm_')) {
      url.searchParams.delete(param);
    }
  }

  // Sort remaining params for stability
  if (url.searchParams.toString()) {
    const sorted = new URLSearchParams();
    const entries = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of entries) {
      sorted.append(key, sanitizeParamValue(value));
    }
    url.search = sorted.toString() ? `?${sorted.toString()}` : '';
  } else {
    url.search = '';
  }

  url.hash = '';

  const cleanedPath = trimTrailingSlash(url.pathname);
  url.pathname = removeTrailingSlash(cleanedPath);

  return url.toString();
}

export function extractDomain(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return stripWww(url.hostname.toLowerCase());
  } catch {
    return rawUrl;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API not available for hashing.');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function sameCanonicalUrl(a: string, b: string): boolean {
  return canonicalizeUrl(a) === canonicalizeUrl(b);
}
