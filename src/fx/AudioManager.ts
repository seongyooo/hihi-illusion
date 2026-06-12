// Procedural audio via Web Audio API — no external dependencies.
// AudioContext is created lazily on first call (satisfies browser autoplay policy).

export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmStarted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    type: OscillatorType,
    volume: number,
    attack: number,
    decay: number,
    delay = 0
  ): void {
    const ctx = this.getCtx();
    const t   = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    osc.start(t);
    osc.stop(t + attack + decay);
  }

  // Soft UI button click
  playClick(): void {
    const ctx = this.getCtx();
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.06);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Soft tap with slight pitch variation — fires on each individual step
  playStep(): void {
    const ctx = this.getCtx();
    const t   = ctx.currentTime;
    const variation = 0.88 + Math.random() * 0.26; // 0.88~1.14x pitch range
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500 * variation, t);
    osc.frequency.exponentialRampToValueAtTime(250 * variation, t + 0.1);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  // Ascending C-major arpeggio — illusion connection opens
  playIllusionActivate(): void {
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((freq, i) => {
      this.tone(freq, 'triangle', 0.18, 0.02, 0.45, i * 0.1);
    });
  }

  // Ascending C-major chord strum — goal reached
  playGoalReached(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      this.tone(freq, 'triangle', 0.20, 0.02, 1.2, i * 0.06);
    });
  }

  // Sparkling two-note chime — star collected
  playStarCollect(): void {
    this.tone(880,    'sine',     0.14, 0.01, 0.22, 0.00); // A5
    this.tone(1318.5, 'triangle', 0.10, 0.01, 0.30, 0.07); // E6
    this.tone(1760,   'sine',     0.08, 0.01, 0.40, 0.14); // A6
  }

  // Swoosh + arrival ping — teleport
  playTeleport(): void {
    this.tone(880, 'sine',     0.12, 0.01, 0.18, 0.00);
    this.tone(440, 'sine',     0.08, 0.01, 0.12, 0.05);
    this.tone(660, 'triangle', 0.16, 0.02, 0.32, 0.12);
  }

  /** 첫 인터랙션 시 BGM 시작 (브라우저 자동재생 정책 대응) */
  ensureBgm(): void {
    if (this.bgmStarted) return;
    this.bgmStarted = true;
    this.bgmAudio = new Audio('/backgroud_music.mp3');
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.5;
    this.bgmAudio.play().catch(() => {});
  }

  stopBgm(): void {
    if (!this.bgmAudio) return;
    this.bgmAudio.pause();
    this.bgmAudio.currentTime = 0;
    this.bgmAudio = null;
    this.bgmStarted = false;
  }

}
