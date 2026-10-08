import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Tv,
  Apple,
  Check,
  X,
  Share2,
  PlusSquare,
  Sparkles,
  Maximize2,
  Monitor,
  ExternalLink,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { toggleFullScreen } from '../utils/fullscreen';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'android' | 'ios' | 'tv';
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  defaultTab,
}) => {
  const { isInstallable, isInstalled, isIOS, isSmartTV, install } = usePWAInstall();

  // Determine initial active tab based on detected platform
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'tv'>(() => {
    if (defaultTab) return defaultTab;
    if (isSmartTV) return 'tv';
    if (isIOS) return 'ios';
    return 'android';
  });

  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    const outcome = await install();
    if (outcome === 'accepted') {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    }
  };

  const handleToggleFullscreen = () => {
    toggleFullScreen();
  };

  const handleOpenTVMode = () => {
    window.location.href = '/?mode=tv';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#07132c] border-2 border-sky-400 p-5 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-9 w-9 rounded-full bg-sky-950 hover:bg-sky-800 text-white flex items-center justify-center transition border border-sky-600/70"
          aria-label="Tutup Panduan Instalasi"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with Military Tactical Flair */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-700 text-white shadow-lg border border-sky-400/50 shrink-0">
            <Download className="h-6 w-6 text-amber-300 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-widest text-sky-400 uppercase">
                PWA / PROGRESSIVE WEB APP
              </span>
              <span className="rounded bg-sky-900/80 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-sky-500/50">
                TNI AU
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-display">
              Instal Aplikasi Karaoke
            </h2>
          </div>
        </div>

        {/* Slogan Banner */}
        <div className="mb-5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/10 border border-amber-400/50 px-3.5 py-2 text-center shadow-inner">
          <p className="font-display text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
            &ldquo;Prajurit Yang Pantang Mundur Walau Suara Hancur&rdquo;
          </p>
          <p className="text-[11px] text-sky-200/90 mt-0.5">
            Pasang langsung di layar utama tanpa repot buka browser setiap saat.
          </p>
        </div>

        {/* Already Installed Alert */}
        {isInstalled && (
          <div className="mb-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 p-3 flex items-center gap-2.5 text-xs text-emerald-200">
            <Check className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>
              Aplikasi Karaoke Diskomlekau sudah terpasang di perangkat ini dalam mode Standalone!
            </span>
          </div>
        )}

        {/* 1-Click Native Install Banner for Android & Chrome */}
        {isInstallable && !installSuccess && (
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-4 shadow-xl border border-sky-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 font-black text-sm text-amber-300">
                <Sparkles className="h-4 w-4" />
                <span>Instalasi 1-Klik Tersedia!</span>
              </div>
              <p className="text-xs text-sky-100 mt-0.5">
                Peramban Anda mendukung instalasi instan ke Layar Utama.
              </p>
            </div>
            <button
              onClick={handleNativeInstall}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2 shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Instal Sekarang</span>
            </button>
          </div>
        )}

        {installSuccess && (
          <div className="mb-5 rounded-2xl bg-emerald-600 p-4 text-center text-white font-bold text-sm flex items-center justify-center gap-2">
            <Check className="h-5 w-5" />
            <span>Berhasil! Aplikasi telah ditambahkan ke layar utama.</span>
          </div>
        )}

        {/* Device Selection Tabs: Android, iOS, Smart TV */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#050e22] border border-sky-800 mb-5">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'android'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-sky-950/60'
            }`}
          >
            <Smartphone className="h-4 w-4 text-emerald-400" />
            <span>HP Android</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'ios'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-sky-950/60'
            }`}
          >
            <Apple className="h-4 w-4 text-sky-300" />
            <span>iPhone / iOS</span>
          </button>

          <button
            onClick={() => setActiveTab('tv')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'tv'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-sky-950/60'
            }`}
          >
            <Tv className="h-4 w-4 text-amber-400" />
            <span>Smart TV</span>
          </button>
        </div>

        {/* TAB CONTENT 1: ANDROID */}
        {activeTab === 'android' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-[#050e22] p-4 border border-sky-800/80 space-y-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <span>Cara Pasang di HP Android (Google Chrome / Brave):</span>
              </h4>

              <ol className="space-y-2.5 text-slate-300 pl-1">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    1
                  </span>
                  <span>
                    Buka tautan ini di peramban <strong>Google Chrome</strong> di HP Android Anda.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    2
                  </span>
                  <span>
                    Tekan tombol menu titik tiga (<strong>⋮</strong>) di sudut kanan atas Chrome.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    3
                  </span>
                  <span>
                    Pilih opsi <strong>&ldquo;Instal Aplikasi&rdquo;</strong> atau{' '}
                    <strong>&ldquo;Tambahkan ke Layar Utama&rdquo;</strong> (Add to Home screen).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    4
                  </span>
                  <span>
                    Ikon <strong>Karaoke Diskomlekau</strong> akan muncul di beranda HP Anda layaknya aplikasi Play Store!
                  </span>
                </li>
              </ol>

              {isInstallable && (
                <div className="pt-2">
                  <button
                    onClick={handleNativeInstall}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Klik di sini untuk Pasang di Android</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT 2: iOS (IPHONE / IPAD) */}
        {activeTab === 'ios' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-[#050e22] p-4 border border-sky-800/80 space-y-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Apple className="h-4 w-4 text-sky-300" />
                <span>Cara Pasang di iPhone / iPad (Safari):</span>
              </h4>

              <div className="rounded-xl bg-sky-950/60 p-2.5 border border-sky-700/60 text-[11px] text-sky-200">
                Apple iOS mengharuskan penambahan ke layar utama melalui peramban <strong>Safari</strong>.
              </div>

              <ol className="space-y-2.5 text-slate-300 pl-1">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    1
                  </span>
                  <span>
                    Buka situs ini di peramban <strong>Safari</strong> pada iPhone atau iPad Anda.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    2
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Tekan tombol <strong>Bagikan / Share</strong></span>
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-sky-900 text-sky-200 border border-sky-700">
                      <Share2 className="h-3.5 w-3.5" />
                    </span>
                    <span>(ikon kotak dengan panah ke atas di bagian bawah layar).</span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    3
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Gulir ke bawah pada menu yang muncul dan pilih</span>
                    <span className="inline-flex items-center gap-1 font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      <PlusSquare className="h-3 w-3 text-sky-400" />
                      &ldquo;Tambah ke Layar Utama&rdquo; (Add to Home Screen)
                    </span>.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900 text-[11px] font-black text-sky-300 shrink-0">
                    4
                  </span>
                  <span>
                    Tekan <strong>&ldquo;Tambah&rdquo;</strong> di pojok kanan atas. Ikon aplikasi akan langsung ada di layar beranda iOS Anda!
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* TAB CONTENT 3: SMART TV */}
        {activeTab === 'tv' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-[#050e22] p-4 border border-sky-800/80 space-y-3.5">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Tv className="h-4 w-4 text-amber-400" />
                <span>Cara Pasang & Tampilkan di Smart TV:</span>
              </h4>

              {/* Quick Actions for TV: Fullscreen & Dedicated TV Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleToggleFullscreen}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 p-2.5 font-black text-slate-950 shadow transition active:scale-95"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>Mode Layar Penuh TV (F11)</span>
                </button>

                <button
                  onClick={handleOpenTVMode}
                  className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 p-2.5 font-bold text-white shadow transition active:scale-95 border border-sky-400/50"
                >
                  <Monitor className="h-4 w-4 text-amber-300" />
                  <span>Buka Layar Subdis Rudal TV</span>
                </button>
              </div>

              {/* Specific TV Guides */}
              <div className="space-y-2.5 pt-2 text-slate-300">
                <div className="rounded-xl bg-[#071533] p-3 border border-sky-900">
                  <strong className="text-amber-300 block mb-1">
                    1. Android TV / Google TV (Sony, TCL, Xiaomi, Chromecast, TV Box):
                  </strong>
                  <p className="text-[11px] leading-relaxed">
                    Buka peramban TV (Chrome / BrowseHere / Puffin) &gt; Akses alamat aplikasi ini &gt; Tekan tombol <strong>Menu</strong> di remote &gt; Pilih <strong>&ldquo;Pasang Aplikasi&rdquo; (Install App)</strong> atau <strong>&ldquo;Tambah ke Pintasan Aplikasi&rdquo;</strong>.
                  </p>
                </div>

                <div className="rounded-xl bg-[#071533] p-3 border border-sky-900">
                  <strong className="text-sky-300 block mb-1">
                    2. Samsung Smart TV (Tizen OS):
                  </strong>
                  <p className="text-[11px] leading-relaxed">
                    Buka aplikasi <strong>Web Browser</strong> bawaan TV Samsung &gt; Masukkan tautan ini &gt; Tekan ikon <strong>Menu/Pengaturan (Gigi roda atau titik tiga)</strong> &gt; Pilih <strong>&ldquo;Tambah ke Beranda&rdquo; (Add to Home)</strong>.
                  </p>
                </div>

                <div className="rounded-xl bg-[#071533] p-3 border border-sky-900">
                  <strong className="text-emerald-300 block mb-1">
                    3. LG Smart TV (webOS):
                  </strong>
                  <p className="text-[11px] leading-relaxed">
                    Buka aplikasi <strong>Web Browser</strong> bawaan TV LG &gt; Masukkan tautan &gt; Tekan ikon <strong>Bintang / Bookmark</strong> di bilah atas &gt; Centang <strong>&ldquo;Sematkan ke Beranda / Quick Access&rdquo;</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer info & close */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-sky-900/60 text-xs">
          <div className="flex items-center gap-1.5 text-sky-400 font-mono text-[11px]">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>Mendukung Offline Cache & Standalone Display</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-900/80 hover:bg-sky-800 text-white font-bold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
