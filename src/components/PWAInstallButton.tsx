import React, { useState } from 'react';
import { Download, Smartphone, Tv, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile' | 'tv' | 'badge';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isSmartTV, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If already installed in standalone mode, still allow opening modal for other devices / info or hide button
  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    // If not direct 1-click installable or user wants instructions:
    setIsModalOpen(true);
  };

  if (variant === 'tv') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center gap-1.5 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition shadow-sm active:scale-95 shrink-0 ${className}`}
          title="Instal Aplikasi di Smart TV / HP Android / iOS"
        >
          <Tv className="h-3 w-3 text-amber-400 shrink-0" />
          <Download className="h-3 w-3 text-amber-300 shrink-0" />
          <span>Instal di Smart TV</span>
        </button>

        <PWAInstallModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          defaultTab="tv"
        />
      </>
    );
  }

  if (variant === 'mobile') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md transition active:scale-95 border border-sky-400/50 shrink-0 ${className}`}
          title="Instal Aplikasi Remote Karaoke di HP (Android & iOS)"
        >
          <Download className="h-3 w-3 text-amber-300 shrink-0" />
          <span>Pasang App</span>
        </button>

        <PWAInstallModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          defaultTab={isIOS ? 'ios' : 'android'}
        />
      </>
    );
  }

  // Header default variant
  return (
    <>
      <button
        onClick={handleClick}
        className={`group relative flex items-center gap-1.5 rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-950/80 to-blue-950/80 hover:from-sky-900/90 hover:to-blue-900/90 px-2 sm:px-2.5 py-1 text-[11px] font-bold text-sky-200 transition shadow-md hover:border-sky-300 active:scale-95 shrink-0 ${className}`}
        title="Pasang / Instal Aplikasi di HP Android, iOS, atau Smart TV"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>
        <Download className="h-3 w-3 text-amber-300 group-hover:scale-110 transition shrink-0" />
        <span className="hidden sm:inline font-bold text-amber-300">Instal App</span>
      </button>

      <PWAInstallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
