// 100% Procedural Web Audio API Restaurant Soundscape & Event SFX Engine
// Zero external MP3/WAV dependencies

class RestaurantSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private sizzleSource: AudioBufferSourceNode | null = null;
  private enabled = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? 0.5 : 0;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(next: boolean): boolean {
    this.enabled = next;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return false;

    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(next ? 0.55 : 0, now, 0.08);

    if (next) {
      this.startAmbientLoop();
      this.playStaffAck();
    } else {
      this.stopAmbientLoop();
    }
    return this.enabled;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Pink/brownish warmth for gentle restaurant room murmur
      data[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = data[i];
      data[i] *= 2.4;
    }
    return buffer;
  }

  private startAmbientLoop() {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.ambientSource) return;

    const noiseBuffer = this.createNoiseBuffer(ctx, 4);

    // 1. Cozy restaurant dining room murmur
    const roomSrc = ctx.createBufferSource();
    roomSrc.buffer = noiseBuffer;
    roomSrc.loop = true;

    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'bandpass';
    roomFilter.frequency.value = 420;
    roomFilter.Q.value = 0.7;

    const ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.16;

    roomSrc.connect(roomFilter);
    roomFilter.connect(ambientGain);
    ambientGain.connect(this.masterGain);
    roomSrc.start();

    this.ambientSource = roomSrc;
    this.ambientGain = ambientGain;

    // 2. Subtle distant kitchen frying / boiling sizzle
    const sizzleSrc = ctx.createBufferSource();
    sizzleSrc.buffer = noiseBuffer;
    sizzleSrc.loop = true;

    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'highpass';
    sizzleFilter.frequency.value = 2600;

    const sizzleGain = ctx.createGain();
    sizzleGain.gain.value = 0.035;

    sizzleSrc.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    sizzleGain.connect(this.masterGain);
    sizzleSrc.start();

    this.sizzleSource = sizzleSrc;
  }

  private stopAmbientLoop() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch {
        // ignore if already stopped
      }
      this.ambientSource = null;
    }
    if (this.sizzleSource) {
      try {
        this.sizzleSource.stop();
        this.sizzleSource.disconnect();
      } catch {
        // ignore
      }
      this.sizzleSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  // Pleasant cafe entrance bell ("Ding-Dong") when visitor walks in
  public playDoorChime() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 880, start: 0, dur: 0.35 },
      { freq: 659.25, start: 0.16, dur: 0.5 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.14, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  }

  // Crisp POS cash register chime when Sinta takes an order
  public playCashierBeep() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const freqs = [1174.66, 1567.98];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.08 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.18);
    });
  }

  // Warm wok sizzle burst when Chef Dimas tosses Hot Maks
  public playKitchenSizzle() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.45), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.18));
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3400;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
  }

  // Kitchen service pass bell ("Ting!") when Bima picks up or serves a dish
  public playServeBell() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  // Soft confirmation tone when clicking or commanding an AI staff member
  public playStaffAck() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public dispose() {
    this.stopAmbientLoop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
  }
}

export const restaurantSound = new RestaurantSoundEngine();
