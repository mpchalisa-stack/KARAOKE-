import React, { useState } from 'react';
import {
  ListMusic,
  History,
  Trash2,
  Shuffle,
  ChevronUp,
  ChevronDown,
  X,
  Play,
  Shield,
  Radio,
  Check,
  Edit2,
  Radar,
  Rocket,
  Zap,
  ArrowUpToLine,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { QueueItem } from '../types/karaoke';

export const QueueSidebar: React.FC = () => {
  const {
    queue,
    currentSong,
    history,
    removeFromQueue,
    moveQueueItem,
    clearQueue,
    updateSingerName,
    playSongNow,
    isQueueOpenMobile,
    setIsQueueOpenMobile,
    defaultSingerName,
  } = useKaraoke();

  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [editingSingerQueueId, setEditingSingerQueueId] = useState<string | null>(null);
  const [editingSingerText, setEditingSingerText] = useState('');

  const handleStartEditSinger = (item: QueueItem) => {
    setEditingSingerQueueId(item.queueId);
    setEditingSingerText(item.singerName);
  };

  const handleSaveSinger = (queueId: string) => {
    if (editingSingerText.trim()) {
      updateSingerName(queueId, editingSingerText.trim());
    }
    setEditingSingerQueueId(null);
  };

  // Shuffle queue
  const handleShuffleQueue = () => {
    if (queue.length <= 1) return;
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      moveQueueItem(i, j);
    }
  };

  // Move directly to top (#1 next in line)
  const handleMoveToTop = (index: number) => {
    if (index === 0) return;
    moveQueueItem(index, 0);
  };

  const content = (
    <div className="flex h-full flex-col bg-[#07132c]/98 border-l-2 border-sky-900/70 shadow-2xl">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-sky-900/60 p-4 bg-[#050e22]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-blue-800 text-sky-200 border border-sky-400/50 shadow">
            <ListMusic className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-sm font-bold text-white tracking-wide">
                Antrean Lagu
              </h3>
              <span className="rounded bg-sky-950 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 border border-sky-700">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {queue.length} lagu dalam daftar tunggu
            </p>
          </div>
        </div>

        {/* Quick Shuffle Action & Mobile Close */}
        <div className="flex items-center gap-1">
          {queue.length > 1 && (
            <button
              onClick={handleShuffleQueue}
              className="flex items-center gap-1 rounded-lg bg-[#0b1c3e] border border-sky-800/80 px-2 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-600 hover:text-white transition"
              title="Acak Urutan Antrean"
            >
              <Shuffle className="h-3 w-3" />
              <span className="hidden xl:inline">Acak</span>
            </button>
          )}

          <button
            onClick={() => setIsQueueOpenMobile(false)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#091838] text-sky-300 hover:text-white md:hidden border border-sky-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs: Antrean vs Riwayat */}
      <div className="flex border-b border-sky-900/60 px-4 pt-2 gap-2 bg-[#050e22]">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-1.5 border-b-2 pb-2 text-xs font-bold transition ${
            activeTab === 'queue'
              ? 'border-sky-400 text-sky-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ListMusic className="h-3.5 w-3.5" />
          <span>Antrean ({queue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 border-b-2 pb-2 text-xs font-bold transition ${
            activeTab === 'history'
              ? 'border-sky-400 text-sky-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Riwayat ({history.length})</span>
        </button>
      </div>

      {/* Currently Playing Card */}
      {currentSong && (
        <div className="mx-4 mt-3 rounded-xl border border-sky-500/40 bg-gradient-to-r from-sky-950/70 to-[#07132c] p-3 shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-sky-300 font-bold mb-1.5">
            <span className="flex items-center gap-1 tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              SEDANG MENGUDARA
            </span>
            {/* Animated Equalizer bars */}
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 h-full bg-sky-400 animate-pulse" />
              <span className="w-0.5 h-2/3 bg-amber-400 animate-pulse delay-75" />
              <span className="w-0.5 h-4/5 bg-sky-300 animate-pulse delay-150" />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <img
              src={currentSong.thumbnailUrl}
              alt={currentSong.title}
              className="h-11 w-14 rounded-lg object-cover border border-sky-800 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{currentSong.title}</p>
              <p className="truncate text-[11px] text-sky-300/70">{currentSong.channelTitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {activeTab === 'queue' ? (
          queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#091838] border border-sky-900 text-sky-400 mb-3 shadow-md">
                <Rocket className="h-6 w-6 rotate-45 text-amber-400" />
              </div>
              <p className="text-xs font-bold text-slate-200">Manifest Antrean Masih Kosong</p>
              <p className="text-[11px] text-sky-300/70 max-w-xs mt-1">
                Gunakan bilah pencarian atau scan barcode HP di atas untuk memasukkan lagu prajurit ke antrean!
              </p>
            </div>
          ) : (
            queue.map((item, index) => {
              const isEditing = editingSingerQueueId === item.queueId;

              return (
                <div
                  key={item.queueId}
                  className="group relative flex flex-col gap-2 rounded-2xl border border-sky-900/80 bg-[#061026]/95 p-3 hover:border-sky-400 hover:bg-[#091838] transition shadow-md"
                >
                  {/* Top Row: Order Badge, Thumbnail, Title & Singer */}
                  <div className="flex items-center gap-2.5">
                    {/* Sequence number badge */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#091838] text-xs font-mono font-bold text-sky-300 shrink-0 border border-sky-700">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    {/* Thumbnail */}
                    <img
                      src={item.song.thumbnailUrl}
                      alt={item.song.title}
                      className="h-10 w-14 rounded-lg object-cover border border-sky-900 shrink-0"
                    />

                    {/* Title & Singer */}
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="truncate text-xs font-bold text-white leading-tight">
                        {item.song.title}
                      </p>

                      {/* Singer Callsign (Editable) */}
                      <div className="mt-1 flex items-center gap-1.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingSingerText}
                              onChange={(e) => setEditingSingerText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveSinger(item.queueId)}
                              className="w-24 rounded bg-[#040b1a] px-1.5 py-0.5 text-[10px] text-white outline-none border border-sky-400"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveSinger(item.queueId)}
                              className="text-emerald-400 hover:text-white"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditSinger(item)}
                            className="flex items-center gap-1 text-[10px] font-bold text-sky-300 hover:text-sky-100"
                            title="Klik untuk ubah callsign / nama prajurit"
                          >
                            <span className="rounded bg-sky-900/60 px-1.5 py-0.5 border border-sky-500/40">
                              🎖️ {item.singerName}
                            </span>
                            <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-sky-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Ordering Controls & Play Button */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-sky-900/60 gap-2">
                    {/* Reordering Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveQueueItem(index, index - 1)}
                        disabled={index === 0}
                        className="flex items-center gap-0.5 rounded-lg bg-[#0b1c3e] border border-sky-800 px-2 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-700 hover:text-white disabled:opacity-20 transition"
                        title="Geser Urutan Naik"
                      >
                        <ChevronUp className="h-3 w-3" />
                        <span>Naik</span>
                      </button>

                      <button
                        onClick={() => moveQueueItem(index, index + 1)}
                        disabled={index === queue.length - 1}
                        className="flex items-center gap-0.5 rounded-lg bg-[#0b1c3e] border border-sky-800 px-2 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-700 hover:text-white disabled:opacity-20 transition"
                        title="Geser Urutan Turun"
                      >
                        <ChevronDown className="h-3 w-3" />
                        <span>Turun</span>
                      </button>

                      {index > 0 && (
                        <button
                          onClick={() => handleMoveToTop(index)}
                          className="flex items-center gap-0.5 rounded-lg bg-amber-500/10 border border-amber-500/40 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition"
                          title="Pindahkan lagu ini langsung ke urutan teratas giliran berikutnya"
                        >
                          <ArrowUpToLine className="h-3 w-3" />
                          <span>Ke Paling Atas</span>
                        </button>
                      )}
                    </div>

                    {/* Play Now & Delete */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          playSongNow(item.song, item.singerName);
                          removeFromQueue(item.queueId);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-white shadow-md shadow-emerald-950 active:scale-95 transition"
                        title="Putar Lagu Ini Sekarang di Layar Panggung"
                      >
                        <Play className="h-3 w-3 fill-white" />
                        <span>Putar</span>
                      </button>

                      <button
                        onClick={() => removeFromQueue(item.queueId)}
                        className="p-1.5 text-sky-400/70 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                        title="Hapus dari antrean"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* History Tab */
          history.length === 0 ? (
            <div className="py-10 text-center text-xs text-sky-400/60">
              Belum ada lagu yang selesai mengudara.
            </div>
          ) : (
            history.map((song, idx) => (
              <div
                key={`${song.id}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-sky-900/70 bg-[#061026] p-2 hover:bg-[#091838]"
              >
                <img
                  src={song.thumbnailUrl}
                  alt={song.title}
                  className="h-9 w-12 rounded object-cover border border-sky-900"
                />
                <div className="min-w-0 flex-1 px-2">
                  <p className="truncate text-xs font-semibold text-white">{song.title}</p>
                  <p className="truncate text-[10px] text-sky-300/70">{song.channelTitle}</p>
                </div>
                <button
                  onClick={() => playSongNow(song, defaultSingerName)}
                  className="rounded-lg bg-sky-900/60 border border-sky-600/50 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-600 hover:text-white"
                  title="Putar Ulang Lagu Ini"
                >
                  Putar
                </button>
              </div>
            ))
          )
        )}
      </div>

      {/* Footer Controls: Clear Queue */}
      {queue.length > 0 && activeTab === 'queue' && (
        <div className="border-t border-sky-900/60 p-3 bg-[#050e22] flex items-center justify-between">
          <span className="text-[11px] text-sky-300 font-mono">
            Total {queue.length} giliran prajurit
          </span>
          <button
            onClick={clearQueue}
            className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-rose-400 transition"
          >
            <Trash2 className="h-3 w-3" />
            <span>Kosongkan Antrean</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Persistent Sidebar on Desktop & Tablet (md and above) */}
      <aside className="hidden md:flex w-80 lg:w-96 xl:w-[410px] shrink-0 h-[calc(100vh-65px)] sticky top-[65px] flex-col overflow-hidden">
        {content}
      </aside>

      {/* Mobile Drawer if user on mobile phone explicitly opens it */}
      {isQueueOpenMobile && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm md:hidden">
          <div
            className="flex-1"
            onClick={() => setIsQueueOpenMobile(false)}
            aria-hidden="true"
          />
          <div className="h-[80vh] w-full rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

