import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smartphone,
  Search,
  ListMusic,
  Sparkles,
  Play,
  Pause,
  Plus,
  Trash2,
  Rocket,
  Shield,
  RefreshCw,
  X,
  SkipForward,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  Tv,
  Music,
  Check,
  User,
  Zap,
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Song, QueueItem, SuffixFilter } from '../types/karaoke';
import { CURATED_LIBRARY, extractYoutubeVideoId, fetchOEmbedInfo } from '../services/youtube';
import { PWAInstallButton } from './PWAInstallButton';
import { useWebRTCMicrophone } from '../hooks/useWebRTCMicrophone';
import { getSignalingWebSocketUrl, getWebSocketStateName } from '../services/signaling';
import { getTvPeerId, getClientPeerId, createPeer, startPeerHeartbeat, type PeerAction, type PeerMessage, type DataConnection, type MediaConnection } from '../services/peerManager';
import type Peer from 'peerjs';

export interface MobileClientViewProps {
  isEmbedded?: boolean;
  onCloseEmbedded?: () => void;
  roomIdOverride?: string;
}

export const MobileClientView: React.FC<MobileClientViewProps> = ({
  isEmbedded = false,
  onCloseEmbedded,
  roomIdOverride,
}) => {
  // Extract roomId from URL or fallback
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialRoomId = (
    roomIdOverride ||
    urlParams.get('room') ||
    localStorage.getItem('karaoke_room_id_v1') ||
    'ROOM-1001'
  )
    .trim()
    .toUpperCase();

  const [roomId] = useState<string>(initialRoomId);
  const [singerName, setSingerName] = useState<string>(() => {
    return localStorage.getItem('karaoke_client_singer_name') || 'Prajurit (HP)';
  });
  const [isEditingSinger, setIsEditingSinger] = useState<boolean>(false);
  const [singerInput, setSingerInput] = useState<string>(singerName);

  // Client unique ID and sync time tracker
  const clientId = useRef<string>(
    (typeof window !== 'undefined' && localStorage.getItem('karaoke_client_device_id')) ||
      ('hp-' + Math.random().toString(36).substring(2, 9))
  ).current;
  const lastSyncTime = useRef<number>(Date.now());

  // Connection State
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [clientCount, setClientCount] = useState<number>(1);
  const wsRef = useRef<WebSocket | null>(null);

  // Master Room State (Synchronized with TV & Tablet)
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // Navigation State: 5 Clear, Intuitive Tabs (including Mic Wireless)
  const [activeTab, setActiveTab] = useState<'search' | 'mic' | 'queue' | 'reactions' | 'curated'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suffixFilter, setSuffixFilter] = useState<SuffixFilter>('karaoke');
  const [searchResults, setSearchResults] = useState<Song[]>(() => CURATED_LIBRARY['hits-indonesia'] || CURATED_LIBRARY['slow-rock']);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Direct YouTube Link Input (Simple & Collapsible)
  const [showDirectInput, setShowDirectInput] = useState<boolean>(false);
  const [directUrl, setDirectUrl] = useState<string>('');
  const [isResolvingDirect, setIsResolvingDirect] = useState<boolean>(false);

  // Toast / Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (e) {}
    }
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  // PeerJS P2P Client (Enables serverless direct TV-HP connections without backend WebSocket)
  const [peerConnectionState, setPeerConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectPeerTimerRef = useRef<any>(null);
  const peerHeartbeatCleanRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [peerMicStreaming, setPeerMicStreaming] = useState<boolean>(false);
  const [peerMicMuted, setPeerMicMuted] = useState<boolean>(false);
  const [peerMicError, setPeerMicError] = useState<string | null>(null);
  const [peerAudioLevel, setPeerAudioLevel] = useState<number>(0);
  const [peerMicStatus, setPeerMicStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // TV Music Sync Delay Buffer (0ms - 250ms, default 70ms)
  const [tvMusicDelay, setTvMusicDelay] = useState<number>(70);

  // Helper to send JSON messages to TV Master via PeerJS DataConnection
  const sendPeerMessage = useCallback((msg: PeerMessage): boolean => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send(msg);
        return true;
      } catch (err) {
        console.warn('[PeerJS] send error:', err);
      }
    }
    return false;
  }, []);

  const handleSetTvMusicDelay = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(250, Math.round(val)));
      setTvMusicDelay(clamped);

      // 1. WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'MUSIC_SYNC_DELAY',
              roomId,
              payload: { delayMs: clamped },
              timestamp: Date.now(),
            })
          );
        } catch {}
      }

      // 2. PeerJS DataConnection
      sendPeerMessage({
        action: 'SET_MUSIC_DELAY',
        payload: { delayMs: clamped },
      });

      // 3. HTTP Fallback
      fetch(`/api/room/${encodeURIComponent(roomId)}/music-delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delayMs: clamped }),
      }).catch(() => {});

      showToast(`⚡ Sinkron Musik TV: ${clamped}ms`);
    },
    [roomId, sendPeerMessage, showToast]
  );

  // WebSocket signaling readyState tracking
  const [wsReadyState, setWsReadyState] = useState<number>(WebSocket.CONNECTING);
  const triggerReconnectRef = useRef<(() => void) | null>(null);

  const handleRequestReconnect = useCallback(() => {
    if (triggerReconnectRef.current) {
      triggerReconnectRef.current();
    }
  }, []);

  // WebRTC P2P Wireless Microphone Broadcaster Hook
  const {
    isStreaming: isMicStreaming,
    isMuted: isMicMuted,
    isEchoCancellationEnabled,
    isZeroDelayBypass,
    micVolume,
    micEcho,
    audioLevel: micAudioLevel,
    micError,
    connectionStatus: micConnectionStatus,
    startBroadcasting: startMicBroadcast,
    stopBroadcasting: stopMicBroadcast,
    toggleMute: toggleMicMute,
    toggleEchoCancellation,
    toggleZeroDelayBypass,
    increaseVolume,
    decreaseVolume,
    setVolumeDirect,
    increaseEcho,
    decreaseEcho,
    setEchoDirect,
    handleSignalingMessage: handleMicSignaling,
  } = useWebRTCMicrophone({
    socketRef: wsRef,
    roomId,
    singerName,
    onToast: showToast,
    onRequestReconnect: handleRequestReconnect,
  });

  // Save singer name
  const handleSaveSinger = () => {
    const clean = singerInput.trim() || 'Prajurit (HP)';
    setSingerName(clean);
    localStorage.setItem('karaoke_client_singer_name', clean);
    setIsEditingSinger(false);
    showToast(`Nama disimpan: ${clean}`);
  };

  // Fetch initial room state and send HTTP heartbeat ping
  const fetchRoomState = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, singerName, role: 'client' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          lastSyncTime.current = Date.now();
          setIsConnected(true);
          if (data.room.currentSong !== undefined) setCurrentSong(data.room.currentSong);
          if (typeof data.room.isPlaying === 'boolean') setIsPlaying(data.room.isPlaying);
          if (Array.isArray(data.room.queue)) setQueue(data.room.queue);
          if (typeof data.room.musicDelayMs === 'number') setTvMusicDelay(data.room.musicDelayMs);
          if (data.clientCount !== undefined) setClientCount(data.clientCount);
        }
      }
    } catch (err) {
      if (Date.now() - lastSyncTime.current > 7000) {
        setIsConnected(false);
      }
    }
  }, [roomId, singerName, clientId]);

  // PeerJS Client connection & auto-reconnect logic (Serverless direct TV-HP connections)
  const establishDataConnection = useCallback((peer: Peer, targetTvId: string) => {
    setPeerConnectionState('connecting');
    const conn = peer.connect(targetTvId, { reliable: true });
    dataConnRef.current = conn;

    conn.on('open', () => {
      console.log('[PeerJS HP] Connected to TV Master:', targetTvId);
      setPeerConnectionState('connected');
      setIsConnected(true);
      // Handshake to TV
      conn.send({ action: 'STATUS_UPDATE', senderName: singerName, senderId: peer.id });
      showToast('🟢 Terhubung ke TV Master (P2P)!');
    });

    conn.on('data', (data: any) => {
      if (data && data.action === 'STATUS_UPDATE') {
        if (data.song !== undefined) setCurrentSong(data.song);
        if (typeof data.isPlaying === 'boolean') setIsPlaying(data.isPlaying);
        if (Array.isArray(data.queue)) setQueue(data.queue);
        if (typeof data.clientCount === 'number') setClientCount(data.clientCount);
        if (typeof data.payload?.musicDelayMs === 'number') setTvMusicDelay(data.payload.musicDelayMs);
        setIsConnected(true);
        setPeerConnectionState('connected');
      }
    });

    conn.on('close', () => {
      console.log('[PeerJS HP] Connection to TV closed');
      setPeerConnectionState('disconnected');
      schedulePeerReconnect();
    });

    conn.on('error', (err) => {
      console.warn('[PeerJS HP] Connection error:', err);
      setPeerConnectionState('disconnected');
      schedulePeerReconnect();
    });
  }, [singerName, showToast]);

  const schedulePeerReconnect = useCallback(() => {
    if (reconnectPeerTimerRef.current) clearTimeout(reconnectPeerTimerRef.current);
    reconnectPeerTimerRef.current = setTimeout(() => {
      connectToTvPeer();
    }, 3000);
  }, []);

  // Send action to TV via PeerJS DataConnection
  const sendPeerAction = useCallback((action: PeerAction, payload?: any): boolean => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send({
          action,
          payload,
          senderName: singerName,
          senderId: peerRef.current?.id,
          timestamp: Date.now(),
        });
        return true;
      } catch (err) {
        console.warn('[PeerJS HP] Error sending action:', err);
      }
    }
    return false;
  }, [singerName]);

  const connectToTvPeer = useCallback(() => {
    if (reconnectPeerTimerRef.current) {
      clearTimeout(reconnectPeerTimerRef.current);
      reconnectPeerTimerRef.current = null;
    }

    try {
      const tvPeerId = getTvPeerId(roomId);

      if (!peerRef.current || peerRef.current.destroyed) {
        const clientPeer = createPeer(getClientPeerId(roomId));
        peerRef.current = clientPeer;

        // Keep connection warm to 0.peerjs.com
        if (peerHeartbeatCleanRef.current) peerHeartbeatCleanRef.current();
        peerHeartbeatCleanRef.current = startPeerHeartbeat(clientPeer);

        clientPeer.on('open', (id) => {
          console.log('[PeerJS HP] Client peer registered:', id);
          establishDataConnection(clientPeer, tvPeerId);
        });

        // Reconnect immediately if connection to signaling broker is lost
        clientPeer.on('disconnected', () => {
          console.log('[PeerJS HP] Sinyal terputus dari broker. Menyambung ulang...');
          if (clientPeer && !clientPeer.destroyed && clientPeer.disconnected) {
            try {
              clientPeer.reconnect();
            } catch {
              schedulePeerReconnect();
            }
          }
        });

        clientPeer.on('error', (err: any) => {
          const errMsg = String(err?.message || err?.type || err || '');
          if (errMsg.includes('Lost connection') || err?.type === 'network' || err?.type === 'server-error') {
            if (clientPeer && !clientPeer.destroyed && clientPeer.disconnected) {
              try {
                clientPeer.reconnect();
                return;
              } catch {}
            }
          }
          console.warn('[PeerJS HP] Client peer error:', errMsg);
          setPeerConnectionState('disconnected');
          schedulePeerReconnect();
        });
      } else if (peerRef.current.disconnected) {
        try {
          peerRef.current.reconnect();
        } catch {
          schedulePeerReconnect();
        }
      } else if (peerRef.current.open) {
        establishDataConnection(peerRef.current, tvPeerId);
      }
    } catch (err) {
      console.warn('[PeerJS HP] Initialization error:', err);
      setPeerConnectionState('disconnected');
      schedulePeerReconnect();
    }
  }, [roomId, establishDataConnection, schedulePeerReconnect]);

  useEffect(() => {
    connectToTvPeer();

    return () => {
      if (reconnectPeerTimerRef.current) clearTimeout(reconnectPeerTimerRef.current);
      if (peerHeartbeatCleanRef.current) peerHeartbeatCleanRef.current();
      if (dataConnRef.current) {
        try {
          dataConnRef.current.close();
        } catch {}
      }
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch {}
      }
    };
  }, [connectToTvPeer]);

  // PeerJS WebRTC Microphone Streamer (Streams HP audio directly to TV)
  const startPeerMic = useCallback(async () => {
    setPeerMicError(null);
    setPeerMicStatus('connecting');

    if (peerConnectionState !== 'connected' || !dataConnRef.current?.open) {
      const err = 'Koneksi ke TV belum siap. Pastikan terhubung ke TV sebelum menyalakan mikrofon.';
      setPeerMicError(err);
      setPeerMicStatus('error');
      showToast(err);
      return false;
    }

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Matikan noise suppression berat agar proses DSP tidak memakan waktu pemrosesan
            autoGainControl: false,
            latency: 0,
            channelCount: 1,
          } as any,
          video: false,
        });
      } catch (conErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
    } catch (err: any) {
      console.error('[Mic] getUserMedia error:', err);
      const name = err?.name || '';
      let msg = 'Gagal mengakses mikrofon.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg = 'Izin mikrofon ditolak oleh browser HP. Silakan buka Pengaturan Izin Situs dan pilih "Izinkan Mikrofon", lalu coba lagi.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'Perangkat mikrofon tidak ditemukan di ponsel Anda.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'Mikrofon HP sedang digunakan oleh aplikasi lain (misal WhatsApp atau panggilan telepon).';
      } else {
        msg = err?.message || 'Akses Mikrofon Bermasalah';
      }
      setPeerMicError(msg);
      setPeerMicStatus('error');
      showToast(msg);
      return false;
    }

    localStreamRef.current = stream;

    const tvPeerId = getTvPeerId(roomId);
    if (!peerRef.current) return false;

    const mediaConn = peerRef.current.call(tvPeerId, stream, {
      metadata: { singerName, senderId: peerRef.current.id },
    });
    mediaConnRef.current = mediaConn;

    mediaConn.on('close', () => {
      setPeerMicStreaming(false);
      setPeerMicStatus('idle');
    });

    mediaConn.on('error', (err) => {
      console.warn('[Mic] MediaConnection error:', err);
      setPeerMicError('Koneksi streaming suara ke TV terputus.');
      setPeerMicStatus('error');
    });

    setPeerMicStreaming(true);
    setPeerMicStatus('connected');
    showToast('🎤 Mikrofon HP Terhubung Langsung ke Speaker TV!');

    // Setup local audio analyser for real-time VU meter
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx({ latencyHint: 'interactive' });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVU = () => {
          if (analyserRef.current && localStreamRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const lvl = Math.min(100, Math.round((avg / 128) * 100));
            setPeerAudioLevel(lvl);
            animFrameRef.current = requestAnimationFrame(updateVU);
          }
        };
        updateVU();
      }
    } catch {}

    return true;
  }, [peerConnectionState, roomId, singerName, showToast]);

  const stopPeerMic = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaConnRef.current) {
      try {
        mediaConnRef.current.close();
      } catch {}
      mediaConnRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setPeerMicStreaming(false);
    setPeerMicStatus('idle');
    setPeerAudioLevel(0);
    showToast('Mikrofon dimatikan');
  }, [showToast]);

  const togglePeerMicMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const muted = !track.enabled;
      setPeerMicMuted(muted);
      showToast(muted ? 'Mikrofon dibisukan' : 'Mikrofon diaktifkan');
    }
  }, [showToast]);

  // Unified Wireless Microphone State & Controls
  const isMicLive = isMicStreaming || peerMicStreaming;
  const isCurrentMicMuted = isMicStreaming ? isMicMuted : peerMicMuted;
  const displayAudioLevel = Math.max(micAudioLevel, peerAudioLevel);

  const handleStartUnifiedMic = useCallback(async () => {
    let ok = false;
    // 1. Prioritize ultra-low latency WebRTC stream via WebSocket signaling
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        ok = await startMicBroadcast();
      } catch (err) {
        console.warn('[HP WebRTC] startMicBroadcast error:', err);
      }
    }

    // 2. Fallback to PeerJS direct call if WebSocket did not initialize stream
    if (!ok) {
      if (peerConnectionState !== 'connected') {
        connectToTvPeer();
      }
      ok = await startPeerMic();
    }
    return ok;
  }, [startMicBroadcast, startPeerMic, peerConnectionState, connectToTvPeer]);

  const handleStopUnifiedMic = useCallback(() => {
    if (isMicStreaming) {
      stopMicBroadcast();
    }
    if (peerMicStreaming) {
      stopPeerMic();
    }
  }, [isMicStreaming, peerMicStreaming, stopMicBroadcast, stopPeerMic]);

  const handleToggleUnifiedMute = useCallback(() => {
    if (isMicStreaming) {
      toggleMicMute();
    }
    if (peerMicStreaming) {
      togglePeerMicMute();
    }
  }, [isMicStreaming, peerMicStreaming, toggleMicMute, togglePeerMicMute]);

  // Connect WebSocket & fallback SSE
  useEffect(() => {
    fetchRoomState();

    let socket: WebSocket | null = null;
    let sseSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    let retryAttempt = 0;
    let pingInterval: any = null;

    const connectWebSocket = () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      try {
        const wsUrl = getSignalingWebSocketUrl({
          roomId,
          role: 'client',
          singerName,
        });

        socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        setWsReadyState(WebSocket.CONNECTING);

        socket.onopen = () => {
          retryAttempt = 0;
          lastSyncTime.current = Date.now();
          setIsConnected(true);
          setWsReadyState(WebSocket.OPEN);

          // Heartbeat ping every 20 seconds
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

            lastSyncTime.current = Date.now();
            setIsConnected(true);

            switch (data.type) {
              case 'INIT_STATE':
              case 'STATE_UPDATE':
                if (data.payload) {
                  if (data.payload.currentSong !== undefined) setCurrentSong(data.payload.currentSong);
                  if (data.payload.isPlaying !== undefined) setIsPlaying(data.payload.isPlaying);
                  if (Array.isArray(data.payload.queue)) setQueue(data.payload.queue);
                  if (data.payload.clientCount !== undefined) setClientCount(data.payload.clientCount);
                  if (typeof data.payload.musicDelayMs === 'number') setTvMusicDelay(data.payload.musicDelayMs);
                }
                break;

              case 'ADD_QUEUE_ITEM':
                if (data.payload?.item) {
                  setQueue((prev) => {
                    if (prev.some((q) => q.queueId === data.payload.item.queueId)) return prev;
                    return [...prev, data.payload.item];
                  });
                }
                break;

              case 'REMOVE_QUEUE_ITEM':
                if (data.payload?.queueId) {
                  setQueue((prev) => prev.filter((q) => q.queueId !== data.payload.queueId));
                }
                break;

              case 'SYNC_QUEUE':
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                }
                break;

              case 'PLAY_NOW':
                if (data.payload?.song) {
                  setCurrentSong(data.payload.song);
                  setIsPlaying(true);
                }
                break;

              case 'SKIP_NEXT':
                if (data.payload?.currentSong !== undefined) {
                  setCurrentSong(data.payload.currentSong);
                }
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                }
                break;

              case 'TOGGLE_PAUSE':
                if (data.payload?.isPlaying !== undefined) {
                  setIsPlaying(data.payload.isPlaying);
                } else {
                  setIsPlaying((prev) => !prev);
                }
                break;

              case 'CLIENT_COUNT_UPDATE':
                if (data.payload?.clientCount) {
                  setClientCount(data.payload.clientCount);
                }
                break;

              case 'RTC_ANSWER':
              case 'RTC_ICE_CANDIDATE':
              case 'RTC_MIC_PARAMS':
                handleMicSignaling(data);
                break;

              case 'MUSIC_SYNC_DELAY':
                if (typeof data.payload?.delayMs === 'number') {
                  setTvMusicDelay(data.payload.delayMs);
                }
                break;
            }
          } catch (e) {
            console.warn('Error parsing WS message:', e);
          }
        };

        socket.onclose = () => {
          setWsReadyState(WebSocket.CLOSED);
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          // Do not force isConnected to false if HTTP ping is still succeeding!
          if (Date.now() - lastSyncTime.current > 7000) {
            setIsConnected(false);
          }
          retryAttempt++;
          const delay = Math.min(1500 * Math.pow(1.3, retryAttempt), 10000);
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        };

        socket.onerror = () => {
          setWsReadyState(WebSocket.CLOSED);
          try {
            socket?.close();
          } catch {}
        };
      } catch (err) {
        setWsReadyState(WebSocket.CLOSED);
        connectSSE();
      }
    };

    triggerReconnectRef.current = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    };

    const connectSSE = () => {
      try {
        const sseUrl = `/api/room/${encodeURIComponent(roomId)}/events?role=client&name=${encodeURIComponent(
          singerName
        )}`;
        sseSource = new EventSource(sseUrl);

        sseSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT_STATE' || data.type === 'STATE_UPDATE') {
              if (data.payload?.currentSong !== undefined) setCurrentSong(data.payload.currentSong);
              if (data.payload?.isPlaying !== undefined) setIsPlaying(data.payload.isPlaying);
              if (Array.isArray(data.payload?.queue)) setQueue(data.payload.queue);
              if (data.payload?.clientCount) setClientCount(data.payload.clientCount);
              setIsConnected(true);
            } else if (data.type === 'SYNC_QUEUE' && Array.isArray(data.payload?.queue)) {
              setQueue(data.payload.queue);
            } else if (data.type === 'PLAY_NOW' && data.payload?.song) {
              setCurrentSong(data.payload.song);
              setIsPlaying(true);
            } else if (data.type === 'SKIP_NEXT') {
              if (data.payload?.currentSong !== undefined) setCurrentSong(data.payload.currentSong);
              if (Array.isArray(data.payload?.queue)) setQueue(data.payload.queue);
            } else if (data.type === 'TOGGLE_PAUSE') {
              if (data.payload?.isPlaying !== undefined) setIsPlaying(data.payload.isPlaying);
              else setIsPlaying((p) => !p);
            } else if (data.type === 'ADD_QUEUE_ITEM' && data.payload?.item) {
              setQueue((prev) => [...prev, data.payload.item]);
            } else if (data.type === 'REMOVE_QUEUE_ITEM' && data.payload?.queueId) {
              setQueue((prev) => prev.filter((q) => q.queueId !== data.payload.queueId));
            }
          } catch (e) {}
        };

        sseSource.onerror = () => {
          setIsConnected(false);
        };
      } catch (e) {}
    };

    connectWebSocket();

    // Fast polling every 1.5s to guarantee 100% real-time synchronization between TV and HP
    const pollInterval = setInterval(fetchRoomState, 1500);

    return () => {
      triggerReconnectRef.current = null;
      clearInterval(pollInterval);
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
      if (sseSource) sseSource.close();
    };
  }, [roomId, singerName, fetchRoomState]);

  // Execute YouTube Search
  const executeSearch = useCallback(
    async (queryOverride?: string) => {
      const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
      if (!q) return;

      setIsSearching(true);
      setSearchError(null);

      let finalQuery = q;
      if (suffixFilter === 'karaoke' && !q.toLowerCase().includes('karaoke')) {
        finalQuery += ' karaoke';
      } else if (suffixFilter === 'no vocal' && !q.toLowerCase().includes('no vocal')) {
        finalQuery += ' no vocal';
      } else if (suffixFilter === 'instrumental' && !q.toLowerCase().includes('instrumental')) {
        finalQuery += ' instrumental';
      }

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`);
        const data = await response.json();

        if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
          setSearchResults(data.songs);
        } else {
          const lower = q.toLowerCase();
          const allCurated = Object.values(CURATED_LIBRARY).flat();
          const filtered = allCurated.filter(
            (s) => s.title.toLowerCase().includes(lower) || s.channelTitle.toLowerCase().includes(lower)
          );
          setSearchResults(filtered.length > 0 ? filtered : (CURATED_LIBRARY['hits-indonesia'] || CURATED_LIBRARY['slow-rock']));
        }
      } catch (err) {
        setSearchError('Pencarian dialihkan ke koleksi lagu.');
        setSearchResults(CURATED_LIBRARY['hits-indonesia'] || CURATED_LIBRARY['slow-rock']);
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, suffixFilter]
  );

  // Add song to queue
  const handleAddSongToQueue = async (song: Song, priority = false) => {
    // 1. Optimistic UI update so HP immediately shows song in antrean
    const optimisticItem: QueueItem = {
      queueId: `q-opt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      song,
      singerName,
      addedAt: Date.now(),
      priority,
    };
    setQueue((prev) => (priority ? [optimisticItem, ...prev] : [...prev, optimisticItem]));
    if (!currentSong) {
      setCurrentSong(song);
      setIsPlaying(true);
    }

    // 2. Multi-Channel Dispatch: PeerJS DataConnection (P2P Vercel) + WebSocket + HTTP POST
    sendPeerAction('ADD_QUEUE', { song, singerName, priority });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'ADD_QUEUE_ITEM',
            roomId,
            payload: { song, singerName, priority },
          })
        );
      } catch (e) {}
    }

    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName, priority }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.currentSong) setCurrentSong(data.currentSong);
        fetchRoomState();
      }
    } catch (err) {}

    showToast(
      priority
        ? `⚡ "${song.title.slice(0, 24)}..." diprioritaskan!`
        : `✅ "${song.title.slice(0, 24)}..." masuk antrean TV!`
    );
  };

  // Play song immediately on the TV
  const handlePlayNow = async (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);

    // Multi-Channel Dispatch
    sendPeerAction('SELECT_SONG', song);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'PLAY_NOW',
            roomId,
            payload: { song, singerName },
          })
        );
      } catch (e) {}
    }

    try {
      await fetch(`/api/room/${encodeURIComponent(roomId)}/play-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName }),
      });
      fetchRoomState();
    } catch (e) {}
    showToast(`▶️ Memutar di TV: "${song.title.slice(0, 22)}..."`);
  };

  // Skip current song (Ganti lagu di TV)
  const handleSkipNext = async () => {
    let nextSongItem: Song | undefined;
    if (queue.length > 0) {
      nextSongItem = queue[0].song;
      setCurrentSong(nextSongItem);
      setQueue((prev) => prev.slice(1));
    }

    // Multi-Channel Dispatch
    sendPeerAction('NEXT_SONG');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'SKIP_NEXT',
            roomId,
            payload: { senderName: singerName, nextSong: nextSongItem },
          })
        );
      } catch (e) {}
    }

    try {
      await fetch(`/api/room/${encodeURIComponent(roomId)}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ singerName, nextSong: nextSongItem }),
      });
      fetchRoomState();
    } catch (e) {}
    showToast('⏭️ Mengganti lagu di TV!');
  };

  // Play / Pause control on the TV
  const handleTogglePlayPause = async () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    // Multi-Channel Dispatch: { action: "PLAY" } / { action: "PAUSE" }
    sendPeerAction(nextState ? 'PLAY' : 'PAUSE');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'TOGGLE_PAUSE',
            roomId,
            payload: { isPlaying: nextState, senderName: singerName },
          })
        );
      } catch (e) {}
    }

    try {
      await fetch(`/api/room/${encodeURIComponent(roomId)}/toggle-pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPlaying: nextState, senderName: singerName }),
      });
      fetchRoomState();
    } catch (e) {}
    showToast(nextState ? '▶️ Melanjutkan TV' : '⏸️ Menjeda TV');
  };

  // Reorder queue: move song up or down
  const handleMoveQueueItem = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= queue.length) return;

    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);
    setQueue(newQueue);

    sendPeerAction('REORDER_QUEUE', { fromIndex, toIndex });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'MOVE_QUEUE_ITEM',
          roomId,
          payload: { fromIndex, toIndex, senderName: singerName },
        })
      );
    } else {
      try {
        await fetch(`/api/room/${encodeURIComponent(roomId)}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromIndex, toIndex, singerName }),
        });
      } catch (e) {}
    }
    showToast(`↔️ Urutan lagu digeser ke #${toIndex + 1}`);
  };

  // Remove song from queue
  const handleRemoveQueueItem = async (queueId: string) => {
    setQueue((prev) => prev.filter((q) => q.queueId !== queueId));

    sendPeerAction('REMOVE_QUEUE', { queueId });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'REMOVE_QUEUE_ITEM',
          roomId,
          payload: { queueId },
        })
      );
    } else {
      try {
        await fetch(`/api/room/${encodeURIComponent(roomId)}/remove`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId }),
        });
      } catch (e) {}
    }
    showToast('🗑️ Lagu dihapus dari antrean');
  };

  // Trigger Sound Reaction to TV Screen
  const handleSendReaction = async (sound: string, emoji: string, name: string) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(sound === 'boo' ? [120, 60, 180] : [60]);
      } catch {}
    }

    sendPeerAction('PLAY_SOUND_FX', { sound, senderName: singerName });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'PLAY_SOUND_FX',
          roomId,
          payload: { sound, senderName: singerName },
        })
      );
    } else {
      try {
        await fetch(`/api/room/${encodeURIComponent(roomId)}/reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sound, singerName }),
        });
      } catch (err) {}
    }

    showToast(`${emoji} ${name} terkirim ke Layar TV!`);
  };

  // Add Direct YouTube Link
  const handleAddDirectLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim()) return;

    const videoId = extractYoutubeVideoId(directUrl.trim());
    if (!videoId) {
      showToast('❌ Tautan YouTube tidak valid.');
      return;
    }

    setIsResolvingDirect(true);
    let title = `Video YouTube (${videoId})`;
    let channelTitle = 'YouTube Video';

    try {
      const oembed = await fetchOEmbedInfo(videoId);
      if (oembed?.title) title = oembed.title;
      if (oembed?.author_name) channelTitle = oembed.author_name;
    } catch {}

    const directSong: Song = {
      id: videoId,
      title,
      channelTitle,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isCurated: false,
    };

    await handleAddSongToQueue(directSong, false);
    setDirectUrl('');
    setIsResolvingDirect(false);
    setShowDirectInput(false);
  };

  return (
    <div
      className={`text-slate-100 flex flex-col font-sans select-none ${
        isEmbedded ? 'h-full overflow-y-auto pb-20 bg-[#060e20]' : 'min-h-screen pb-28 max-w-lg mx-auto bg-[#060e20]'
      }`}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-3 inset-x-3 z-50 flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xl shadow-sky-950 border border-sky-300/40 backdrop-blur-md">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Clean, Simple Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-sky-900/60 bg-[#07132c]/95 backdrop-blur-md px-3.5 py-2.5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & TV Connection Status */}
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-blue-800 text-white shadow shrink-0 border border-sky-400/40">
              <Mic className="h-4.5 w-4.5 text-sky-200" />
              <Zap className="h-3 w-3 text-amber-300 fill-amber-300 absolute -top-1 -right-1 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-black tracking-tight text-white">
                  KARAOKE <span className="text-sky-400">DISKOMLEKAU</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    peerConnectionState === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : peerConnectionState === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span
                  className={
                    peerConnectionState === 'connected'
                      ? 'text-emerald-400'
                      : peerConnectionState === 'connecting'
                      ? 'text-amber-300'
                      : 'text-rose-400'
                  }
                >
                  {peerConnectionState === 'connected'
                    ? 'Terhubung ke TV'
                    : peerConnectionState === 'connecting'
                    ? 'Menghubungkan...'
                    : 'Koneksi Terputus'}
                </span>
                <span className="text-slate-400 text-[10px]">({roomId})</span>
              </div>
            </div>
          </div>

          {/* Actions: PWA Install & User Name Badge */}
          <div className="flex items-center gap-1.5">
            <PWAInstallButton variant="mobile" />

            {isEditingSinger ? (
              <div className="flex items-center gap-1 bg-[#040915] p-1 rounded-xl border border-sky-400 shadow">
                <input
                  type="text"
                  value={singerInput}
                  onChange={(e) => setSingerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveSinger()}
                  className="w-24 rounded bg-transparent px-1.5 py-0.5 text-xs text-white outline-none"
                  placeholder="Nama Anda"
                  autoFocus
                />
                <button
                  onClick={handleSaveSinger}
                  className="rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-bold text-white shrink-0"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSingerInput(singerName);
                  setIsEditingSinger(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#091838] px-2.5 py-1.5 text-xs border border-sky-800 hover:border-sky-500 transition shadow-sm"
                title="Sentuh untuk mengganti nama Anda"
              >
                <User className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span className="text-amber-300 font-bold truncate max-w-[85px]">{singerName}</span>
                <span className="text-[10px] text-sky-400">✏️</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Slogan Kebanggaan Prajurit Diskomlekau - Sebaris Memanjang Satu Garis */}
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border-b border-amber-400/50 px-3 py-1 text-center shadow-sm overflow-hidden whitespace-nowrap">
        <p className="font-display text-[10px] sm:text-xs font-black text-amber-300 uppercase tracking-wide drop-shadow whitespace-nowrap">
          &ldquo;Prajurit Yang Pantang Mundur Walau Suara Hancur&rdquo;
        </p>
      </div>

      {/* "SEDANG TAYANG DI LAYAR TV" (Live Synchronized Player Card) */}
      <section className="bg-gradient-to-r from-[#071533] to-[#091b40] p-3 border-b border-sky-900/60 shadow-inner">
        <div className="flex items-center justify-between text-[11px] font-bold text-sky-300 mb-1.5">
          <span className="flex items-center gap-1.5 uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            Sedang Tayang di Layar TV
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
            {isPlaying ? '▶️ Memutar' : '⏸️ Dijeda'}
          </span>
        </div>

        {currentSong ? (
          <div className="flex items-center gap-2.5">
            <img
              src={currentSong.thumbnailUrl}
              alt={currentSong.title}
              className="h-12 w-16 rounded-xl object-cover border border-sky-700/60 shadow shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white leading-tight">
                {currentSong.title}
              </p>
              <p className="truncate text-[10px] text-sky-300/80 mt-0.5">
                {currentSong.channelTitle}
              </p>
            </div>

            {/* Quick TV Playback Controls: Pause/Play & Skip */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleTogglePlayPause}
                className="flex items-center justify-center h-8 w-8 rounded-xl bg-sky-900/80 border border-sky-600/70 text-white hover:bg-sky-700 transition active:scale-95 shadow"
                title={isPlaying ? 'Jeda Lagu di TV' : 'Putar Lagu di TV'}
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current text-amber-300" /> : <Play className="h-4 w-4 fill-current text-emerald-400 ml-0.5" />}
              </button>

              <button
                onClick={handleSkipNext}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 px-2.5 py-2 text-[10px] font-black text-white shadow transition active:scale-95 border border-amber-400/50"
                title="Ganti ke lagu berikutnya di antrean TV"
              >
                <SkipForward className="h-3.5 w-3.5 fill-current" />
                <span>Ganti</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-slate-300 py-1">
            <span>Belum ada lagu yang diputar di TV.</span>
            <button
              onClick={() => setActiveTab('search')}
              className="rounded-xl bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white shadow"
            >
              Pilih Lagu Sekarang
            </button>
          </div>
        )}
      </section>

      {/* Quick Wireless Mic Floating Banner when Streaming */}
      {isMicLive && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-[#041c2c] border-b border-emerald-500/70 px-3 py-2 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-in fade-in sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white truncate flex items-center gap-1.5">
                  <span>🎙️ Mic Live (Ultra-Low Latency)</span>
                  {isCurrentMicMuted && <span className="text-[9px] bg-rose-600 px-1 py-0.2 rounded font-mono font-bold">MUTED</span>}
                </p>
                <p className="text-[10px] text-emerald-300/80 truncate">
                  Level {displayAudioLevel}% ke Speaker TV
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleToggleUnifiedMute}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                  isCurrentMicMuted
                    ? 'bg-rose-900/80 text-rose-200 border-rose-500'
                    : 'bg-emerald-900/80 text-emerald-200 border-emerald-500'
                }`}
              >
                {isCurrentMicMuted ? 'Buka Mic' : 'Mute'}
              </button>
              <button
                onClick={() => setActiveTab('mic')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow"
              >
                Panel Mic
              </button>
            </div>
          </div>

          {/* Quick Controls: Volume, Echo, and Music Sync Delay Adjusters */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-800/60 flex-wrap">
            {/* Quick Volume +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-emerald-600/40">
              <span className="text-[10px] font-mono text-emerald-300 font-bold">Vol:</span>
              <button
                onClick={decreaseVolume}
                className="h-5 w-6 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-200 font-black text-xs flex items-center justify-center border border-emerald-500/50 active:scale-95 transition"
                title="Kurangi Volume (-)"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-white font-bold w-8 text-center">
                {micVolume}%
              </span>
              <button
                onClick={increaseVolume}
                className="h-5 w-6 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-200 font-black text-xs flex items-center justify-center border border-emerald-500/50 active:scale-95 transition"
                title="Tambah Volume (+)"
              >
                +
              </button>
            </div>

            {/* Quick Echo +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-teal-600/40">
              <span className="text-[10px] font-mono text-teal-300 font-bold">Echo:</span>
              <button
                onClick={decreaseEcho}
                className="h-5 w-6 rounded bg-teal-950 hover:bg-teal-800 text-teal-200 font-black text-xs flex items-center justify-center border border-teal-500/50 active:scale-95 transition"
                title="Kurangi Echo (-)"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-amber-300 font-bold w-7 text-center">
                {micEcho}%
              </span>
              <button
                onClick={increaseEcho}
                className="h-5 w-6 rounded bg-teal-950 hover:bg-teal-800 text-teal-200 font-black text-xs flex items-center justify-center border border-teal-500/50 active:scale-95 transition"
                title="Tambah Echo (+)"
              >
                +
              </button>
            </div>

            {/* Quick TV Music Sync Delay +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-amber-600/50">
              <span className="text-[10px] font-mono text-amber-300 font-bold flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                <span>Sync:</span>
              </span>
              <button
                onClick={() => handleSetTvMusicDelay(Math.max(0, tvMusicDelay - 5))}
                className="h-5 w-6 rounded bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-xs flex items-center justify-center border border-amber-500/50 active:scale-95 transition"
                title="Kurangi Delay Musik (-5ms)"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-amber-200 font-bold px-1 text-center">
                +{tvMusicDelay}ms
              </span>
              <button
                onClick={() => handleSetTvMusicDelay(Math.min(250, tvMusicDelay + 5))}
                className="h-5 w-6 rounded bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-xs flex items-center justify-center border border-amber-500/50 active:scale-95 transition"
                title="Tambah Delay Musik (+5ms)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 p-3.5 space-y-4">
        {/* ============================================================== */}
        {/* TAB 1: CARI LAGU (Super Simpel & Jelas)                        */}
        {/* ============================================================== */}
        {activeTab === 'search' && (
          <div className="space-y-3.5">
            {/* Search Input Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                placeholder="Ketik judul lagu atau penyanyi..."
                className="w-full rounded-2xl border-2 border-sky-600/60 bg-[#050e22] pl-10 pr-24 py-3 text-xs text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 shadow-lg"
              />
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-sky-400" />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-16 top-3 p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                onClick={() => executeSearch()}
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1.5 top-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 active:scale-95 transition shadow disabled:opacity-40"
              >
                {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Cari'}
              </button>
            </div>

            {/* Quick Filter Buttons (Pilihan Populer 1-Sentuh) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              <span className="text-[10px] font-bold text-sky-400 shrink-0">Populer:</span>
              {['Dewa 19', 'Slank', 'Dangdut Koplo', 'Slow Rock 90an', 'Iwan Fals', 'Noah', 'Reggae', 'Nostalgia'].map(
                (term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setSearchQuery(term);
                      executeSearch(term);
                    }}
                    className="rounded-xl px-2.5 py-1 whitespace-nowrap bg-[#081533] border border-sky-800 text-sky-200 hover:border-sky-400 hover:text-white transition font-medium"
                  >
                    {term}
                  </button>
                )
              )}
            </div>

            {/* Direct Link Option Toggle */}
            <div className="text-right">
              <button
                onClick={() => setShowDirectInput(!showDirectInput)}
                className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline"
              >
                <LinkIcon className="h-3 w-3" />
                <span>{showDirectInput ? 'Tutup Input Link' : '+ Punya Link YouTube Langsung?'}</span>
              </button>
            </div>

            {showDirectInput && (
              <form
                onSubmit={handleAddDirectLink}
                className="flex items-center gap-2 rounded-xl bg-[#050e22] p-2 border border-sky-800 animate-in fade-in duration-200"
              >
                <input
                  type="text"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="Tempel link YouTube (cth: https://youtu.be/...)"
                  className="flex-1 bg-transparent px-2 text-xs text-white placeholder-slate-500 outline-none truncate"
                />
                <button
                  type="submit"
                  disabled={isResolvingDirect || !directUrl.trim()}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shrink-0 disabled:opacity-40"
                >
                  {isResolvingDirect ? 'Memproses...' : '+ Antrekan'}
                </button>
              </form>
            )}

            {/* Search Results List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-sky-300">
                <span className="font-bold">Daftar Lagu ({searchResults.length}):</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  Sentuh tombol untuk memutar ke TV
                </span>
              </div>

              {searchResults.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between rounded-2xl border border-sky-900/80 bg-[#050e22] p-2.5 hover:border-sky-500/70 transition gap-2 shadow"
                >
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="h-12 w-16 rounded-xl object-cover border border-sky-900 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white leading-tight">
                      {song.title}
                    </p>
                    <p className="truncate text-[10px] text-sky-300/70 mt-0.5">
                      {song.channelTitle} {song.duration ? `• ${song.duration}` : ''}
                    </p>
                  </div>

                  {/* 2 Clear, High-Contrast Action Buttons */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {/* Green Button: Play Now on TV */}
                    <button
                      onClick={() => handlePlayNow(song)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-[11px] font-black text-white active:scale-95 shadow transition"
                      title="Putar sekarang di layar TV"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Putar di TV</span>
                    </button>

                    {/* Blue Button: Add to Queue */}
                    <button
                      onClick={() => handleAddSongToQueue(song, false)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-500 px-2.5 py-1.5 text-[10px] font-bold text-white active:scale-95 shadow transition"
                      title="Tambahkan ke antrean berikutnya"
                    >
                      <Plus className="h-3 w-3" />
                      <span>+ Antrean</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB: MIKROFON WIRELESS HP (WebRTC P2P Audio Streaming)        */}
        {/* ============================================================== */}
        {activeTab === 'mic' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header Card */}
            <div className="rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-[#041c14] via-[#05281d] to-[#041624] p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg border shrink-0 transition-all ${
                    isMicStreaming
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white border-emerald-300 shadow-emerald-500/40 animate-pulse'
                      : 'bg-[#082218] text-emerald-400 border-emerald-600/40'
                  }`}
                >
                  <Mic className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-base font-black text-white tracking-wide flex items-center gap-2">
                    <span>Mikrofon Wireless HP</span>
                    {isMicStreaming && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white uppercase animate-pulse">
                        LIVE ON AIR
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    Streaming audio suara vokal langsung ke speaker TV via WebRTC P2P
                  </p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="mt-3 pt-3 border-t border-emerald-700/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Koneksi TV (P2P):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          peerConnectionState === 'connected'
                            ? 'bg-emerald-400'
                            : peerConnectionState === 'connecting'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span
                        className={
                          peerConnectionState === 'connected'
                            ? 'text-emerald-300'
                            : peerConnectionState === 'connecting'
                            ? 'text-amber-300'
                            : 'text-rose-300'
                        }
                      >
                        {peerConnectionState === 'connected'
                          ? `Terhubung ke TV (${roomId})`
                          : peerConnectionState === 'connecting'
                          ? 'Menghubungkan...'
                          : 'Koneksi Terputus'}
                      </span>
                    </span>
                    {peerConnectionState !== 'connected' && (
                      <button
                        onClick={connectToTvPeer}
                        className="px-2 py-0.5 rounded bg-sky-600/80 hover:bg-sky-500 text-white text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Sambung Ulang
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Jalur Audio HP:</span>
                  <span className="font-mono font-bold flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        peerMicStreaming || isMicStreaming
                          ? 'bg-emerald-400 animate-ping'
                          : peerMicStatus === 'connecting'
                          ? 'bg-amber-400 animate-pulse'
                          : peerMicStatus === 'error'
                          ? 'bg-rose-400'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span
                      className={
                        peerMicStreaming || isMicStreaming
                          ? 'text-emerald-300'
                          : peerMicStatus === 'connecting'
                          ? 'text-amber-300'
                          : peerMicStatus === 'error'
                          ? 'text-rose-300'
                          : 'text-slate-400'
                      }
                    >
                      {peerMicStreaming || isMicStreaming
                        ? 'Mengudara ke TV (WebRTC P2P)'
                        : peerMicStatus === 'connecting'
                        ? 'Menghubungkan WebRTC...'
                        : peerMicStatus === 'error'
                        ? 'Perlu Izin / Tindakan'
                        : 'Siap Digunakan'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Error banner if any */}
            {(peerMicError || micError) && (
              <div className="rounded-xl border border-rose-500/60 bg-rose-950/85 p-3.5 text-xs text-rose-200 shadow-lg flex items-start gap-3">
                <MicOff className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-rose-300 text-sm">
                    {(peerMicError || micError || '').includes('belum siap')
                      ? 'Koneksi ke TV Belum Siap'
                      : (peerMicError || micError || '').includes('Izin') || (peerMicError || micError || '').includes('ditolak')
                      ? 'Izin Mikrofon Ditolak'
                      : (peerMicError || micError || '').includes('HTTPS')
                      ? 'Koneksi Wajib HTTPS'
                      : 'Akses Mikrofon Bermasalah'}
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-100">{peerMicError || micError}</p>
                  {peerConnectionState !== 'connected' && (
                    <button
                      onClick={connectToTvPeer}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow transition active:scale-95"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sambungkan Ulang ke TV Sekarang
                    </button>
                  )}
                  {((peerMicError || micError || '').includes('Izin') || (peerMicError || micError || '').includes('ditolak')) && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      💡 Tips: Buka setelan browser HP (ikon gembok di samping alamat URL) &gt; Setelan Situs &gt; Izinkan Mikrofon, lalu coba lagi.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Main Interactive Mic Broadcast Console */}
            <div className="rounded-2xl border border-sky-800/70 bg-[#061430] p-5 shadow-2xl text-center space-y-4">
              {!isMicLive ? (
                <div className="space-y-4">
                  <button
                    onClick={handleStartUnifiedMic}
                    disabled={peerMicStatus === 'connecting' || micConnectionStatus === 'connecting'}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-display text-sm font-black tracking-wide shadow-xl shadow-emerald-950/70 border-2 border-emerald-400 active:scale-98 transition flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                  >
                    <Mic className="h-6 w-6 animate-bounce" />
                    <span>
                      {peerMicStatus === 'connecting' || micConnectionStatus === 'connecting'
                        ? 'MENGHUBUNGKAN KE TV...'
                        : '🎤 NYALAKAN MIKROFON WIRELESS HP'}
                    </span>
                  </button>

                  <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Sentuh tombol di atas untuk bernyanyi! Suara mikrofon HP Anda akan dipancarkan secara instan ke TV melalui jalur audio WebRTC Ultra-Low Latency (10ms Opus frame).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Big Live VU Meter Display */}
                  <div className="bg-[#030d1d] p-4 rounded-2xl border border-emerald-500/50 shadow-inner space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                        <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                        INDIKATOR LEVEL SUARA (VU METER)
                      </span>
                      <span className="font-mono text-xs font-black text-white bg-black/60 px-2 py-0.5 rounded border border-emerald-600/50">
                        {displayAudioLevel}%
                      </span>
                    </div>

                    {/* Progress Bar VU Meter with 20 segmented LEDs */}
                    <div className="h-4 w-full bg-slate-900 rounded-lg overflow-hidden p-0.5 border border-slate-700 flex gap-0.5">
                      {Array.from({ length: 20 }).map((_, idx) => {
                        const threshold = (idx + 1) * 5;
                        const isLit = displayAudioLevel >= threshold;
                        const isRed = idx >= 16;
                        const isYellow = idx >= 12 && idx < 16;

                        return (
                          <div
                            key={idx}
                            className={`flex-1 rounded-sm transition-all duration-75 ${
                              isLit
                                ? isRed
                                ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                                : isYellow
                                ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                : 'bg-slate-800/80'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-slate-400 px-0.5">
                      <span>SENYAP</span>
                      <span>NORMAL</span>
                      <span className="text-amber-400">OPTIMAL</span>
                      <span className="text-rose-400">PUNCAK</span>
                    </div>
                  </div>

                  {/* Dual Action Controls: Mute & Stop */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleToggleUnifiedMute}
                      className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition active:scale-95 shadow cursor-pointer ${
                        isCurrentMicMuted
                          ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                      }`}
                    >
                      {isCurrentMicMuted ? (
                        <>
                          <MicOff className="h-4 w-4 text-amber-300" />
                          <span>Buka Suara Mic</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="h-4 w-4 text-rose-400" />
                          <span>Bisukan (Mute)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleStopUnifiedMic}
                      className="py-3 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 border border-rose-400 active:scale-95 shadow cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                      <span>Matikan Mic</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dedicated Volume (+ and -) and Echo (+ and -) Controls */}
              <div className="space-y-3">
                {/* Volume (+ and -) Control */}
                <div className="rounded-2xl bg-[#030f24] p-3.5 border border-emerald-500/50 text-left shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        Volume Suara Mic
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                      {micVolume}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={decreaseVolume}
                      className="h-10 w-12 rounded-xl bg-emerald-950/90 hover:bg-emerald-800 text-emerald-200 font-black text-xl flex items-center justify-center border border-emerald-500/50 shadow active:scale-95 transition"
                      title="Kurangi Volume (-)"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="5"
                      value={micVolume}
                      onChange={(e) => setVolumeDirect(Number(e.target.value))}
                      className="flex-1 accent-emerald-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <button
                      onClick={increaseVolume}
                      className="h-10 w-12 rounded-xl bg-emerald-950/90 hover:bg-emerald-800 text-emerald-200 font-black text-xl flex items-center justify-center border border-emerald-500/50 shadow active:scale-95 transition"
                      title="Tambah Volume (+)"
                    >
                      +
                    </button>
                  </div>

                  {/* Volume Presets */}
                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
                    {[50, 80, 100, 120, 150].map((v) => (
                      <button
                        key={v}
                        onClick={() => setVolumeDirect(v)}
                        className={`flex-1 py-1 rounded-lg font-mono font-bold border transition ${
                          micVolume === v
                            ? 'bg-emerald-600 text-white border-emerald-300 shadow'
                            : 'bg-black/40 text-slate-400 hover:text-white border-slate-700'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Echo (+ and -) Karaoke Reverb Control */}
                <div className="rounded-2xl bg-[#030f24] p-3.5 border border-teal-500/50 text-left shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-400" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        Efek Echo / Gema Karaoke
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black text-amber-300 bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-500/40">
                      {micEcho}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={decreaseEcho}
                      className="h-10 w-12 rounded-xl bg-teal-950/90 hover:bg-teal-800 text-teal-200 font-black text-xl flex items-center justify-center border border-teal-500/50 shadow active:scale-95 transition"
                      title="Kurangi Efek Echo (-)"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={micEcho}
                      onChange={(e) => setEchoDirect(Number(e.target.value))}
                      className="flex-1 accent-teal-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <button
                      onClick={increaseEcho}
                      className="h-10 w-12 rounded-xl bg-teal-950/90 hover:bg-teal-800 text-teal-200 font-black text-xl flex items-center justify-center border border-teal-500/50 shadow active:scale-95 transition"
                      title="Tambah Efek Echo (+)"
                    >
                      +
                    </button>
                  </div>

                  {/* Echo Presets */}
                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
                    {[
                      { val: 0, label: '0% (Nol Delay)' },
                      { val: 15, label: '15% Lembut' },
                      { val: 30, label: '30% Standar' },
                      { val: 50, label: '50% Panggung' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => setEchoDirect(p.val)}
                        className={`flex-1 py-1 rounded-lg font-mono font-bold border transition ${
                          micEcho === p.val
                            ? 'bg-teal-600 text-white border-teal-300 shadow'
                            : 'bg-black/40 text-slate-400 hover:text-white border-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-teal-300/80 italic pt-0.5">
                    {micEcho === 0
                      ? '⚡ Mode Nol Delay Murni: Suara vokal keluar instan tanpa pantulan gema, sinkron penuh dengan ketukan musik TV.'
                      : `✨ Efek Reverb Karaoke Aktif (${micEcho}%): Suara terdengar lebih merdu dan bergema.`}
                  </p>
                </div>
              </div>

              {/* Zero-Delay & Anti-Gema Optimizer Controls */}
              <div className="rounded-xl bg-[#030e24] p-3 border border-sky-800/80 text-left space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Peredam Feedback Suara TV:</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Mencegah musik TV terpantul ulang ke mikrofon HP
                    </p>
                  </div>

                  <button
                    onClick={toggleEchoCancellation}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow shrink-0 active:scale-95 ${
                      isEchoCancellationEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-emerald-950/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {isEchoCancellationEnabled ? '✓ AKTIF' : 'NONAKTIF'}
                  </button>
                </div>

                <div className="pt-2 border-t border-sky-900/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>Sinkronisasi Nol Delay Vokal-Musik:</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Bypass buffer window hardware agar suara pas dengan ketukan musik
                    </p>
                  </div>

                  <button
                    onClick={toggleZeroDelayBypass}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow shrink-0 active:scale-95 ${
                      isZeroDelayBypass
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-300 shadow-amber-950/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {isZeroDelayBypass ? '⚡ AKTIF (0 Delay)' : 'STANDAR'}
                  </button>
                </div>
              </div>

              {/* Vocal Sync Delay / Music Delay Adjustment (TV DelayNode Buffer) */}
              <div className="rounded-2xl bg-[#030f24] p-3.5 border-2 border-amber-500/60 text-left shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white tracking-wide block">
                        Sinkronisasi Musik TV (Vocal Sync Buffer)
                      </span>
                      <span className="text-[10px] text-amber-200/80">
                        Atur Web Audio DelayNode di TV agar musik &amp; vokal 100% pas
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-amber-300 bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/50">
                    +{tvMusicDelay} ms
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleSetTvMusicDelay(Math.max(0, tvMusicDelay - 5))}
                    className="h-10 w-12 rounded-xl bg-amber-950/90 hover:bg-amber-800 text-amber-200 font-black text-xl flex items-center justify-center border border-amber-500/50 shadow active:scale-95 transition"
                    title="Kurangi Delay Musik (-5ms)"
                  >
                    -
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="250"
                    step="5"
                    value={tvMusicDelay}
                    onChange={(e) => handleSetTvMusicDelay(Number(e.target.value))}
                    className="flex-1 accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />

                  <button
                    onClick={() => handleSetTvMusicDelay(Math.min(250, tvMusicDelay + 5))}
                    className="h-10 w-12 rounded-xl bg-amber-950/90 hover:bg-amber-800 text-amber-200 font-black text-xl flex items-center justify-center border border-amber-500/50 shadow active:scale-95 transition"
                    title="Tambah Delay Musik (+5ms)"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets for Vocal Sync Delay */}
                <div className="grid grid-cols-4 gap-1 pt-1 text-[10px]">
                  {[
                    { ms: 0, label: '0ms (Direct)' },
                    { ms: 60, label: '60ms (Cepat)' },
                    { ms: 75, label: '75ms (Ideal)' },
                    { ms: 100, label: '100ms (Stabil)' },
                  ].map((p) => (
                    <button
                      key={p.ms}
                      onClick={() => handleSetTvMusicDelay(p.ms)}
                      className={`py-1.5 px-1 rounded-lg font-mono font-bold border text-center transition ${
                        tvMusicDelay === p.ms
                          ? 'bg-amber-500 text-black border-amber-300 shadow font-black'
                          : 'bg-black/50 text-slate-300 hover:text-white border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-slate-300 leading-relaxed pt-1 border-t border-amber-500/20">
                  💡 <strong>Fungsi Sinkronisasi:</strong> Menunda audio musik di TV sedikit (60ms - 80ms) sehingga vokal dari mikrofon HP Anda yang masuk melalui WiFi terdengar persis bersamaan dengan ketukan musik di TV (tidak terasa terlambat).
                </p>
              </div>

              {/* Technical Profile Note */}
              <div className="text-left rounded-xl bg-[#040d20] p-3 border border-sky-900/60 text-[11px] space-y-1.5 text-slate-300">
                <p className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-sky-400" />
                  Fitur Vokal & Audio Subdis Rudal Diskomlekau:
                </p>
                <ul className="space-y-1 text-[10px] text-slate-300/90 pl-4 list-disc">
                  <li>
                    <strong className="text-emerald-300">Volume (+ dan -)</strong> — Atur kekerasan vokal HP langsung dari smartphone (hingga 150%).
                  </li>
                  <li>
                    <strong className="text-teal-300">Echo (+ dan -)</strong> — Atur efek gema panggung karaoke agar vokal terdengar merdu dan megah.
                  </li>
                  <li>
                    <strong className="text-amber-300">Nol Delay ke Musik</strong> — Transmisi 10ms Opus frame tanpa buffer lookahead sehingga vokal pas di tempo lagu.
                  </li>
                  <li>
                    <strong className="text-sky-300">Peredam Feedback</strong> — Highpass 85Hz & Dynamics Compressor memutus dengungan balik dari speaker TV.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ANTREAN TV (Jelas, Mudah Diatur Urutannya)             */}
        {/* ============================================================== */}
        {activeTab === 'queue' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-sky-300">
              <span className="font-bold flex items-center gap-1.5">
                <ListMusic className="h-4 w-4 text-sky-400" />
                Antrean di Layar TV ({queue.length} Lagu):
              </span>
              <button
                onClick={fetchRoomState}
                className="text-sky-400 hover:text-white flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Quick Skip to Next Button */}
            {queue.length > 0 && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#081533] border border-sky-700 text-xs shadow-md">
                <div className="min-w-0">
                  <span className="font-bold text-[10px] uppercase text-sky-400 block">Lagu Berikutnya:</span>
                  <span className="text-amber-300 font-extrabold truncate block max-w-[180px]">
                    {queue[0].song.title}
                  </span>
                </div>
                <button
                  onClick={handleSkipNext}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-3.5 py-2 text-xs font-black text-white shadow-md active:scale-95 transition shrink-0"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                  <span>Putar Lagu Ini</span>
                </button>
              </div>
            )}

            {queue.length === 0 ? (
              <div className="rounded-2xl border border-sky-900 bg-[#050e22] p-8 text-center space-y-3">
                <Rocket className="h-10 w-10 mx-auto text-amber-400 rotate-45" />
                <p className="text-sm font-bold text-white">Antrean TV Masih Kosong</p>
                <p className="text-xs text-sky-300/80 leading-relaxed max-w-xs mx-auto">
                  Belum ada lagu dalam antrean. Buka tab <strong>"Cari Lagu"</strong> lalu klik <strong>"+ Antrean"</strong> untuk mendaftarkan giliran bernyanyi Anda!
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-sky-500"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Cari Lagu Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-sky-300/80">
                  💡 Gunakan tombol <strong>⬆️ Naik</strong> atau <strong>⬇️ Turun</strong> untuk memindahkan giliran lagu di TV, atau <strong>▶️ Putar</strong> untuk langsung memulai lagu tersebut.
                </p>

                {queue.map((item, index) => {
                  const isMySong = item.singerName.toLowerCase() === singerName.toLowerCase();

                  return (
                    <div
                      key={item.queueId}
                      className={`flex items-center justify-between rounded-2xl border p-2.5 transition gap-2 shadow ${
                        isMySong
                          ? 'border-sky-400 bg-sky-950/50'
                          : 'border-sky-900/70 bg-[#050e22]'
                      }`}
                    >
                      {/* Big Queue Number */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#07132c] text-sm font-mono font-black text-sky-300 border border-sky-800 shrink-0">
                        #{index + 1}
                      </div>

                      <img
                        src={item.song.thumbnailUrl}
                        alt={item.song.title}
                        className="h-11 w-14 rounded-lg object-cover border border-sky-900 shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white leading-tight">
                          {item.song.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                              isMySong
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-sky-900/40 text-sky-300 border-sky-700/50'
                            }`}
                          >
                            👤 {item.singerName} {isMySong ? '(Anda)' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Controls: Putar Sekarang, Naik/Turun, Hapus */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Play Now Button */}
                        <button
                          onClick={() => handlePlayNow(item.song)}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600/30 border border-emerald-500/60 hover:bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-emerald-300 hover:text-white transition active:scale-95"
                          title="Putar sekarang di layar TV"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Putar</span>
                        </button>

                        {/* Move Up/Down */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveQueueItem(index, index - 1)}
                            disabled={index === 0}
                            className="p-1 rounded-md bg-[#07132c] border border-sky-800 text-sky-300 hover:bg-sky-700 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition"
                            title="Geser Naik (Maju Giliran)"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveQueueItem(index, index + 1)}
                            disabled={index === queue.length - 1}
                            className="p-1 rounded-md bg-[#07132c] border border-sky-800 text-sky-300 hover:bg-sky-700 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition"
                            title="Geser Turun (Mundur Giliran)"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveQueueItem(item.queueId)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                          title="Hapus lagu ini dari antrean"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: KIRIM SORAK & EFEK SUARA TV (Sangat Jelas & Menyenangkan)*/}
        {/* ============================================================== */}
        {activeTab === 'reactions' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Kirim Sorak & Efek Suara ke Layar TV</span>
              </h3>
              <p className="text-[11px] text-sky-300/80">
                Tekan tombol di bawah untuk membunyikan suara di speaker TV dan memunculkan animasi reaksi seru di layar!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* TOMBOL SPESIAL HUUU PALING BESAR */}
              <button
                onClick={() => handleSendReaction('boo', '👎', 'Sorak HUUU (Suara Hancur!)')}
                className="col-span-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 border-2 border-rose-500/80 p-3.5 text-left text-white shadow-xl shadow-rose-950/60 active:scale-95 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl animate-bounce">👎</span>
                  <div>
                    <h4 className="font-display text-base font-black text-amber-300 leading-tight">
                      HUUU! (Suara Fals / Hancur)
                    </h4>
                    <p className="text-[11px] text-rose-200 mt-0.5">
                      "Prajurit Yang Pantang Mundur Walau Suara Hancur!" 😂
                    </p>
                  </div>
                </div>
                <span className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-black uppercase text-white shadow">
                  Kirim
                </span>
              </button>

              {/* TEPUK TANGAN PASUKAN */}
              <button
                onClick={() => handleSendReaction('applause', '👏', 'Tepuk Tangan Pasukan')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">👏</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Tepuk Tangan</h4>
                  <p className="text-[10px] text-sky-300/70">Apresiasi pasukan</p>
                </div>
              </button>

              {/* SORAK KOMANDO */}
              <button
                onClick={() => handleSendReaction('cheer', '🎉', 'Sorak Komando')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">🎉</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Sorak Komando</h4>
                  <p className="text-[10px] text-sky-300/70">Hore mantap!</p>
                </div>
              </button>

              {/* SIRINE TEMPUR */}
              <button
                onClick={() => handleSendReaction('airhorn', '📢', 'Sirine Tempur')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">📢</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Sirine Tempur</h4>
                  <p className="text-[10px] text-sky-300/70">DJ Airhorn pangkalan</p>
                </div>
              </button>

              {/* KETAWA NGAKAK */}
              <button
                onClick={() => handleSendReaction('laugh', '😂', 'Tawa Pasukan')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">😂</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Ketawa Pasukan</h4>
                  <p className="text-[10px] text-sky-300/70">Tawa gembira</p>
                </div>
              </button>

              {/* BEL APEL GILIRAN */}
              <button
                onClick={() => handleSendReaction('ding', '🔔', 'Bel Apel Giliran')}
                className="col-span-2 flex items-center gap-3 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">🔔</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Bel Apel Giliran</h4>
                  <p className="text-[10px] text-sky-300/70">Pemberitahuan giliran bernyanyi berikutnya</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: REKOMENDASI POPULER (Pilihan Cepat Tanpa Mengetik)     */}
        {/* ============================================================== */}
        {activeTab === 'curated' && (
          <div className="space-y-4">
            <p className="text-xs text-sky-300/80">
              Pilihan lagu karaoke favorit siap langsung diputar atau dimasukkan antrean TV:
            </p>

            {Object.entries(CURATED_LIBRARY).map(([categoryKey, songs]) => (
              <div key={categoryKey} className="space-y-2">
                <div className="flex items-center justify-between border-b border-sky-900/60 pb-1">
                  <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                    {categoryKey.replace('-', ' ')}
                  </h4>
                  <span className="text-[10px] text-sky-400 font-mono">
                    {songs.length} Lagu
                  </span>
                </div>

                <div className="space-y-1.5">
                  {songs.slice(0, 4).map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between rounded-xl border border-sky-900/60 bg-[#050e22] p-2 hover:border-sky-500/60 gap-2 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white leading-tight">
                          {song.title}
                        </p>
                        <p className="truncate text-[10px] text-sky-300/70">
                          {song.channelTitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handlePlayNow(song)}
                          className="rounded-lg bg-emerald-600/30 border border-emerald-500/50 hover:bg-emerald-600 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:text-white transition active:scale-95 flex items-center gap-0.5"
                          title="Putar sekarang di TV"
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          <span>Putar</span>
                        </button>

                        <button
                          onClick={() => handleAddSongToQueue(song, false)}
                          className="rounded-lg bg-sky-600 hover:bg-sky-500 px-2 py-1 text-[10px] font-bold text-white shrink-0 active:scale-95"
                        >
                          + Antrean
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Clean, Simple Fixed Bottom Navigation Bar (5 Clear Tabs including Wireless Mic) */}
      <nav className="fixed bottom-0 inset-x-0 z-45 bg-[#07132c]/98 border-t border-sky-900/80 backdrop-blur-lg px-2 py-1.5 max-w-lg mx-auto shadow-2xl">
        <div className="grid grid-cols-5 gap-1">
          {/* Tab 1: Cari Lagu */}
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition ${
              activeTab === 'search'
                ? 'bg-sky-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            <Search className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-bold">Cari Lagu</span>
          </button>

          {/* Tab 2: Antrean TV */}
          <button
            onClick={() => setActiveTab('queue')}
            className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition ${
              activeTab === 'queue'
                ? 'bg-sky-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            <ListMusic className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-bold">Antrean</span>
            {queue.length > 0 && (
              <span className="absolute top-0.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black shadow">
                {queue.length}
              </span>
            )}
          </button>

          {/* Tab 3: Mic Wireless HP (Center Prominent) */}
          <button
            onClick={() => setActiveTab('mic')}
            className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition ${
              activeTab === 'mic'
                ? isMicStreaming
                  ? 'bg-gradient-to-tr from-rose-600 to-red-600 text-white font-black shadow-lg shadow-rose-950/80 border border-rose-300'
                  : 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-950/80 border border-emerald-300'
                : isMicStreaming
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 animate-pulse'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <Mic className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-bold">Mic HP</span>
            {isMicStreaming && (
              <span className="absolute -top-1 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
            )}
          </button>

          {/* Tab 4: Kirim Sorak */}
          <button
            onClick={() => setActiveTab('reactions')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition ${
              activeTab === 'reactions'
                ? 'bg-rose-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <Sparkles className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-bold">Sorak TV</span>
          </button>

          {/* Tab 5: Rekomendasi */}
          <button
            onClick={() => setActiveTab('curated')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition ${
              activeTab === 'curated'
                ? 'bg-sky-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            <Rocket className="h-4 w-4 mb-0.5" />
            <span className="text-[10px] font-bold">Pilihan</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
