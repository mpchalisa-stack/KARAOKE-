import React, { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Radio,
  Globe2,
  Share2,
  MessageCircle,
  Wifi,
  Settings2,
  Maximize2,
  X,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { MobileSimulatorModal } from './MobileSimulatorModal';
import { PWAInstallButton } from './PWAInstallButton';
import { useKaraoke } from '../context/KaraokeContext';
import {
  fetchServerNetworkInfo,
  getUniversalBarcodeUrl,
  getUrlMode,
  setUrlMode,
  getCustomHostOverride,
  setCustomHostOverride,
  getWhatsAppShareUrl,
  UrlMode,
  NetworkInfo,
} from '../services/network';

export const PersistentBarcodeHeader: React.FC = () => {
  const { roomId, remoteConnectedDevices } = useKaraoke();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [largeQrDataUrl, setLargeQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [currentMode, setCurrentMode] = useState<UrlMode>(() => getUrlMode());
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [showZoomModal, setShowZoomModal] = useState<boolean>(false);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [customHostInput, setCustomHostInput] = useState<string>(() => getCustomHostOverride());

  // Fetch server detected URL on mount
  useEffect(() => {
    fetchServerNetworkInfo().then((info) => {
      if (info) {
        setNetworkInfo(info);
      }
    });
  }, []);

  // Compute universal client URL based on current selected mode
  const clientUrl = getUniversalBarcodeUrl(roomId, networkInfo, currentMode);
  const waShareUrl = getWhatsAppShareUrl(roomId, clientUrl);

  // Generate crisp, pure black on white QR codes with level M (fast optical decode)
  useEffect(() => {
    // 1. Standard header size
    QRCode.toDataURL(clientUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000', // Pure black for 100% optical readability on LCD screens
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR code gen error:', err));

    // 2. High-res zoom modal size
    QRCode.toDataURL(clientUrl, {
      width: 500,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setLargeQrDataUrl(url))
      .catch(() => {});
  }, [clientUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clientUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = clientUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  }, [clientUrl]);

  const handleModeChange = (mode: UrlMode) => {
    setCurrentMode(mode);
    setUrlMode(mode);
  };

  const handleSaveCustomHost = () => {
    setCustomHostOverride(customHostInput);
    setCurrentMode('custom');
    setUrlMode('custom');
    setShowSettingsDrawer(false);
  };

  const handleResetHost = () => {
    setCustomHostOverride('');
    setCustomHostInput('');
    setCurrentMode('origin');
    setUrlMode('origin');
    setShowSettingsDrawer(false);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-r from-[#071533] via-[#091b40] to-[#07132c] px-3.5 py-3 sm:px-4 sm:py-3 shadow-xl shadow-sky-950/60 hud-corner">
        {/* Background Radar Glow */}
        <div className="absolute -right-8 -bottom-8 h-36 w-36 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

        {/* Main Barcode & Access Controls Row */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Left Section: Ultra High-Contrast Scannable Barcode & Status */}
          <div className="flex items-center gap-3.5 w-full lg:w-auto">
            {/* Clickable High-Contrast Scannable QR Code */}
            <div
              onClick={() => setShowZoomModal(true)}
              className="group relative cursor-pointer rounded-2xl bg-white p-2 shadow-xl shadow-sky-500/20 border-2 border-sky-400 shrink-0 select-none hover:scale-105 transition active:scale-95"
              title="Klik untuk memperbesar barcode ke ukuran layar penuh"
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Barcode Akses Room ${roomId}`}
                  className="h-16 w-16 sm:h-18 sm:w-18 object-contain rounded-lg"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center bg-slate-100 text-sky-600">
                  <QrCode className="h-8 w-8 animate-pulse" />
                </div>
              )}
              {/* Zoom overlay badge */}
              <div className="absolute inset-0 bg-sky-950/80 rounded-xl opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-[9px] font-bold gap-0.5">
                <Maximize2 className="h-4 w-4 text-amber-300" />
                <span>Perbesar</span>
              </div>
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              {/* Room Code + Connected Devices */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 rounded-lg bg-sky-950 px-2 py-0.5 text-[11px] font-mono font-bold text-sky-300 border border-sky-600/60 shadow-sm shrink-0">
                  <Radio className="h-3 w-3 text-sky-400 animate-pulse" />
                  ROOM: {roomId}
                </span>

                <span className="flex items-center gap-1 rounded-lg bg-emerald-950/90 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-600/50 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  {remoteConnectedDevices} HP Terhubung
                </span>

                <button
                  onClick={() => setShowZoomModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 px-2 py-0.5 text-[10px] font-semibold text-sky-300 border border-sky-700/60 transition shrink-0"
                >
                  <Maximize2 className="h-3 w-3 text-amber-400" />
                  <span>Perbesar QR</span>
                </button>
              </div>

              <h3 className="font-display text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-1.5 pt-0.5">
                <span>Scan Barcode dengan Kamera HP untuk Pilih Lagu</span>
              </h3>
              <p className="text-[11px] text-sky-300/80 leading-tight">
                Prajurit dapat langsung scan untuk memilih lagu & kendali jarak jauh tanpa perlu instalasi aplikasi tambahan.
              </p>

              {/* Direct Link text with quick copy */}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] text-slate-400 font-mono">Link:</span>
                <button
                  onClick={handleCopyLink}
                  className="text-[10px] font-mono font-bold text-amber-300 hover:text-white underline truncate max-w-xs sm:max-w-md text-left"
                  title="Klik untuk menyalin link"
                >
                  {clientUrl}
                </button>
              </div>
            </div>
          </div>

          {/* Right Section: Streamlined Primary Actions */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end w-full lg:w-auto gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-sky-900/60">
            {/* 1. Open Virtual Mobile Remote (Direct On-Screen Simulator) */}
            <button
              onClick={() => setShowSimulator(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 transition active:scale-95 shadow-md shadow-amber-950/50 border border-amber-300"
              title="Buka Remote HP virtual langsung di layar komputer / laptop ini"
            >
              <Smartphone className="h-4 w-4 text-slate-950 fill-current" />
              <span>📱 Buka Remote HP (Layar Ini)</span>
            </button>

            {/* 2. Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95 shadow-sm border border-sky-400/40"
              title="Salin Tautan Room untuk Dibagikan ke HP"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Link</span>
                </>
              )}
            </button>

            {/* 3. Quick Share to WhatsApp Button */}
            <a
              href={waShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95 shadow-sm border border-emerald-400/40"
              title="Kirim tautan room karaoke langsung ke chat WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {/* 4. Advanced Network Mode Settings (Discreet Gear Icon) */}
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`flex items-center justify-center h-8 w-8 rounded-xl border transition ${
                showSettingsDrawer
                  ? 'border-sky-400 bg-sky-600 text-white'
                  : 'border-sky-800/80 bg-[#061026] text-sky-400 hover:bg-sky-900/50 hover:text-white'
              }`}
              title="Pengaturan Mode URL / LAN (Lanjutan)"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Network Mode & Domain Switcher Drawer (Collapsible) */}
        {showSettingsDrawer && (
          <div className="mt-3.5 pt-3.5 border-t border-sky-900/80 bg-[#040c1e] rounded-xl p-3.5 animate-in fade-in duration-150 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe2 className="h-4 w-4 text-sky-400" />
                <span>Pilih Jalur Akses Barcode untuk Semua Pengguna:</span>
              </span>
              <span className="text-[10px] text-sky-400/80 font-mono">
                Mode Aktif: <strong className="text-amber-300 uppercase">{currentMode}</strong>
              </span>
            </div>

            {/* Mode Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Mode 1: Current Window Origin */}
              <button
                onClick={() => handleModeChange('origin')}
                className={`flex flex-col items-start p-2.5 rounded-xl border transition text-left ${
                  currentMode === 'origin'
                    ? 'border-sky-400 bg-sky-950/80 text-white shadow'
                    : 'border-sky-900/80 bg-[#07132c] text-slate-300 hover:border-sky-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sky-300 text-[11px]">
                  <Radio className="h-3.5 w-3.5 text-amber-400" />
                  <span>Domain Layar Ini (Rekomendasi)</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  100% terhubung ke server cockpit yang sedang Anda lihat saat ini.
                </p>
              </button>

              {/* Mode 2: Public Shared URL */}
              <button
                onClick={() => handleModeChange('shared')}
                className={`flex flex-col items-start p-2.5 rounded-xl border transition text-left ${
                  currentMode === 'shared'
                    ? 'border-sky-400 bg-sky-950/80 text-white shadow'
                    : 'border-sky-900/80 bg-[#07132c] text-slate-300 hover:border-sky-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sky-300 text-[11px]">
                  <Globe2 className="h-3.5 w-3.5 text-sky-400" />
                  <span>Publik (Shared URL)</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Gunakan domain publik ais-pre untuk akses preview bersama.
                </p>
              </button>

              {/* Mode 3: Local WiFi / LAN IP */}
              <button
                onClick={() => handleModeChange('lan')}
                className={`flex flex-col items-start p-2.5 rounded-xl border transition text-left ${
                  currentMode === 'lan'
                    ? 'border-sky-400 bg-sky-950/80 text-white shadow'
                    : 'border-sky-900/80 bg-[#07132c] text-slate-300 hover:border-sky-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sky-300 text-[11px]">
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span>WiFi / Hotspot Lokal</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Koneksi langsung sesama perangkat dalam 1 jaringan WiFi / hotspot.
                </p>
              </button>

              {/* Mode 4: Custom Domain */}
              <button
                onClick={() => handleModeChange('custom')}
                className={`flex flex-col items-start p-2.5 rounded-xl border transition text-left ${
                  currentMode === 'custom'
                    ? 'border-sky-400 bg-sky-950/80 text-white shadow'
                    : 'border-sky-900/80 bg-[#07132c] text-slate-300 hover:border-sky-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sky-300 text-[11px]">
                  <Settings2 className="h-3.5 w-3.5 text-purple-400" />
                  <span>Domain Kustom</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Gunakan domain khusus militer, ngrok, atau IP manual pilihan Anda.
                </p>
              </button>
            </div>

            {/* Custom Host Input form if needed */}
            {currentMode === 'custom' && (
              <div className="pt-2 border-t border-sky-900/60 flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  value={customHostInput}
                  onChange={(e) => setCustomHostInput(e.target.value)}
                  placeholder="cth: https://karaoke.pangkalan.mil atau 192.168.1.15:3000"
                  className="w-full sm:flex-1 rounded-lg border border-sky-800 bg-[#07132c] px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
                />
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    onClick={handleSaveCustomHost}
                    className="flex-1 sm:flex-none rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow"
                  >
                    Simpan Domain
                  </button>
                  <button
                    onClick={handleResetHost}
                    className="rounded-lg border border-sky-800 hover:bg-sky-900/40 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FULLSCREEN / MODAL ZOOM BARCODE (Guarantees Instant Camera Recognition) */}
      {showZoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#071533] border-2 border-sky-400 p-6 shadow-2xl text-center">
            {/* Close Button */}
            <button
              onClick={() => setShowZoomModal(false)}
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-sky-900/80 hover:bg-sky-800 text-white flex items-center justify-center transition border border-sky-600"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header Title */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950 border border-sky-600 text-sky-300 text-xs font-mono font-bold mb-3">
              <Radio className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
              KODE ROOM: {roomId}
            </div>

            <h2 className="text-xl font-black text-white font-display">
              Scan Barcode Remote Karaoke
            </h2>
            <p className="text-xs text-sky-200/80 mt-1 max-w-sm mx-auto">
              Arahkan kamera HP ke barcode di bawah ini untuk memilih lagu dan bernyanyi bersama prajurit lainnya.
            </p>

            {/* High-Resolution Optical Pure Black on White QR Code */}
            <div className="my-5 inline-block rounded-2xl bg-white p-4 shadow-2xl shadow-sky-500/40 border-4 border-sky-400 ring-8 ring-sky-900/40">
              {largeQrDataUrl ? (
                <img
                  src={largeQrDataUrl}
                  alt={`Barcode Room ${roomId}`}
                  className="h-64 w-64 object-contain rounded-lg mx-auto"
                />
              ) : (
                <div className="h-64 w-64 flex items-center justify-center bg-slate-100 text-sky-700">
                  <QrCode className="h-16 w-16 animate-pulse" />
                </div>
              )}
            </div>

            {/* Helpful Practical Guidance */}
            <div className="rounded-xl bg-[#040c1e] p-3 border border-sky-900/80 text-left text-xs text-sky-200 space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-slate-300">
                  <strong>Tips Scan Kamera HP:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-sky-300/80">
                    <li>Gunakan aplikasi Kamera bawaan HP (iPhone / Android) atau Google Lens.</li>
                    <li>Jika peramban sementara HP meminta izin cookie / login, kirim link via <strong>WhatsApp</strong> di bawah lalu buka di <strong>Chrome / Safari</strong>.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Actions inside modal */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <a
                href={waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow transition"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Kirim ke WhatsApp</span>
              </a>

              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow transition"
              >
                {isCopied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                <span>{isCopied ? 'Tersalin!' : 'Salin Tautan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Mobile Remote Simulator Modal */}
      <MobileSimulatorModal
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
      />
    </>
  );
};
