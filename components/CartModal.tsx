'use client';

import { useState } from 'react';
import { useCartStore } from '@/store/cart';
import { X, ShoppingCart, Trash2, Send, Plus, Minus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default function CartModal({ onClose }: { onClose: () => void }) {
  const { items, removeFromCart, updateQty, clearCart, getTotalPrice } = useCartStore();
  const [customerName, setCustomerName] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPrice = getTotalPrice();
  // Approximate total with VAT (36%)
  const totalWithVat = items.reduce((sum, item) => {
    const priceVat = item.priceWithVat ?? ((item.priceWithoutVat ?? 0) * 1.36);
    const pkgQty = item.packageQuantity ?? 1;
    return sum + (priceVat * pkgQty * item.qty);
  }, 0);

  const handleSendWhatsapp = async () => {
    if (items.length === 0) return;
    
    if (!customerName.trim()) {
      setErrorMsg('Введите имя');
      return;
    }
    
    if (!customerCity.trim()) {
      setErrorMsg('Введите город');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMsg('Введите контактный номер');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const cartItems = items.map(item => ({ id: item.id, qty: item.qty }));
      
      const payload = {
        name: customerName,
        city: customerCity,
        phone: customerPhone,
        cartItems,
        utm: {} // Could pull from localStorage or URLSearchParams here
      };

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке');
      }

      // Success, open WhatsApp
      window.location.href = data.whatsappUrl;
      clearCart();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сервера. Попробуйте еще раз.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/55 z-[90] flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[620px] max-h-[92vh] overflow-hidden flex flex-col rounded-[22px] shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-line shrink-0 bg-white z-10">
          <h2 className="text-2xl font-bold m-0">Корзина</h2>
          <button
            onClick={onClose}
            className="shrink-0 bg-gray-100 hover:bg-gray-200 w-[42px] h-[42px] rounded-full flex items-center justify-center text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1 bg-white">
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted">
              <ShoppingCart className="mx-auto mb-3 opacity-20" size={48} />
              Пока ничего не выбрано.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const priceNoVat = item.priceWithoutVat ?? 0;
                const priceVat = item.priceWithVat ?? (priceNoVat * 1.36);
                const pkgQty = item.packageQuantity ?? 1;
                const lineTotalNoVat = priceNoVat * pkgQty * item.qty;
                const lineTotalVat = priceVat * pkgQty * item.qty;

                const packageDisplay = item.packageType && item.packageQuantity
                  ? `${item.packageType} — ${item.packageQuantity} ${item.packageUnit}`
                  : `1 ${item.unit || 'шт'}`;

                return (
                  <div key={item.id} className="border border-line rounded-[14px] p-3 flex flex-col gap-3 relative">
                    <div className="flex justify-between gap-3 pr-10">
                      <div>
                        <strong className="block leading-snug text-[15px] mb-2">{item.name}</strong>
                        
                        <div className="grid gap-1 mb-2">
                          <div className="text-muted text-[13px] flex justify-between gap-4">
                            <span>Цена без НДС:</span>
                            <span className="text-gray-900 font-medium">{formatPrice(priceNoVat)} / {item.unit || 'шт'}</span>
                          </div>
                          <div className="text-muted text-[13px] flex justify-between gap-4">
                            <span>Цена с НДС:</span>
                            <span className="text-gray-900 font-medium">{formatPrice(priceVat)} / {item.unit || 'шт'}</span>
                          </div>
                          <div className="text-muted text-[13px] flex justify-between gap-4">
                            <span>Фасовка:</span>
                            <span className="text-gray-900 font-medium">{packageDisplay}</span>
                          </div>
                        </div>

                        {priceNoVat > 0 && (
                          <div className="text-[15px] font-bold text-dark mt-1">
                            Сумма: {formatPrice(lineTotalNoVat)} <span className="text-muted text-[12px] font-normal">без НДС</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-danger hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={20} />
                    </button>
                    
                    <div className="grid grid-cols-[44px_1fr_44px] gap-2 items-center mt-1 w-full sm:w-[200px]">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="h-[42px] rounded-xl border border-line bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200"
                      >
                        <Minus size={18} strokeWidth={2.5} />
                      </button>
                      <div className="h-[42px] border border-line rounded-xl flex flex-col items-center justify-center bg-white leading-none">
                        <span className="text-[16px] font-black">{item.qty}</span>
                        {item.packageType && <span className="text-[9px] text-muted uppercase tracking-wider font-bold mt-0.5">{item.packageType}</span>}
                      </div>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="h-[42px] rounded-xl border border-line bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 pt-4 border-t border-line">
                <h3 className="font-bold text-[17px] mb-3">Ваши данные</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <input 
                      type="text" 
                      placeholder="Ваше имя *" 
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (errorMsg === 'Введите имя') setErrorMsg('');
                      }}
                      className="w-full px-4 py-3 border border-line rounded-xl text-[15px] outline-none focus:border-accent transition-colors bg-neutral-50"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Город *" 
                      value={customerCity}
                      onChange={(e) => {
                        setCustomerCity(e.target.value);
                        if (errorMsg === 'Введите город') setErrorMsg('');
                      }}
                      className="w-full px-4 py-3 border border-line rounded-xl text-[15px] outline-none focus:border-accent transition-colors bg-neutral-50"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Контактный номер *" 
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (errorMsg === 'Введите контактный номер') setErrorMsg('');
                      }}
                      className="w-full px-4 py-3 border border-line rounded-xl text-[15px] outline-none focus:border-accent transition-colors bg-neutral-50"
                    />
                  </div>
                  {errorMsg && (
                    <div className="text-danger text-sm font-bold mt-1 animate-in fade-in">
                      {errorMsg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-line shrink-0 bg-gray-50 flex flex-col gap-3 z-10">
          {items.length > 0 && totalPrice > 0 && (
            <div className="flex flex-col gap-1 mb-2 px-1">
              <div className="flex justify-between items-end">
                <span className="text-muted font-medium">Итого без НДС:</span>
                <span className="text-xl font-black">{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-muted font-medium">Итого с НДС:</span>
                <span className="text-gray-900 font-bold">{formatPrice(totalWithVat)}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSendWhatsapp}
            disabled={items.length === 0 || isSubmitting}
            className="w-full h-[54px] rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-[15px] flex items-center justify-center gap-2 transition-colors shadow-sm shadow-accent/20"
          >
            {isSubmitting ? (
              <span>Обработка...</span>
            ) : (
              <>
                <Send size={18} />
                Отправить заказ в WhatsApp
              </>
            )}
          </button>
          
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="w-full py-3 rounded-xl text-muted hover:text-danger hover:bg-red-50 font-bold text-[14px] transition-colors"
            >
              Очистить корзину
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
