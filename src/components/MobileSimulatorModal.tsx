import React from 'react';
import { X, Smartphone, ExternalLink, HelpCircle } from 'lucide-react';
import { MobileClientView } from './MobileClientView';
import { useKaraoke } from '../context/KaraokeContext';

interface MobileSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSimulatorModal: React.FC<MobileSimulatorModalProps> = ({ isOpen, onClose }) => {
  const { roomId } = useKaraoke();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Container simulating a real smartphone */}
      <div className="relative flex flex-col items-center max-h-[96vh] w-full max-w-[420px]">
        {/* Top Controls outside phone */}
        <div className="flex items-center justify-between w-full mb-2 px-1 text-white">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-sky-400" />
            <span className="text-xs sm:text-sm font-black font-display text-sky-200">
              Remote HP Prajurit (Simulasi Langsung)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/?client=1&room=${encodeURIComponent(roomId)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-white bg-sky-950/80 px-2.5 py-1 rounded-lg border border-sky-700/60 transition"
              title="Buka tampilan HP di tab baru"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Tab Baru</span>
            </a>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition border border-slate-600"
              title="Tutup simulator"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Realistic Phone Bezel Frame */}
        <div className="relative w-full h-[82vh] max-h-[760px] rounded-[38px] bg-slate-950 border-[7px] border-slate-700 shadow-2xl shadow-sky-900/60 overflow-hidden flex flex-col ring-2 ring-sky-500/40">
          {/* Phone Top Speaker & Notch */}
          <div className="h-5 w-full bg-slate-950 shrink-0 flex items-center justify-center select-none relative z-20">
            <div className="h-3.5 w-24 rounded-b-xl bg-slate-800 flex items-center justify-center">
              <div className="h-1 w-8 rounded-full bg-slate-600" />
            </div>
          </div>

          {/* Phone Display Screen (Embeds MobileClientView) */}
          <div className="flex-1 w-full overflow-hidden bg-[#050e24]">
            <MobileClientView
              isEmbedded={true}
              onCloseEmbedded={onClose}
              roomIdOverride={roomId}
            />
          </div>

          {/* Phone Bottom Home Bar Indicator */}
          <div className="h-4 w-full bg-slate-950 shrink-0 flex items-center justify-center select-none relative z-20">
            <div className="h-1 w-28 rounded-full bg-slate-600" />
          </div>
        </div>

        {/* Helpful Tip Footer */}
        <p className="text-[11px] text-slate-300 text-center mt-2 flex items-center justify-center gap-1">
          <HelpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Simulasi ini terhubung 100% secara instan dengan Layar TV & Master Cockpit.</span>
        </p>
      </div>
    </div>
  );
};
