'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Share2 } from 'lucide-react';
import { trackCatalogEvent } from '@/lib/analytics-client';
import {
  disablePwaReminder,
  markPwaReminderShown,
  snoozePwaReminder,
} from '@/lib/pwa-install';
import { usePwaInstall } from './PwaInstallProvider';

interface PwaInstallReminderProps {
  managerId?: string | null;
  cartTotal: number;
  itemsCount: number;
  contentIds: string[];
  onContinue(): void;
}

export default function PwaInstallReminder({
  managerId,
  cartTotal,
  itemsCount,
  contentIds,
  onContinue,
}: PwaInstallReminderProps) {
  const { canInstall, platform, requestInstall } = usePwaInstall();
  const [installMessage, setInstallMessage] = useState('');
  const [installing, setInstalling] = useState(false);
  const loggedShown = useRef(false);

  const analyticsPayload = {
    managerId,
    cartTotal,
    itemsCount,
    contentIds,
    metadata: {
      source: 'before_whatsapp',
      platform,
      installPromptAvailable: canInstall,
    },
  };

  useEffect(() => {
    markPwaReminderShown();
    if (!loggedShown.current) {
      loggedShown.current = true;
      trackCatalogEvent('pwa_install_prompt_shown', analyticsPayload);
    }
    // This event belongs to the first render of this reminder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueToWhatsapp = () => {
    snoozePwaReminder();
    trackCatalogEvent('pwa_install_remind_later', {
      ...analyticsPayload,
      metadata: { ...analyticsPayload.metadata, reason: 'continued_to_whatsapp' },
    });
    onContinue();
  };

  const neverShowAgain = () => {
    disablePwaReminder();
    trackCatalogEvent('pwa_install_dismissed', {
      ...analyticsPayload,
      metadata: { ...analyticsPayload.metadata, reason: 'never_show_again' },
    });
    onContinue();
  };

  const install = async () => {
    if (installing) return;
    setInstalling(true);
    setInstallMessage('');
    trackCatalogEvent('pwa_install_clicked', analyticsPayload);
    const outcome = await requestInstall();
    if (outcome === 'accepted') {
      onContinue();
      return;
    }
    if (outcome === 'dismissed') {
      snoozePwaReminder();
      trackCatalogEvent('pwa_install_dismissed', {
        ...analyticsPayload,
        metadata: { ...analyticsPayload.metadata, reason: 'native_prompt_dismissed' },
      });
      setInstallMessage('Установка отменена. Можно продолжить в WhatsApp — напомним снова через 10 дней.');
    } else {
      setInstallMessage('Автоматическая установка сейчас недоступна. Используйте инструкцию ниже.');
    }
    setInstalling(false);
  };

  const instruction = platform === 'ios'
    ? 'Нажмите «Поделиться» в Safari, затем выберите «На экран Домой».'
    : platform === 'android'
      ? 'Откройте меню браузера ⋮ и выберите «Установить приложение» или «Добавить на главный экран».'
      : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».';

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-gray-950/65 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pwa-reminder-title">
      <div className="w-full max-w-[520px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <img src="/pwa-icon-192.png" alt="Логотип Алматы Товар" className="h-full w-full object-contain" />
          </div>
          <div>
            <h2 id="pwa-reminder-title" className="text-xl font-black text-gray-950">Установить каталог на телефон?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Чтобы в следующий раз быстрее открыть товары и повторить заказ, установите каталог как приложение.
            </p>
          </div>
        </div>

        {!canInstall && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
            {platform === 'ios' ? <Share2 className="mt-0.5 shrink-0" size={20} /> : <ExternalLink className="mt-0.5 shrink-0" size={20} />}
            <span>{instruction}</span>
          </div>
        )}

        {installMessage && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{installMessage}</div>}

        <div className="mt-6 grid gap-2">
          {canInstall && (
            <button
              type="button"
              onClick={() => void install()}
              disabled={installing}
              className="flex h-13 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 font-extrabold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <Download size={19} /> {installing ? 'Открываем установку...' : 'Установить каталог'}
            </button>
          )}
          <button
            type="button"
            onClick={continueToWhatsapp}
            className="h-13 rounded-xl bg-gray-950 px-4 font-extrabold text-white hover:bg-gray-800"
          >
            Продолжить в WhatsApp
          </button>
          <button
            type="button"
            onClick={neverShowAgain}
            className="min-h-11 rounded-xl px-4 text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            Больше не показывать
          </button>
        </div>
      </div>
    </div>
  );
}
