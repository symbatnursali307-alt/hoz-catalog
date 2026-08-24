'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { trackCatalogEvent } from '@/lib/analytics-client';
import { getMinimumPackages, getProductPackagePrice, getUnitName, getUnitsPerPackage } from '@/lib/catalog';
import { formatPrice } from '@/lib/utils';
import { Product, useCartStore } from '@/store/cart';

export default function ProductModal({
  product,
  cartEnabled,
  onClose,
}: {
  product: Product;
  cartEnabled: boolean;
  onClose: () => void;
}) {
  const minimum = getMinimumPackages(product);
  const [packages, setPackages] = useState(minimum);
  const addToCart = useCartStore((state) => state.addToCart);
  const manager = useCartStore((state) => state.manager);
  const packagePrice = getProductPackagePrice(product);
  const unitsPerPackage = getUnitsPerPackage(product);
  const unitName = getUnitName(product);
  const characteristics = useMemo(() => {
    if (!product.characteristics || Array.isArray(product.characteristics)) return [];
    return Object.entries(product.characteristics);
  }, [product.characteristics]);

  useEffect(() => {
    trackCatalogEvent('product_viewed', {
      managerId: manager?.id,
      productId: product.id,
      categoryId: product.category.id,
      cartTotal: product.priceWithVat || undefined,
      contentIds: [product.metaCatalogId || product.slug],
    });
  }, [manager?.id, product]);

  const handleAdd = () => {
    if (!product.orderable) return;
    addToCart(product, packages);
    trackCatalogEvent('add_to_cart', {
      managerId: manager?.id,
      productId: product.id,
      categoryId: product.category.id,
      cartTotal: packagePrice * packages,
      itemsCount: packages,
      contentIds: [product.metaCatalogId || product.slug],
      metadata: { packages, unitsPerPackage },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/55 z-[90] flex items-center justify-center p-3 animate-in fade-in duration-200" onMouseDown={onClose}>
      <div
        className="bg-white w-full max-w-[560px] max-h-[94vh] overflow-y-auto rounded-[22px] p-4 sm:p-5 shadow-2xl animate-in zoom-in-95 duration-200"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-accent mb-1">{product.category.name}</div>
            <h2 className="text-xl sm:text-2xl font-black leading-tight text-gray-900">{product.name}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 bg-gray-100 hover:bg-gray-200 w-11 h-11 rounded-full flex items-center justify-center text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="aspect-square w-full rounded-[18px] mb-4 bg-gray-50 border border-line flex items-center justify-center overflow-hidden relative">
          {product.imageUrl || product.photo ? (
            <Image
              src={(product.imageUrl || product.photo) as string}
              alt={product.name}
              fill
              sizes="(max-width: 640px) calc(100vw - 40px), 520px"
              unoptimized={(product.imageUrl || product.photo)?.startsWith('/uploads/')}
              className="object-contain p-3 mix-blend-multiply"
            />
          ) : (
            <span className="text-gray-400 font-bold">Фото уточняется</span>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-gray-50 p-4">
          {product.priceWithVat ? (
            <div className="text-2xl font-black text-gray-900">
              {formatPrice(product.priceWithVat)} <span className="text-sm font-bold text-gray-500">/ {unitName || 'ед.'} с НДС</span>
            </div>
          ) : (
            <div className="text-lg font-bold text-gray-600">Цена с НДС уточняется</div>
          )}

          {product.orderable ? (
            <div className="grid gap-2 mt-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-gray-500">Упаковка</span><strong>{product.packageType}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">В упаковке</span><strong>{unitsPerPackage} {product.packageUnit || unitName}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">Цена упаковки</span><strong>{formatPrice(packagePrice)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">Минимальный заказ</span><strong>{minimum} {product.packageType}</strong></div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Фасовка уточняется. Товар можно посмотреть, но добавить в заявку пока нельзя.
            </div>
          )}
        </div>

        {(product.shortDescription || product.fullDescription) && (
          <div className="mt-4">
            <h3 className="font-bold text-gray-900 mb-2">Описание</h3>
            <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
              {product.fullDescription || product.shortDescription}
            </p>
          </div>
        )}

        {characteristics.length > 0 && (
          <div className="mt-4">
            <h3 className="font-bold text-gray-900 mb-2">Характеристики</h3>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 px-3">
              {characteristics.map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-3 py-2 text-sm">
                  <span className="text-gray-500">{key}</span>
                  <span className="font-medium text-gray-800 text-right">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {product.buyerHint && (
          <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{product.buyerHint}</div>
        )}

        {cartEnabled && product.orderable && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="text-sm font-bold text-gray-700 mb-2">Количество упаковок</div>
            <div className="grid grid-cols-[52px_1fr_52px] gap-2 items-center">
              <button
                onClick={() => setPackages(Math.max(minimum, packages - 1))}
                className="h-[52px] rounded-xl border border-line bg-gray-100 flex items-center justify-center"
              >
                <Minus size={19} strokeWidth={3} />
              </button>
              <div className="h-[52px] rounded-xl border border-line flex items-center justify-center font-black text-xl">
                {packages} <span className="ml-2 text-xs text-gray-500 font-bold">{product.packageType}</span>
              </div>
              <button
                onClick={() => setPackages(packages + 1)}
                className="h-[52px] rounded-xl border border-line bg-gray-100 flex items-center justify-center"
              >
                <Plus size={19} strokeWidth={3} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="mt-3 w-full h-[56px] rounded-xl bg-accent hover:bg-accent-dark text-white font-extrabold flex items-center justify-center gap-2"
            >
              <ShoppingCart size={19} />
              Добавить — {formatPrice(packagePrice * packages)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
