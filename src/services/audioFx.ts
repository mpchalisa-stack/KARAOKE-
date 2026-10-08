/**
 * Synthesized Karaoke Sound Effects using Web Audio API
 * No external audio files or network requests needed!
 */

class AudioFxEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // 👏 Crowd Applause
  playApplause(durationSeconds: number = 3.5) {
    try {
      const ctx = this.getContext();
      const bufferSize = ctx.sampleRate * durationSeconds;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate pink/white noise with random burst claps
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // occasional spikes simulate individual clapping hands
        const spike = Math.random() > 0.985 ? (Math.random() * 2 - 1) * 3 : 0;
        data[i] = (white * 0.4 + spike) * 0.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.Q.setValueAtTime(1.5, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.7, ctx.currentTime + durationSeconds - 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationSeconds);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + durationSeconds);
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // 📢 Reggae / DJ Airhorn
  playAirhorn() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // Classic dancehall airhorn chords / rhythmic beeps
      const pitches = [466.16, 554.37, 622.25]; // Bb4, Db5, Eb5 chord
      const bursts = [
        { start: 0, dur: 0.15 },
        { start: 0.18, dur: 0.15 },
        { start: 0.36, dur: 0.18 },
        { start: 0.58, dur: 0.45 },
      ];

      bursts.forEach(({ start, dur }) => {
        pitches.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + start);
          // slight pitch slide down like real horn
          osc.frequency.exponentialRampToValueAtTime(freq * 0.93, now + start + dur);

          gain.gain.setValueAtTime(0.12, now + start);
          gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + start);
          osc.stop(now + start + dur);
        });
      });
    } catch (e) {
      console.warn('Airhorn error:', e);
    }
  }

  // 🎉 Crowd Cheers & Whistle
  playCheer() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Noise cheer
      this.playApplause(3.0);

      // Play joyful whistle slides
      [now + 0.1, now + 0.6, now + 1.2].forEach((startTime, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const startPitch = 1200 + idx * 200;
        osc.frequency.setValueAtTime(startPitch, startTime);
        osc.frequency.exponentialRampToValueAtTime(startPitch * 1.8, startTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(startPitch * 1.3, startTime + 0.6);

        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch (e) {
      console.warn('Cheer error:', e);
    }
  }

  // 🔔 Bell / Ding (Order / Next Singer Call)
  playDing() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now); // A6
      osc.frequency.setValueAtTime(2093, now + 0.08); // C7

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } catch (e) {
      console.warn('Ding error:', e);
    }
  }

  // 🥁 Drum Roll / Rimshot
  playRimshot() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Two quick drum hits + cymbal crash
      [0, 0.15].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now + t);
        osc.frequency.exponentialRampToValueAtTime(60, now + t + 0.08);

        gain.gain.setValueAtTime(0.4, now + t);
        gain.gain.exponentialRampToValueAtTime(0.01, now + t + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.09);
      });

      // Cymbal crash
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4500, now + 0.32);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now + 0.32);
      noise.stop(now + 1.1);
    } catch (e) {
      console.warn('Rimshot error:', e);
    }
  }

  // 👎 Playful Crowd Booing / Huuu
  playBoo(durationSeconds: number = 2.8) {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Low formant pitches simulating crowd saying "Huuu..."
      const pitches = [196, 220, 246, 261]; // G3, A3, B3, C4
      pitches.forEach((baseFreq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        // Pitch slides downwards: typical "Huuu..." contour
        const startFreq = baseFreq + (idx % 2 === 0 ? 10 : -10);
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.linearRampToValueAtTime(startFreq * 1.05, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 0.72, now + durationSeconds);

        // Vocal "u" vowel formant filter (low-pass + resonance)
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(550, now);
        filter.frequency.exponentialRampToValueAtTime(380, now + durationSeconds);
        filter.Q.setValueAtTime(4.0, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.25);
        gain.gain.setValueAtTime(0.18, now + durationSeconds - 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + durationSeconds);
      });

      // Background crowd murmur noise
      const bufferSize = Math.floor(ctx.sampleRate * durationSeconds);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(420, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(320, now + durationSeconds);
      noiseFilter.Q.setValueAtTime(2.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.01, now);
      noiseGain.gain.linearRampToValueAtTime(0.2, now + 0.3);
      noiseGain.gain.setValueAtTime(0.2, now + durationSeconds - 0.6);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + durationSeconds);
    } catch (e) {
      console.warn('Boo audio error:', e);
    }
  }

  // 😂 Chuckle / Crowd Laughter
  playLaugh() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // Staccato laughing bursts "Ha ha ha ha ha"
      const bursts = [0, 0.16, 0.32, 0.48, 0.64, 0.82];
      bursts.forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        const pitch = 330 - i * 15 + Math.random() * 20;
        osc.frequency.setValueAtTime(pitch * 1.2, now + t);
        osc.frequency.exponentialRampToValueAtTime(pitch, now + t + 0.12);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now + t);
        filter.Q.setValueAtTime(3.0, now + t);

        gain.gain.setValueAtTime(0.01, now + t);
        gain.gain.linearRampToValueAtTime(0.25, now + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.13);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + t);
        osc.stop(now + t + 0.14);
      });
    } catch (e) {
      console.warn('Laugh error:', e);
    }
  }
}

export const audioFx = new AudioFxEngine();

