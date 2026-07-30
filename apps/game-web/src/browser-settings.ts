import { useSyncExternalStore } from "react";

const SETTINGS_KEY = "grail-conquest:browser-settings:v1";

export interface BrowserSettings {
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly fontScale: 0.9 | 1 | 1.15 | 1.3;
  readonly muted: boolean;
  readonly masterVolume: number;
}

const DEFAULT_SETTINGS: BrowserSettings = {
  reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  highContrast: false,
  fontScale: 1,
  muted: true,
  masterVolume: 0.45,
};

let settings = loadSettings();
const listeners = new Set<() => void>();
applySettings(settings);

export function getBrowserSettings(): BrowserSettings {
  return settings;
}

export function subscribeBrowserSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBrowserSettings(): BrowserSettings {
  return useSyncExternalStore(
    subscribeBrowserSettings,
    getBrowserSettings,
    getBrowserSettings,
  );
}

export function updateBrowserSettings(patch: Partial<BrowserSettings>): BrowserSettings {
  settings = {
    ...settings,
    ...patch,
    masterVolume: clamp(patch.masterVolume ?? settings.masterVolume, 0, 1),
  };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings(settings);
  for (const listener of listeners) listener();
  return settings;
}

export function motionDuration(duration: number): number {
  return settings.reducedMotion ? 0 : duration;
}

function loadSettings(): BrowserSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const value = JSON.parse(raw) as Partial<BrowserSettings>;
    const fontScale = [0.9, 1, 1.15, 1.3].includes(Number(value.fontScale))
      ? Number(value.fontScale) as BrowserSettings["fontScale"]
      : DEFAULT_SETTINGS.fontScale;
    return {
      reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
      highContrast: typeof value.highContrast === "boolean" ? value.highContrast : false,
      fontScale,
      muted: typeof value.muted === "boolean" ? value.muted : true,
      masterVolume: typeof value.masterVolume === "number" ? clamp(value.masterVolume, 0, 1) : DEFAULT_SETTINGS.masterVolume,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applySettings(value: BrowserSettings): void {
  const root = document.documentElement;
  root.dataset.reducedMotion = String(value.reducedMotion);
  root.dataset.highContrast = String(value.highContrast);
  root.style.setProperty("--ui-font-scale", String(value.fontScale));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
