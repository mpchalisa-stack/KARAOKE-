import React from 'react';
import { Smartphone, Sparkles, X, CheckCircle2, Music2 } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';

export const RemoteNotificationsToast: React.FC = () => {
  const { remoteNotifications, removeRemoteNotification } = useKaraoke();

  if (!remoteNotifications || remoteNotifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {remoteNotifications.map((notif) => (
        <div
          key={notif.id}
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-sky-400/50 bg-[#07132c]/95 p-3.5 text-xs text-white shadow-2xl shadow-sky-950 backdrop-blur-md animate-in slide-in-from-right duration-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 text-white shadow-md border border-sky-400/40">
              <Smartphone className="h-5 w-5 text-sky-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sky-300 text-[10px] uppercase tracking-wider font-mono">
                  SINKRONISASI HP PRAJURIT
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="font-semibold text-slate-100 text-xs mt-0.5 leading-snug">
                {notif.message}
              </p>
            </div>
          </div>

          <button
            onClick={() => removeRemoteNotification(notif.id)}
            className="p-1 text-sky-400/70 hover:text-white hover:bg-sky-900/50 rounded-lg shrink-0"
            aria-label="Tutup Notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
