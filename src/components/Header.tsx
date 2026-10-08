import React, { useState } from 'react';
import {
  Radio,
  Tv,
  Smartphone,
  KeyRound,
  ListMusic,
  UserCheck,
  Shield,
  Zap,
  Mic,
  Volume2,
  Sparkles,
  ExternalLink,
  Maximize2,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { PWAInstallButton } from './PWAInstallButton';
import { toggleFullScreen } from '../utils/fullscreen';

export const Header: React.FC = () => {
  const {
    queue,
    remoteConnectedDevices,
    isTvMode,
    setIsTvMode,
    isQueueOpenMobile,
    setIsQueueOpenMobile,
    defaultSingerName,
    setDefaultSingerName,
    roomId,
  } = useKaraoke();

  const [isEditingSinger, setIsEditingSinger] = useState(false);
  const [singerInput, setSingerInput] = useState(defaultSingerName);

  const handleSingerSave = () => {
    if (singerInput.trim()) {
      setDefaultSingerName(singerInput.trim());
    }
    setIsEditingSinger(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-sky-900/60 bg-[#07132c]/95 backdrop-blur-md px-3 sm:px-5 py-2.5 shadow-xl shadow-sky-950/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Brand Logo & Military Slogan */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-700 to-indigo-950 shadow-md shadow-sky-500/30 border-2 border-sky-400/50 shrink-0">
            <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-sky-200" />
            <Zap className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-amber-300 fill-amber-300 absolute -top-1 -right-1 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
          </div>
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-display text-base sm:text-xl lg:text-2xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(56,189,248,0.55)]">
                DISKOMLEK<span className="text-sky-400">AU</span>
              </span>
              <span className="rounded bg-sky-900/80 px-1 py-0.5 text-[8px] sm:text-[9px] font-black text-sky-200 border border-sky-400/50 tracking-wider shadow-sm">
                TNI AU
              </span>
            </div>
            <span className="text-sky-500/40 font-bold shrink-0 hidden sm:inline-block">·</span>
            <span className="font-display text-[11px] sm:text-xs md:text-sm font-black text-amber-300 uppercase tracking-wide drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent whitespace-nowrap shrink-0 hidden sm:inline-block">
              &ldquo;Prajurit Yang Pantang Mundur Walau Suara Hancur&rdquo;
            </span>
          </div>
        </div>

        {/* Singer / Callsign Quick Badge */}
        <div className="hidden lg:flex items-center gap-2 rounded-xl bg-[#0b1c3e] px-3 py-1.5 border border-sky-800/80 shadow-inner">
          <Shield className="h-4 w-4 text-sky-400 shrink-0" />
          {isEditingSinger ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={singerInput}
                onChange={(e) => setSingerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSingerSave()}
                className="w-32 rounded bg-[#061026] px-2 py-0.5 text-xs text-white outline-none border border-sky-500 focus:ring-1 focus:ring-sky-400"
                autoFocus
              />
              <button
                onClick={handleSingerSave}
                className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-500"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSingerInput(defaultSingerName);
                setIsEditingSinger(true);
              }}
              className="group flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
              title="Klik untuk mengubah nama penyanyi / callsign prajurit"
            >
              <span className="text-sky-400/80 font-mono text-[11px]">VOKALIS:</span>
              <span className="font-bold text-sky-200 group-hover:underline">
                {defaultSingerName}
              </span>
            </button>
          )}
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Room & Live HP Connected Badge */}
          <div className="flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-[#091b3e] px-2.5 py-1 text-xs font-mono shadow-sm">
            <Smartphone className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-amber-300 font-bold">{roomId}</span>
            <span className="text-slate-500">·</span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {remoteConnectedDevices} HP
            </span>
          </div>

          {/* PWA Install Button (HP Android, iOS, Smart TV) */}
          <PWAInstallButton variant="header" />

          {/* Single, Intuitive TV Stage Mode Toggle */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsTvMode(!isTvMode)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow ${
                isTvMode
                  ? 'border-sky-400 bg-sky-600 text-white shadow-sky-600/30'
                  : 'border-sky-800/80 bg-[#0a1a3a] text-slate-200 hover:border-sky-400 hover:bg-sky-900/40'
              }`}
              title="Tampilkan Layar Panggung TV Penuh (Tekan ESC untuk kembali)"
            >
              <Tv className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Layar TV</span>
            </button>
            <button
              onClick={() => toggleFullScreen()}
              className="flex items-center justify-center h-8 w-8 rounded-xl border border-sky-800/80 bg-[#0a1a3a] text-sky-300 hover:bg-sky-600 hover:text-white transition shadow cursor-pointer"
              title="Layar Penuh TV / Monitor (F11)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <a
              href={`/?mode=tv&room=${encodeURIComponent(roomId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-xl border border-sky-800/80 bg-[#0a1a3a] text-sky-300 hover:bg-sky-600 hover:text-white transition shadow"
              title="Buka Layar TV di Tab Baru / Monitor Kedua (HDMI / Proyektor)"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Mobile Queue Toggle Drawer Trigger */}
          <button
            onClick={() => setIsQueueOpenMobile(!isQueueOpenMobile)}
            className="relative flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-sky-600/30 transition hover:bg-sky-500 lg:hidden"
            aria-label="Buka Antrean Lagu"
          >
            <ListMusic className="h-4 w-4" />
            <span>Antrean</span>
            {queue.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-slate-950">
                {queue.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

