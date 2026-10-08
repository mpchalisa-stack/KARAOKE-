import React, { useState } from 'react';
import { Search, Loader2, Sparkles, Filter, Link as LinkIcon, Plus, Check, Radio } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { SuffixFilter } from '../types/karaoke';
import { buildKaraokeQuery } from '../services/youtube';

export const SearchBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    suffixFilter,
    setSuffixFilter,
    executeSearch,
    isSearching,
    addDirectVideoUrl,
    defaultSingerName,
  } = useKaraoke();

  const [showDirectLink, setShowDirectLink] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [directSinger, setDirectSinger] = useState('');
  const [directSuccess, setDirectSuccess] = useState(false);
  const [directError, setDirectError] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      executeSearch();
    }
  };

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectError('');
    if (!directUrl.trim()) return;

    const ok = await addDirectVideoUrl(directUrl.trim(), directSinger.trim() || defaultSingerName);
    if (ok) {
      setDirectSuccess(true);
      setDirectUrl('');
      setDirectSinger('');
      setTimeout(() => setDirectSuccess(false), 3000);
    } else {
      setDirectError('Format tautan atau Video ID tidak valid. Contoh: https://youtu.be/xxx atau nCbzF356088');
    }
  };

  const currentProcessedQuery = buildKaraokeQuery(searchQuery, suffixFilter);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-sky-900/60 bg-[#07132c]/90 p-3.5 sm:p-4 shadow-xl backdrop-blur-md">
      {/* Primary Search Form */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input Box */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sky-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik judul lagu atau nama penyanyi (misal: November Rain, Pupus, Bob Marley)..."
              className="w-full rounded-xl border border-sky-900/80 bg-[#040b1a] py-2.5 pl-10 pr-16 text-sm text-white placeholder-slate-400 outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-white"
              >
                Hapus
              </button>
            )}
          </div>

          {/* Suffix Filter Options */}
          <div className="flex items-center gap-1 bg-[#040b1a] border border-sky-900/80 rounded-xl p-1 shrink-0">
            {(['karaoke', 'no vocal', 'instrumental'] as SuffixFilter[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSuffixFilter(mode)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  suffixFilter === mode
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-[#091838] hover:text-white'
                }`}
              >
                +{mode === 'no vocal' ? 'tanpa vokal' : mode}
              </button>
            ))}
          </div>

          {/* Search Submit Button */}
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-600/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 border border-sky-400/40"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-sky-200" />
                <span>Mencari...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Cari Lagu</span>
              </>
            )}
          </button>
        </div>

        {/* Bottom Helpers: Direct Link Toggle */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-0.5">
          <div className="truncate">
            {searchQuery.trim() ? (
              <span className="text-[11px] text-sky-300">
                Pencarian aktif: <strong>"{currentProcessedQuery}"</strong>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Otomatis mencari versi karaoke tanpa vokal di YouTube
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowDirectLink(!showDirectLink)}
            className="text-[11px] font-bold text-sky-400 hover:text-amber-300 transition flex items-center gap-1 shrink-0 ml-2"
          >
            <LinkIcon className="h-3 w-3" />
            <span>{showDirectLink ? 'Tutup Input Link' : '+ Punya Link YouTube?'}</span>
          </button>
        </div>
      </form>

      {/* Expandable Direct Link Adder */}
      {showDirectLink && (
        <form
          onSubmit={handleDirectAdd}
          className="mt-1 p-3 rounded-xl bg-[#040b1a] border border-sky-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in duration-150"
        >
          <input
            type="text"
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            placeholder="Tempel tautan YouTube (https://youtu.be/... atau Video ID)"
            className="flex-1 rounded-lg border border-sky-900 bg-[#07132c] py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
          />

          <input
            type="text"
            value={directSinger}
            onChange={(e) => setDirectSinger(e.target.value)}
            placeholder={`Penyanyi (${defaultSingerName})`}
            className="w-full sm:w-40 rounded-lg border border-sky-900 bg-[#07132c] py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
          />

          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500 active:scale-95 shrink-0"
          >
            {directSuccess ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>Masuk Antrean!</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Lagu</span>
              </>
            )}
          </button>
        </form>
      )}

      {directError && <p className="text-xs text-rose-400 font-semibold">{directError}</p>}
    </div>
  );
};
