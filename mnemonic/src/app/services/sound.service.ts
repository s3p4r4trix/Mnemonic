import { DestroyRef, inject, Injectable, signal } from "@angular/core";

const MUTE_STORAGE_KEY = "mnemonic:muted";

// C-major pentatonic scale semitone offsets: C, D, E, G, A
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9] as const;
const C4_FREQUENCY_HZ = 261.6256;
const MAX_STEP_INDEX = 14; // 3 full octaves (C4..A6)

export function pentatonicFrequency(stepIndex: number): number {
  const safeIndex = Number.isFinite(stepIndex) ? Math.floor(stepIndex) : 0;
  const clamped = Math.max(0, Math.min(safeIndex, MAX_STEP_INDEX));
  const octave = Math.floor(clamped / PENTATONIC_SEMITONES.length);
  const degree = clamped % PENTATONIC_SEMITONES.length;
  const semitones = octave * 12 + PENTATONIC_SEMITONES[degree];
  return C4_FREQUENCY_HZ * Math.pow(2, semitones / 12);
}

@Injectable({
  providedIn: "root",
})
export class SoundService {
  readonly #destroyRef = inject(DestroyRef);
  readonly #muted = signal<boolean>(this.#loadMuted());
  readonly muted = this.#muted.asReadonly();

  #audioContext: AudioContext | null = null;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      if (this.#audioContext && this.#audioContext.state !== "closed") {
        void this.#audioContext.close().catch(() => undefined);
      }
      this.#audioContext = null;
    });
  }

  toggleMute(): void {
    this.setMuted(!this.#muted());
  }

  setMuted(muted: boolean): void {
    this.#muted.set(muted);
    this.#saveMuted(muted);
    if (muted && this.#audioContext && this.#audioContext.state === "running") {
      void this.#audioContext.suspend().catch(() => undefined);
    } else if (!muted && this.#audioContext && this.#audioContext.state === "suspended") {
      void this.#audioContext.resume().catch(() => undefined);
    }
  }

  playStepTone(stepIndex: number, variant: "sequence" | "input" = "sequence"): void {
    const ctx = this.#getPlayableContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freq = pentatonicFrequency(stepIndex);
    const duration = variant === "sequence" ? 0.24 : 0.16;
    const peakGain = variant === "sequence" ? 0.16 : 0.13;
    const wave: OscillatorType = variant === "sequence" ? "sine" : "triangle";

    this.#scheduleTone(ctx, freq, now, duration, peakGain, wave);
  }

  playRoundCleared(streak: number): void {
    const ctx = this.#getPlayableContext();
    if (!ctx) return;

    // Slight offset so the final input tap resolves cleanly into the chord
    const baseTime = ctx.currentTime + 0.09;
    // C5, E5, G5 (plus C6 sparkle on streak >= 2)
    const notes = streak >= 2 ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      this.#scheduleTone(ctx, freq, baseTime + idx * 0.065, 0.22, 0.13, "triangle");
    });
  }

  playGameOver(): void {
    const ctx = this.#getPlayableContext();
    if (!ctx) return;

    const baseTime = ctx.currentTime + 0.09;
    // Gentle descending minor third: E4 -> C#4
    this.#scheduleTone(ctx, 329.63, baseTime, 0.2, 0.14, "sine");
    this.#scheduleTone(ctx, 277.18, baseTime + 0.16, 0.32, 0.14, "sine");
  }

  #scheduleTone(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  #getPlayableContext(): AudioContext | null {
    if (this.#muted()) return null;
    if (typeof window === "undefined") return null;

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.#audioContext || this.#audioContext.state === "closed") {
      try {
        this.#audioContext = new AudioCtx();
      } catch {
        return null;
      }
    }

    if (this.#audioContext.state === "suspended") {
      void this.#audioContext.resume().catch(() => undefined);
    }

    return this.#audioContext;
  }

  #loadMuted(): boolean {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(MUTE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  #saveMuted(muted: boolean): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
      }
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
}
