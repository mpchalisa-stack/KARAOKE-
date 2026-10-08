import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Song, QueueItem, SuffixFilter, WebSocketMessage, RemoteClientInfo, RemoteNotification, SongScoreData, ScreenReaction, SoundFxType } from '../types/karaoke';
import { searchKaraokeSongs, CURATED_LIBRARY, CATEGORY_PRESETS, extractYoutubeVideoId, fetchOEmbedInfo } from '../services/youtube';
import { audioFx } from '../services/audioFx';
import { useWebRTCAudioReceiver, ActiveWirelessMic } from '../hooks/useWebRTCAudioReceiver';
import { useKaraokeScoring, LiveScoringState } from '../hooks/useKaraokeScoring';
import { getSignalingWebSocketUrl } from '../services/signaling';
import { getTvPeerId, createPeer, startPeerHeartbeat, type PeerMessage, type DataConnection } from '../services/peerManager';
import type Peer from 'peerjs';

interface KaraokeContextType {
  // Search & Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  suffixFilter: SuffixFilter;
  setSuffixFilter: (filter: SuffixFilter) => void;
  searchResults: Song[];
  isSearching: boolean;
  searchError: string | null;
  isCuratedFallback: boolean;
  activeCategory: string | null;
  executeSearch: (query?: string, categoryId?: string) => Promise<void>;
  addDirectVideoUrl: (urlOrId: string, singerName?: string) => Promise<boolean>;

  // Queue Management
  queue: QueueItem[];
  currentSong: Song | null;
  history: Song[];
  addToQueue: (song: Song, singerName?: string, playNext?: boolean) => void;
  removeFromQueue: (queueId: string) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  updateSingerName: (queueId: string, newSinger: string) => void;
  playSongNow: (song: Song, singerName?: string) => void;
  skipNextSong: () => void;
  replayCurrentSong: () => void;

  // Player State
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: (broadcast?: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  handlePlayerEnded: () => void;
  playerRef: any;

  // UI States
  isQueueOpenMobile: boolean;
  setIsQueueOpenMobile: (open: boolean) => void;
  isScoreModalOpen: boolean;
  setIsScoreModalOpen: (open: boolean) => void;
  currentScoreData: SongScoreData | null;
  evaluateCurrentSong: () => void;
  isTvMode: boolean;
  setIsTvMode: (tvMode: boolean) => void;
  defaultSingerName: string;
  setDefaultSingerName: (name: string) => void;

  // Remote & Sync
  roomId: string;
  remoteConnectedDevices: number;
  remoteClientsList: RemoteClientInfo[];
  remoteNotifications: RemoteNotification[];
  removeRemoteNotification: (id: string) => void;
  activeReactions: ScreenReaction[];
  triggerSoundFx: (type: SoundFxType | string, broadcast?: boolean, senderName?: string) => void;

  // WebRTC Wireless Microphone Audio
  activeWirelessMics: ActiveWirelessMic[];
  masterMicVolume: number;
  setMasterMicVolume: (vol: number) => void;
  masterMicEcho: number;
  setMasterMicEcho: (echo: number) => void;
  isMasterMicMuted: boolean;
  setIsMasterMicMuted: (muted: boolean) => void;
  increaseMicVolume: () => void;
  decreaseMicVolume: () => void;
  increaseMicEcho: () => void;
  decreaseMicEcho: () => void;
  isAudioSuspended: boolean;
  resumeAudio: () => void;
  setClientMicVolume: (senderId: string, volume: number) => void;
  setClientMicEcho: (senderId: string, echo: number) => void;
  toggleClientMicMute: (senderId: string) => void;

  // Web Audio API Karaoke Scoring System
  scoringState: LiveScoringState;
  isScoringActive: boolean;
  startScoring: () => void;
  stopScoringAndGetResult: () => SongScoreData | null;
  musicMediaRef: React.MutableRefObject<HTMLMediaElement | null>;

  // Vocal Sync Delay / Music Delay Adjustment (TV DelayNode buffer)
  musicDelayMs: number;
  setMusicDelayMs: (ms: number, broadcast?: boolean) => void;
  connectMusicMediaElement: (element: HTMLMediaElement) => void;
}

const KaraokeContext = createContext<KaraokeContextType | null>(null);

const STORAGE_KEYS = {
  QUEUE: 'karaoke_queue_list_v1',
  HISTORY: 'karaoke_history_list_v1',
  CURRENT: 'karaoke_current_song_v1',
  SINGER: 'karaoke_default_singer_v1',
  ROOM_ID: 'karaoke_room_id_v1',
};

export const KaraokeProvider: React.FC<{ children: React.ReactNode; initialIsTvMode?: boolean }> = ({
  children,
  initialIsTvMode = false,
}) => {
  // Stored preferences
  const [defaultSingerName, setDefaultSingerNameState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.SINGER) || 'Vokalis Bintang';
  });

  const [roomId] = useState<string>(() => {
    // Check URL first
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('room');
    if (fromUrl) {
      const clean = fromUrl.trim().toUpperCase();
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, clean);
      return clean;
    }
    let stored = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
    if (!stored) {
      stored = 'ROOM-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, stored);
    }
    return stored.trim().toUpperCase();
  });

  // Player & Queue State
  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT);
      return saved ? JSON.parse(saved) : (CURATED_LIBRARY['hits-indonesia']?.[0] || CURATED_LIBRARY['slow-rock'][0]); // default initial track
    } catch {
      return CURATED_LIBRARY['hits-indonesia']?.[0] || CURATED_LIBRARY['slow-rock'][0];
    }
  });

  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
      if (saved) return JSON.parse(saved);
      const hits = CURATED_LIBRARY['hits-indonesia'] || [];
      return [
        {
          queueId: 'q-initial-1',
          song: hits[2] || hits[1], // Cakra Khan - Kekasih Bayangan
          singerName: 'Budi Vokal',
          addedAt: Date.now(),
        },
        {
          queueId: 'q-initial-2',
          song: hits[4] || hits[0], // Kerispatih - Demi Cinta
          singerName: 'Siti Karaoke',
          addedAt: Date.now() + 1000,
        },
        {
          queueId: 'q-initial-3',
          song: hits[9] || hits[0], // Ada Band - Manusia Bodoh
          singerName: 'Rian Akustik',
          addedAt: Date.now() + 2000,
        },
        {
          queueId: 'q-initial-4',
          song: hits[7] || hits[0], // Java Jive - Gerangan Cinta
          singerName: 'Letnan Dedi',
          addedAt: Date.now() + 3000,
        },
      ];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState<Song[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suffixFilter, setSuffixFilter] = useState<SuffixFilter>('karaoke');
  const [searchResults, setSearchResults] = useState<Song[]>(() => CURATED_LIBRARY['hits-indonesia'] || []);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isCuratedFallback, setIsCuratedFallback] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string | null>('hits-indonesia');

  // Player Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const playerRef = useRef<any>(null);

  // Modals & Panels
  const [isQueueOpenMobile, setIsQueueOpenMobile] = useState<boolean>(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState<boolean>(false);
  const [currentScoreData, setCurrentScoreData] = useState<SongScoreData | null>(null);
  const [isTvMode, setIsTvMode] = useState<boolean>(() => {
    if (initialIsTvMode) return true;
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'tv' || urlParams.get('tv') === '1';
  });
  const [remoteConnectedDevices, setRemoteConnectedDevices] = useState<number>(1);
  const [remoteClientsList, setRemoteClientsList] = useState<RemoteClientInfo[]>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<RemoteNotification[]>([]);
  const [activeReactions, setActiveReactions] = useState<ScreenReaction[]>([]);

  // WebSocket and BroadcastChannel references
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // WebRTC Wireless Microphone Audio Receiver for Master
  const {
    activeMics: activeWirelessMics,
    masterMicVolume,
    setMasterMicVolume,
    masterMicEcho,
    setMasterMicEcho,
    isMasterMicMuted,
    setIsMasterMicMuted,
    increaseVolume: increaseMicVolume,
    decreaseVolume: decreaseMicVolume,
    increaseEcho: increaseMicEcho,
    decreaseEcho: decreaseMicEcho,
    isAudioSuspended,
    resumeAudio,
    setClientMicVolume,
    setClientMicEcho,
    toggleClientMicMute,
    handleSignalingMessage: handleWebRTCSignaling,
    attachAudioStream,
    cleanupSender,
    musicDelayMs,
    setMusicDelayMs,
    connectMusicMediaElement,
  } = useWebRTCAudioReceiver({
    socketRef: wsRef,
    roomId,
  });

  // PeerJS P2P TV Master references (Serverless WebRTC via 0.peerjs.com)
  const peerRef = useRef<Peer | null>(null);
  const peerConnectionsRef = useRef<Map<string, DataConnection>>(new Map());

  // Reference to HTMLMediaElement for Web Audio API music analyzer
  const musicMediaRef = useRef<HTMLMediaElement | null>(null);

  // Active WebRTC microphone audio stream (from mobile broadcaster)
  const activeMicStream =
    activeWirelessMics.length > 0 && activeWirelessMics[0].stream
      ? activeWirelessMics[0].stream
      : null;

  // Web Audio API Karaoke Scoring Engine (dual AnalyserNode for mic and music)
  const {
    liveState: scoringState,
    isScoringActive,
    startScoring,
    stopScoringAndGetResult,
  } = useKaraokeScoring({
    currentSong,
    singerName: defaultSingerName,
    isPlaying,
    micStream: activeMicStream,
    musicMediaElement: musicMediaRef.current,
    triggerSoundFx: (type) => triggerSoundFx(type),
    nextItem: queue.length > 0 ? queue[0] : undefined,
  });

  // Automatically start scoring session when song playback begins
  useEffect(() => {
    if (isPlaying && currentSong) {
      startScoring();
    }
  }, [isPlaying, currentSong, startScoring]);

  const addRemoteNotification = useCallback((message: string, senderName?: string, type: 'info' | 'success' | 'alert' = 'info') => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNotif: RemoteNotification = {
      id,
      message,
      senderName,
      type,
      timestamp: Date.now(),
    };
    setRemoteNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setRemoteNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const removeRemoteNotification = useCallback((id: string) => {
    setRemoteNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Persist storage helpers
  const setDefaultSingerName = (name: string) => {
    setDefaultSingerNameState(name);
    localStorage.setItem(STORAGE_KEYS.SINGER, name);
  };

  // Keep localStorage updated
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    if (currentSong) {
      localStorage.setItem(STORAGE_KEYS.CURRENT, JSON.stringify(currentSong));
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  // Sync Master state to backend server so newly scanned Android clients get latest data
  const syncStateToServer = useCallback(() => {
    // 1. Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'SYNC_STATE',
            roomId,
            payload: {
              currentSong,
              isPlaying,
              queue,
              musicDelayMs,
            },
          })
        );
      } catch (err) {
        console.warn('WS sync state error:', err);
      }
    }

    // 2. HTTP POST sync
    fetch(`/api/room/${encodeURIComponent(roomId)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentSong,
        isPlaying,
        queue,
        musicDelayMs,
      }),
    }).catch(() => {});
  }, [roomId, currentSong, isPlaying, queue, musicDelayMs]);

  // Connect music media element to TV DelayNode pipeline on mount
  useEffect(() => {
    if (musicMediaRef.current) {
      connectMusicMediaElement(musicMediaRef.current);
    }
  }, [connectMusicMediaElement]);

  // Push server sync on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(syncStateToServer, 600);
    return () => clearTimeout(timer);
  }, [syncStateToServer]);

  // Real-time WebSocket connection to server
  useEffect(() => {
    let socket: WebSocket | null = null;
    let sseSource: EventSource | null = null;
    let reconnectTimer: any = null;
    let pingInterval: any = null;
    let retryCount = 0;

    const fetchRoomState = async () => {
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: 'master-cockpit', singerName: 'Layar Utama', role: 'master' }),
        });
        const data = await res.json();
        if (data.success && data.room) {
          if (data.room.currentSong) {
            setCurrentSong(data.room.currentSong);
          } else if (currentSong) {
            syncStateToServer();
          }
          if (typeof data.room.isPlaying === 'boolean') {
            setIsPlaying(data.room.isPlaying);
          }
          if (Array.isArray(data.room.queue)) {
            if (data.room.queue.length > 0) {
              setQueue(data.room.queue);
            } else if (queue.length > 0) {
              syncStateToServer();
            }
          }
          if (typeof data.room.musicDelayMs === 'number') {
            setMusicDelayMs(data.room.musicDelayMs, false);
          }
          if (data.clientCount !== undefined) {
            setRemoteConnectedDevices(data.clientCount);
          }
          if (Array.isArray(data.room.clients)) {
            setRemoteClientsList(data.room.clients);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    // Initial hydration from room server & immediate sync
    fetchRoomState();
    syncStateToServer();

    const connectWs = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        const wsUrl = getSignalingWebSocketUrl({
          roomId,
          role: 'master',
          singerName: 'Layar Utama',
        });

        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          retryCount = 0;
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: 'PING', roomId, timestamp: Date.now() }));
              } catch {}
            }
          }, 20000);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || !data.type) return;

            switch (data.type) {
              case 'INIT_STATE':
              case 'STATE_UPDATE': {
                if (data.payload) {
                  if (data.payload.currentSong !== undefined && data.payload.currentSong !== null) {
                    setCurrentSong(data.payload.currentSong);
                  }
                  if (data.payload.isPlaying !== undefined) {
                    setIsPlaying(data.payload.isPlaying);
                  }
                  if (Array.isArray(data.payload.queue)) {
                    setQueue(data.payload.queue);
                  }
                  if (data.payload.clientCount !== undefined) {
                    setRemoteConnectedDevices(data.payload.clientCount);
                  }
                  if (Array.isArray(data.payload.clients)) {
                    setRemoteClientsList(data.payload.clients);
                  }
                }
                break;
              }

              case 'ADD_QUEUE_ITEM': {
                const item = data.payload?.item;
                const sender = data.payload?.senderName || 'Prajurit (HP)';
                if (item && item.song) {
                  setQueue((prev) => {
                    // Check if already in queue
                    if (prev.some((q) => q.queueId === item.queueId)) return prev;
                    if (item.priority) {
                      return [item, ...prev];
                    }
                    return [...prev, item];
                  });
                  audioFx.playDing();
                  addRemoteNotification(
                    `📱 ${sender} menambahkan lagu "${item.song.title.slice(0, 30)}..." ke antrean!`,
                    sender,
                    'success'
                  );
                }
                break;
              }

              case 'REMOVE_QUEUE_ITEM': {
                const queueId = data.payload?.queueId;
                if (queueId) {
                  setQueue((prev) => prev.filter((q) => q.queueId !== queueId));
                }
                break;
              }

              case 'SYNC_QUEUE': {
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                  const sender = data.payload?.senderName;
                  if (sender && sender !== 'Layar Utama') {
                    addRemoteNotification(`📱 ${sender} memperbarui urutan antrean lagu!`, sender, 'info');
                  }
                }
                break;
              }

              case 'PLAY_NOW': {
                if (data.payload?.song) {
                  setCurrentSong(data.payload.song);
                  setIsPlaying(true);
                  const sender = data.payload?.singerName || 'HP';
                  addRemoteNotification(`📱 ${sender} mengganti lagu: "${data.payload.song.title.slice(0, 30)}..."`, sender, 'info');
                }
                break;
              }

              case 'PLAY_SOUND_FX': {
                const sound = data.payload?.sound;
                const sender = data.payload?.senderName || 'Prajurit (HP)';
                if (sound) {
                  triggerSoundFx(sound, false, sender);
                  addRemoteNotification(
                    sound === 'boo' ? `👎 Sorak HUUU dari ${sender}!` : `🎉 Reaksi "${sound}" dari ${sender}!`,
                    sender,
                    sound === 'boo' ? 'alert' : 'info'
                  );
                }
                break;
              }

              case 'CLIENT_COUNT_UPDATE': {
                if (data.payload?.clientCount !== undefined) {
                  setRemoteConnectedDevices(data.payload.clientCount);
                }
                if (Array.isArray(data.payload?.clients)) {
                  setRemoteClientsList(data.payload.clients);
                }
                if (data.payload?.joinedName && data.payload.joinedName !== 'Layar Utama') {
                  addRemoteNotification(`📱 ${data.payload.joinedName} berhasil terhubung dari HP!`, undefined, 'info');
                }
                break;
              }

              case 'SKIP_NEXT': {
                skipNextSong(false);
                break;
              }

              case 'TOGGLE_PAUSE': {
                if (data.payload?.isPlaying !== undefined) {
                  setIsPlaying(data.payload.isPlaying);
                } else {
                  setIsPlaying((prev) => !prev);
                }
                break;
              }

              case 'CLIENT_MIC_AUDIO_DATA':
              case 'RTC_MIC_LEVEL':
              case 'RTC_OFFER':
              case 'RTC_ICE_CANDIDATE':
              case 'RTC_MIC_PARAMS':
              case 'MUSIC_SYNC_DELAY': {
                handleWebRTCSignaling(data);
                break;
              }

              case 'RTC_MIC_STATUS': {
                handleWebRTCSignaling(data);
                const isMicOn = data.payload?.isMicOn;
                const sender = data.payload?.senderName || 'Prajurit (HP)';
                if (isMicOn) {
                  addRemoteNotification(
                    `🎤 ${sender} mengaktifkan Mikrofon Wireless HP! Suara disiarkan langsung ke speaker.`,
                    sender,
                    'success'
                  );
                } else {
                  addRemoteNotification(
                    `🎤 ${sender} mematikan Mikrofon Wireless HP.`,
                    sender,
                    'info'
                  );
                }
                break;
              }
            }
          } catch (err) {
            console.warn('Master WS parse error:', err);
          }
        };

        socket.onclose = () => {
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          retryCount++;
          const delay = Math.min(1500 * Math.pow(1.3, retryCount), 10000);
          reconnectTimer = setTimeout(connectWs, delay);
        };

        socket.onerror = () => {
          try {
            socket?.close();
          } catch {}
        };
      } catch (e) {
        connectSSE();
      }
    };

    const connectSSE = () => {
      try {
        sseSource = new EventSource(`/api/room/${encodeURIComponent(roomId)}/events?role=master&name=Layar%20Utama`);
        sseSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT_STATE' || data.type === 'STATE_UPDATE') {
              if (data.payload?.currentSong !== undefined && data.payload.currentSong !== null) {
                setCurrentSong(data.payload.currentSong);
              }
              if (data.payload?.isPlaying !== undefined) {
                setIsPlaying(data.payload.isPlaying);
              }
              if (Array.isArray(data.payload?.queue)) {
                setQueue(data.payload.queue);
              }
              if (data.payload?.clientCount) setRemoteConnectedDevices(data.payload.clientCount);
              if (Array.isArray(data.payload?.clients)) setRemoteClientsList(data.payload.clients);
            } else if (data.type === 'SYNC_QUEUE' && Array.isArray(data.payload?.queue)) {
              setQueue(data.payload.queue);
            } else if (data.type === 'PLAY_NOW' && data.payload?.song) {
              setCurrentSong(data.payload.song);
              setIsPlaying(true);
            } else if (data.type === 'SKIP_NEXT') {
              skipNextSong();
            } else if (data.type === 'ADD_QUEUE_ITEM' && data.payload?.item) {
              setQueue((prev) => {
                if (prev.some((q) => q.queueId === data.payload.item.queueId)) return prev;
                return [...prev, data.payload.item];
              });
              audioFx.playDing();
              addRemoteNotification(`📱 HP Prajurit menambahkan lagu ke antrean!`);
            } else if (data.type === 'CLIENT_COUNT_UPDATE') {
              if (data.payload?.clientCount) setRemoteConnectedDevices(data.payload.clientCount);
              if (Array.isArray(data.payload?.clients)) setRemoteClientsList(data.payload.clients);
            }
          } catch (err) {}
        };
      } catch (err) {}
    };

    connectWs();

    // Periodic state polling every 2 seconds to guarantee TV and Tablet stay 100% in sync
    const pollTimer = setInterval(fetchRoomState, 2000);

    return () => {
      clearInterval(pollTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
      if (sseSource) sseSource.close();
    };
  }, [roomId, addRemoteNotification]);

  // Broadcast Channel setup for instant multi-window / multi-screen sync on same browser
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`karaoke_channel_${roomId}`);
      broadcastRef.current = channel;

      channel.onmessage = (event) => {
        const msg: WebSocketMessage = event.data;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'ADD_QUEUE_ITEM':
            if (msg.payload?.item) {
              setQueue((prev) => {
                if (prev.some((q) => q.queueId === msg.payload.item.queueId)) return prev;
                return [...prev, msg.payload.item];
              });
              audioFx.playDing();
            }
            break;
          case 'PLAY_NOW':
            if (msg.payload?.song) {
              setCurrentSong(msg.payload.song);
              setIsPlaying(true);
            }
            break;
          case 'SYNC_QUEUE':
            if (Array.isArray(msg.payload?.queue)) {
              setQueue(msg.payload.queue);
            }
            break;
          case 'SKIP_NEXT':
            skipNextSong(false);
            break;
          case 'TOGGLE_PAUSE':
            if (msg.payload?.isPlaying !== undefined) {
              setIsPlaying(msg.payload.isPlaying);
            } else {
              setIsPlaying((prev) => !prev);
            }
            break;
          case 'PLAY_SOUND_FX':
            if (msg.payload?.sound) {
              triggerSoundFx(msg.payload.sound, false, msg.payload.senderName);
            }
            break;
          case 'CLIENT_CONNECTED':
            setRemoteConnectedDevices((prev) => prev + 1);
            break;
          case 'MUSIC_SYNC_DELAY':
            if (typeof msg.payload?.delayMs === 'number') {
              setMusicDelayMs(msg.payload.delayMs, false);
            }
            break;
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [roomId]);

  // Send message helper across sync channels
  const broadcastMessage = useCallback(
    (type: WebSocketMessage['type'], payload?: any) => {
      // 1. BroadcastChannel (same browser tabs)
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type,
          roomId,
          payload,
          timestamp: Date.now(),
        });
      }

      // 2. WebSocket (remote network devices)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type,
              roomId,
              payload,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          // ignore
        }
      }
    },
    [roomId]
  );

  // Sound effects runner with on-screen visual reaction (HUUU, Cheer, Applause, etc.)
  const triggerSoundFx = useCallback(
    (type: SoundFxType | string, broadcast = true, senderName?: string) => {
      const sender = senderName || defaultSingerName || 'Prajurit';

      const reactionMeta: Record<string, { label: string; emoji: string }> = {
        boo: { label: 'HUUUU...!! Suara Hancur Tapi Tetap Maju! 💨', emoji: '👎' },
        cheer: { label: 'Sorak Komando! Mantap Luar Biasa! ✨', emoji: '🎉' },
        applause: { label: 'Tepuk Tangan Meriah Pasukan! 👏', emoji: '👏' },
        airhorn: { label: 'Sirine Tempur DJ Pangkalan! 🚨', emoji: '📢' },
        laugh: { label: 'Tawa Pasukan Bahagia! 😂', emoji: '😂' },
        ding: { label: 'Bel Panggilan Apel! 🔔', emoji: '🔔' },
        rimshot: { label: 'Rimshot Drum Solo! 🥁', emoji: '🥁' },
      };

      const meta = reactionMeta[type] || { label: `Sorak "${type}"`, emoji: '✨' };
      const reactionId = `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newReaction: ScreenReaction = {
        id: reactionId,
        type: type as SoundFxType,
        label: meta.label,
        emoji: meta.emoji,
        senderName: sender,
        timestamp: Date.now(),
      };

      setActiveReactions((prev) => [...prev.slice(-4), newReaction]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
      }, 4200);

      switch (type) {
        case 'applause':
          audioFx.playApplause();
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.7 },
          });
          break;
        case 'cheer':
          audioFx.playCheer();
          confetti({
            particleCount: 90,
            spread: 100,
            origin: { y: 0.6 },
          });
          break;
        case 'airhorn':
          audioFx.playAirhorn();
          break;
        case 'ding':
          audioFx.playDing();
          break;
        case 'rimshot':
          audioFx.playRimshot();
          break;
        case 'boo':
          audioFx.playBoo();
          break;
        case 'laugh':
          audioFx.playLaugh();
          break;
      }
      if (broadcast) {
        broadcastMessage('PLAY_SOUND_FX', { sound: type, senderName: sender });
      }
    },
    [broadcastMessage, defaultSingerName]
  );

  // Execute Search
  const executeSearch = useCallback(
    async (queryOverride?: string, categoryId?: string) => {
      const q = queryOverride !== undefined ? queryOverride : searchQuery;
      if (!q.trim() && !categoryId) return;

      setIsSearching(true);
      setSearchError(null);
      if (categoryId) {
        setActiveCategory(categoryId);
      } else {
        setActiveCategory(null);
      }

      const res = await searchKaraokeSongs(q, suffixFilter, categoryId);
      setSearchResults(res.songs);
      setIsCuratedFallback(res.isCuratedFallback);
      if (res.error) {
        setSearchError(res.error);
      }
      setIsSearching(false);
    },
    [searchQuery, suffixFilter]
  );

  // Add Direct YouTube Video Link / ID with automatic title resolution
  const addDirectVideoUrl = useCallback(
    async (urlOrId: string, singerName?: string): Promise<boolean> => {
      const videoId = extractYoutubeVideoId(urlOrId);
      if (!videoId) return false;

      let title = `Video Karaoke (${videoId})`;
      let channelTitle = 'YouTube Video';

      try {
        const oembed = await fetchOEmbedInfo(videoId);
        if (oembed?.title) {
          title = oembed.title;
        }
        if (oembed?.author_name) {
          channelTitle = oembed.author_name;
        }
      } catch (e) {
        console.warn('oEmbed fetch error:', e);
      }

      const directSong: Song = {
        id: videoId,
        title,
        channelTitle,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        isCurated: false,
      };

      const newItem: QueueItem = {
        queueId: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        song: directSong,
        singerName: singerName?.trim() || defaultSingerName,
        addedAt: Date.now(),
      };

      setQueue((prev) => [...prev, newItem]);
      broadcastMessage('ADD_QUEUE_ITEM', { item: newItem });
      audioFx.playDing();
      return true;
    },
    [defaultSingerName, broadcastMessage]
  );

  // Add to Queue
  const addToQueue = useCallback(
    (song: Song, singerName?: string, playNext = false) => {
      const sName = singerName?.trim() || defaultSingerName;
      const newItem: QueueItem = {
        queueId: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        song,
        singerName: sName,
        addedAt: Date.now(),
        priority: playNext,
      };

      setQueue((prev) => {
        if (playNext) {
          return [newItem, ...prev];
        }
        return [...prev, newItem];
      });

      broadcastMessage('ADD_QUEUE_ITEM', { item: newItem, senderName: sName });
      fetch(`/api/room/${encodeURIComponent(roomId)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName: sName, priority: playNext }),
      }).catch(() => {});
      audioFx.playDing();
    },
    [defaultSingerName, broadcastMessage, roomId]
  );

  // Remove from Queue
  const removeFromQueue = useCallback((queueId: string) => {
    setQueue((prev) => prev.filter((item) => item.queueId !== queueId));
    broadcastMessage('REMOVE_QUEUE_ITEM', { queueId });
    fetch(`/api/room/${encodeURIComponent(roomId)}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId }),
    }).catch(() => {});
  }, [broadcastMessage, roomId]);

  // Reorder Queue
  const moveQueueItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      setQueue((prev) => {
        if (toIndex < 0 || toIndex >= prev.length) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        broadcastMessage('SYNC_QUEUE', { queue: updated });
        fetch(`/api/room/${encodeURIComponent(roomId)}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromIndex, toIndex, singerName: defaultSingerName }),
        }).catch(() => {});
        return updated;
      });
    },
    [broadcastMessage, roomId, defaultSingerName]
  );

  // Clear Queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Update singer name
  const updateSingerName = useCallback((queueId: string, newSinger: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.queueId === queueId ? { ...item, singerName: newSinger } : item))
    );
  }, []);

  // Play Song Immediately
  const playSongNow = useCallback(
    (song: Song, singerName?: string) => {
      const sName = singerName || defaultSingerName;
      if (currentSong) {
        setHistory((prev) => [currentSong, ...prev.slice(0, 19)]);
      }
      setCurrentSong(song);
      setIsPlaying(true);
      broadcastMessage('PLAY_NOW', { song, singerName: sName });
      fetch(`/api/room/${encodeURIComponent(roomId)}/play-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName: sName }),
      }).catch(() => {});
    },
    [currentSong, broadcastMessage, roomId, defaultSingerName]
  );

  // Skip to next song in queue
  const skipNextSong = useCallback(
    (broadcast = true) => {
      setQueue((prevQueue) => {
        if (prevQueue.length === 0) {
          setIsPlaying(false);
          if (broadcast) {
            broadcastMessage('SYNC_STATE', { currentSong: null, isPlaying: false, queue: [] });
            fetch(`/api/room/${encodeURIComponent(roomId)}/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentSong: null, isPlaying: false, queue: [] }),
            }).catch(() => {});
          }
          return prevQueue;
        }
        const [nextItem, ...remaining] = prevQueue;
        if (currentSong) {
          setHistory((prevHist) => [currentSong, ...prevHist.slice(0, 19)]);
        }
        setCurrentSong(nextItem.song);
        setIsPlaying(true);
        if (broadcast) {
          broadcastMessage('PLAY_NOW', { song: nextItem.song, singerName: nextItem.singerName });
          broadcastMessage('SYNC_QUEUE', { queue: remaining });
          fetch(`/api/room/${encodeURIComponent(roomId)}/skip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ singerName: defaultSingerName, nextSong: nextItem.song }),
          }).catch(() => {});
        }
        return remaining;
      });
    },
    [currentSong, broadcastMessage, roomId, defaultSingerName]
  );

  // Toggle Play / Pause synchronized across TV, Tablet, and Mobile
  const togglePlayPause = useCallback(
    (broadcast = true) => {
      setIsPlaying((prev) => {
        const next = !prev;
        if (broadcast) {
          broadcastMessage('TOGGLE_PAUSE', { isPlaying: next });
          fetch(`/api/room/${encodeURIComponent(roomId)}/toggle-pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPlaying: next, senderName: defaultSingerName }),
          }).catch(() => {});
        }
        return next;
      });
    },
    [broadcastMessage, roomId, defaultSingerName]
  );

  // Military Rank Titles & Humorous Military Commendations
  const MILITARY_TITLES = [
    '🎖️ JENDERAL PADUAN SUARA TNI AU',
    '🚀 PENEMBAK JITU NADA TINGGI',
    '🛡️ KOMANDAN VOKAL BERDAYA TEMPUR TINGGI',
    '⚡ KOPRAL FALSETTO STRATEGIS',
    '🔥 PRAJURIT PANTANG MUNDUR (SUARA HANCUR TETAP TEMPUR!)',
  ];

  const MILITARY_COMMENTARIES = [
    'Meskipun nada tinggi sempat goyah, semangat tempur prajurit pantang mundur! Layak dipertahankan di garis depan panggung!',
    'Daya ledak vokal setara rudal jelajah udara! Seluruh jajaran Diskomlekau berdiri memberikan tepuk tangan komando!',
    'Pitch vokal terkalibrasi akurat bagaikan radar sasaran udara! Lanjutkan ke pertempuran lagu berikutnya!',
    'Vokal berwibawa dan penuh jiwa korsa! Siap tampil di panggung upacara kehormatan TNI AU!',
    'Walau suara hancur, nafas tetap berapi-api! Semboyan Pantang Mundur terbukti nyata!',
    'Artikulasi tegas, power vokal stabil dari bait pertama hingga klimaks! Rekomendasi bintang 5 Subdis Rudal!',
  ];

  const generateScoreData = useCallback((song: Song, singer: string, nextItem?: QueueItem): SongScoreData => {
    // Generate realistic exciting score between 83 and 99
    const totalScore = Math.floor(83 + Math.random() * 16);
    let grade: 'SS' | 'S' | 'A' | 'B' | 'C' = 'A';
    if (totalScore >= 96) grade = 'SS';
    else if (totalScore >= 90) grade = 'S';
    else if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 80) grade = 'B';
    else grade = 'C';

    const rankTitle = MILITARY_TITLES[Math.floor(Math.random() * MILITARY_TITLES.length)];
    const commentary = MILITARY_COMMENTARIES[Math.floor(Math.random() * MILITARY_COMMENTARIES.length)];

    return {
      song,
      singerName: singer || defaultSingerName,
      totalScore,
      grade,
      rankTitle,
      commentary,
      pitchAccuracy: Math.min(100, Math.floor(totalScore - 4 + Math.random() * 8)),
      vocalPower: Math.min(100, Math.floor(totalScore - 3 + Math.random() * 7)),
      stagePresence: Math.min(100, Math.floor(totalScore - 2 + Math.random() * 6)),
      combatSpirit: Math.min(100, Math.floor(95 + Math.random() * 5)), // Always 95-100% Pantang Mundur!
      nextSong: nextItem?.song,
      nextSingerName: nextItem?.singerName,
      evaluatedAt: Date.now(),
    };
  }, [defaultSingerName]);

  // Replay current song
  const replayCurrentSong = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, []);

  // Trigger song scoring evaluation on demand (with Web Audio API analysis & 10-15% arcade modifier)
  const evaluateCurrentSong = useCallback(() => {
    if (currentSong) {
      const nextItem = queue.length > 0 ? queue[0] : undefined;
      const score = stopScoringAndGetResult() || generateScoreData(currentSong, defaultSingerName, nextItem);
      setCurrentScoreData(score);
      setIsScoreModalOpen(true);
      setIsPlaying(false);
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try {
          playerRef.current.pauseVideo();
        } catch {}
      }
    }
  }, [currentSong, defaultSingerName, queue, stopScoringAndGetResult, generateScoreData]);

  // Auto transition when YouTube Player state becomes ENDED
  const handlePlayerEnded = useCallback(() => {
    if (currentSong) {
      const nextItem = queue.length > 0 ? queue[0] : undefined;
      const score = stopScoringAndGetResult() || generateScoreData(currentSong, defaultSingerName, nextItem);
      setCurrentScoreData(score);
      setIsScoreModalOpen(true);
      setIsPlaying(false);
    }
  }, [currentSong, defaultSingerName, queue, stopScoringAndGetResult, generateScoreData]);

  // Helper to broadcast messages to all connected PeerJS mobile clients
  const broadcastToPeers = useCallback((msg: PeerMessage) => {
    peerConnectionsRef.current.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {}
      }
    });
  }, []);

  // Broadcast TV status update to all connected PeerJS mobile clients whenever song or queue changes
  useEffect(() => {
    const msg: PeerMessage = {
      action: 'STATUS_UPDATE',
      nowPlaying: currentSong?.title || '',
      isPlaying,
      currentTime: 0,
      song: currentSong,
      queue,
      payload: { musicDelayMs },
      clientCount: Math.max(1, peerConnectionsRef.current.size + 1),
      timestamp: Date.now(),
    };
    broadcastToPeers(msg);
  }, [currentSong, isPlaying, queue, musicDelayMs, broadcastToPeers]);

  // PeerJS P2P Master Host: Enables serverless direct TV-HP connections (Vercel ready via 0.peerjs.com)
  useEffect(() => {
    let peerInstance: Peer | null = null;
    let heartbeatCleanup: (() => void) | null = null;
    let reconnectTimer: any = null;
    let isCleanedUp = false;

    const initMaster = () => {
      if (isCleanedUp) return;

      try {
        const tvPeerId = getTvPeerId(roomId);
        peerInstance = createPeer(tvPeerId);
        peerRef.current = peerInstance;

        // Keep WebSocket signaling alive on 0.peerjs.com
        if (heartbeatCleanup) heartbeatCleanup();
        heartbeatCleanup = startPeerHeartbeat(peerInstance);

        peerInstance.on('open', (id) => {
          if (isCleanedUp) return;
          console.log('[PeerJS TV Master] Berhasil terdaftar dengan Peer ID:', id);
        });

        // Reconnect immediately if signaling server connection drops
        peerInstance.on('disconnected', () => {
          if (isCleanedUp) return;
          console.log('[PeerJS TV Master] Sinyal terputus dari server. Menyambung ulang...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isCleanedUp && peerInstance && !peerInstance.destroyed && peerInstance.disconnected) {
              try {
                peerInstance.reconnect();
              } catch {}
            }
          }, 1500);
        });

        // Handle incoming data connections from mobile clients (Remote control & queue sync)
        peerInstance.on('connection', (conn) => {
          if (isCleanedUp) return;

          conn.on('open', () => {
            peerConnectionsRef.current.set(conn.peer, conn);
            setRemoteConnectedDevices(Math.max(1, peerConnectionsRef.current.size + 1));

            // Immediately send full state snapshot to the newly connected phone
            conn.send({
              action: 'STATUS_UPDATE',
              nowPlaying: currentSong?.title || '',
              isPlaying,
              currentTime: 0,
              song: currentSong,
              queue,
              clientCount: Math.max(1, peerConnectionsRef.current.size + 1),
            });
          });

          conn.on('data', (data: any) => {
            if (!data || !data.action) return;

            switch (data.action) {
              case 'PLAY':
                setIsPlaying(true);
                break;

              case 'PAUSE':
                setIsPlaying(false);
                break;

              case 'NEXT_SONG':
                skipNextSong();
                break;

              case 'SELECT_SONG':
                if (data.payload) {
                  playSongNow(data.payload, data.senderName);
                }
                break;

              case 'SET_VOLUME':
                if (typeof data.payload === 'number') {
                  setAudioVolume(data.payload);
                }
                break;

              case 'ADD_QUEUE':
                if (data.payload?.song) {
                  addToQueue(data.payload.song, data.payload.singerName, data.payload.priority);
                }
                break;

              case 'REMOVE_QUEUE':
                if (data.payload?.queueId) {
                  removeFromQueue(data.payload.queueId);
                }
                break;

              case 'REORDER_QUEUE':
                if (typeof data.payload?.fromIndex === 'number' && typeof data.payload?.toIndex === 'number') {
                  moveQueueItem(data.payload.fromIndex, data.payload.toIndex);
                }
                break;

              case 'PLAY_SOUND_FX':
                if (data.payload?.sound) {
                  triggerSoundFx(data.payload.sound, false, data.payload.senderName);
                }
                break;

              case 'MIC_PARAMS':
                if (data.payload) {
                  const targetId = conn.peer;
                  if (typeof data.payload.volume === 'number') {
                    setClientMicVolume(targetId, data.payload.volume);
                  }
                  if (typeof data.payload.echo === 'number') {
                    setClientMicEcho(targetId, data.payload.echo);
                  }
                }
                break;

              case 'SET_MUSIC_DELAY':
                if (typeof data.payload?.delayMs === 'number') {
                  setMusicDelayMs(data.payload.delayMs, true);
                }
                break;

              case 'STATUS_UPDATE':
                conn.send({
                  action: 'STATUS_UPDATE',
                  nowPlaying: currentSong?.title || '',
                  isPlaying,
                  currentTime: 0,
                  song: currentSong,
                  queue,
                  payload: { musicDelayMs },
                  clientCount: Math.max(1, peerConnectionsRef.current.size + 1),
                });
                break;
            }
          });

          conn.on('close', () => {
            peerConnectionsRef.current.delete(conn.peer);
            setRemoteConnectedDevices(Math.max(1, peerConnectionsRef.current.size + 1));
          });

          conn.on('error', () => {
            peerConnectionsRef.current.delete(conn.peer);
            setRemoteConnectedDevices(Math.max(1, peerConnectionsRef.current.size + 1));
          });
        });

        // Handle incoming WebRTC MediaConnection for Wireless Microphone audio streaming
        peerInstance.on('call', (mediaConn) => {
          if (isCleanedUp) return;

          // Answer call to accept incoming audio stream from phone
          mediaConn.answer();
          const senderId = mediaConn.peer;
          const senderName = mediaConn.metadata?.singerName || 'Prajurit (HP)';

          mediaConn.on('stream', (remoteStream) => {
            attachAudioStream(senderId, senderName, remoteStream);
            addRemoteNotification(
              `🎤 ${senderName} mengaktifkan Mikrofon HP (P2P)! Suara langsung disiarkan ke speaker TV.`,
              senderName,
              'success'
            );
          });

          mediaConn.on('close', () => {
            cleanupSender(senderId);
            addRemoteNotification(
              `🎤 ${senderName} mematikan Mikrofon HP.`,
              senderName,
              'info'
            );
          });

          mediaConn.on('error', () => {
            cleanupSender(senderId);
          });
        });

        peerInstance.on('error', (err: any) => {
          const errMsg = String(err?.message || err?.type || err || '');
          if (isCleanedUp) return;

          // Recover from server drops or transient disconnects
          if (errMsg.includes('Lost connection') || err?.type === 'network' || err?.type === 'server-error') {
            if (peerInstance && !peerInstance.destroyed && peerInstance.disconnected) {
              try {
                peerInstance.reconnect();
              } catch {}
            }
          } else if (err?.type === 'unavailable-id') {
            // Wait 2.5 seconds if previous session hasn't released ID, then re-initialize
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (!isCleanedUp) initMaster();
            }, 2500);
          }
        });
      } catch (e) {
        console.warn('[PeerJS TV Master] initialization error:', e);
      }
    };

    initMaster();

    return () => {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatCleanup) heartbeatCleanup();
      peerConnectionsRef.current.clear();
      if (peerInstance) {
        try {
          peerInstance.destroy();
        } catch {}
      }
      peerRef.current = null;
    };
  }, [
    roomId,
    currentSong,
    isPlaying,
    queue,
    attachAudioStream,
    cleanupSender,
    addRemoteNotification,
    addToQueue,
    moveQueueItem,
    playSongNow,
    removeFromQueue,
    setAudioVolume,
    setClientMicEcho,
    setClientMicVolume,
    setIsPlaying,
    skipNextSong,
    triggerSoundFx,
  ]);

  return (
    <KaraokeContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        suffixFilter,
        setSuffixFilter,
        searchResults,
        isSearching,
        searchError,
        isCuratedFallback,
        activeCategory,
        executeSearch,
        addDirectVideoUrl,
        queue,
        currentSong,
        history,
        addToQueue,
        removeFromQueue,
        moveQueueItem,
        clearQueue,
        updateSingerName,
        playSongNow,
        skipNextSong,
        replayCurrentSong,
        evaluateCurrentSong,
        isPlaying,
        setIsPlaying,
        togglePlayPause,
        audioVolume,
        setAudioVolume,
        isMuted,
        setIsMuted,
        handlePlayerEnded,
        playerRef,
        isQueueOpenMobile,
        setIsQueueOpenMobile,
        isScoreModalOpen,
        setIsScoreModalOpen,
        currentScoreData,
        isTvMode,
        setIsTvMode,
        defaultSingerName,
        setDefaultSingerName,
        roomId,
        remoteConnectedDevices,
        remoteClientsList,
        remoteNotifications,
        removeRemoteNotification,
        activeReactions,
        triggerSoundFx,
        activeWirelessMics,
        masterMicVolume,
        setMasterMicVolume,
        masterMicEcho,
        setMasterMicEcho,
        isMasterMicMuted,
        setIsMasterMicMuted,
        increaseMicVolume,
        decreaseMicVolume,
        increaseMicEcho,
        decreaseMicEcho,
        isAudioSuspended,
        resumeAudio,
        setClientMicVolume,
        setClientMicEcho,
        toggleClientMicMute,
        scoringState,
        isScoringActive,
        startScoring,
        stopScoringAndGetResult,
        musicMediaRef,
        musicDelayMs,
        setMusicDelayMs,
        connectMusicMediaElement,
      }}
    >
      {/* Hidden HTMLMediaElement for Web Audio API music scoring analyzer */}
      <audio
        ref={musicMediaRef}
        id="karaoke-music-media-element"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
      {children}
    </KaraokeContext.Provider>
  );
};

export const useKaraoke = (): KaraokeContextType => {
  const context = useContext(KaraokeContext);
  if (!context) {
    throw new Error('useKaraoke must be used within a KaraokeProvider');
  }
  return context;
};

