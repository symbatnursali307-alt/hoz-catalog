'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useCartStore, Product } from '@/store/cart';
import { Plus, Minus, X } from 'lucide-react';
import { calculatePriceWithVat } from '@/lib/pricing';
import { CART_ENABLED } from '@/lib/features';

export default function ProductModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const addToCart = useCartStore((state) => state.addToCart);
  const displayedPriceWithVat = product.priceWithVat ?? calculatePriceWithVat(product.priceWithoutVat);

  const handleAdd = () => {
    addToCart(product, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/55 z-[90] flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[380px] max-h-[92vh] overflow-y-auto rounded-[22px] p-4 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="aspect-square w-full rounded-[18px] mb-4 bg-gray-50 border border-line flex items-center justify-center text-gray-500 font-extrabold overflow-hidden relative">
          {product.photo ? (
            <Image
              src={product.photo} 
              alt={product.name}
              fill
              sizes="(max-width: 640px) calc(100vw - 24px), 380px"
              quality={82}
              className="object-contain p-2"
            />
          ) : (
            "Фото товара"
          )}
        </div>

        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold leading-tight mb-2">{product.name}</h2>
            <div className="flex items-baseline gap-2">
              <div className="text-[22px] md:text-[26px] font-black tracking-tight text-dark">
                {product.priceWithoutVat ? `${product.priceWithoutVat.toLocaleString('ru-RU')} тг.` : product.price || 'Цена по запросу'}
              </div>
              {product.unit && (
                <div className="text-muted text-sm md:text-base font-medium">
                  / {product.unit} без НДС
                </div>
              )}
            </div>
            {displayedPriceWithVat && (
              <div className="text-muted text-sm font-medium mt-0.5">
                Цена с НДС: <span className="text-gray-700 font-semibold">{displayedPriceWithVat.toLocaleString('ru-RU')} тг.</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 bg-gray-100 hover:bg-gray-200 w-[42px] h-[42px] rounded-full flex items-center justify-center text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {(product.packageType && product.packageQuantity) && (
          <div className="border border-line rounded-[14px] p-3 my-3 bg-neutral-50 flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="font-bold shrink-0">Фасовка:</span>
              <span className="text-muted text-[13px] md:text-[14px] leading-tight pt-[1px] font-medium">
                {product.packageType} — {product.packageQuantity} {product.packageUnit}
              </span>
            </div>
            {product.priceWithoutVat && (
              <div className="flex items-start gap-2 mt-1 pt-1 border-t border-line/10">
                <span className="font-bold shrink-0">Цена за {product.packageType}:</span>
                <span className="text-dark font-black text-[15px]">
                  {((product.priceWithoutVat || 0) * (product.packageQuantity || 1)).toLocaleString('ru-RU')} тг. <span className="font-normal text-muted text-[12px]">без НДС</span>
                </span>
              </div>
            )}
          </div>
        )}

        {product.description && (
          <div className="border border-line rounded-[14px] p-3 my-3 bg-neutral-50 flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="font-bold shrink-0">Описание:</span>
              <span className="text-muted text-[13px] md:text-[14px] leading-tight pt-[1px] font-medium">{product.description}</span>
            </div>
          </div>
        )}

        {CART_ENABLED && (
          <>
            <div className="grid grid-cols-[56px_1fr_56px] gap-[10px] items-center my-4">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="h-[56px] rounded-2xl border border-line bg-gray-100 flex items-center justify-center text-2xl font-black text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <Minus size={20} strokeWidth={3} />
              </button>
              <div className="h-[56px] border border-line rounded-2xl flex flex-col items-center justify-center bg-white leading-none">
                <span className="text-[22px] font-black">{qty}</span>
              </div>
              <button
                onClick={() => setQty(qty + 1)}
                className="h-[56px] rounded-2xl border border-line bg-gray-100 flex items-center justify-center text-2xl font-black text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              className="w-full h-[56px] rounded-xl bg-accent hover:bg-accent-dark text-white font-extrabold text-[15px] flex items-center justify-center transition-colors"
            >
              Добавить в корзину
            </button>
          </>
        )}
      </div>
    </div>
  );
}
