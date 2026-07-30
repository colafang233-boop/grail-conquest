import {
  mergeExternalContentPacks,
  validateExternalContentPack,
  type BrowserContentPack,
  type ExternalContentDiagnostic,
} from "@grail/core";
import { useSyncExternalStore } from "react";

const OVERRIDE_KEY = "grail-conquest:content-overrides:v1";

export interface BrowserContentSnapshot {
  readonly status: "loading" | "ready" | "error";
  readonly pack?: BrowserContentPack;
  readonly diagnostics: readonly ExternalContentDiagnostic[];
  readonly overrideCount: number;
  readonly error?: string;
}

let basePack: BrowserContentPack | undefined;
let overridePacks: BrowserContentPack[] = [];
let snapshot: BrowserContentSnapshot = {
  status: "loading",
  diagnostics: [],
  overrideCount: 0,
};
const listeners = new Set<() => void>();

export async function initializeBrowserContent(): Promise<BrowserContentSnapshot> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}content/base-content.json`, {
      cache: "no-cache",
    });
    if (!response.ok) throw new Error(`内容包请求失败：HTTP ${response.status}`);
    const value: unknown = await response.json();
    const validated = validateExternalContentPack(value, "public/content/base-content.json");
    if (!validated.valid || !validated.pack) {
      throw new Error(formatDiagnostics(validated.diagnostics));
    }
    basePack = validated.pack;
    overridePacks = loadStoredOverrides();
    return rebuildSnapshot();
  } catch (error) {
    snapshot = {
      status: "error",
      diagnostics: [],
      overrideCount: 0,
      error: error instanceof Error ? error.message : "内容包加载失败",
    };
    notify();
    return snapshot;
  }
}

export function getBrowserContentSnapshot(): BrowserContentSnapshot {
  return snapshot;
}

export function subscribeBrowserContent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBrowserContent(): BrowserContentSnapshot {
  return useSyncExternalStore(
    subscribeBrowserContent,
    getBrowserContentSnapshot,
    getBrowserContentSnapshot,
  );
}

export function installContentOverride(
  value: unknown,
  source = "browser-import.json",
): BrowserContentSnapshot {
  if (!basePack) throw new Error("基础内容包尚未加载");
  const validation = validateExternalContentPack(value, source);
  if (!validation.valid || !validation.pack) {
    snapshot = {
      ...snapshot,
      diagnostics: validation.diagnostics,
      error: formatDiagnostics(validation.diagnostics),
    };
    notify();
    return snapshot;
  }
  overridePacks = [...overridePacks.filter(item => item.id !== validation.pack?.id), validation.pack];
  persistOverrides();
  return rebuildSnapshot();
}

export function replaceActivePack(pack: BrowserContentPack): BrowserContentSnapshot {
  if (!basePack) throw new Error("基础内容包尚未加载");
  const validation = validateExternalContentPack(pack, "scenario-editor");
  snapshot = {
    status: validation.valid ? "ready" : "error",
    ...(validation.pack ? { pack: validation.pack } : {}),
    diagnostics: validation.diagnostics,
    overrideCount: overridePacks.length,
    ...(!validation.valid ? { error: formatDiagnostics(validation.diagnostics) } : {}),
  };
  notify();
  return snapshot;
}

export function clearContentOverrides(): BrowserContentSnapshot {
  overridePacks = [];
  window.localStorage.removeItem(OVERRIDE_KEY);
  return rebuildSnapshot();
}

export function getActiveContentPack(): BrowserContentPack {
  if (!snapshot.pack) throw new Error(snapshot.error ?? "内容包尚未就绪");
  return snapshot.pack;
}

export function exportActiveContentPack(): string {
  return JSON.stringify(getActiveContentPack(), null, 2);
}

function rebuildSnapshot(): BrowserContentSnapshot {
  if (!basePack) throw new Error("基础内容包尚未加载");
  const merged = mergeExternalContentPacks(basePack, overridePacks);
  snapshot = {
    status: merged.diagnostics.some(item => item.severity === "error") ? "error" : "ready",
    pack: merged.pack,
    diagnostics: merged.diagnostics,
    overrideCount: overridePacks.length,
    ...(merged.diagnostics.some(item => item.severity === "error")
      ? { error: formatDiagnostics(merged.diagnostics) }
      : {}),
  };
  notify();
  return snapshot;
}

function loadStoredOverrides(): BrowserContentPack[] {
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value, index) => {
      const result = validateExternalContentPack(value, `localStorage[${index}]`);
      return result.valid && result.pack ? [result.pack] : [];
    });
  } catch {
    return [];
  }
}

function persistOverrides(): void {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overridePacks));
  } catch (error) {
    throw new Error(error instanceof Error ? `无法保存内容覆盖包：${error.message}` : "无法保存内容覆盖包");
  }
}

function formatDiagnostics(diagnostics: readonly ExternalContentDiagnostic[]): string {
  return diagnostics
    .filter(item => item.severity === "error")
    .map(item => `[${item.code}] ${item.path}: ${item.message}`)
    .join("\n") || "内容包校验失败";
}

function notify(): void {
  for (const listener of listeners) listener();
}
