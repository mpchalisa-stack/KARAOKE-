import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Award,
  Star,
  Sparkles,
  Flame,
  Volume2,
  Play,
  RotateCcw,
  X,
  Radar,
  Rocket,
  Shield,
  ThumbsUp,
  Music,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';

export const SongScoreModal: React.FC = () => {
  const {
    currentScoreData,
    isScoreModalOpen,
    setIsScoreModalOpen,
    skipNextSong,
    replayCurrentSong,
    triggerSoundFx,
    queue,
  } = useKaraoke();

  const [animatedScore, setAnimatedScore] = useState<number>(0);
  const [aiCheer, setAiCheer] = useState<string | null>(null);

  useEffect(() => {
    if (!isScoreModalOpen || !currentScoreData) return;
    setAiCheer(null);

    // Fetch server-side AI commentary proxy
    fetch('/api/ai/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songTitle: currentScoreData.song.title,
        singerName: currentScoreData.singerName,
        score: currentScoreData.totalScore,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.cheer) {
          setAiCheer(data.cheer);
        }
      })
      .catch(() => {
        // Fallback to local commentary gracefully
      });
  }, [isScoreModalOpen, currentScoreData]);

  useEffect(() => {
    if (!isScoreModalOpen || !currentScoreData) return;

    // Auto-play soundboard effects per user specification:
    // > 80: applause (or cheer if >= 90)
    // < 60: boo ('Huuu')
    if (currentScoreData.totalScore > 80) {
      triggerSoundFx(currentScoreData.totalScore >= 90 ? 'cheer' : 'applause');
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } else if (currentScoreData.totalScore < 60) {
      triggerSoundFx('boo');
    } else {
      triggerSoundFx('applause');
    }

    // Score count-up animation
    setAnimatedScore(0);
    const target = currentScoreData.totalScore;
    const duration = 1200;
    const steps = 30;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedScore(target);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isScoreModalOpen, currentScoreData, triggerSoundFx]);

  if (!isScoreModalOpen || !currentScoreData) return null;

  const handleNextSong = () => {
    setIsScoreModalOpen(false);
    skipNextSong();
  };

  const handleReplay = () => {
    setIsScoreModalOpen(false);
    replayCurrentSong();
  };

  const nextSongInManifest = queue.length > 0 ? queue[0] : null;

  // Grade color scheme
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'SS':
        return 'from-amber-400 via-yellow-300 to-amber-500 text-amber-950 border-amber-300';
      case 'S':
        return 'from-sky-400 via-blue-400 to-indigo-500 text-white border-sky-300';
      case 'A':
        return 'from-emerald-400 to-teal-500 text-white border-emerald-300';
      case 'B':
        return 'from-purple-400 to-indigo-500 text-white border-purple-300';
      case 'C':
        return 'from-amber-600 to-orange-700 text-white border-amber-500';
      case 'D':
      default:
        return 'from-rose-600 via-red-600 to-rose-800 text-white border-rose-400';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-xl rounded-3xl border-3 border-amber-400/80 bg-gradient-to-b from-[#091838] via-[#07132c] to-[#040a18] p-6 sm:p-8 shadow-2xl shadow-amber-500/20 max-h-[92vh] overflow-y-auto">
        {/* Military Radar Header Badge */}
        <div className="flex items-center justify-between border-b border-sky-900/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-700 text-white shadow-xl shadow-amber-500/30 border-2 border-amber-300">
              <Trophy className="h-6 w-6 text-yellow-100 animate-bounce" />
              <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black">
                ★
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xs font-bold text-amber-400 uppercase tracking-widest">
                  DEWAN JURI SUBDIS RUDAL DISKOMLEKAU
                </span>
                <span className="rounded bg-sky-950 px-2 py-0.5 text-[9px] font-mono font-bold text-sky-300 border border-sky-700">
                  HASIL RESMI
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-black text-white tracking-wide">
                RAPOR PENILAIAN KARAOKE
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsScoreModalOpen(false)}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-sky-900/40 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Singer & Song Banner */}
        <div className="mt-5 rounded-2xl bg-[#050e22] p-4 border border-sky-900/80 flex items-center gap-3">
          <img
            src={currentScoreData.song.thumbnailUrl}
            alt={currentScoreData.song.title}
            className="h-14 w-20 rounded-xl object-cover border border-sky-800 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white leading-snug">
              {currentScoreData.song.title}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-300 border border-amber-500/40">
                🎖️ Penyanyi: {currentScoreData.singerName}
              </span>
              <span className="text-[11px] text-sky-300/70 font-mono">
                {currentScoreData.song.channelTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Score & Rank Central Showcase */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-around gap-6 rounded-3xl bg-gradient-to-tr from-[#050d20] to-[#0a1c42] p-6 border-2 border-sky-500/40 shadow-inner text-center">
          {/* Main Numeric Score */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-sky-300 uppercase tracking-widest font-mono">
              SKOR TOTAL VOKAL
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-6xl sm:text-7xl font-black tracking-tight text-white drop-shadow-[0_0_35px_rgba(251,191,36,0.6)]">
                {animatedScore}
              </span>
              <span className="text-xl font-bold text-amber-400 font-mono">/ 100</span>
            </div>
            {currentScoreData.totalScore > 80 ? (
              <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span>👏 TEPUK TANGAN MERIAH (Skor &gt; 80)</span>
              </p>
            ) : currentScoreData.totalScore < 60 ? (
              <p className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1">
                <span>👎 SORAK HUUU DARI BARAK (Skor &lt; 60)</span>
              </p>
            ) : (
              <p className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>TERVALIDASI JURI SUBDIS RUDAL</span>
              </p>
            )}
          </div>

          {/* Grade Stamp & Military Title */}
          <div className="flex flex-col items-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr ${getGradeColor(
                currentScoreData.grade
              )} shadow-xl border-4 font-display text-4xl font-black rotate-3 animate-pulse`}
            >
              {currentScoreData.grade}
            </div>
            <span className="mt-2 text-xs font-black text-amber-300 max-w-[170px] leading-tight">
              {currentScoreData.rankTitle}
            </span>
          </div>
        </div>

        {/* Tactical Parameters Radar Breakdown */}
        <div className="mt-6 space-y-2.5">
          <p className="text-xs font-bold text-sky-300 uppercase tracking-wider font-mono">
            ANALISIS PARAMETER TEMPUR VOKAL:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl bg-[#050e22] p-3 border border-sky-900/80">
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-300">Ketepatan Nada (Pitch):</span>
                <span className="text-amber-400 font-mono">{currentScoreData.pitchAccuracy}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#081533] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400 transition-all duration-1000"
                  style={{ width: `${currentScoreData.pitchAccuracy}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#050e22] p-3 border border-sky-900/80">
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-300">Power & Ketahanan Vokal:</span>
                <span className="text-amber-400 font-mono">{currentScoreData.vocalPower}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#081533] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400 transition-all duration-1000"
                  style={{ width: `${currentScoreData.vocalPower}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#050e22] p-3 border border-sky-900/80">
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-300">Semangat Tempur & Korsa:</span>
                <span className="text-amber-400 font-mono">{currentScoreData.combatSpirit}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#081533] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400 transition-all duration-1000"
                  style={{ width: `${currentScoreData.combatSpirit}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#050e22] p-3 border border-sky-900/80">
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-300">Penguasaan Panggung:</span>
                <span className="text-amber-400 font-mono">{currentScoreData.stagePresence}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#081533] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400 transition-all duration-1000"
                  style={{ width: `${currentScoreData.stagePresence}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Commander's Humorous / Motivational Military Review */}
        <div className="mt-5 rounded-2xl border-2 border-amber-500/40 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-300 mb-1">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-400" />
              <span>KOMENTAR RESMI KOMANDAN DISKOMLEKAU:</span>
            </div>
            {aiCheer && (
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>AI Live Intel</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-100 italic leading-relaxed">
            "{aiCheer || currentScoreData.commentary}"
          </p>
        </div>

        {/* Next Singer in Queue Preview */}
        {nextSongInManifest && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#061026] p-3 border border-sky-900 text-xs">
            <span className="text-sky-300 font-bold">Giliran Terbang Berikutnya:</span>
            <div className="flex items-center gap-2 truncate max-w-xs">
              <span className="text-white truncate font-medium">
                {nextSongInManifest.song.title}
              </span>
              <span className="rounded bg-sky-900 px-2 py-0.5 font-bold text-amber-300 shrink-0">
                🎖️ {nextSongInManifest.singerName}
              </span>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-sky-900/80">
          <button
            onClick={handleReplay}
            className="flex items-center gap-1.5 rounded-xl border border-sky-700 bg-[#091838] hover:bg-sky-900/60 px-4 py-2.5 text-xs font-bold text-sky-200 hover:text-white transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Ulangi Lagu Ini</span>
          </button>

          <button
            onClick={handleNextSong}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-xl shadow-amber-500/30 transition active:scale-95"
          >
            <Play className="h-4 w-4 fill-slate-950" />
            <span>Lanjut ke Lagu Berikutnya &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
