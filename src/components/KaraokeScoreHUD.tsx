import React from 'react';
import { Trophy, Flame, Mic, Music, AlertCircle, Sparkles } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';

interface KaraokeScoreHUDProps {
  className?: string;
  compact?: boolean;
}

export const KaraokeScoreHUD: React.FC<KaraokeScoreHUDProps> = ({
  className = '',
  compact = false,
}) => {
  const { scoringState, isPlaying, currentSong, activeWirelessMics } = useKaraoke();

  if (!isPlaying || !currentSong) return null;

  const {
    liveScore,
    micLevel,
    musicLevel,
    statusFeedback,
    streak,
  } = scoringState;

  const hasActiveMic = activeWirelessMics.length > 0;

  // Status styling
  const getStatusBadge = () => {
    switch (statusFeedback) {
      case 'PERFECT':
        return {
          label: 'PERFECT! ★★★',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-amber-500/30',
        };
      case 'STABLE':
        return {
          label: 'VOKAL STABIL! ★',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-emerald-500/30',
        };
      case 'GREAT':
        return {
          label: 'BAGUS!',
          bg: 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-sky-500/30',
        };
      case 'TOO_QUIET':
        return {
          label: '⚠️ TERLALU SENYAP (-Poin)',
          bg: 'bg-rose-600/30 text-rose-300 border-rose-500 animate-pulse',
        };
      default:
        return {
          label: hasActiveMic ? 'MENDENGARKAN...' : 'MIC HP STANDBY',
          bg: 'bg-slate-800/60 text-slate-400 border-slate-700',
        };
    }
  };

  const statusInfo = getStatusBadge();

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/80 backdrop-blur-md border border-amber-500/50 shadow-xl ${className}`}
      >
        <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-300 font-bold">Skor Live:</span>
          <span className="font-display text-sm font-black text-amber-300">
            {liveScore}
          </span>
        </div>
        {streak >= 3 && (
          <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-orange-400 bg-orange-950/80 px-1.5 py-0.5 rounded border border-orange-500/40">
            <Flame className="h-3 w-3" />
            x{streak}
          </span>
        )}
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusInfo.bg}`}
        >
          {statusInfo.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-[#040e24]/65 backdrop-blur-sm p-2.5 sm:p-3 border border-amber-500/50 shadow-xl min-w-[200px] space-y-2 select-none animate-in fade-in ${className}`}
    >
      {/* Top Header: Title & Live Score */}
      <div className="flex items-center justify-between gap-2 border-b border-sky-900/60 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-400 animate-pulse" />
          <span className="text-[10px] font-mono font-black text-amber-300 tracking-wider uppercase">
            SKOR JURI LIVE
          </span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-black text-white drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]">
            {liveScore}
          </span>
          <span className="text-[10px] font-mono text-slate-400">/100</span>
        </div>
      </div>

      {/* Combo Streak & Status Pill */}
      <div className="flex items-center justify-between gap-1 text-[10px]">
        <div className="flex items-center gap-1">
          {streak >= 2 ? (
            <span className="flex items-center gap-0.5 font-mono font-black text-orange-400 bg-orange-950/90 px-1.5 py-0.5 rounded-lg border border-orange-500/50 shadow-sm animate-bounce">
              <Flame className="h-3 w-3 fill-orange-400" />
              Combo x{streak}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-slate-400">
              Web Audio 500ms
            </span>
          )}
        </div>

        <span
          className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-sm ${statusInfo.bg}`}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Mic vs Music Real-Time Audio Spectrum Bars */}
      <div className="space-y-1.5 pt-1 text-[9px] font-mono">
        {/* Mic Level Bar */}
        <div>
          <div className="flex items-center justify-between text-slate-300 mb-0.5">
            <span className="flex items-center gap-1">
              <Mic className="h-2.5 w-2.5 text-emerald-400" />
              <span>Mic HP Vokal</span>
            </span>
            <span className={micLevel >= 18 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {micLevel}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                micLevel >= 18
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                  : 'bg-slate-700'
              }`}
              style={{ width: `${Math.min(100, micLevel)}%` }}
            />
          </div>
        </div>

        {/* Music Level Bar */}
        <div>
          <div className="flex items-center justify-between text-slate-300 mb-0.5">
            <span className="flex items-center gap-1">
              <Music className="h-2.5 w-2.5 text-sky-400" />
              <span>Musik / Media</span>
            </span>
            <span className="text-sky-400 font-bold">{musicLevel}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-150"
              style={{ width: `${Math.min(100, musicLevel)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
