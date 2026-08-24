'use client';

import { useState } from 'react';
import { Download, ExternalLink, Share2, X } from 'lucide-react';
import { trackCatalogEvent } from '@/lib/analytics-client';
import { usePwaInstall } from './PwaInstallProvider';

interface PwaInstallButtonProps {
  source: 'catalog_header' | 'admin_header';
  variant?: 'dark' | 'light';
}

export default function PwaInstallButton({ source, variant = 'light' }: PwaInstallButtonProps) {
  const { ready, isInstalled, canInstall, platform, requestInstall } = usePwaInstall();
  const [showInstruction, setShowInstruction] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!ready || isInstalled) return null;

  const analyticsPayload = {
    metadata: {
      source,
      platform,
      installPromptAvailable: canInstall,
    },
  };

  const openInstruction = () => {
    setShowInstruction(true);
    trackCatalogEvent('pwa_install_prompt_shown', analyticsPayload);
  };

  const install = async () => {
    if (installing) return;
    trackCatalogEvent('pwa_install_clicked', analyticsPayload);

    setInstalling(true);
    const outcome = await requestInstall();
    setInstalling(false);

    if (outcome === 'dismissed') {
      trackCatalogEvent('pwa_install_dismissed', {
        metadata: { ...analyticsPayload.metadata, reason: 'native_prompt_dismissed' },
      });
    } else if (outcome === 'unavailable') {
      openInstruction();
    }
  };

  const instruction = platform === 'ios'
    ? 'В Safari нажмите «Поделиться», затем выберите «На экран Домой».'
    : platform === 'android'
      ? 'Откройте меню браузера ⋮ и выберите «Установить приложение» или «Добавить на главный экран».'
      : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».';

  const buttonClassName = variant === 'dark'
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50';

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        disabled={installing}
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold shadow-sm transition-colors disabled:opacity-60 sm:px-3 ${buttonClassName}`}
        title="Установить каталог как приложение"
      >
        <Download size={15} />
        <span>{installing ? 'Установка…' : 'Установить'}</span>
      </button>

      {showInstruction && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-gray-950/65 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pwa-button-instruction-title">
          <div className="w-full max-w-[440px] rounded-[24px] bg-white p-5 text-left text-gray-900 shadow-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-gray-200">
                <img src="/pwa-icon-192.png" alt="Логотип Алматы Товар" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="pwa-button-instruction-title" className="text-lg font-black">Установка каталога</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{instruction}</p>
              </div>
              <button type="button" onClick={() => setShowInstruction(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Закрыть">
                <X size={19} />
              </button>
            </div>

            <div className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
              {platform === 'ios' ? <Share2 className="mt-0.5 shrink-0" size={20} /> : <ExternalLink className="mt-0.5 shrink-0" size={20} />}
              <span>После установки каталог появится на главном экране и будет открываться как отдельное приложение.</span>
            </div>

            <button type="button" onClick={() => setShowInstruction(false)} className="mt-5 h-11 w-full rounded-xl bg-gray-950 px-4 text-sm font-extrabold text-white hover:bg-gray-800">
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
