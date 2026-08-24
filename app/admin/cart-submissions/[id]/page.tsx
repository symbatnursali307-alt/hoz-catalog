'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, ExternalLink, ImageOff, MessageCircle, Package } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface Snapshot {
  productId: string;
  name: string;
  imageUrl?: string;
  sku?: string;
  brand?: string;
  categoryName?: string;
  priceWithVat: number;
  unitName: string;
  packageType: string;
  unitsPerPackage: number;
  packageUnit: string;
  packageQuantity: number;
  lineTotal: number;
}

interface OrderDetails {
  id: string;
  orderNumber: number;
  publicId: string;
  orderUrl: string;
  phone: string;
  customerName: string | null;
  totalAmount: number;
  itemCount: number;
  items: Snapshot[];
  createdAt: string;
  managerNameSnapshot: string | null;
  managerPhoneSnapshot: string | null;
  manager: { name: string; whatsappPhone: string } | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  visitorId: string;
  sessionId: string;
}

export default function AdminOrderPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/cart-submissions/${encodeURIComponent(params.id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось загрузить заказ');
        setOrder(data);
      })
      .catch((nextError) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="py-20 text-center font-bold text-gray-400">Загрузка заказа...</div>;
  if (error || !order) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error || 'Заказ не найден'}</div>;

  const managerName = order.manager?.name || order.managerNameSnapshot || 'Без менеджера';
  const managerPhone = order.manager?.whatsappPhone || order.managerPhoneSnapshot || '';

  return (
    <div className="max-w-[1100px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/admin/cart-submissions" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-gray-500 no-underline hover:text-gray-900"><ArrowLeft size={16} /> Все заказы</Link>
          <h2 className="text-2xl font-black">Заказ №{order.orderNumber}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500"><CalendarDays size={16} /> {new Date(order.createdAt).toLocaleString('ru-RU')}</div>
        </div>
        <a href={order.orderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white no-underline"><ExternalLink size={17} /> Открыть страницу клиента</a>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-gray-400">Клиент</div><div className="mt-1 font-black">{order.customerName || 'Имя не указано'}</div><div className="text-sm text-gray-500">{order.phone || 'Телефон не запрашивался'}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-gray-400">Менеджер</div><div className="mt-1 font-black">{managerName}</div><div className="text-sm text-gray-500">{managerPhone || 'Номер недоступен'}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-gray-400">Итого</div><div className="mt-1 text-2xl font-black">{formatPrice(order.totalAmount)}</div><div className="text-sm text-gray-500">{order.itemCount} позиций</div></div>
      </div>

      <div className="grid gap-3">
        {order.items.map((item, index) => (
          <article key={`${item.productId}-${index}`} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center sm:p-4">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gray-50">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-1" /> : <ImageOff size={28} className="text-gray-300" />}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase text-accent">Позиция {index + 1}{item.sku ? ` · ${item.sku}` : ''}</div>
                <h3 className="mt-1 break-words font-black leading-snug">{item.name}</h3>
                <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                  <div>Цена: <b>{formatPrice(item.priceWithVat)} / {item.unitName}</b></div>
                  <div>Фасовка: <b>{item.packageType}, {item.unitsPerPackage} {item.packageUnit}</b></div>
                  {item.brand && <div>Бренд: <b>{item.brand}</b></div>}
                  {item.categoryName && <div>Категория: <b>{item.categoryName}</b></div>}
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2 border-t pt-3 sm:col-span-1 sm:min-w-40 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <div><div className="text-xs text-gray-500">Количество</div><div className="font-black">{item.packageQuantity} уп.</div></div>
                <div className="text-right"><div className="text-xs text-gray-500">Сумма</div><div className="font-black text-accent">{formatPrice(item.lineTotal)}</div></div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-black"><Package size={18} /> Атрибуция</h3>
          <dl className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <dt className="text-gray-500">Источник</dt><dd>{order.utmSource || 'прямой'}</dd>
            <dt className="text-gray-500">Кампания</dt><dd>{order.utmCampaign || '—'}</dd>
            <dt className="text-gray-500">Medium</dt><dd>{order.utmMedium || '—'}</dd>
            <dt className="text-gray-500">Visitor ID</dt><dd className="break-all font-mono text-xs">{order.visitorId}</dd>
            <dt className="text-gray-500">Session ID</dt><dd className="break-all font-mono text-xs">{order.sessionId}</dd>
          </dl>
        </section>
        {managerPhone && (
          <section className="flex flex-col justify-between rounded-2xl border bg-white p-4">
            <div><h3 className="flex items-center gap-2 font-black"><MessageCircle size={18} /> Связь с менеджером</h3><p className="mt-2 text-sm text-gray-500">Откроется диалог по заказу №{order.orderNumber}.</p></div>
            <a href={`https://wa.me/${managerPhone}?text=${encodeURIComponent(`Здравствуйте! Уточнение по заказу №${order.orderNumber}.`)}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-11 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-bold text-white no-underline">Открыть WhatsApp</a>
          </section>
        )}
      </div>
    </div>
  );
}
