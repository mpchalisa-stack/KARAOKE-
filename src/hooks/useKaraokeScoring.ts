import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, SongScoreData, QueueItem } from '../types/karaoke';

export interface UseKaraokeScoringOptions {
  currentSong: Song | null;
  singerName: string;
  isPlaying: boolean;
  micStream: MediaStream | null;
  musicMediaElement: HTMLMediaElement | null;
  triggerSoundFx: (type: string) => void;
  nextItem?: QueueItem;
}

export interface LiveScoringState {
  liveScore: number; // 0 - 100
  micLevel: number; // 0 - 100
  musicLevel: number; // 0 - 100
  statusFeedback: 'PERFECT' | 'GREAT' | 'STABLE' | 'TOO_QUIET' | 'IDLE';
  streak: number;
  totalSamples: number;
  vocalHits: number;
}

// Military Rank Titles for high scores
const MILITARY_TITLES_HIGH = [
  '🎖️ JENDERAL PADUAN SUARA TNI AU',
  '🚀 PENEMBAK JITU NADA TINGGI',
  '🛡️ KOMANDAN VOKAL BERDAYA TEMPUR TINGGI',
  '⚡ KOPRAL FALSETTO STRATEGIS',
  '🌟 BINTANG EMAS SUBDIS RUDAL DISKOMLEKAU',
];

// Military Titles for low scores (< 60)
const MILITARY_TITLES_LOW = [
  '🔥 PRAJURIT PANTANG MUNDUR (SUARA HANCUR TETAP TEMPUR!)',
  '🚨 RADAR PERTAHANAN RUSAK (FALSETTO MELENCENG)',
  '💥 KORBAN BOM VOKAL (PERLU DIKLAT DARURAT)',
  '🌪️ BADAI NOISE TAK TERKENDALI',
  '🛑 TENTARA PATAH NADA (WAJIB REMEDIAL OLAH VOKAL)',
];

const MILITARY_COMMENTARIES_HIGH = [
  'Daya ledak vokal setara rudal jelajah udara! Seluruh jajaran Diskomlekau berdiri memberikan tepuk tangan komando!',
  'Pitch vokal terkalibrasi akurat bagaikan radar sasaran udara! Lanjutkan ke pertempuran lagu berikutnya!',
  'Vokal berwibawa dan penuh jiwa korsa! Siap tampil di panggung upacara kehormatan TNI AU!',
  'Artikulasi tegas, power vokal stabil dari bait pertama hingga klimaks! Rekomendasi bintang 5 Subdis Rudal!',
  'Harmoni vokal tembus sasaran dengan akurasi 100%! Lagu ditaklukkan dengan sempurna!',
];

const MILITARY_COMMENTARIES_LOW = [
  'Alarm bahaya berbunyi! Suara prajurit meleset jauh dari frekuensi pandu! Wajib push-up 50x dan latihan nafas di barak!',
  'Terlalu banyak senyap di tengah pertempuran lagu! Suara vokal bagaikan amunisi hampa, lawan tidak gentar!',
  'Suara hancur lebur bagai terkena ranjau! Tapi semangat tempur tetap diapresiasi oleh komandan batalyon!',
  'Desibel vokal terlalu rendah atau pitch lari ke hutan! Segera perbaiki laras vokal Anda!',
  'Dewan juri menutup telinga demi keselamatan pendengaran! Ayo coba lagi dengan tenaga penuh!',
];

export function useKaraokeScoring({
  currentSong,
  singerName,
  isPlaying,
  micStream,
  musicMediaElement,
  triggerSoundFx,
  nextItem,
}: UseKaraokeScoringOptions) {
  const [liveState, setLiveState] = useState<LiveScoringState>({
    liveScore: 75,
    micLevel: 0,
    musicLevel: 0,
    statusFeedback: 'IDLE',
    streak: 0,
    totalSamples: 0,
    vocalHits: 0,
  });

  const [isScoringActive, setIsScoringActive] = useState<boolean>(false);

  // Web Audio Context & Analyser nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const musicAnalyserRef = useRef<AnalyserNode | null>(null);

  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const syntheticMusicOscRef = useRef<OscillatorNode | null>(null);
  const syntheticMusicGainRef = useRef<GainNode | null>(null);

  // WeakSet to avoid "createMediaElementSource can only be called once" errors
  const connectedMediaElements = useRef<WeakSet<HTMLMediaElement>>(new WeakSet());

  // RAF sampling loop timer references
  const animFrameRef = useRef<number | null>(null);
  const lastSampleTimeRef = useRef<number>(0);

  // Scoring metrics accumulation
  const metricsRef = useRef({
    accumulatedScore: 70, // baseline starting score
    totalSamples: 0,
    vocalHits: 0,
    silentMisses: 0,
    streak: 0,
    maxStreak: 0,
    vocalPowerSum: 0,
    stabilitySum: 0,
    prevMicEnergy: 0,
  });

  // Get or initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx({ latencyHint: 'interactive' });
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Initialize two AnalyserNodes: One for mic, One for music/video source
  const setupAudioGraph = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // 1. Microphone AnalyserNode
    if (!micAnalyserRef.current) {
      const micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 256; // 128 frequency bins
      micAnalyser.smoothingTimeConstant = 0.4;
      micAnalyserRef.current = micAnalyser;
    }

    // 2. Music / Video Source AnalyserNode
    if (!musicAnalyserRef.current) {
      const musicAnalyser = ctx.createAnalyser();
      musicAnalyser.fftSize = 256;
      musicAnalyser.smoothingTimeConstant = 0.4;
      musicAnalyserRef.current = musicAnalyser;

      // Provide synthetic rhythmic accompaniment generator connected to music analyser
      // Ensures music frequency/amplitude data is active even if video is in YouTube iframe
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, ctx.currentTime); // A2 baseline bass
        gain.gain.setValueAtTime(0.001, ctx.currentTime); // Inaudible reference carrier for analyser
        osc.connect(gain);
        gain.connect(musicAnalyser);
        osc.start();
        syntheticMusicOscRef.current = osc;
        syntheticMusicGainRef.current = gain;
      } catch {}
    }
  }, [getAudioContext]);

  // Connect WebRTC Microphone stream to micAnalyser
  useEffect(() => {
    const ctx = getAudioContext();
    if (!ctx || !micAnalyserRef.current) return;

    if (micStream && micStream.getAudioTracks().length > 0) {
      try {
        // Disconnect old source if any
        if (micSourceRef.current) {
          try {
            micSourceRef.current.disconnect();
          } catch {}
          micSourceRef.current = null;
        }

        const source = ctx.createMediaStreamSource(micStream);
        source.connect(micAnalyserRef.current);
        micSourceRef.current = source;
      } catch (err) {
        console.warn('[Scoring Engine] Failed to connect mic stream to analyser:', err);
      }
    } else {
      if (micSourceRef.current) {
        try {
          micSourceRef.current.disconnect();
        } catch {}
        micSourceRef.current = null;
      }
    }
  }, [micStream, getAudioContext]);

  // Connect HTMLMediaElement to musicAnalyser
  useEffect(() => {
    const ctx = getAudioContext();
    if (!ctx || !musicAnalyserRef.current || !musicMediaElement) return;

    if (!connectedMediaElements.current.has(musicMediaElement)) {
      try {
        const source = ctx.createMediaElementSource(musicMediaElement);
        source.connect(musicAnalyserRef.current);
        // Also connect to destination so media element can be heard if played
        source.connect(ctx.destination);
        musicSourceRef.current = source;
        connectedMediaElements.current.add(musicMediaElement);
      } catch (err) {
        console.warn('[Scoring Engine] Failed to connect HTMLMediaElement:', err);
      }
    }
  }, [musicMediaElement, getAudioContext]);

  // Reset metrics when a new song starts
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      accumulatedScore: 75,
      totalSamples: 0,
      vocalHits: 0,
      silentMisses: 0,
      streak: 0,
      maxStreak: 0,
      vocalPowerSum: 0,
      stabilitySum: 0,
      prevMicEnergy: 0,
    };
    setLiveState({
      liveScore: 75,
      micLevel: 0,
      musicLevel: 0,
      statusFeedback: 'IDLE',
      streak: 0,
      totalSamples: 0,
      vocalHits: 0,
    });
  }, []);

  // Sample and calculate score comparison (runs every 500ms during playback)
  const sampleAndCalculate = useCallback(() => {
    const micAnalyser = micAnalyserRef.current;
    const musicAnalyser = musicAnalyserRef.current;
    if (!micAnalyser || !musicAnalyser) return;

    // 1. Capture Mic Frequency & Time Domain Data
    const micFreq = new Uint8Array(micAnalyser.frequencyBinCount);
    micAnalyser.getByteFrequencyData(micFreq);

    // 2. Capture Music Frequency & Time Domain Data
    const musicFreq = new Uint8Array(musicAnalyser.frequencyBinCount);
    musicAnalyser.getByteFrequencyData(musicFreq);

    // 3. Compute Vocal Energy Band (approx 80Hz - 2500Hz: bins 1 to 20)
    let micVocalSum = 0;
    for (let i = 1; i < 20; i++) {
      micVocalSum += micFreq[i];
    }
    const micVocalEnergy = Math.min(100, Math.round((micVocalSum / (19 * 255)) * 100));

    // 4. Compute Music Energy
    let musicSum = 0;
    for (let i = 1; i < 25; i++) {
      musicSum += musicFreq[i];
    }
    let musicEnergy = Math.min(100, Math.round((musicSum / (24 * 255)) * 100));

    // Fallback if music element is quiet or YouTube is iframe: simulate dynamic music rhythm
    if (musicEnergy < 15 && isPlaying) {
      musicEnergy = 35 + Math.round(Math.sin(Date.now() / 600) * 20);
    }

    const metrics = metricsRef.current;
    metrics.totalSamples += 1;

    // Check stability (variance from previous sample)
    const energyDiff = Math.abs(micVocalEnergy - metrics.prevMicEnergy);
    const isStableVocal = micVocalEnergy >= 16 && energyDiff <= 28;
    metrics.prevMicEnergy = micVocalEnergy;

    let feedback: LiveScoringState['statusFeedback'] = 'IDLE';

    // Calculation Logic:
    // When music is in active/vocal phase (musicEnergy >= 18):
    if (musicEnergy >= 18) {
      if (micVocalEnergy >= 18) {
        // Singer is singing actively
        metrics.vocalHits += 1;
        metrics.streak += 1;
        if (metrics.streak > metrics.maxStreak) {
          metrics.maxStreak = metrics.streak;
        }

        // Stability point bonus
        const stabilityBonus = isStableVocal ? 1.8 : 0.8;
        metrics.accumulatedScore = Math.min(100, metrics.accumulatedScore + stabilityBonus);
        metrics.vocalPowerSum += micVocalEnergy;
        metrics.stabilitySum += isStableVocal ? 90 : 65;

        if (metrics.streak >= 4 && isStableVocal) {
          feedback = 'PERFECT';
        } else if (isStableVocal) {
          feedback = 'STABLE';
        } else {
          feedback = 'GREAT';
        }
      } else if (micVocalEnergy < 10) {
        // Singer is silent while music is active: deduct points
        metrics.silentMisses += 1;
        metrics.streak = 0;
        metrics.accumulatedScore = Math.max(15, metrics.accumulatedScore - 1.2);
        feedback = 'TOO_QUIET';
      } else {
        feedback = 'IDLE';
      }
    } else {
      // Intro or quiet bridge: singer maintaining breath
      if (micVocalEnergy >= 20) {
        metrics.accumulatedScore = Math.min(100, metrics.accumulatedScore + 0.5);
        feedback = 'GREAT';
      } else {
        feedback = 'IDLE';
      }
    }

    const currentLiveScore = Math.round(metrics.accumulatedScore);

    setLiveState({
      liveScore: currentLiveScore,
      micLevel: micVocalEnergy,
      musicLevel: musicEnergy,
      statusFeedback: feedback,
      streak: metrics.streak,
      totalSamples: metrics.totalSamples,
      vocalHits: metrics.vocalHits,
    });
  }, [isPlaying]);

  // RequestAnimationFrame 500ms sampling loop
  useEffect(() => {
    if (!isPlaying || !isScoringActive) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    setupAudioGraph();

    const loop = (timestamp: number) => {
      if (timestamp - lastSampleTimeRef.current >= 500) {
        lastSampleTimeRef.current = timestamp;
        sampleAndCalculate();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, isScoringActive, setupAudioGraph, sampleAndCalculate]);

  // Start scoring session
  const startScoring = useCallback(() => {
    setupAudioGraph();
    resetMetrics();
    setIsScoringActive(true);
  }, [setupAudioGraph, resetMetrics]);

  // Stop scoring and compute Final Score with 10-15% arcade random modifier & audio triggers
  const stopScoringAndGetResult = useCallback((): SongScoreData | null => {
    if (!currentSong) return null;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsScoringActive(false);

    const metrics = metricsRef.current;
    const baseScore = metrics.totalSamples > 0 ? metrics.accumulatedScore : 78;

    // Arcade Random Modifier: 10% - 15% dynamic variance (between -12% to +12%)
    // Makes the final score feel dynamic like an authentic arcade karaoke machine
    const randomVariation = (Math.random() * 0.24 - 0.12); // approx +/- 12%
    let finalScore = Math.round(baseScore * (1 + randomVariation));
    // Clamp strictly within 0 - 100
    finalScore = Math.max(0, Math.min(100, finalScore));

    // Determine Grade
    let grade: 'SS' | 'S' | 'A' | 'B' | 'C' = 'A';
    if (finalScore >= 95) grade = 'SS';
    else if (finalScore >= 88) grade = 'S';
    else if (finalScore >= 80) grade = 'A';
    else if (finalScore >= 65) grade = 'B';
    else grade = 'C';

    // Determine Rank Title & Commentary based on whether score is high or low
    let rankTitle = '';
    let commentary = '';
    if (finalScore >= 80) {
      rankTitle = MILITARY_TITLES_HIGH[Math.floor(Math.random() * MILITARY_TITLES_HIGH.length)];
      commentary = MILITARY_COMMENTARIES_HIGH[Math.floor(Math.random() * MILITARY_COMMENTARIES_HIGH.length)];
    } else {
      rankTitle = MILITARY_TITLES_LOW[Math.floor(Math.random() * MILITARY_TITLES_LOW.length)];
      commentary = MILITARY_COMMENTARIES_LOW[Math.floor(Math.random() * MILITARY_COMMENTARIES_LOW.length)];
    }

    // Auto-play soundboard effects according to the user specification:
    // > 80 = applause (or cheer if >= 90)
    // < 60 = boo ('Huuu')
    if (finalScore > 80) {
      triggerSoundFx(finalScore >= 90 ? 'cheer' : 'applause');
    } else if (finalScore < 60) {
      triggerSoundFx('boo');
    } else {
      // 60 - 80: neutral drum/applause
      triggerSoundFx('applause');
    }

    const pitchAccuracy = Math.min(100, Math.max(20, Math.round(finalScore + (Math.random() * 6 - 3))));
    const vocalPower = Math.min(100, Math.max(20, Math.round(finalScore + (Math.random() * 8 - 4))));
    const stagePresence = Math.min(100, Math.max(20, Math.round(finalScore + (Math.random() * 6 - 3))));
    const combatSpirit = finalScore >= 60 ? Math.min(100, Math.floor(92 + Math.random() * 8)) : Math.floor(70 + Math.random() * 15);

    return {
      song: currentSong,
      singerName: singerName || 'Prajurit (HP)',
      totalScore: finalScore,
      grade,
      rankTitle,
      commentary,
      pitchAccuracy,
      vocalPower,
      stagePresence,
      combatSpirit,
      nextSong: nextItem?.song,
      nextSingerName: nextItem?.singerName,
      evaluatedAt: Date.now(),
    };
  }, [currentSong, singerName, nextItem, triggerSoundFx]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (syntheticMusicOscRef.current) {
        try {
          syntheticMusicOscRef.current.stop();
        } catch {}
      }
      if (syntheticMusicGainRef.current) {
        try {
          syntheticMusicGainRef.current.disconnect();
        } catch {}
      }
    };
  }, []);

  return {
    liveState,
    isScoringActive,
    startScoring,
    stopScoringAndGetResult,
    resetMetrics,
  };
}
