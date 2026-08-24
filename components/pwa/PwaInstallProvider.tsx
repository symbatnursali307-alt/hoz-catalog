'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isStandalonePwa, markPwaInstalled } from '@/lib/pwa-install';

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';
export type PwaPlatform = 'ios' | 'android' | 'other';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __catalogPwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

interface PwaInstallContextValue {
  ready: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  platform: PwaPlatform;
  requestInstall(): Promise<PwaInstallOutcome>;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  ready: false,
  isInstalled: false,
  canInstall: false,
  platform: 'other',
  requestInstall: async () => 'unavailable',
});

function detectPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const userAgent = navigator.userAgent;
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(userAgent) || isIpadOs) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsInstalled(isStandalonePwa());
    setReady(true);

    const storeInstallPrompt = (event: BeforeInstallPromptEvent | null) => {
      deferredPromptRef.current = event;
      setDeferredPrompt(event);
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__catalogPwaInstallPrompt = event as BeforeInstallPromptEvent;
      storeInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleCapturedInstallPrompt = () => {
      storeInstallPrompt(window.__catalogPwaInstallPrompt || null);
    };
    const handleInstalled = () => {
      window.__catalogPwaInstallPrompt = null;
      storeInstallPrompt(null);
      setIsInstalled(true);
      markPwaInstalled();
    };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleDisplayMode = () => setIsInstalled(isStandalonePwa());

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('catalog:pwa-install-ready', handleCapturedInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener?.('change', handleDisplayMode);
    handleCapturedInstallPrompt();

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('catalog:pwa-install-ready', handleCapturedInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  const value = useMemo<PwaInstallContextValue>(() => ({
    ready,
    isInstalled,
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    platform,
    requestInstall: async () => {
      if (isInstalled) return 'unavailable';

      let prompt = deferredPromptRef.current || window.__catalogPwaInstallPrompt || null;
      if (!prompt) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            window.removeEventListener('catalog:pwa-install-ready', finish);
            resolve();
          };
          window.addEventListener('catalog:pwa-install-ready', finish, { once: true });
          window.setTimeout(finish, 1200);
        });
        prompt = deferredPromptRef.current || window.__catalogPwaInstallPrompt || null;
      }
      if (!prompt) return 'unavailable';

      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.__catalogPwaInstallPrompt = null;
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        markPwaInstalled();
      }
      return choice.outcome;
    },
  }), [deferredPrompt, isInstalled, platform, ready]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  return useContext(PwaInstallContext);
}
