import React, { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Mic,
  Zap,
  Radio,
  Minimize2,
  Maximize2,
  ListMusic,
  ChevronRight,
  Tv,
  CheckCircle2,
  Play,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { fetchServerNetworkInfo, getUniversalBarcodeUrl, NetworkInfo } from '../services/network';
import {
  enterFullScreen,
  toggleFullScreen,
  isFullScreenActive,
  addFullScreenChangeListener,
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from '../utils/fullscreen';

interface TVStageModeProps {
  standalone?: boolean;
}

export const TVStageMode: React.FC<TVStageModeProps> = ({ standalone = false }) => {
  const {
    isTvMode,
    setIsTvMode,
    currentSong,
    queue,
    roomId,
    remoteConnectedDevices,
    activeWirelessMics,
    activeReactions,
    isPlaying,
    musicDelayMs,
    setMusicDelayMs,
    connectMusicMediaElement,
  } = useKaraoke();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [tvQrUrl, setTvQrUrl] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isFullScreenActive());
  const [showExitHint, setShowExitHint] = useState<boolean>(false);
  const [showSyncControl, setShowSyncControl] = useState<boolean>(false);
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Samsung Smart TV Tizen One-Key Activation & Splash State
  const [hasActivated, setHasActivated] = useState<boolean>(() => {
    // If browser is already in fullscreen mode on entry, bypass splash
    return isFullScreenActive();
  });
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // Fetch server detected IP/hostname on mount
  useEffect(() => {
    fetchServerNetworkInfo().then((info) => {
      if (info) setNetworkInfo(info);
    });
  }, []);

  // Monitor fullscreen state across TV vendor prefixes (WebKit / Tizen / webOS)
  useEffect(() => {
    setIsFullscreen(isFullScreenActive());
    return addFullScreenChangeListener((active) => {
      setIsFullscreen(active);
    });
  }, []);

  // Ensure TV mode CSS classes on document element and body to hide scrollbar & cursor
  useEffect(() => {
    document.documentElement.classList.add('tv-mode-active');
    document.body.classList.add('tv-mode-active');
    return () => {
      document.documentElement.classList.remove('tv-mode-active');
      document.body.classList.remove('tv-mode-active');
      releaseScreenWakeLock();
    };
  }, []);

  // One-Key Activation handler for Samsung Smart TV (Tizen OS)
  const activateTvScreen = useCallback(async () => {
    setHasActivated(true);

    // 1. Trigger Cross-Browser & WebKit Fullscreen
    try {
      await enterFullScreen();
    } catch (e) {
      console.warn('[TV] enterFullScreen failed:', e);
    }

    // 2. Request Screen Wake Lock API to prevent TV sleep / screensaver
    try {
      const locked = await requestScreenWakeLock();
      setWakeLockActive(locked);
    } catch (e) {
      console.warn('[TV] requestScreenWakeLock failed:', e);
    }
  }, []);

  // Re-acquire Screen Wake Lock when window gains focus or visibility state returns
  useEffect(() => {
    if (!hasActivated) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestScreenWakeLock().then((locked) => setWakeLockActive(locked));
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hasActivated]);

  const handleExit = useCallback(() => {
    releaseScreenWakeLock();
    if (standalone) {
      window.location.href = `/?room=${encodeURIComponent(roomId)}`;
    } else {
      setIsTvMode(false);
    }
  }, [standalone, roomId, setIsTvMode]);

  // Comprehensive TV Remote key listener (Samsung Tizen, WebKit, standard keys)
  useEffect(() => {
    if (!isTvMode && !standalone) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyCode = e.keyCode || e.which;
      const key = e.key;

      // Samsung TV Remote Tizen KeyCodes:
      // 13: Enter / OK
      // 10009: Return / Back
      // 37: ArrowLeft, 38: ArrowUp, 39: ArrowRight, 40: ArrowDown
      // 10182: Exit
      const isEnterOrOk = keyCode === 13 || key === 'Enter';
      const isReturnOrBack = keyCode === 10009 || key === 'Escape' || key === 'Backspace' || keyCode === 10182;
      const isArrowKey =
        (keyCode >= 37 && keyCode <= 40) ||
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);

      // If TV splash overlay is visible, ANY remote button (Enter, Arrows, etc.) activates fullscreen & starts video
      if (!hasActivated) {
        e.preventDefault();
        e.stopPropagation();
        activateTvScreen();
        return;
      }

      // If already activated:
      if (isReturnOrBack) {
        handleExit();
      } else if (isEnterOrOk || key === 'f' || key === 'F') {
        toggleFullScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode, standalone, hasActivated, activateTvScreen, handleExit]);

  // Synchronize TV YouTube iframe with play/pause state from Mobile Remote / Tablet
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow || !hasActivated) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: isPlaying ? 'playVideo' : 'pauseVideo',
          args: '',
        }),
        '*'
      );
    } catch (e) {}
  }, [isPlaying, hasActivated]);

  const clientUrl = getUniversalBarcodeUrl(roomId, networkInfo);

  // Instant fallback QR code URL so it never renders blank
  const instantFallbackQr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    clientUrl
  )}&color=000000&bgcolor=ffffff&margin=2`;

  // High-definition local QRCode generation
  useEffect(() => {
    if (!isTvMode && !standalone) return;
    let isMounted = true;

    QRCode.toDataURL(clientUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) setTvQrUrl(url);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isTvMode, standalone, clientUrl]);

  // Mouse activity detector: temporarily show discreet exit pill when mouse moves, then hide
  const handleMouseMove = () => {
    setShowExitHint(true);
    if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    mouseTimeoutRef.current = setTimeout(() => {
      setShowExitHint(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, []);

  if (!isTvMode && !standalone) return null;

  const currentQrImage = tvQrUrl || instantFallbackQr;
  const isMicLive = activeWirelessMics && activeWirelessMics.length > 0;
  const activeMicCount = activeWirelessMics?.length || 0;

  // Next up songs for the top bar queue banner
  const topQueueList = queue.slice(0, 4);

  // Marquee running ticker texts di sudut bawah layar
  const marqueeItems = [
    '✨ DISKOMLEK KARAOKE FAMILY ROOM',
    '🎖️ "Prajurit yang pantang mundur walau suara hancur"',
    `📱 Remote & Mic HP: Scan QR Code di pojok kanan atas [KODE ROOM: ${roomId}]`,
    '🎤 Selamat bernyanyi dan nikmati momen kebersamaan!',
    '⭐ Pilih lagu, atur volume, dan kirim reaksi suara langsung dari smartphone Anda',
  ];
  const marqueeText = marqueeItems.join('     ✦     ');

  // Video embed URL with auto-optimized parameters for commercial TV playback
  const videoId = currentSong?.id || 'BnlzOzdP8Is';
  const iframeSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&iv_load_policy=3&playsinline=1&controls=0&modestbranding=1`;

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`fixed inset-0 z-50 flex flex-col bg-black text-white select-none overflow-hidden font-sans ${
        isFullscreen ? 'tv-fullscreen-mode' : ''
      }`}
      style={{
        backgroundColor: '#000000',
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* =========================================================================
          SPESIFIKASI 1 & 2: OVERLAY PEMICU AWAL (START SCREEN / TV SPLASH)
          One-Key Activation untuk Web Browser Samsung Smart TV (Tizen OS)
         ========================================================================= */}
      {!hasActivated && (
        <div
          onClick={activateTvScreen}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl select-none cursor-pointer p-4 sm:p-8 animate-in fade-in duration-300"
          aria-label="Layar Pemicu Layar Penuh Smart TV"
        >
          {/* Subtle Background Radar/Pulse Glow */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
            <div className="w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] rounded-full bg-sky-500/10 blur-3xl animate-pulse" />
          </div>

          {/* Central Interactive Activation Card */}
          <div className="relative z-10 flex flex-col items-center max-w-2xl w-full p-6 sm:p-10 rounded-3xl bg-slate-900/85 border border-sky-400/30 shadow-[0_0_60px_rgba(14,165,233,0.35)] text-center transition-all transform hover:scale-[1.01]">
            {/* Header Icon / Badge */}
            <div className="relative mb-4 sm:mb-5">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-800 shadow-xl shadow-sky-500/50 border border-sky-300/40">
                <Tv className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-pulse" />
              </div>
              <span className="absolute -bottom-2 -right-2 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-black shadow">
                TIZEN READY
              </span>
            </div>

            {/* TV Splash Title */}
            <h1 className="font-display font-black text-2xl sm:text-4xl lg:text-5xl tracking-wider uppercase text-white drop-shadow-[0_0_20px_rgba(56,189,248,0.8)]">
              DISKOMLEK <span className="text-sky-400">KARAOKE</span>
            </h1>

            {/* Sub-Title: INTERACTIVE VOCAL SIMULATION SYSTEM DISKOMLEKAU */}
            <div className="mt-3 sm:mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/70 border border-white/20 shadow-lg">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-bold text-[11px] sm:text-xs text-sky-200 uppercase tracking-widest">
                Interactive Vocal Simulation System Diskomlekau
              </span>
            </div>

            {/* Primary Action Button / Remote Prompt Box */}
            <div className="mt-6 sm:mt-8 w-full max-w-lg p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-600/90 via-blue-600/90 to-sky-600/90 border-2 border-white/40 shadow-[0_0_35px_rgba(56,189,248,0.6)] flex flex-col items-center justify-center gap-2 animate-bounce cursor-pointer group">
              <div className="flex items-center gap-3">
                <Play className="h-5 w-5 sm:h-6 sm:w-6 text-amber-300 fill-amber-300" />
                <span className="text-base sm:text-lg md:text-xl font-extrabold uppercase text-white tracking-wide group-hover:scale-105 transition-transform">
                  Tekan tombol [OK / ENTER] pada Remote TV
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-sky-100/90">
                untuk Masuk Mode Layar Penuh &amp; Memulai Karaoke
              </span>
            </div>

            {/* Secondary note for mouse pointer / touch */}
            <p className="mt-4 text-xs sm:text-sm text-slate-300 flex items-center justify-center gap-1.5">
              <span>Atau klik tombol / kursor TV di layar untuk melanjutkan</span>
            </p>

            {/* TV Room Quick Reference */}
            <div className="mt-6 pt-5 border-t border-white/10 w-full flex items-center justify-around flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">
                  KODE ROOM: <strong className="text-amber-300 font-mono text-sm">{roomId}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span>Engine: WebKit Tizen 100% Compatible</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          1. LAYOUT & VIDEO UTAMA: 100% Fullscreen Edge-to-Edge
             Area tengah 100% bersih untuk lirik karaoke commercial quality.
             Mounted / activated once user gives gesture via Remote TV or Click.
         ========================================================================= */}
      <div className="absolute inset-0 w-full h-full bg-black z-0 pointer-events-auto">
        {hasActivated ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-0 pointer-events-none sm:pointer-events-auto"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title="DISKOMLEK KARAOKE Video Player"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="text-center space-y-2 opacity-40">
              <Tv className="h-16 w-16 mx-auto text-sky-400 animate-pulse" />
              <p className="text-sm font-mono text-slate-400">Menunggu aktivasi remote TV...</p>
            </div>
          </div>
        )}
      </div>

      {/* Subtle vignette border along outermost edges for readability of overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-black/65 via-transparent to-black/75" />

      {/* =========================================================================
          AREA ATAS TENGAH TV MASTER:
          1. DAFTAR ANTREAN LAGU (PALING ATAS)
          2. JUDUL: "INTERACTIVE VOCAL SIMULATION SYSTEM DISKOMLEKAU" (TEPAT DI BAWAH DAFTAR ANTREAN LAGU)
          - z-index: 60 (layer terdepan mutlak)
          - Menggunakan flex-col terpadu agar Judul selalu berada tepat di bawah antrean lagu secara konsisten
          - Warna Merah dengan outline/stroke Putih (.title-red-white-stroke), PERBESAR
         ========================================================================= */}
      <div
        className="absolute top-2 sm:top-3 inset-x-0 z-[60] flex flex-col items-center pointer-events-none px-3 sm:px-6 gap-1.5 sm:gap-2"
        aria-label="Antrean Lagu dan Judul Sistem"
      >
        {/* 1. DAFTAR ANTREAN LAGU (PALING ATAS) */}
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 px-3 sm:px-5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/20 shadow-xl max-w-[92vw] md:max-w-[70vw] lg:max-w-[62vw] overflow-hidden flex-wrap justify-center pointer-events-auto">
          <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-lg text-amber-300 font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 shadow-sm">
            <ListMusic className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400" />
            <span>ANTREAN MUSIK:</span>
            {queue.length > 0 && (
              <span className="ml-0.5 bg-amber-400 text-black px-1 rounded-full text-[8px] sm:text-[9px] font-extrabold">
                {queue.length}
              </span>
            )}
          </div>

          {/* Daftar lagu antrean berikutnya */}
          {topQueueList.length > 0 ? (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden flex-wrap justify-center">
              {topQueueList.map((item, idx) => (
                <div
                  key={item.queueId}
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded-lg border border-white/10 max-w-[170px] sm:max-w-[220px] md:max-w-[260px] shadow-sm backdrop-blur-sm"
                >
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-sky-300 shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-white truncate">
                    {item.song.title}
                  </span>
                  <span className="text-[9px] text-amber-300 font-bold truncate shrink-0">
                    ({item.singerName})
                  </span>
                  {idx < topQueueList.length - 1 && (
                    <ChevronRight className="h-2.5 w-2.5 text-white/40 shrink-0 hidden sm:inline" />
                  )}
                </div>
              ))}
              {queue.length > topQueueList.length && (
                <span className="text-[9px] font-mono text-slate-300 bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                  +{queue.length - topQueueList.length} lagi
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 italic px-2">
              Antrean kosong (Pilih &amp; masukkan lagu lewat remote HP)
            </span>
          )}
        </div>

        {/* 2. JUDUL UTAMA TV MASTER (DI BAWAH DAFTAR ANTREAN LAGU) */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 py-1.5 sm:py-2.5 px-4 sm:px-8 rounded-2xl bg-black/85 backdrop-blur-md border border-white/20 shadow-[0_4px_35px_rgba(0,0,0,0.95)] max-w-[96vw] transition-all">
          <Zap className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-amber-300 fill-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)] animate-pulse shrink-0" />
          <h1 className="font-display font-black uppercase tracking-wider text-center text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl leading-tight title-red-white-stroke drop-shadow-2xl whitespace-nowrap">
            INTERACTIVE VOCAL SIMULATION SYSTEM DISKOMLEKAU
          </h1>
          <span className="rounded bg-sky-950/90 px-2 py-0.5 text-[9px] sm:text-[10px] lg:text-xs font-black text-sky-200 border border-sky-400/60 tracking-wider shrink-0 shadow">
            TNI AU
          </span>
        </div>
      </div>

      {/* =========================================================================
          PANEL INFO LAGU & BRAND ("DISKOMLEK KARAOKE" + "NOW PLAYING"):
          - Diposisikan rapi di pojok kiri di bawah banner judul & antrean
          - z-30 memastikan layer rapi tanpa menumpuk judul utama (z-60)
         ========================================================================= */}
      <header
        className="absolute top-[106px] sm:top-[118px] md:top-[126px] left-3 sm:left-6 z-30 pointer-events-none max-w-[210px] sm:max-w-xs"
        aria-label="Informasi Ruang & Lagu"
      >
        <div className="flex flex-col gap-1.5 p-2 sm:p-2.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl transition-all">
          {/* Logo & Title */}
          <div className="flex items-center gap-2">
            <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-800 shadow-md shadow-sky-500/40 border border-sky-300/40 shrink-0">
              <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-100" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-display text-xs sm:text-sm font-black tracking-wider text-white drop-shadow-[0_0_10px_rgba(56,189,248,0.7)] uppercase">
                  DISKOMLEK <span className="text-sky-400">KARAOKE</span>
                </span>
              </div>
            </div>
          </div>

          {/* Now Playing Song Info */}
          <div className="pt-1.5 border-t border-white/10 flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>

            <div className="flex flex-col min-w-0">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-sky-300 uppercase">
                NOW PLAYING:
              </span>
              <p
                className="text-[11px] sm:text-xs md:text-sm font-bold text-white truncate drop-shadow max-w-[170px] sm:max-w-[240px]"
                title={currentSong ? currentSong.title : 'Pilih lagu untuk bernyanyi...'}
              >
                {currentSong ? currentSong.title : 'Pilih lagu via HP...'}
              </p>
              {currentSong?.channelTitle && (
                <span className="text-[10px] text-slate-300 truncate font-medium">
                  {currentSong.channelTitle}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          POJOK KANAN ATAS: QR Code & Room Info
          - Diposisikan di top-[106px] sm:top-[118px] md:top-[126px] sejajar panel kiri
          - Memberikan ruang penuh di atas untuk judul utama & antrean lagu
         ========================================================================= */}
      <aside
        className="absolute top-[106px] sm:top-[118px] md:top-[126px] right-3 sm:right-6 z-30 pointer-events-auto"
        aria-label="Scan Remote & Mic Smartphone"
      >
        <div className="flex flex-col items-center p-2 sm:p-2.5 rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 shadow-2xl text-center group hover:bg-black/70 transition-all">
          {/* QR Code Graphic Box */}
          <div className="rounded-xl bg-white p-1 shadow-lg border border-white/20 shrink-0">
            <img
              src={currentQrImage}
              alt={`QR Code Ruang ${roomId}`}
              className="h-16 w-16 sm:h-20 sm:w-20 md:h-22 md:w-22 object-contain rounded"
            />
          </div>

          {/* Under-QR Text & Room Code */}
          <div className="mt-1 flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-200 tracking-wide">
              Scan Remote &amp; Mic
            </span>
            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-sky-950/80 border border-sky-500/40 text-amber-300 font-mono text-[10px] sm:text-xs font-black tracking-wider shadow">
              <span>{roomId}</span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold">({remoteConnectedDevices} HP)</span>
            </div>
          </div>

          {/* Wireless Mic HP Live Status Indicator */}
          <div className="mt-1 w-full pt-1 border-t border-white/10 flex items-center justify-center">
            {isMicLive ? (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[9px] sm:text-[10px] font-bold animate-pulse">
                <Mic className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-400" />
                <span>Mic ON ({activeMicCount})</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400 font-medium">
                <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-500" />
                <span>Mic Standby</span>
              </div>
            )}
          </div>

          {/* Vocal Sync Delay Buffer Indicator */}
          <div className="mt-1 w-full pt-1 border-t border-white/10 flex items-center justify-center">
            <button
              onClick={() => setShowSyncControl(!showSyncControl)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/50 text-amber-300 text-[9px] font-mono font-bold hover:bg-amber-900/80 transition cursor-pointer"
              title="Atur Sinkronisasi Musik TV (Delay Buffer)"
            >
              <Zap className="h-2.5 w-2.5 text-amber-400" />
              <span>Sync: +{musicDelayMs}ms</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Floating Vocal Sync Control Panel on TV */}
      {showSyncControl && (
        <div className="absolute top-[255px] sm:top-[270px] right-3 sm:right-6 z-40 p-3 rounded-2xl bg-black/90 backdrop-blur-xl border border-amber-500/60 shadow-2xl space-y-2 text-xs max-w-xs animate-in fade-in duration-200 pointer-events-auto">
          <div className="flex items-center justify-between text-amber-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Sinkron Musik TV:</span>
            </span>
            <span className="font-mono bg-amber-950 px-2 py-0.5 rounded border border-amber-400/40 text-amber-200">
              +{musicDelayMs}ms
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMusicDelayMs(Math.max(0, musicDelayMs - 5))}
              className="h-8 w-8 rounded-lg bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-base flex items-center justify-center border border-amber-500/50 cursor-pointer"
            >
              -
            </button>
            <input
              type="range"
              min="0"
              max="250"
              step="5"
              value={musicDelayMs}
              onChange={(e) => setMusicDelayMs(Number(e.target.value))}
              className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <button
              onClick={() => setMusicDelayMs(Math.min(250, musicDelayMs + 5))}
              className="h-8 w-8 rounded-lg bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-base flex items-center justify-center border border-amber-500/50 cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
            {[0, 60, 75, 100].map((ms) => (
              <button
                key={ms}
                onClick={() => setMusicDelayMs(ms)}
                className={`py-1 rounded border text-center transition cursor-pointer ${
                  musicDelayMs === ms
                    ? 'bg-amber-500 text-black border-amber-300 font-bold'
                    : 'bg-black/60 text-slate-300 hover:text-white border-slate-700'
                }`}
              >
                {ms}ms
              </button>
            ))}
          </div>
          <p className="text-[9px] text-slate-300 leading-tight">
            Menunda sedikit musik di TV agar tepat selaras dengan vokal mic HP.
          </p>
        </div>
      )}

      {/* =========================================================================
          REAL-TIME REACTION OVERLAYS (HUUU / Sorak / Applause)
          Muncul halus di bagian tengah tanpa menutupi lirik karaoke.
         ========================================================================= */}
      {activeReactions.length > 0 && (
        <div className="absolute top-28 sm:top-32 inset-x-0 z-30 flex flex-col items-center pointer-events-none space-y-2">
          {activeReactions.map((rx) => {
            const isHuuu = rx.type === 'boo';
            return (
              <div
                key={rx.id}
                className={`animate-in zoom-in-90 fade-in slide-in-from-top-3 duration-300 flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-md border shadow-2xl max-w-sm transition-all ${
                  isHuuu
                    ? 'bg-rose-950/50 border-rose-500/70 text-rose-100'
                    : 'bg-black/50 border-sky-400/60 text-white'
                }`}
              >
                <span className="text-3xl animate-bounce shrink-0">{rx.emoji}</span>
                <div className="text-left min-w-0">
                  <h3
                    className={`font-display text-sm font-black tracking-wide ${
                      isHuuu ? 'text-amber-300' : 'text-sky-300'
                    }`}
                  >
                    {rx.label}
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-300 truncate">
                    Dari: <span className="text-amber-300 font-bold underline decoration-sky-400">{rx.senderName} (HP)</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discreet Exit & Fullscreen Controls (Shows on mouse hover/movement for convenience) */}
      <div
        className={`absolute bottom-12 left-4 sm:bottom-14 sm:left-6 z-30 transition-opacity duration-300 ${
          showExitHint || !isFullscreen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs shadow-xl">
          <button
            onClick={() => toggleFullScreen()}
            className="flex items-center gap-1.5 text-sky-300 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer font-medium"
            title="Layar Penuh TV"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="text-[11px]">{isFullscreen ? 'Kecilkan' : 'Fullscreen'}</span>
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={handleExit}
            className="flex items-center gap-1 text-slate-300 hover:text-rose-400 transition px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer font-medium text-[11px]"
            title="Kembali ke Konsol Tablet (ESC)"
          >
            <span>Keluar TV (ESC)</span>
          </button>
          {wakeLockActive && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-[10px] text-emerald-400 font-mono">WakeLock ON</span>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. RUNNING TEXT / MARQUEE DI SUDUT BAWAH LAYAR:
             - Ticker running text halus di bagian paling bawah
             - Latar hitam transparan (rgba 0.45) dengan blur
         ========================================================================= */}
      <footer
        className="absolute bottom-0 inset-x-0 h-10 sm:h-11 z-20 pointer-events-none overflow-hidden flex items-center border-t border-white/10"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        aria-label="Running Text Ticker"
      >
        {/* Subtle accent badge on the left */}
        <div className="shrink-0 h-full px-3 sm:px-4 bg-gradient-to-r from-sky-900/80 to-blue-950/80 border-r border-white/10 flex items-center gap-1.5 text-amber-300 font-mono text-[10px] sm:text-[11px] font-black uppercase tracking-wider z-10 shadow-md">
          <Radio className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          <span className="hidden sm:inline">DISKOMLEK</span>
          <span>LIVE</span>
        </div>

        {/* Continuous Smooth Marquee Ticker */}
        <div className="relative flex-1 overflow-hidden whitespace-nowrap flex items-center h-full">
          <div className="animate-marquee-tv text-xs sm:text-[13px] font-semibold text-slate-200 tracking-wide">
            <span className="mx-6">{marqueeText}</span>
            <span className="mx-6">{marqueeText}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
