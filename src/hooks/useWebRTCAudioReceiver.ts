import { useState, useRef, useCallback, useEffect } from 'react';
import { optimizeSdpForUltraLowLatency } from './useWebRTCMicrophone';
import { RTC_ICE_SERVERS } from '../services/signaling';

export interface ActiveWirelessMic {
  senderId: string;
  senderName: string;
  stream?: MediaStream | null;
  volume: number; // 0 - 150% (defaults to 100%)
  echo: number;   // 0 - 100% (defaults to 0%)
  isMuted?: boolean;
  audioLevel: number; // 0 - 100% live VU meter
  addedAt: number;
  lastActive: number;
  mode: 'webrtc' | 'relay';
}

export interface UseWebRTCAudioReceiverOptions {
  socketRef: React.MutableRefObject<WebSocket | null>;
  roomId: string;
}

interface WebAudioNodes {
  source?: MediaStreamAudioSourceNode | null;
  highpass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  dryGain: GainNode;
  delayNode: DelayNode;
  feedbackGain: GainNode;
  echoFilter: BiquadFilterNode;
  wetGain: GainNode;
  clientGain: GainNode; // Individual volume & mute for this specific mic
  masterGain: GainNode; // Global master mic bus
  clientVolume: number;
  clientEcho: number;
  clientMuted: boolean;
  nextScheduledTime: number; // For scheduling WebSocket audio chunks smoothly
}

export function useWebRTCAudioReceiver({ socketRef, roomId }: UseWebRTCAudioReceiverOptions) {
  const [activeMics, setActiveMics] = useState<ActiveWirelessMic[]>([]);
  const [masterMicVolume, setMasterMicVolume] = useState<number>(100); // 0 - 150%
  const [masterMicEcho, setMasterMicEcho] = useState<number>(0); // 0 - 100%
  const [isMasterMicMuted, setIsMasterMicMuted] = useState<boolean>(false);
  const [isAudioSuspended, setIsAudioSuspended] = useState<boolean>(false);

  // TV Vocal Sync Delay Buffer / Music Delay (0ms - 250ms, default 70ms for optimal acoustic wireless sync)
  const [musicDelayMs, setMusicDelayMsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('karaoke_music_delay_ms_v1');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return Math.max(0, Math.min(250, val));
      }
    } catch {}
    return 70; // 70ms default: perfectly compensates for ~50-70ms mobile audio hardware & network latency
  });

  // PeerConnections and Audio Elements indexed by senderId
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Web Audio Context for zero-latency (<15ms) sound playback & real-time karaoke echo effect
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<Map<string, WebAudioNodes>>(new Map());
  const masterVolumeRef = useRef<number>(100);
  const masterEchoRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);

  // Web Audio API DelayNode for TV Music Sync
  const musicDelayNodeRef = useRef<DelayNode | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const connectedMusicElementsRef = useRef<WeakSet<HTMLMediaElement>>(new WeakSet());
  const musicDelayMsRef = useRef<number>(70);

  useEffect(() => {
    musicDelayMsRef.current = musicDelayMs;
  }, [musicDelayMs]);

  useEffect(() => {
    masterVolumeRef.current = masterMicVolume;
  }, [masterMicVolume]);

  useEffect(() => {
    masterEchoRef.current = masterMicEcho;
  }, [masterMicEcho]);

  useEffect(() => {
    isMutedRef.current = isMasterMicMuted;
  }, [isMasterMicMuted]);

  // Initialize or retrieve shared AudioContext with interactive latency hint
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx({ latencyHint: 'interactive' });
        audioContextRef.current = ctx;

        // Initialize dedicated Music DelayNode pipeline
        try {
          const delay = ctx.createDelay(1.0);
          delay.delayTime.setValueAtTime(musicDelayMsRef.current / 1000, ctx.currentTime);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(1.0, ctx.currentTime);
          delay.connect(gain);
          gain.connect(ctx.destination);
          musicDelayNodeRef.current = delay;
          musicGainNodeRef.current = gain;
        } catch (e) {
          console.warn('[WebAudio] DelayNode init error:', e);
        }
      }
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        setIsAudioSuspended(true);
        audioContextRef.current.resume().then(() => {
          setIsAudioSuspended(false);
        }).catch(() => {});
      } else {
        setIsAudioSuspended(false);
      }
    }

    return audioContextRef.current;
  }, []);

  // Update Music Delay with smooth Web Audio DelayNode parameter ramping
  const setMusicDelayMs = useCallback(
    (newDelay: number, broadcast = true) => {
      const clamped = Math.max(0, Math.min(250, Math.round(newDelay)));
      setMusicDelayMsState(clamped);
      musicDelayMsRef.current = clamped;

      try {
        localStorage.setItem('karaoke_music_delay_ms_v1', String(clamped));
      } catch {}

      const ctx = audioContextRef.current;
      if (ctx && musicDelayNodeRef.current) {
        try {
          const targetSec = clamped / 1000;
          musicDelayNodeRef.current.delayTime.cancelScheduledValues(ctx.currentTime);
          musicDelayNodeRef.current.delayTime.setValueAtTime(targetSec, ctx.currentTime);
        } catch (e) {
          console.warn('[WebAudio] Error setting delayTime:', e);
        }
      }

      // Broadcast update across WebSocket room
      if (broadcast && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(
            JSON.stringify({
              type: 'MUSIC_SYNC_DELAY',
              roomId,
              payload: { delayMs: clamped },
              timestamp: Date.now(),
            })
          );
        } catch {}
      }
    },
    [roomId, socketRef]
  );

  // Connect any HTMLMediaElement (audio/video music player) through TV Music DelayNode
  const connectMusicMediaElement = useCallback(
    (mediaElem: HTMLMediaElement) => {
      if (!mediaElem) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        if (!musicDelayNodeRef.current) {
          const delay = ctx.createDelay(1.0);
          delay.delayTime.setValueAtTime(musicDelayMsRef.current / 1000, ctx.currentTime);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(1.0, ctx.currentTime);
          delay.connect(gain);
          gain.connect(ctx.destination);
          musicDelayNodeRef.current = delay;
          musicGainNodeRef.current = gain;
        }

        if (!connectedMusicElementsRef.current.has(mediaElem)) {
          const source = ctx.createMediaElementSource(mediaElem);
          source.connect(musicDelayNodeRef.current);
          connectedMusicElementsRef.current.add(mediaElem);
          console.log('[WebAudio TV] Music media element routed through DelayNode successfully');
        }
      } catch (err) {
        console.warn('[WebAudio TV] connectMusicMediaElement:', err);
      }
    },
    [getAudioContext]
  );

  // Explicit user unlock action (e.g. clicking "Aktifkan Audio" or touching screen)
  const resumeAudio = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        setIsAudioSuspended(false);
      } catch {}
    }
  }, [getAudioContext]);

  // Unlock AudioContext on initial master user interaction anywhere on screen
  useEffect(() => {
    const handleUnlock = () => {
      resumeAudio();
    };
    window.addEventListener('click', handleUnlock, { once: true });
    window.addEventListener('keydown', handleUnlock, { once: true });
    window.addEventListener('touchstart', handleUnlock, { once: true });
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };
  }, [resumeAudio]);

  // Create or retrieve per-client Web Audio node pipeline
  const getOrCreateClientAudioNodes = useCallback(
    (senderId: string): WebAudioNodes | null => {
      let nodes = audioNodesRef.current.get(senderId);
      if (nodes) return nodes;

      const audioCtx = getAudioContext();
      if (!audioCtx) return null;

      try {
        // High-pass filter at 85Hz to eliminate low-frequency rumble & speaker acoustic feedback
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(85, audioCtx.currentTime);

        // Dynamics compressor to prevent mic clipping, howling, and sudden loud bursts
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-20, audioCtx.currentTime);
        compressor.knee.setValueAtTime(10, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

        // Individual Client Gain Node (controls this specific phone's volume & mute)
        const clientGain = audioCtx.createGain();
        clientGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        // Master Gain Node for global master volume control across all mics
        const masterGain = audioCtx.createGain();
        const targetMasterVol = isMutedRef.current ? 0 : Math.min(1.5, Math.max(0, masterVolumeRef.current / 100));
        masterGain.gain.setValueAtTime(targetMasterVol, audioCtx.currentTime);

        // Dry path (Direct Instant Voice - zero latency)
        const dryGain = audioCtx.createGain();
        dryGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        // Wet path (Karaoke Echo Effect: Delay + Warm Lowpass + Feedback Loop)
        const delayNode = audioCtx.createDelay(1.0);
        delayNode.delayTime.setValueAtTime(0.12, audioCtx.currentTime); // 120ms classic vocal karaoke echo

        const feedbackGain = audioCtx.createGain();
        const initialEcho = masterEchoRef.current;
        const targetFeedback = Math.min(0.45, (initialEcho / 100) * 0.4);
        feedbackGain.gain.setValueAtTime(targetFeedback, audioCtx.currentTime);

        const echoFilter = audioCtx.createBiquadFilter();
        echoFilter.type = 'lowpass';
        echoFilter.frequency.setValueAtTime(3200, audioCtx.currentTime); // Warm analogue vocal echo

        const wetGain = audioCtx.createGain();
        const targetWet = (initialEcho / 100) * 0.6;
        wetGain.gain.setValueAtTime(targetWet, audioCtx.currentTime);

        // Dry Routing: Highpass -> Compressor -> DryGain -> ClientGain -> MasterGain -> Destination
        highpass.connect(compressor);
        compressor.connect(dryGain);
        dryGain.connect(clientGain);

        // Wet Routing (Echo): Compressor -> Delay -> EchoFilter -> Feedback -> Delay
        //                      EchoFilter -> WetGain -> ClientGain
        compressor.connect(delayNode);
        delayNode.connect(echoFilter);
        echoFilter.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        echoFilter.connect(wetGain);
        wetGain.connect(clientGain);

        // Mix into Master Output Bus
        clientGain.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        nodes = {
          source: null,
          highpass,
          compressor,
          dryGain,
          delayNode,
          feedbackGain,
          echoFilter,
          wetGain,
          clientGain,
          masterGain,
          clientVolume: 100,
          clientEcho: initialEcho,
          clientMuted: false,
          nextScheduledTime: audioCtx.currentTime,
        };

        audioNodesRef.current.set(senderId, nodes);
        return nodes;
      } catch (err) {
        console.warn('[WebAudio] Node creation error:', err);
        return null;
      }
    },
    [getAudioContext]
  );

  // Broadcast volume & echo parameter updates to mobile client
  const broadcastMicParams = useCallback(
    (volume: number, echo: number, targetClientId?: string) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(
            JSON.stringify({
              type: 'RTC_MIC_PARAMS',
              roomId,
              payload: {
                targetClientId,
                volume,
                echo,
              },
              timestamp: Date.now(),
            })
          );
        } catch {}
      }
    },
    [roomId, socketRef]
  );

  // Incremental control functions (+ and -) for Master Volume and Echo
  const increaseVolume = useCallback(() => {
    setMasterMicVolume((prev) => {
      const next = Math.min(150, prev + 5);
      broadcastMicParams(next, masterMicEcho);
      return next;
    });
  }, [broadcastMicParams, masterMicEcho]);

  const decreaseVolume = useCallback(() => {
    setMasterMicVolume((prev) => {
      const next = Math.max(0, prev - 5);
      broadcastMicParams(next, masterMicEcho);
      return next;
    });
  }, [broadcastMicParams, masterMicEcho]);

  const increaseEcho = useCallback(() => {
    setMasterMicEcho((prev) => {
      const next = Math.min(100, prev + 5);
      broadcastMicParams(masterMicVolume, next);
      return next;
    });
  }, [broadcastMicParams, masterMicVolume]);

  const decreaseEcho = useCallback(() => {
    setMasterMicEcho((prev) => {
      const next = Math.max(0, prev - 5);
      broadcastMicParams(masterMicVolume, next);
      return next;
    });
  }, [broadcastMicParams, masterMicVolume]);

  // Individual client mic controls (for Master screen adjusting specific singer)
  const setClientMicVolume = useCallback(
    (senderId: string, volume: number) => {
      const clamped = Math.min(150, Math.max(0, volume));
      const nodes = audioNodesRef.current.get(senderId);
      if (nodes) {
        nodes.clientVolume = clamped;
        const ctx = audioContextRef.current;
        const target = nodes.clientMuted ? 0 : clamped / 100;
        if (ctx) nodes.clientGain.gain.setValueAtTime(target, ctx.currentTime);
        else nodes.clientGain.gain.value = target;
      }
      setActiveMics((prev) =>
        prev.map((m) => (m.senderId === senderId ? { ...m, volume: clamped } : m))
      );
      broadcastMicParams(clamped, nodes ? nodes.clientEcho : 0, senderId);
    },
    [broadcastMicParams]
  );

  const setClientMicEcho = useCallback(
    (senderId: string, echo: number) => {
      const clamped = Math.min(100, Math.max(0, echo));
      const nodes = audioNodesRef.current.get(senderId);
      if (nodes) {
        nodes.clientEcho = clamped;
        const ctx = audioContextRef.current;
        const wetTarget = (clamped / 100) * 0.6;
        const feedbackTarget = Math.min(0.45, (clamped / 100) * 0.4);
        if (ctx) {
          nodes.wetGain.gain.setValueAtTime(wetTarget, ctx.currentTime);
          nodes.feedbackGain.gain.setValueAtTime(feedbackTarget, ctx.currentTime);
        } else {
          nodes.wetGain.gain.value = wetTarget;
          nodes.feedbackGain.gain.value = feedbackTarget;
        }
      }
      setActiveMics((prev) =>
        prev.map((m) => (m.senderId === senderId ? { ...m, echo: clamped } : m))
      );
      broadcastMicParams(nodes ? nodes.clientVolume : 100, clamped, senderId);
    },
    [broadcastMicParams]
  );

  const toggleClientMicMute = useCallback((senderId: string) => {
    const nodes = audioNodesRef.current.get(senderId);
    if (nodes) {
      nodes.clientMuted = !nodes.clientMuted;
      const ctx = audioContextRef.current;
      const target = nodes.clientMuted ? 0 : nodes.clientVolume / 100;
      if (ctx) nodes.clientGain.gain.setValueAtTime(target, ctx.currentTime);
      else nodes.clientGain.gain.value = target;

      setActiveMics((prev) =>
        prev.map((m) => (m.senderId === senderId ? { ...m, isMuted: nodes.clientMuted } : m))
      );
    }
  }, []);

  // Attach received MediaStream to both the low-latency Web Audio pipeline and a non-muted active audio tag
  const attachAudioStream = useCallback(
    (senderId: string, senderName: string, stream: MediaStream) => {
      const audioCtx = getAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      // 1. Maintain <audio> element to keep stream alive in Chromium media pipeline
      // IMPORTANT FIX: Never set muted = true in Chromium because muted=true causes Chromium to pause the WebRTC RTP decoder!
      // Instead, set volume = 0.0001 (inaudible so no duplicate audio, but keeps RTP decoder active).
      let audioEl = audioElementsRef.current.get(senderId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `webrtc-audio-${senderId}`;
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        audioElementsRef.current.set(senderId, audioEl);
      }
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.srcObject = stream;
      audioEl.muted = false; // Chromium fix!
      audioEl.volume = 0.0001; // Virtually silent, keeping RTP decoder pumping
      audioEl.play().catch(() => {});

      // 2. Direct Ultra-Low Latency Web Audio API Playout
      try {
        if (audioCtx) {
          const nodes = getOrCreateClientAudioNodes(senderId);
          if (nodes) {
            // Disconnect old source if re-attaching
            if (nodes.source) {
              try {
                nodes.source.disconnect();
              } catch {}
            }
            const source = audioCtx.createMediaStreamSource(stream);
            nodes.source = source;
            source.connect(nodes.highpass);
          }
          console.log(`[WebRTC Master] Audio stream attached for ${senderName} (${senderId})`);
        }
      } catch (err) {
        console.warn('[WebRTC Master] Web Audio setup fallback:', err);
        if (audioEl) {
          audioEl.volume = isMutedRef.current ? 0 : Math.min(1, masterVolumeRef.current / 100);
        }
      }

      setActiveMics((prev) => {
        const filtered = prev.filter((m) => m.senderId !== senderId);
        return [
          ...filtered,
          {
            senderId,
            senderName,
            stream,
            volume: 100,
            echo: masterEchoRef.current,
            isMuted: false,
            audioLevel: 0,
            addedAt: Date.now(),
            lastActive: Date.now(),
            mode: 'webrtc',
          },
        ];
      });
    },
    [getAudioContext, getOrCreateClientAudioNodes]
  );

  // Play real-time audio PCM chunk received via WebSocket (Fail-safe relay for 4G/firewall networks)
  const playRelayAudioChunk = useCallback(
    (senderId: string, senderName: string, base64Pcm: string, sampleRate: number, level: number) => {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      try {
        // Decode base64 to 16-bit PCM samples
        const binary = atob(base64Pcm);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const pcm16 = new Int16Array(bytes.buffer);
        const samplesCount = pcm16.length;
        if (samplesCount === 0) return;

        // Convert to Float32Array
        const float32 = new Float32Array(samplesCount);
        for (let i = 0; i < samplesCount; i++) {
          float32[i] = pcm16[i] / (pcm16[i] < 0 ? 32768 : 32767);
        }

        // Create AudioBuffer
        const buffer = audioCtx.createBuffer(1, samplesCount, sampleRate || audioCtx.sampleRate);
        buffer.copyToChannel(float32, 0);

        const nodes = getOrCreateClientAudioNodes(senderId);
        if (nodes) {
          // If this sender doesn't have an active WebRTC stream playing, play relay chunk
          const isWebRTCActive = !!nodes.source;
          if (!isWebRTCActive) {
            const sourceNode = audioCtx.createBufferSource();
            sourceNode.buffer = buffer;
            sourceNode.connect(nodes.highpass);

            // Schedule smooth playback with minimal jitter buffer (~15ms)
            const currentTime = audioCtx.currentTime;
            const startTime = Math.max(currentTime, nodes.nextScheduledTime);
            sourceNode.start(startTime);
            nodes.nextScheduledTime = startTime + buffer.duration;
          }
        }

        // Update activeMics state with live visualizer level
        setActiveMics((prev) => {
          const existing = prev.find((m) => m.senderId === senderId);
          if (existing) {
            return prev.map((m) =>
              m.senderId === senderId
                ? { ...m, audioLevel: level || m.audioLevel, lastActive: Date.now() }
                : m
            );
          } else {
            return [
              ...prev,
              {
                senderId,
                senderName,
                volume: 100,
                echo: masterEchoRef.current,
                isMuted: false,
                audioLevel: level || 0,
                addedAt: Date.now(),
                lastActive: Date.now(),
                mode: 'relay',
              },
            ];
          }
        });
      } catch (e) {
        console.warn('[WebAudio] Relay chunk decode error:', e);
      }
    },
    [getAudioContext, getOrCreateClientAudioNodes]
  );

  // Clean up a specific sender's peer connection, audio element, and Web Audio nodes
  const cleanupSender = useCallback((senderId: string) => {
    // 1. Clean Web Audio nodes
    const nodes = audioNodesRef.current.get(senderId);
    if (nodes) {
      try {
        nodes.masterGain.disconnect();
        nodes.wetGain.disconnect();
        nodes.dryGain.disconnect();
        nodes.feedbackGain.disconnect();
        nodes.echoFilter.disconnect();
        nodes.delayNode.disconnect();
        nodes.compressor.disconnect();
        nodes.highpass.disconnect();
        if (nodes.source) nodes.source.disconnect();
      } catch {}
      audioNodesRef.current.delete(senderId);
    }

    // 2. Close and remove audio element
    const audioEl = audioElementsRef.current.get(senderId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
      } catch {}
      audioElementsRef.current.delete(senderId);
    }

    // 3. Close peer connection
    const pc = peerConnectionsRef.current.get(senderId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      } catch {}
      peerConnectionsRef.current.delete(senderId);
    }

    pendingCandidatesRef.current.delete(senderId);

    setActiveMics((prev) => prev.filter((m) => m.senderId !== senderId));
  }, []);

  // Update volume & echo of all active mic streams dynamically
  useEffect(() => {
    const vol = isMasterMicMuted ? 0 : Math.min(1.5, Math.max(0, masterMicVolume / 100));
    const echoWet = (masterMicEcho / 100) * 0.6;
    const echoFeedback = Math.min(0.45, (masterMicEcho / 100) * 0.4);

    const ctx = audioContextRef.current;
    audioNodesRef.current.forEach((nodes) => {
      if (ctx) {
        nodes.masterGain.gain.setValueAtTime(vol, ctx.currentTime);
        nodes.wetGain.gain.setValueAtTime(echoWet, ctx.currentTime);
        nodes.feedbackGain.gain.setValueAtTime(echoFeedback, ctx.currentTime);
      } else {
        nodes.masterGain.gain.value = vol;
        nodes.wetGain.gain.value = echoWet;
        nodes.feedbackGain.gain.value = echoFeedback;
      }
    });
  }, [masterMicVolume, masterMicEcho, isMasterMicMuted]);

  // Handle incoming signaling messages from HP Broadcaster(s)
  const handleSignalingMessage = useCallback(
    async (data: any) => {
      if (!data || !data.type) return;

      const { senderId, senderName, offer, candidate, isMicOn, volume, echo, pcm, sampleRate, level } =
        data.payload || {};

      // 1. Process RTC_OFFER from HP Client
      if (data.type === 'RTC_OFFER' && senderId && offer) {
        try {
          // Clean previous connection for this sender if any
          const existingPc = peerConnectionsRef.current.get(senderId);
          if (existingPc) {
            try {
              existingPc.close();
            } catch {}
          }

          const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
          peerConnectionsRef.current.set(senderId, pc);

          // Handle incoming audio track with ultra-low latency playout hints
          pc.ontrack = (event) => {
            const [stream] = event.streams;

            if (event.receiver) {
              if ('playoutDelayHint' in event.receiver) {
                (event.receiver as any).playoutDelayHint = 0;
              }
              if ('jitterBufferTarget' in event.receiver) {
                (event.receiver as any).jitterBufferTarget = 0;
              }
            }
            if (event.track && 'playoutDelayHint' in event.track) {
              try {
                (event.track as any).playoutDelayHint = 0;
              } catch {}
            }

            if (stream) {
              attachAudioStream(senderId, senderName || 'Prajurit (HP)', stream);
            }
          };

          // Relay ICE candidates back to sender
          pc.onicecandidate = (event) => {
            if (
              event.candidate &&
              socketRef.current &&
              socketRef.current.readyState === WebSocket.OPEN
            ) {
              socketRef.current.send(
                JSON.stringify({
                  type: 'RTC_ICE_CANDIDATE',
                  roomId,
                  payload: {
                    targetClientId: senderId,
                    candidate: event.candidate,
                  },
                  timestamp: Date.now(),
                })
              );
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log(`[WebRTC Master] PeerConnection ${pc.connectionState} for ${senderId}`);
              // Note: Do not clean up immediately if WebSocket relay is still transmitting!
            }
          };

          // Set remote description (the offer)
          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          // Apply pending candidates if any
          const pending = pendingCandidatesRef.current.get(senderId) || [];
          while (pending.length > 0) {
            const cand = pending.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
          pendingCandidatesRef.current.delete(senderId);

          // Create answer with ultra-low latency SDP optimizations
          const rawAnswer = await pc.createAnswer();
          const optimizedAnswer = {
            type: rawAnswer.type,
            sdp: optimizeSdpForUltraLowLatency(rawAnswer.sdp || ''),
          };

          await pc.setLocalDescription(optimizedAnswer);

          // Send answer back to sender via WebSocket
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                type: 'RTC_ANSWER',
                roomId,
                payload: {
                  targetClientId: senderId,
                  answer: optimizedAnswer,
                },
                timestamp: Date.now(),
              })
            );
          }
        } catch (err) {
          console.error('[WebRTC Master] Error processing RTC_OFFER:', err);
        }
      }

      // 2. Process RTC_ICE_CANDIDATE
      else if (data.type === 'RTC_ICE_CANDIDATE' && senderId && candidate) {
        const pc = peerConnectionsRef.current.get(senderId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[WebRTC Master] Error adding ICE candidate:', e);
          }
        } else {
          const current = pendingCandidatesRef.current.get(senderId) || [];
          current.push(candidate);
          pendingCandidatesRef.current.set(senderId, current);
        }
      }

      // 3. Process RTC_MIC_STATUS
      else if (data.type === 'RTC_MIC_STATUS' && senderId) {
        if (!isMicOn) {
          cleanupSender(senderId);
        }
      }

      // 4. Process RTC_MIC_PARAMS (Volume & Echo sync from HP client)
      else if (data.type === 'RTC_MIC_PARAMS') {
        if (typeof volume === 'number') {
          setMasterMicVolume(Math.min(150, Math.max(0, volume)));
        }
        if (typeof echo === 'number') {
          setMasterMicEcho(Math.min(100, Math.max(0, echo)));
        }
      }

      // 5. Process CLIENT_MIC_AUDIO_DATA (Real-time WebSocket audio relay)
      else if (data.type === 'CLIENT_MIC_AUDIO_DATA' && senderId && pcm) {
        playRelayAudioChunk(senderId, senderName || 'Prajurit (HP)', pcm, sampleRate || 48000, level || 0);
      }

      // 6. Process RTC_MIC_LEVEL (Live VU meter update)
      else if (data.type === 'RTC_MIC_LEVEL' && senderId) {
        setActiveMics((prev) =>
          prev.map((m) => (m.senderId === senderId ? { ...m, audioLevel: level || 0 } : m))
        );
      }

      // 7. Process MUSIC_SYNC_DELAY (Vocal sync adjustment from HP)
      else if (data.type === 'MUSIC_SYNC_DELAY') {
        const { delayMs } = data.payload || {};
        if (typeof delayMs === 'number') {
          setMusicDelayMs(delayMs, false);
        }
      }
    },
    [attachAudioStream, cleanupSender, playRelayAudioChunk, roomId, setMusicDelayMs, socketRef]
  );

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current.clear();

      audioNodesRef.current.forEach((nodes) => {
        try {
          nodes.masterGain.disconnect();
          nodes.wetGain.disconnect();
          nodes.dryGain.disconnect();
          nodes.feedbackGain.disconnect();
          nodes.echoFilter.disconnect();
          nodes.delayNode.disconnect();
          nodes.compressor.disconnect();
          nodes.highpass.disconnect();
          if (nodes.source) nodes.source.disconnect();
        } catch {}
      });
      audioNodesRef.current.clear();

      if (musicDelayNodeRef.current) {
        try {
          musicDelayNodeRef.current.disconnect();
        } catch {}
        musicDelayNodeRef.current = null;
      }
      if (musicGainNodeRef.current) {
        try {
          musicGainNodeRef.current.disconnect();
        } catch {}
        musicGainNodeRef.current = null;
      }

      audioElementsRef.current.forEach((audioEl) => {
        try {
          audioEl.pause();
          audioEl.srcObject = null;
          if (audioEl.parentNode) {
            audioEl.parentNode.removeChild(audioEl);
          }
        } catch {}
      });
      audioElementsRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    activeMics,
    masterMicVolume,
    setMasterMicVolume,
    masterMicEcho,
    setMasterMicEcho,
    isMasterMicMuted,
    setIsMasterMicMuted,
    isAudioSuspended,
    resumeAudio,
    increaseVolume,
    decreaseVolume,
    increaseEcho,
    decreaseEcho,
    setClientMicVolume,
    setClientMicEcho,
    toggleClientMicMute,
    broadcastMicParams,
    handleSignalingMessage,
    attachAudioStream,
    cleanupSender,
    musicDelayMs,
    setMusicDelayMs,
    connectMusicMediaElement,
  };
}
