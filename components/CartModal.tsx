'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Minus, Plus, Send, ShoppingCart, Trash2, X } from 'lucide-react';
import {
  getAnalyticsIdentity,
  getStoredAttribution,
  trackCatalogEvent,
} from '@/lib/analytics-client';
import { getProductPackagePrice, getUnitName, getUnitsPerPackage } from '@/lib/catalog';
import { isStandalonePwa, shouldShowPwaReminderNow } from '@/lib/pwa-install';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import PwaInstallReminder from '@/components/pwa/PwaInstallReminder';
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider';

interface PendingWhatsapp {
  url: string;
  managerId?: string | null;
  totalAmount: number;
  phone?: string;
  metadata: { submissionId: string; publicId: string; orderNumber: number };
}

export default function CartModal({
  contactStepEnabled,
  onClose,
}: {
  contactStepEnabled: boolean;
  onClose: () => void;
}) {
  const {
    items,
    manager,
    removeFromCart,
    updatePackages,
    clearCart,
    getTotalPrice,
    getTotalPackages,
    isStale,
  } = useCartStore();
  const [showContact, setShowContact] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingWhatsapp, setPendingWhatsapp] = useState<PendingWhatsapp | null>(null);
  const submissionInFlight = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const { isInstalled } = usePwaInstall();

  const totalPrice = getTotalPrice();
  const totalPackages = getTotalPackages();
  const contentIds = useMemo(
    () => items.map((item) => item.metaCatalogId || item.slug),
    [items],
  );

  useEffect(() => {
    trackCatalogEvent('cart_opened', {
      managerId: manager?.id,
      cartTotal: totalPrice,
      itemsCount: totalPackages,
      contentIds,
    });
    // The event belongs to the moment the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemove = (id: string, categoryId: string, contentId: string) => {
    removeFromCart(id);
    trackCatalogEvent('remove_from_cart', {
      managerId: manager?.id,
      productId: id,
      categoryId,
      contentIds: [contentId],
    });
  };

  const continueToWhatsapp = (pending: PendingWhatsapp) => {
    setPendingWhatsapp(null);
    trackCatalogEvent('whatsapp_clicked', {
      managerId: pending.managerId,
      cartTotal: pending.totalAmount,
      itemsCount: totalPackages,
      contentIds,
      phone: pending.phone,
      metadata: pending.metadata,
    });
    clearCart();
    window.location.assign(pending.url);
  };

  const handleSendWhatsapp = async () => {
    if (!items.length || submissionInFlight.current) return;
    const normalizedPhone = customerPhone.replace(/\D/g, '');
    if (contactStepEnabled && (normalizedPhone.length < 7 || normalizedPhone.length > 15)) {
      setErrorMsg('Введите корректный номер телефона');
      return;
    }

    submissionInFlight.current = true;
    if (!idempotencyKey.current) {
      idempotencyKey.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const identity = getAnalyticsIdentity();
      const response = await fetch('/api/cart-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...identity,
          managerId: manager?.id || null,
          managerSlug: manager?.slug || null,
          idempotencyKey: idempotencyKey.current,
          phone: normalizedPhone || null,
          customerName: contactStepEnabled ? customerName.trim() || null : null,
          items: items.map((item) => ({ id: item.id, packageQuantity: item.packages })),
          utm: getStoredAttribution(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Не удалось сохранить заявку');

      if (data.created !== false) {
        trackCatalogEvent('order_created', {
          managerId: data.manager?.id || manager?.id,
          cartTotal: data.totalAmount,
          itemsCount: totalPackages,
          contentIds,
          metadata: {
            submissionId: data.submissionId,
            publicId: data.publicId,
            orderNumber: data.orderNumber,
          },
        });
      }

      if (normalizedPhone) {
        trackCatalogEvent('phone_entered', {
          managerId: data.manager?.id || manager?.id,
          cartTotal: data.totalAmount,
          itemsCount: totalPackages,
          contentIds,
          phone: normalizedPhone,
          metadata: { submissionId: data.submissionId, publicId: data.publicId, orderNumber: data.orderNumber },
        });
      }
      const pending: PendingWhatsapp = {
        url: data.whatsappUrl,
        managerId: data.manager?.id || manager?.id,
        totalAmount: data.totalAmount,
        phone: normalizedPhone,
        metadata: { submissionId: data.submissionId, publicId: data.publicId, orderNumber: data.orderNumber },
      };
      submissionInFlight.current = false;
      setIsSubmitting(false);
      if (contactStepEnabled && shouldShowPwaReminderNow(isInstalled || isStandalonePwa())) {
        setPendingWhatsapp(pending);
      } else {
        continueToWhatsapp(pending);
      }
    } catch (error: any) {
      submissionInFlight.current = false;
      setErrorMsg(error?.message || 'Ошибка сервера. Попробуйте ещё раз.');
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-gray-900/55 z-[90] flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[680px] max-h-[94vh] overflow-hidden flex flex-col rounded-[22px] shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            {showContact && (
              <button onClick={() => setShowContact(false)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-black">{showContact ? 'Контакт для заявки' : 'Корзина'}</h2>
              {manager && <div className="text-xs text-gray-500 mt-0.5">Менеджер: {manager.name}</div>}
            </div>
          </div>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {showContact ? (
            <div className="max-w-[500px] mx-auto py-4">
              <div className="rounded-2xl bg-green-50 border border-green-100 p-4 mb-5 text-sm text-green-900 leading-relaxed">
                Оставьте номер телефона, чтобы менеджер мог быстрее найти вашу заявку и сверить товары.
              </div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Телефон *</label>
              <input
                autoFocus
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={customerPhone}
                onChange={(event) => { setCustomerPhone(event.target.value); setErrorMsg(''); }}
                placeholder="+7 777 000 00 00"
                className="w-full px-4 py-3.5 border border-line rounded-xl text-base outline-none focus:border-accent bg-gray-50"
              />
              <label className="block text-sm font-bold text-gray-700 mb-1.5 mt-4">Имя <span className="font-normal text-gray-400">(необязательно)</span></label>
              <input
                type="text"
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Как к вам обращаться"
                className="w-full px-4 py-3.5 border border-line rounded-xl text-base outline-none focus:border-accent bg-gray-50"
              />
              {errorMsg && <div className="mt-3 text-sm font-bold text-red-600">{errorMsg}</div>}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="mx-auto mb-3 opacity-20" size={52} />
              Корзина пустая.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {isStale() && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-800">
                  <AlertTriangle size={19} className="shrink-0 mt-0.5" />
                  Корзина сохранена больше 24 часов назад. Проверьте актуальность цен перед отправкой.
                </div>
              )}

              {items.map((item) => {
                const units = getUnitsPerPackage(item);
                const packagePrice = getProductPackagePrice(item);
                const lineTotal = packagePrice * item.packages;
                return (
                  <div key={item.id} className="border border-line rounded-2xl p-3 relative">
                    <div className="pr-10">
                      <strong className="block leading-snug text-[15px] mb-2">{item.name}</strong>
                      <div className="grid gap-1 text-[13px]">
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Цена с НДС</span><span>{formatPrice(item.priceWithVat || 0)} / {getUnitName(item)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Упаковка</span><span>{item.packageType}, {units} {item.packageUnit || getUnitName(item)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Цена упаковки</span><strong>{formatPrice(packagePrice)}</strong></div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id, item.category.id, item.metaCatalogId || item.slug)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-600 p-2 rounded-lg"
                      title="Удалить"
                    >
                      <Trash2 size={19} />
                    </button>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="grid grid-cols-[42px_92px_42px] gap-2 items-center">
                        <button onClick={() => updatePackages(item.id, -1)} className="h-10 rounded-xl border border-line bg-gray-100 flex items-center justify-center"><Minus size={17} /></button>
                        <div className="h-10 rounded-xl border border-line flex items-center justify-center font-black">{item.packages} уп.</div>
                        <button onClick={() => updatePackages(item.id, 1)} className="h-10 rounded-xl border border-line bg-gray-100 flex items-center justify-center"><Plus size={17} /></button>
                      </div>
                      <div className="text-lg font-black text-right">{formatPrice(lineTotal)}</div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl bg-gray-50 p-4 mt-2">
                <div className="flex justify-between items-end">
                  <span className="font-bold text-gray-600">Итого с НДС</span>
                  <span className="text-2xl font-black">{formatPrice(totalPrice)}</span>
                </div>
                <div className="mt-3 text-xs leading-relaxed text-gray-500">
                  Все цены указаны с НДС.<br />Наличие и финальные условия менеджер уточнит в WhatsApp.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-line bg-gray-50 shrink-0">
          {showContact ? (
            <button
              onClick={handleSendWhatsapp}
              disabled={isSubmitting}
              className="w-full h-14 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-extrabold flex items-center justify-center gap-2"
            >
              <Send size={19} /> {isSubmitting ? 'Сохраняем заявку...' : 'Перейти в WhatsApp'}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {errorMsg && <div className="text-center text-sm font-bold text-red-600">{errorMsg}</div>}
              <button
                onClick={() => contactStepEnabled ? setShowContact(true) : void handleSendWhatsapp()}
                disabled={!items.length || isSubmitting}
                className="w-full h-14 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-extrabold flex items-center justify-center gap-2"
              >
                <Send size={19} /> {isSubmitting ? 'Открываем WhatsApp...' : 'Отправить в WhatsApp'}
              </button>
              {!!items.length && (
                <button onClick={clearCart} className="w-full py-2.5 text-sm font-bold text-gray-500 hover:text-red-600">Очистить корзину</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {pendingWhatsapp && (
      <PwaInstallReminder
        managerId={pendingWhatsapp.managerId}
        cartTotal={pendingWhatsapp.totalAmount}
        itemsCount={totalPackages}
        contentIds={contentIds}
        onContinue={() => continueToWhatsapp(pendingWhatsapp)}
      />
    )}
    </>
  );
}
