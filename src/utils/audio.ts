// Synthesized offline-capable Web Audio API utilities for Emergency Siren and Fake Incoming Call Ringtone

class SafetyAudioController {
  private ctx: AudioContext | null = null;
  private sirenTimer: number | null = null;
  private ringtoneTimer: number | null = null;
  private activeOsc: OscillatorNode | null = null;
  private activeGain: GainNode | null = null;
  public isSirenPlaying = false;
  public isRingtonePlaying = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public startSiren(): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    this.stopSiren();
    this.isSirenPlaying = true;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    gain.gain.value = 0.28;
    osc.connect(gain);
    gain.connect(ctx.destination);

    let high = true;
    osc.frequency.setValueAtTime(980, ctx.currentTime);
    osc.start();

    this.activeOsc = osc;
    this.activeGain = gain;

    this.sirenTimer = window.setInterval(() => {
      if (!this.ctx || !this.activeOsc) return;
      high = !high;
      const targetFreq = high ? 1120 : 660;
      this.activeOsc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.34);
    }, 380);

    return true;
  }

  public stopSiren(): void {
    this.isSirenPlaying = false;
    if (this.sirenTimer !== null) {
      window.clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
    if (this.activeOsc) {
      try {
        this.activeOsc.stop();
        this.activeOsc.disconnect();
      } catch {
        // Ignore already stopped oscillator
      }
      this.activeOsc = null;
    }
    if (this.activeGain) {
      try {
        this.activeGain.disconnect();
      } catch {
        // Ignore
      }
      this.activeGain = null;
    }
  }

  public startRingtone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.stopRingtone();
    this.isRingtonePlaying = true;

    const playBurst = () => {
      if (!this.ctx || !this.isRingtonePlaying) return;
      const now = this.ctx.currentTime;
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o1.type = 'sine';
      o2.type = 'sine';
      o1.frequency.setValueAtTime(440, now);
      o2.frequency.setValueAtTime(480, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.16, now + 0.05);
      g.gain.setValueAtTime(0.16, now + 0.9);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      o1.connect(g);
      o2.connect(g);
      g.connect(this.ctx.destination);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 1.05);
      o2.stop(now + 1.05);
    };

    playBurst();
    this.ringtoneTimer = window.setInterval(playBurst, 2200);
  }

  public stopRingtone(): void {
    this.isRingtonePlaying = false;
    if (this.ringtoneTimer !== null) {
      window.clearInterval(this.ringtoneTimer);
      this.ringtoneTimer = null;
    }
  }
}

export const safetyAudio = new SafetyAudioController();
