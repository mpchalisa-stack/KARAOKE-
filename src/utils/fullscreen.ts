/**
 * Cross-browser Fullscreen Controller with Vendor Prefixes for Smart TVs (Tizen, webOS, Android TV)
 * Supports standard requestFullscreen, webkitRequestFullscreen, mozRequestFullScreen, and msRequestFullscreen.
 */

export function toggleFullScreen(): void {
  if (typeof window === 'undefined') return;
  const doc = window.document as any;
  const docEl = doc.documentElement as any;

  const requestFullScreen =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen;

  const cancelFullScreen =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;

  if (
    !doc.fullscreenElement &&
    !doc.webkitFullscreenElement &&
    !doc.mozFullScreenElement &&
    !doc.msFullscreenElement
  ) {
    if (requestFullScreen) {
      try {
        const res = requestFullScreen.call(docEl);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (e) {
        console.warn('[Fullscreen] requestFullScreen error:', e);
      }
    }
  } else {
    if (cancelFullScreen) {
      try {
        const res = cancelFullScreen.call(doc);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (e) {
        console.warn('[Fullscreen] cancelFullScreen error:', e);
      }
    }
  }
}

export function isFullScreenActive(): boolean {
  if (typeof window === 'undefined') return false;
  const doc = window.document as any;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function addFullScreenChangeListener(callback: (isFull: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    callback(isFullScreenActive());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}

/**
 * Explicitly enter fullscreen mode with WebKit vendor prefix support (Tizen Samsung TV, LG webOS, etc.)
 */
export function enterFullScreen(targetEl?: Element): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const doc = window.document as any;
  const docEl = (targetEl || doc.documentElement) as any;

  const requestFullScreen =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen;

  if (requestFullScreen) {
    try {
      const res = requestFullScreen.call(docEl);
      if (res && typeof res.then === 'function') {
        return res.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    } catch (e) {
      console.warn('[Fullscreen] enterFullScreen error:', e);
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(false);
}

/**
 * Explicitly exit fullscreen mode with WebKit vendor prefix support
 */
export function exitFullScreen(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const doc = window.document as any;
  const cancelFullScreen =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;

  if (cancelFullScreen) {
    try {
      const res = cancelFullScreen.call(doc);
      if (res && typeof res.then === 'function') {
        return res.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    } catch (e) {
      console.warn('[Fullscreen] exitFullScreen error:', e);
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(false);
}

// Global reference for Screen Wake Lock sentinel
let wakeLockSentinel: any = null;

/**
 * Screen Wake Lock API to prevent Smart TV screens from sleeping or dimming during karaoke
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if ('wakeLock' in navigator && (navigator as any).wakeLock) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      if (wakeLockSentinel) {
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
      return true;
    } catch (err) {
      console.warn('[WakeLock] Unable to acquire screen wake lock:', err);
      return false;
    }
  }
  return false;
}

export function releaseScreenWakeLock(): void {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch (e) {}
    wakeLockSentinel = null;
  }
}

// Bind to window for TV remotes and global event handling
if (typeof window !== 'undefined') {
  (window as any).toggleFullScreen = toggleFullScreen;
  (window as any).enterFullScreen = enterFullScreen;
  (window as any).requestScreenWakeLock = requestScreenWakeLock;
}
