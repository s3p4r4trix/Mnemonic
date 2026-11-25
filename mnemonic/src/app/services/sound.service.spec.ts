import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { pentatonicFrequency, SoundService } from "./sound.service";

describe("SoundService", () => {
  beforeEach(() => {
    localStorage.removeItem("mnemonic:muted");
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), SoundService],
    });
  });

  afterEach(() => {
    localStorage.removeItem("mnemonic:muted");
  });

  it("should compute strictly ascending C-major pentatonic frequencies across octaves", () => {
    const c4 = pentatonicFrequency(0);
    const d4 = pentatonicFrequency(1);
    const e4 = pentatonicFrequency(2);
    const g4 = pentatonicFrequency(3);
    const a4 = pentatonicFrequency(4);
    const c5 = pentatonicFrequency(5);

    expect(c4).toBeCloseTo(261.63, 1);
    expect(d4).toBeGreaterThan(c4);
    expect(e4).toBeGreaterThan(d4);
    expect(g4).toBeGreaterThan(e4);
    expect(a4).toBeGreaterThan(g4);
    expect(c5).toBeCloseTo(c4 * 2, 1);
  });

  it("should clamp negative, non-finite, and very high step indices safely", () => {
    expect(pentatonicFrequency(-3)).toBeCloseTo(pentatonicFrequency(0), 2);
    expect(pentatonicFrequency(Number.NaN)).toBeCloseTo(pentatonicFrequency(0), 2);
    expect(pentatonicFrequency(Number.POSITIVE_INFINITY)).toBeCloseTo(pentatonicFrequency(0), 2);
    expect(pentatonicFrequency(99)).toBeCloseTo(pentatonicFrequency(14), 2);
  });

  it("should default to unmuted and persist mute toggles in localStorage", () => {
    const service = TestBed.inject(SoundService);
    expect(service.muted()).toBe(false);

    service.toggleMute();
    expect(service.muted()).toBe(true);
    expect(localStorage.getItem("mnemonic:muted")).toBe("true");

    service.toggleMute();
    expect(service.muted()).toBe(false);
    expect(localStorage.getItem("mnemonic:muted")).toBe("false");
  });

  it("should restore muted state from localStorage on initialization", () => {
    localStorage.setItem("mnemonic:muted", "true");
    const service = TestBed.inject(SoundService);
    expect(service.muted()).toBe(true);
  });

  it("should not throw when playing tones while muted or unmuted", () => {
    const service = TestBed.inject(SoundService);
    expect(() => service.playStepTone(0, "sequence")).not.toThrow();
    expect(() => service.playStepTone(2, "input")).not.toThrow();
    expect(() => service.playRoundCleared(2)).not.toThrow();
    expect(() => service.playGameOver()).not.toThrow();

    service.setMuted(true);
    expect(() => service.playStepTone(0, "sequence")).not.toThrow();
    expect(() => service.playRoundCleared(1)).not.toThrow();
    expect(() => service.playGameOver()).not.toThrow();
  });
});
