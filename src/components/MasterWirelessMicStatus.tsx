import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Sparkles, User, Zap, AlertCircle, Volume1 } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';

export const MasterWirelessMicStatus: React.FC = () => {
  const {
    activeWirelessMics,
    masterMicVolume,
    setMasterMicVolume,
    masterMicEcho,
    setMasterMicEcho,
    increaseMicVolume,
    decreaseMicVolume,
    increaseMicEcho,
    decreaseMicEcho,
    isMasterMicMuted,
    setIsMasterMicMuted,
    isAudioSuspended,
    resumeAudio,
    setClientMicVolume,
    setClientMicEcho,
    toggleClientMicMute,
    musicDelayMs,
    setMusicDelayMs,
  } = useKaraoke();

  return (
    <>
      {/* AudioContext unlock prompt (if browser autoplay policy requires user gesture) */}
      {isAudioSuspended && activeWirelessMics.length > 0 && (
        <div className="mb-3 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-900 p-3 shadow-lg shadow-amber-950/60 animate-bounce">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold">
                Browser menahan suara mic HP client karena belum ada sentuhan di layar Master.
              </span>
            </div>
            <button
              onClick={resumeAudio}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-1.5 text-xs font-black text-black shadow-md hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="h-4 w-4" />
              <span>KLIK UNTUK AKTIFKAN SUARA KE SPEAKER</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Client HP Microphones Console (Shows ALL connected singer mics) */}
      {activeWirelessMics.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-r from-[#031c15] via-[#05261d] to-[#041a29] p-3 sm:p-4 shadow-xl shadow-emerald-950/70 animate-in fade-in duration-200 space-y-3">
          {/* Top Header: System status and Global Master Mic Controls */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-emerald-800/40 pb-2.5">
            {/* Left: Overall Status Banner */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/40 border-2 border-emerald-300 shrink-0">
                <Mic className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-[#031c15]" />
                </span>
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />
                    Mikrofon HP Client Masuk ke Master
                  </span>
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-black text-emerald-300 border border-emerald-400/50 shadow-sm uppercase tracking-wider">
                    {activeWirelessMics.length} Mic Aktif
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-200/90 flex-wrap">
                  <span className="text-[11px] text-emerald-300/80">
                    Semua suara HP langsung disiarkan ke speaker Master tanpa jeda buffer.
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Master Wireless Mic Volume & Echo Master Bus */}
            <div className="flex items-center gap-2 sm:gap-3 self-end md:self-center flex-wrap">
              {/* Master Volume */}
              <div className="flex items-center gap-1 bg-[#02130e] px-2.5 py-1.5 rounded-xl border border-emerald-600/60 shrink-0 shadow-inner">
                <button
                  onClick={() => setIsMasterMicMuted(!isMasterMicMuted)}
                  className="text-emerald-300 hover:text-white transition mr-1 cursor-pointer"
                  title={isMasterMicMuted ? 'Buka Suara Seluruh Mic' : 'Bisukan Seluruh Mic'}
                >
                  {isMasterMicMuted || masterMicVolume === 0 ? (
                    <VolumeX className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  )}
                </button>

                <span className="text-[10px] font-mono text-emerald-300 font-bold">Master Vol:</span>

                <button
                  onClick={decreaseMicVolume}
                  className="h-6 w-6 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-emerald-300 font-black text-sm flex items-center justify-center border border-emerald-600/40 active:scale-95 transition cursor-pointer"
                  title="Kurangi Volume Master Mic (-)"
                >
                  -
                </button>

                <span className="text-[11px] font-mono text-white font-bold w-9 text-center">
                  {isMasterMicMuted ? '0%' : `${masterMicVolume}%`}
                </span>

                <button
                  onClick={increaseMicVolume}
                  className="h-6 w-6 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-emerald-300 font-black text-sm flex items-center justify-center border border-emerald-600/40 active:scale-95 transition cursor-pointer"
                  title="Tambah Volume Master Mic (+)"
                >
                  +
                </button>
              </div>

              {/* Master Echo */}
              <div className="flex items-center gap-1 bg-[#02130e] px-2.5 py-1.5 rounded-xl border border-teal-600/60 shrink-0 shadow-inner">
                <span className="text-[10px] font-mono text-teal-300 font-bold">Echo:</span>

                <button
                  onClick={decreaseMicEcho}
                  className="h-6 w-6 rounded-lg bg-teal-950 hover:bg-teal-800 text-teal-200 font-black text-sm flex items-center justify-center border border-teal-600/40 active:scale-95 transition cursor-pointer"
                  title="Kurangi Efek Echo/Gema (-)"
                >
                  -
                </button>

                <span className="text-[11px] font-mono text-amber-300 font-bold px-1 text-center whitespace-nowrap min-w-[32px]">
                  {masterMicEcho === 0 ? '0%' : `${masterMicEcho}%`}
                </span>

                <button
                  onClick={increaseMicEcho}
                  className="h-6 w-6 rounded-lg bg-teal-950 hover:bg-teal-800 text-teal-200 font-black text-sm flex items-center justify-center border border-teal-600/40 active:scale-95 transition cursor-pointer"
                  title="Tambah Efek Echo/Gema (+)"
                >
                  +
                </button>
              </div>

              {/* Vocal Sync Delay Buffer Adjustment */}
              <div className="flex items-center gap-1 bg-[#02130e] px-2.5 py-1.5 rounded-xl border border-amber-600/60 shrink-0 shadow-inner">
                <span className="text-[10px] font-mono text-amber-300 font-bold">Sync:</span>

                <button
                  onClick={() => setMusicDelayMs(Math.max(0, musicDelayMs - 5))}
                  className="h-6 w-6 rounded-lg bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-sm flex items-center justify-center border border-amber-600/40 active:scale-95 transition cursor-pointer"
                  title="Kurangi Delay Musik (-5ms)"
                >
                  -
                </button>

                <span className="text-[11px] font-mono text-amber-300 font-bold px-1 text-center whitespace-nowrap min-w-[36px]">
                  +{musicDelayMs}ms
                </span>

                <button
                  onClick={() => setMusicDelayMs(Math.min(250, musicDelayMs + 5))}
                  className="h-6 w-6 rounded-lg bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-sm flex items-center justify-center border border-amber-600/40 active:scale-95 transition cursor-pointer"
                  title="Tambah Delay Musik (+5ms)"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Individual Singer / Phone Mic Channels Grid (Duet & Multi-user Singing) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeWirelessMics.map((mic) => {
              const level = Math.min(100, Math.max(0, mic.audioLevel || 0));
              const isSingerMuted = !!mic.isMuted;

              return (
                <div
                  key={mic.senderId}
                  className={`rounded-xl border p-2.5 transition flex flex-col gap-2 ${
                    isSingerMuted
                      ? 'border-slate-800 bg-slate-950/70 opacity-70'
                      : 'border-emerald-600/50 bg-[#021812]/90 shadow-md shadow-emerald-950/40'
                  }`}
                >
                  {/* Singer Header & Live VU Meter Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-900/80 text-amber-300 border border-emerald-500/40 shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{mic.senderName}</p>
                        <span className="text-[9px] font-mono text-emerald-400/80">
                          {mic.mode === 'webrtc' ? '📡 WebRTC P2P' : '⚡ Relay Langsung'}
                        </span>
                      </div>
                    </div>

                    {/* Mute Button */}
                    <button
                      onClick={() => toggleClientMicMute(mic.senderId)}
                      className={`h-7 px-2 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                        isSingerMuted
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 hover:bg-rose-900'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900'
                      }`}
                      title={isSingerMuted ? 'Nyalakan Mic Ini' : 'Bisukan Mic Ini'}
                    >
                      {isSingerMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                      <span>{isSingerMuted ? 'Muted' : 'On'}</span>
                    </button>
                  </div>

                  {/* Real-Time Live Audio VU Meter (Bounces as singer sings!) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>VU Level Suara:</span>
                      <span className={level > 60 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                        {isSingerMuted ? 'BISU' : `${level}%`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/60 overflow-hidden border border-emerald-900/50 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-75 ${
                          level > 80
                            ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500'
                            : level > 40
                            ? 'bg-gradient-to-r from-emerald-500 to-yellow-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: isSingerMuted ? '0%' : `${Math.max(level > 0 ? 6 : 0, level)}%` }}
                      />
                    </div>
                  </div>

                  {/* Individual Singer Volume Slider (+ and -) */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-900/40 text-[11px]">
                    <span className="text-emerald-300/80 font-mono text-[10px]">Gain Mic:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setClientMicVolume(mic.senderId, mic.volume - 5)}
                        className="h-5 w-5 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-300 font-bold flex items-center justify-center border border-emerald-700/50 cursor-pointer"
                        title="Kurangi Gain"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-white text-[10px]">
                        {mic.volume}%
                      </span>
                      <button
                        onClick={() => setClientMicVolume(mic.senderId, mic.volume + 5)}
                        className="h-5 w-5 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-300 font-bold flex items-center justify-center border border-emerald-700/50 cursor-pointer"
                        title="Tambah Gain"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
