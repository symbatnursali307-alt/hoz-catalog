'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, MessageCircle, Package, Search } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface SubmissionSummary {
  id: string;
  orderNumber: number;
  publicId: string;
  phone: string;
  customerName: string | null;
  itemCount: number;
  totalAmount: number;
  managerNameSnapshot: string | null;
  createdAt: string;
  manager: { id: string; name: string; slug: string } | null;
}

export default function CartSubmissionsPage() {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (activeSearch) params.set('q', activeSearch);
      const response = await fetch(`/api/admin/cart-submissions?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить заказы');
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
    } finally {
      setLoading(false);
    }
  }, [activeSearch]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setActiveSearch(search.trim());
  };

  return (
    <div className="max-w-[1100px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-950">Заказы</h2>
          <p className="mt-1 text-sm text-gray-500">Заказы, сохранённые до перехода клиента в WhatsApp. Всего: {total}.</p>
        </div>
        <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-md">
          <label className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Номер заказа или телефон"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <button className="h-11 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white">Найти</button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-12 text-center font-bold text-gray-400">Загрузка заказов...</div>
      ) : !items.length ? (
        <div className="rounded-2xl border bg-white p-12 text-center text-gray-400">
          {activeSearch ? 'Заказы по запросу не найдены' : 'Заказов пока нет'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/cart-submissions/${item.id}`}
              className="grid gap-3 rounded-2xl border bg-white p-4 text-gray-950 no-underline shadow-sm transition hover:border-teal-200 hover:shadow-md sm:grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(130px,.8fr)_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600"><MessageCircle size={19} /></div>
                <div className="min-w-0">
                  <div className="truncate font-black">Заказ №{item.orderNumber}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <CalendarDays size={13} /> {new Date(item.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-bold">{item.customerName || 'Имя не указано'}</div>
                <div className="text-gray-500">{item.phone || 'Телефон не запрашивался'}</div>
              </div>

              <div className="text-sm">
                <div className="font-bold">{item.manager?.name || item.managerNameSnapshot || 'Без менеджера'}</div>
                <div className="flex items-center gap-1 text-gray-500"><Package size={14} /> {item.itemCount} позиций</div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="text-lg font-black">{formatPrice(item.totalAmount)}</div>
                <ChevronRight className="text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
