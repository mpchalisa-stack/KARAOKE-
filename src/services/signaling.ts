/**
 * Service: Signaling & Network Configuration
 * Dynamic WebSocket signaling URL resolver, WebRTC ICE servers, and connection state helpers.
 * Supports VITE_SIGNALING_SERVER_URL, NEXT_PUBLIC_SIGNALING_SERVER_URL, dynamic window.location host,
 * and PeerJS public server fallback (0.peerjs.com).
 */

export interface SignalingUrlParams {
  roomId: string;
  role?: 'master' | 'client';
  singerName?: string;
}

/**
 * Public PeerJS cloud infrastructure settings
 * Can be used as a public signaling fallback for WebRTC P2P
 */
export const PEERJS_PUBLIC_SERVER = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  pingInterval: 5000,
};

/**
 * Public STUN/TURN servers with Google, Cloudflare, Mozilla, and PeerJS public server fallbacks.
 * Enables P2P WebRTC ICE candidate exchange across diverse networks without requiring a TURN relay.
 * Configured with iceTransportPolicy 'all' to prioritize direct local LAN/WiFi host candidates.
 */
export const RTC_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Public PeerJS signaling & STUN infrastructure fallback
    { urls: 'stun:0.peerjs.com:3478' },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // Direct STUN & host connection without relay if on the same local WiFi
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

/**
 * Resolves the WebSocket signaling URL dynamically:
 * 1. Checks environment variable VITE_SIGNALING_SERVER_URL or NEXT_PUBLIC_SIGNALING_SERVER_URL or VITE_WS_URL
 * 2. Defaults to current window.location with wss: (HTTPS) or ws: (HTTP)
 * 3. Never hardcoded to localhost on deployed environments
 */
export function getSignalingWebSocketUrl(params: SignalingUrlParams): string {
  const { roomId, role = 'client', singerName = 'Prajurit (HP)' } = params;
  const cleanRoom = encodeURIComponent((roomId || 'DEFAULT-ROOM').trim().toUpperCase());
  const cleanRole = encodeURIComponent(role);
  const cleanSinger = encodeURIComponent(singerName);
  const queryStr = `room=${cleanRoom}&role=${cleanRole}&singer=${cleanSinger}`;

  // 1. Check custom environment variable if configured
  let envUrl: string | undefined = undefined;

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl =
        import.meta.env.VITE_SIGNALING_SERVER_URL ||
        (import.meta.env as any).NEXT_PUBLIC_SIGNALING_SERVER_URL ||
        import.meta.env.VITE_WS_URL;
    }
  } catch {}

  if (!envUrl) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        envUrl =
          process.env.VITE_SIGNALING_SERVER_URL ||
          process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL ||
          process.env.VITE_WS_URL;
      }
    } catch {}
  }

  if (!envUrl) {
    try {
      if (typeof window !== 'undefined' && (window as any).__ENV__) {
        envUrl =
          (window as any).__ENV__.VITE_SIGNALING_SERVER_URL ||
          (window as any).__ENV__.NEXT_PUBLIC_SIGNALING_SERVER_URL;
      }
    } catch {}
  }

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    let base = envUrl.trim();
    // Convert http(s) to ws(s) if necessary
    if (base.startsWith('https://')) {
      base = base.replace('https://', 'wss://');
    } else if (base.startsWith('http://')) {
      base = base.replace('http://', 'ws://');
    } else if (!base.startsWith('wss://') && !base.startsWith('ws://')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      base = (isHttps ? 'wss://' : 'ws://') + base;
    }

    // Strip trailing slash
    base = base.replace(/\/+$/, '');
    const path = base.includes('/ws') ? '' : '/ws';
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${path}${separator}${queryStr}`;
  }

  // 2. Dynamic host detection from window.location (handles any domain / port / Cloud Run host)
  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws?${queryStr}`;
  }

  // 3. Fallback for non-browser context
  return `ws://localhost:3000/ws?${queryStr}`;
}

/**
 * Checks whether the current runtime environment permits navigator.mediaDevices.getUserMedia.
 * Web browsers strictly require a Secure Context (HTTPS or localhost) for microphone access.
 */
export function isSecureContextValid(): { valid: boolean; reason?: string } {
  if (typeof window === 'undefined') {
    return { valid: true };
  }

  // Modern browsers expose window.isSecureContext
  if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    if (!isLocalhost) {
      return {
        valid: false,
        reason:
          'Akses mikrofon diblokir oleh browser karena alamat tidak menggunakan HTTPS aman. Buka aplikasi menggunakan tautan HTTPS agar izin mikrofon dapat diaktifkan.',
      };
    }
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      return {
        valid: false,
        reason:
          'Peramban HP menonaktifkan API mikrofon pada koneksi HTTP biasa. Harap gunakan alamat URL HTTPS agar fitur Mikrofon HP dapat berjalan.',
      };
    }
    return {
      valid: false,
      reason: 'Peramban tidak mendukung akses perekaman mikrofon WebRTC.',
    };
  }

  return { valid: true };
}

/**
 * Returns user-friendly Indonesian error message based on DOMException name from getUserMedia.
 * Explicitly covers NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError, and SecurityError.
 */
export function getFriendlyMicErrorMessage(err: any): string {
  if (!err) return 'Gagal mengakses mikrofon.';

  const name = err.name || '';
  const msg = err.message || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin mikrofon ditolak oleh browser HP. Silakan buka Pengaturan Izin Situs (klik ikon gembok/setelan di samping bilah URL) dan pilih "Izinkan Mikrofon", lalu muat ulang halaman.';
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Perangkat mikrofon tidak ditemukan di ponsel Anda. Pastikan mikrofon HP tidak dinonaktifkan di pengaturan sistem.';
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Mikrofon ponsel sedang digunakan oleh aplikasi lain (misal: WhatsApp, Panggilan Telepon, atau Perekam Suara). Tutup aplikasi lain terlebih dahulu.';
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Konfigurasi audio mikrofon tidak didukung oleh perangkat keras HP ini.';
  }

  if (name === 'SecurityError') {
    return 'Akses mikrofon diblokir oleh kebijakan keamanan browser (wajib menggunakan HTTPS).';
  }

  if (name === 'AbortError') {
    return 'Permintaan akses mikrofon dibatalkan oleh sistem.';
  }

  return msg || 'Gagal mengaktifkan mikrofon. Pastikan izin mikrofon telah diberikan di browser HP.';
}

/**
 * Translates WebSocket readyState numbers to human readable strings
 */
export function getWebSocketStateName(state: number | undefined): string {
  switch (state) {
    case WebSocket.CONNECTING:
      return 'CONNECTING (Sedang Menghubungkan)';
    case WebSocket.OPEN:
      return 'OPEN (Terhubung)';
    case WebSocket.CLOSING:
      return 'CLOSING (Sedang Menutup)';
    case WebSocket.CLOSED:
      return 'CLOSED (Terputus)';
    default:
      return 'OFFLINE (Belum Tersambung)';
  }
}

/**
 * Asynchronously waits for a WebSocket instance to reach OPEN state.
 * Returns true if OPEN within timeoutMs, otherwise false.
 */
export async function waitForWebSocketReady(
  socket: WebSocket | null,
  timeoutMs: number = 6000
): Promise<boolean> {
  if (!socket) return false;
  if (socket.readyState === WebSocket.OPEN) return true;
  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(socket.readyState === WebSocket.OPEN);
      }
    }, timeoutMs);

    const onOpen = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        clearTimeout(timer);
        resolve(true);
      }
    };

    const onCloseOrError = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        clearTimeout(timer);
        resolve(false);
      }
    };

    const cleanup = () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onCloseOrError);
      socket.removeEventListener('error', onCloseOrError);
    };

    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('close', onCloseOrError, { once: true });
    socket.addEventListener('error', onCloseOrError, { once: true });
  });
}
