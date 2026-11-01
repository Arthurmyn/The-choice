import { useCallback } from 'react';
import type { AmbientId } from '../engine/types';

export type Sfx = 'click' | 'select' | 'confirm' | 'notify' | 'transition' | 'success' | 'error' | 'type';

type CtxCtor = typeof AudioContext;

/**
 * Procedural audio: nothing is downloaded, so there are no licensing issues and
 * the game works offline. Everything degrades silently if Web Audio is missing.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private music = 0.5;
  private sfx = 0.7;
  private musicStarted = false;
  private ambientStop: (() => void) | null = null;
  private ambientKind: AmbientId = 'none';
  private noise: AudioBuffer | null = null;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: CtxCtor | undefined =
      typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext);
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.ctx.destination);
    this.sfxBus.connect(this.ctx.destination);
    this.applyVolumes();
    return this.ctx;
  }

  /** Must be called from a user gesture. */
  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.musicStarted) {
      this.musicStarted = true;
      this.startMusic(ctx);
      if (this.ambientKind !== 'none') this.setAmbient(this.ambientKind);
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.music = music;
    this.sfx = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.music * 0.16, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfx * 0.6, t, 0.05);
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown noise
      data[i] = last * 3.5;
    }
    this.noise = buf;
    return buf;
  }

  private startMusic(ctx: AudioContext): void {
    if (!this.musicBus) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.connect(this.musicBus);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    // A minor add9 pad, slightly detuned for width.
    [110, 164.81, 220, 246.94, 329.63].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      osc.detune.value = (i - 2) * 4;
      g.gain.value = 0.22 / (1 + i * 0.3);
      osc.connect(g).connect(filter);
      osc.start();
    });
  }

  setAmbient(kind: AmbientId): void {
    this.ambientKind = kind;
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    this.ambientStop?.();
    this.ambientStop = null;
    if (kind === 'none') return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const settings: Record<Exclude<AmbientId, 'none'>, [BiquadFilterType, number, number]> = {
      office: ['lowpass', 380, 0.5],
      room: ['bandpass', 520, 0.35],
      city: ['lowpass', 240, 0.7],
      digital: ['lowpass', 160, 0.3],
    };
    const [type, freq, level] = settings[kind];
    filter.type = type;
    filter.frequency.value = freq;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(level * 0.35, ctx.currentTime, 0.8);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start();

    // Sparse keyboard ticks / distant sounds for office and digital moods.
    const timer =
      kind === 'office' || kind === 'digital'
        ? window.setInterval(() => {
            if (Math.random() < 0.55) this.tick(0.015 + Math.random() * 0.015);
          }, 650)
        : null;

    this.ambientStop = () => {
      if (timer) window.clearInterval(timer);
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }, 800);
    };
  }

  private tick(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const o = ctx.createBufferSource();
    o.buffer = this.noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2200;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t, Math.random(), 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, level: number, delay = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.sfx === 0) return;
    switch (name) {
      case 'click':
        this.tone(1250, 0.05, 'sine', 0.12);
        break;
      case 'select':
        this.tone(660, 0.09, 'triangle', 0.18);
        this.tone(990, 0.09, 'triangle', 0.12, 0.05);
        break;
      case 'confirm':
        this.tone(220, 0.5, 'sine', 0.3, 0, 110);
        this.tone(440, 0.35, 'triangle', 0.14, 0.08);
        this.tone(660, 0.35, 'sine', 0.1, 0.16);
        break;
      case 'notify':
        this.tone(880, 0.12, 'sine', 0.2);
        this.tone(1320, 0.2, 'sine', 0.16, 0.12);
        break;
      case 'transition':
        this.tone(140, 0.6, 'sawtooth', 0.04, 0, 70);
        break;
      case 'success':
        this.tone(523, 0.15, 'triangle', 0.18);
        this.tone(784, 0.25, 'triangle', 0.16, 0.12);
        break;
      case 'error':
        this.tone(180, 0.2, 'square', 0.07, 0, 120);
        break;
      case 'type':
        this.tick(0.02);
        break;
    }
  }
}

export const audio = new AudioEngine();

export function useAudio(): { play: (name: Sfx) => void; setAmbient: (kind: AmbientId) => void } {
  const play = useCallback((name: Sfx) => audio.play(name), []);
  const setAmbient = useCallback((kind: AmbientId) => audio.setAmbient(kind), []);
  return { play, setAmbient };
}
