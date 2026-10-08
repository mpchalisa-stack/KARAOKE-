import React, { useState } from 'react';
import {
  Plus,
  Play,
  Zap,
  Info,
  KeyRound,
  Shield,
  Music2,
  CheckCircle,
  Radio,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { Song } from '../types/karaoke';

export const SearchResults: React.FC = () => {
  const {
    searchResults,
    isSearching,
    searchError,
    isCuratedFallback,
    addToQueue,
    playSongNow,
    defaultSingerName,
  } = useKaraoke();

  const [activeSingerModalSong, setActiveSingerModalSong] = useState<Song | null>(null);
  const [customSinger, setCustomSinger] = useState('');
  const [addedQueueAnimationId, setAddedQueueAnimationId] = useState<string | null>(null);

  const handleQuickAdd = (song: Song, playNext = false) => {
    addToQueue(song, defaultSingerName, playNext);
    setAddedQueueAnimationId(song.id);
    setTimeout(() => setAddedQueueAnimationId(null), 1800);
  };

  const handleCustomSingerAdd = (playNext = false) => {
    if (!activeSingerModalSong) return;
    const name = customSinger.trim() || defaultSingerName;
    addToQueue(activeSingerModalSong, name, playNext);
    setAddedQueueAnimationId(activeSingerModalSong.id);
    setTimeout(() => setAddedQueueAnimationId(null), 1800);
    setActiveSingerModalSong(null);
    setCustomSinger('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header and Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-900/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-sky-400" />
          <h2 className="font-display text-sm sm:text-base font-bold text-white tracking-wide">
            Daftar Lagu Karaoke ({searchResults.length})
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {isCuratedFallback ? (
            <span>Koleksi Favorit Siap Putar</span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Hasil Pencarian Live
            </span>
          )}
        </div>
      </div>

      {/* Notice/Error message */}
      {searchError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-300">
          <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p>{searchError}</p>
          </div>
        </div>
      )}

      {/* Grid of Results */}
      {isSearching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-8">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-2xl border border-sky-900/60 bg-[#07132c]/50 p-3 gap-3 animate-pulse"
            >
              <div className="aspect-video w-full rounded-xl bg-sky-950/50" />
              <div className="h-4 w-3/4 rounded bg-sky-950/70" />
              <div className="h-3 w-1/2 rounded bg-sky-950/70" />
              <div className="h-9 w-full rounded-xl bg-sky-950/70 mt-2" />
            </div>
          ))}
        </div>
      ) : searchResults.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-sky-900/60 bg-[#07132c]/50 p-12 text-center">
          <Radio className="h-12 w-12 text-sky-500/50 mb-3" />
          <h3 className="text-base font-bold text-slate-200">Radar Belum Menemukan Target Lagu</h3>
          <p className="text-xs text-sky-300/70 max-w-sm mt-1">
            Coba kueri kata kunci lain atau pilih rekomendasi pangkalan: Slow Rock, Roots Reggae, atau Roots Dub.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.map((song) => {
            const isJustAdded = addedQueueAnimationId === song.id;

            return (
              <div
                key={song.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-sky-900/70 bg-[#07132c]/90 p-3 shadow-lg hover:border-sky-400 hover:bg-[#0a1c42] transition-all duration-300"
              >
                {/* Thumbnail with overlay buttons */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#040a18]">
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060e20] via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  {/* Badge */}
                  <span className="absolute top-2 left-2 rounded-md bg-[#07132c]/85 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/40">
                    KARAOKE
                  </span>

                  {song.duration && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-sky-300 border border-sky-900/80">
                      {song.duration}
                    </span>
                  )}

                  {/* Hover Quick Play Button */}
                  <button
                    onClick={() => playSongNow(song, defaultSingerName)}
                    className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-600/90 text-white shadow-xl opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 hover:bg-sky-500 border border-sky-300/40"
                    title="Putar Langsung Sekarang"
                  >
                    <Play className="h-5 w-5 fill-white ml-0.5" />
                  </button>
                </div>

                {/* Song Details */}
                <div className="mt-3 flex flex-col flex-1">
                  <h3
                    className="line-clamp-2 text-sm font-bold text-slate-100 leading-snug group-hover:text-sky-300 transition-colors"
                    title={song.title}
                  >
                    {song.title}
                  </h3>
                  <p className="mt-1 text-xs text-sky-300/70 truncate">{song.channelTitle}</p>
                </div>

                {/* Action Buttons */}
                <div className="mt-3 pt-3 border-t border-sky-900/60 flex items-center gap-1.5">
                  {/* Primary Add to Queue button */}
                  <button
                    onClick={() => handleQuickAdd(song)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition-all duration-200 shadow-sm ${
                      isJustAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/25 border border-sky-400/30'
                    }`}
                  >
                    {isJustAdded ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Masuk Manifest</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Antrean</span>
                      </>
                    )}
                  </button>

                  {/* Play Next (Priority) Button */}
                  <button
                    onClick={() => handleQuickAdd(song, true)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#091838] text-amber-400 hover:bg-amber-950/40 hover:border-amber-400 border border-sky-900/80 transition"
                    title="Prioritas: Putar Berikutnya"
                  >
                    <Zap className="h-3.5 w-3.5 fill-amber-400" />
                  </button>

                  {/* Custom Callsign / Singer Name Modal Opener */}
                  <button
                    onClick={() => {
                      setActiveSingerModalSong(song);
                      setCustomSinger('');
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#091838] text-sky-300 hover:bg-sky-900/40 hover:text-white border border-sky-900/80 transition"
                    title="Pilih Prajurit / Callsign Khusus"
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Set Singer / Callsign for Queue */}
      {activeSingerModalSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-sky-500/40 bg-[#07132c] p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-extrabold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-400" />
              <span>Siapa Prajurit yang Menyanyikan Lagu Ini?</span>
            </h3>
            <p className="mt-1 line-clamp-1 text-xs text-sky-300/80">
              {activeSingerModalSong.title}
            </p>

            <div className="mt-4">
              <label className="text-xs font-bold text-sky-200">Callsign / Pangkat & Nama:</label>
              <input
                type="text"
                value={customSinger}
                onChange={(e) => setCustomSinger(e.target.value)}
                placeholder={`Contoh: Kapten Udara Budi`}
                className="mt-1.5 w-full rounded-xl border border-sky-700 bg-[#040b1a] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                autoFocus
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveSingerModalSong(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-sky-950/40"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleCustomSingerAdd(true)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
              >
                <Zap className="h-3 w-3 fill-amber-400" />
                <span>Putar Berikutnya</span>
              </button>
              <button
                type="button"
                onClick={() => handleCustomSingerAdd(false)}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500 border border-sky-400/30"
              >
                Tambah ke Antrean
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
