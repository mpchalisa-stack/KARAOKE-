import React, { useState, useEffect } from 'react';
import { KaraokeProvider, useKaraoke } from './context/KaraokeContext';
import { Header } from './components/Header';
import { PersistentBarcodeHeader } from './components/PersistentBarcodeHeader';
import { MasterWirelessMicStatus } from './components/MasterWirelessMicStatus';
import { Player } from './components/Player';
import { SearchBar } from './components/SearchBar';
import { CategoryChips } from './components/CategoryChips';
import { SearchResults } from './components/SearchResults';
import { QueueSidebar } from './components/QueueSidebar';
import { SongScoreModal } from './components/SongScoreModal';
import { TVStageMode } from './components/TVStageMode';
import { MobileClientView } from './components/MobileClientView';
import { RemoteNotificationsToast } from './components/RemoteNotificationsToast';
import { OfflineIndicator } from './components/OfflineIndicator';

function MasterKaraokeApp() {
  const { isTvMode } = useKaraoke();

  // If TV Mode is active, render TVStageMode ONLY so Player is completely unmounted and cannot duplicate audio!
  if (isTvMode) {
    return <TVStageMode standalone={false} />;
  }

  return (
    <div className="min-h-screen bg-[#060e20] text-slate-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <Header />

      {/* Main Application Container with Persistent Side-by-Side Queue */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1700px] w-full mx-auto">
        {/* Main Stage & Content Area (Left side) */}
        <main className="flex-1 min-w-0 p-2 sm:p-4 lg:p-5 space-y-3 sm:space-y-4">
          {/* Fixed Barcode Header: Permanently Embedded on Screen Without Any Popups */}
          <section aria-label="Koneksi Barcode HP Android">
            <PersistentBarcodeHeader />
          </section>

          {/* WebRTC Wireless Microphone Status (shows when HP streams mic) */}
          <MasterWirelessMicStatus />

          {/* YouTube IFrame Player & Stage Screen */}
          <section aria-label="Pemutar Karaoke">
            <Player />
          </section>

          {/* Song Search Bar */}
          <section aria-label="Bilah Pencarian">
            <SearchBar />
          </section>

          {/* Quick Category Recommendations (Slow Rock, Roots Reggae, Roots Dub, etc.) */}
          <section aria-label="Rekomendasi Cepat">
            <CategoryChips />
          </section>

          {/* Search & Curated Results Grid */}
          <section aria-label="Hasil Lagu">
            <SearchResults />
          </section>
        </main>

        {/* Persistent Queue Sidebar (Always alongside the screen on desktop & tablet) */}
        <QueueSidebar />
      </div>

      {/* Real-time remote toasts when Android clients add songs */}
      <RemoteNotificationsToast />

      {/* Scoring Evaluation Modal (Shows when song ends or on demand) */}
      <SongScoreModal />
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<'master' | 'client' | 'tv'>(() => {
    if (typeof window === 'undefined') return 'master';
    const params = new URLSearchParams(window.location.search);
    if (params.get('client') === '1' || params.get('mode') === 'client') return 'client';
    if (params.get('tv') === '1' || params.get('mode') === 'tv') return 'tv';
    // Auto-detect Smart TV Web Browsers (Samsung Tizen, LG webOS, Android TV, etc.)
    if (/SMART-TV|Tizen|webOS|NetCast|Android.*TV|BRAVIA|Hisense|GoogleTV|CrKey|Viera|AppleTV/i.test(navigator.userAgent)) {
      return 'tv';
    }
    return 'master';
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('client') === '1' || params.get('mode') === 'client') {
        setViewMode('client');
      } else if (params.get('tv') === '1' || params.get('mode') === 'tv') {
        setViewMode('tv');
      } else {
        setViewMode('master');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // If accessed from an Android / Mobile phone via barcode scan link:
  if (viewMode === 'client') {
    return (
      <>
        <MobileClientView />
        <OfflineIndicator />
      </>
    );
  }

  // If opened directly on TV screen / projector (e.g. ?mode=tv or ?tv=1):
  if (viewMode === 'tv') {
    return (
      <KaraokeProvider initialIsTvMode={true}>
        <TVStageMode standalone={true} />
        <OfflineIndicator />
      </KaraokeProvider>
    );
  }

  // Otherwise load Tablet Touchscreen Console & Master Cockpit:
  return (
    <KaraokeProvider>
      <MasterKaraokeApp />
      <OfflineIndicator />
    </KaraokeProvider>
  );
}
