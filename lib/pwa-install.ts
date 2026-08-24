'use client';

export const PWA_REMINDER_STORAGE_KEY = 'catalog_pwa_install_reminder_v1';
export const PWA_REMINDER_INTERVAL_DAYS = 10;
export const PWA_REMINDER_INTERVAL_MS = PWA_REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

export interface PwaReminderState {
  version: 1;
  lastShownAt?: number;
  nextReminderAt?: number;
  neverShowAgain?: boolean;
  installedAt?: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parsePwaReminderState(serialized: string | null): PwaReminderState {
  if (!serialized) return { version: 1 };
  try {
    const parsed = JSON.parse(serialized) as Partial<PwaReminderState>;
    if (!parsed || parsed.version !== 1) return { version: 1 };
    return {
      version: 1,
      ...(Number.isFinite(parsed.lastShownAt) ? { lastShownAt: Number(parsed.lastShownAt) } : {}),
      ...(Number.isFinite(parsed.nextReminderAt) ? { nextReminderAt: Number(parsed.nextReminderAt) } : {}),
      ...(parsed.neverShowAgain === true ? { neverShowAgain: true } : {}),
      ...(Number.isFinite(parsed.installedAt) ? { installedAt: Number(parsed.installedAt) } : {}),
    };
  } catch {
    return { version: 1 };
  }
}

export function getPwaReminderState(storage = getBrowserStorage()): PwaReminderState {
  if (!storage) return { version: 1 };
  try {
    return parsePwaReminderState(storage.getItem(PWA_REMINDER_STORAGE_KEY));
  } catch {
    return { version: 1 };
  }
}

function writePwaReminderState(state: PwaReminderState, storage = getBrowserStorage()) {
  if (!storage) return state;
  try {
    storage.setItem(PWA_REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing and strict storage policies must never block WhatsApp.
  }
  return state;
}

export function shouldShowPwaReminder(
  state: PwaReminderState,
  { now = Date.now(), installed = false }: { now?: number; installed?: boolean } = {},
) {
  if (installed || state.installedAt || state.neverShowAgain) return false;
  return !state.nextReminderAt || state.nextReminderAt <= now;
}

export function shouldShowPwaReminderNow(installed = false, now = Date.now()) {
  return shouldShowPwaReminder(getPwaReminderState(), { installed, now });
}

export function markPwaReminderShown(now = Date.now()) {
  const current = getPwaReminderState();
  return writePwaReminderState({ ...current, version: 1, lastShownAt: now });
}

export function snoozePwaReminder(now = Date.now()) {
  const current = getPwaReminderState();
  return writePwaReminderState({
    ...current,
    version: 1,
    lastShownAt: current.lastShownAt || now,
    nextReminderAt: now + PWA_REMINDER_INTERVAL_MS,
  });
}

export function disablePwaReminder(now = Date.now()) {
  const current = getPwaReminderState();
  return writePwaReminderState({
    ...current,
    version: 1,
    lastShownAt: current.lastShownAt || now,
    neverShowAgain: true,
  });
}

export function markPwaInstalled(now = Date.now()) {
  const current = getPwaReminderState();
  return writePwaReminderState({ ...current, version: 1, installedAt: now });
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}
