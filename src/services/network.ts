/**
 * Universal Network & Barcode URL Resolver
 * Ensures barcode URLs are accessible by everyone (Semua Orang) across all regions,
 * Cloud Run shared domains, local WiFi/LAN networks, and all devices.
 */

const STORAGE_CUSTOM_HOST_KEY = 'karaoke_universal_custom_host_v1';
const STORAGE_URL_MODE_KEY = 'karaoke_universal_url_mode_v1';

export type UrlMode = 'shared' | 'origin' | 'lan' | 'custom';

export interface NetworkInfo {
  detectedUrl: string;
  sharedUrl: string;
  rawDetectedUrl?: string;
  localIps: string[];
  port: number;
  region?: string;
  isCloudRun: boolean;
}

let cachedNetworkInfo: NetworkInfo | null = null;

export async function fetchServerNetworkInfo(forceRefresh = false): Promise<NetworkInfo | null> {
  if (cachedNetworkInfo && !forceRefresh) return cachedNetworkInfo;
  try {
    const res = await fetch('/api/network-info', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        cachedNetworkInfo = data;
        return data;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function getCustomHostOverride(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_CUSTOM_HOST_KEY) || '';
}

export function setCustomHostOverride(host: string): void {
  if (typeof window === 'undefined') return;
  const clean = host.trim().replace(/\/$/, '');
  if (clean) {
    localStorage.setItem(STORAGE_CUSTOM_HOST_KEY, clean);
  } else {
    localStorage.removeItem(STORAGE_CUSTOM_HOST_KEY);
  }
}

export function getUrlMode(): UrlMode {
  if (typeof window === 'undefined') return 'origin';
  const stored = localStorage.getItem(STORAGE_URL_MODE_KEY);
  if (stored === 'origin' || stored === 'shared' || stored === 'lan' || stored === 'custom') {
    return stored;
  }
  // Default to 'origin' so mobile client connects to the exact same running server as the screen
  return 'origin';
}

export function setUrlMode(mode: UrlMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_URL_MODE_KEY, mode);
}

/**
 * Computes the optimal public URL for the room barcode so that everyone can access it:
 * - 'shared': Uses the public shared URL (ais-pre-...) which doesn't require developer login
 * - 'origin': Uses the current active window.location.origin
 * - 'lan': Uses local WiFi IP if on local network
 * - 'custom': Uses manual custom domain/host
 */
export function getUniversalBarcodeUrl(
  roomId: string,
  networkInfo?: NetworkInfo | null,
  modeOverride?: UrlMode
): string {
  const mode = modeOverride || getUrlMode();
  const cleanRoom = encodeURIComponent(roomId.trim().toUpperCase());

  // 1. Custom mode
  if (mode === 'custom') {
    const custom = getCustomHostOverride();
    if (custom) {
      const base = custom.startsWith('http') ? custom : `https://${custom}`;
      return `${base}/?client=1&room=${cleanRoom}`;
    }
  }

  // 2. Local LAN mode
  if (mode === 'lan' && networkInfo?.localIps && networkInfo.localIps.length > 0) {
    const lanIp = networkInfo.localIps[0];
    return `http://${lanIp}:${networkInfo.port}/?client=1&room=${cleanRoom}`;
  }

  // 3. Shared Public mode (accessible to everyone without login)
  if (mode === 'shared') {
    // If server provided sharedUrl
    if (networkInfo?.sharedUrl && networkInfo.sharedUrl.startsWith('http')) {
      return `${networkInfo.sharedUrl}/?client=1&room=${cleanRoom}`;
    }

    // Convert from window.location.origin if it contains ais-dev-
    if (typeof window !== 'undefined' && window.location.origin.includes('ais-dev-')) {
      const publicShared = window.location.origin.replace('ais-dev-', 'ais-pre-');
      return `${publicShared}/?client=1&room=${cleanRoom}`;
    }

    if (networkInfo?.detectedUrl && networkInfo.detectedUrl.includes('ais-dev-')) {
      const publicShared = networkInfo.detectedUrl.replace('ais-dev-', 'ais-pre-');
      return `${publicShared}/?client=1&room=${cleanRoom}`;
    }
  }

  // 4. Origin mode or fallback
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('about:')) {
    return `${window.location.origin}/?client=1&room=${cleanRoom}`;
  }

  return `/?client=1&room=${cleanRoom}`;
}

/**
 * Builds WhatsApp share link with prefilled invitation message
 */
export function getWhatsAppShareUrl(roomId: string, clientUrl: string): string {
  const text = `🎤 *KARAOKE DISKOMLEKAU TNI AU*\n"Prajurit Yang Pantang Mundur Walau Suara Hancur"\n\nMari gabung ke Room: *${roomId}*\nKlik tautan ini untuk memilih lagu & mengatur antrean dari HP Anda:\n${clientUrl}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
