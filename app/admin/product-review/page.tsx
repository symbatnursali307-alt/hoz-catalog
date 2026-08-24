'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleAlert, Pencil, RefreshCw, Search, ShieldAlert } from 'lucide-react';

interface QualityIssue {
  code: string;
  severity: 'error' | 'warning';
  title: string;
  details: string;
  fields: string[];
}

interface ReviewItem {
  id: string;
  name: string;
  externalId: string | null;
  imageUrl: string | null;
  photo: string | null;
  isActive: boolean;
  updatedAt: string;
  category: { id: string; name: string } | null;
  review: { id: string; status: string; note: string | null; updatedAt: string } | null;
  quality: { issueCount: number; errorCount: number; warningCount: number };
  issues: QualityIssue[];
}

interface ReviewResponse {
  generatedAt: string;
  stats: {
    totalProducts: number;
    needsReview: number;
    withErrors: number;
    warningsOnly: number;
    manualPending: number;
    clean: number;
  };
  items: ReviewItem[];
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`text-3xl font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-bold text-gray-500">{label}</div>
    </div>
  );
}

export default function ProductReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings' | 'manual'>('all');
  const [visibility, setVisibility] = useState<'all' | 'active' | 'hidden'>('all');
  const [resolving, setResolving] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/product-reviews', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить очередь');
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить очередь');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return (data?.items || []).filter((item) => {
      if (query && ![
        item.name,
        item.externalId || '',
        item.category?.name || '',
        item.review?.note || '',
        ...item.issues.flatMap((issue) => [issue.title, issue.details]),
      ].some((value) => value.toLocaleLowerCase('ru-RU').includes(query))) return false;
      if (filter === 'errors' && !item.quality.errorCount) return false;
      if (filter === 'warnings' && (item.quality.errorCount > 0 || !item.quality.warningCount)) return false;
      if (filter === 'manual' && item.review?.status !== 'PENDING') return false;
      if (visibility === 'active' && !item.isActive) return false;
      if (visibility === 'hidden' && item.isActive) return false;
      return true;
    });
  }, [data, filter, search, visibility]);

  useEffect(() => { setVisibleCount(30); }, [filter, search, visibility]);
  const visibleItems = filtered.slice(0, visibleCount);

  const resolveManual = async (reviewId: string) => {
    setResolving(reviewId);
    setError('');
    try {
      const response = await fetch(`/api/admin/product-reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось закрыть проверку');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось закрыть проверку');
    } finally {
      setResolving('');
    }
  };

  if (loading && !data) return <div className="py-20 text-center font-bold text-gray-400 animate-pulse">Проверяем данные товаров...</div>;

  return (
    <div className="max-w-[1400px] space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-gray-900"><ShieldAlert className="text-amber-500" /> Проверка данных</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Автоматические ошибки, отклонения от стандарта и товары, которые менеджер отправил на ручную проверку.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 disabled:opacity-50">
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} /> Перепроверить
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Всего товаров" value={data.stats.totalProducts} tone="text-gray-900" />
          <SummaryCard label="Требуют проверки" value={data.stats.needsReview} tone="text-amber-600" />
          <SummaryCard label="С ошибками" value={data.stats.withErrors} tone="text-red-600" />
          <SummaryCard label="Только замечания" value={data.stats.warningsOnly} tone="text-orange-500" />
          <SummaryCard label="Отмечены вручную" value={data.stats.manualPending} tone="text-blue-600" />
          <SummaryCard label="Без замечаний" value={data.stats.clean} tone="text-green-600" />
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_180px]">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Товар, артикул, категория или причина..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent">
          <option value="all">Все причины</option><option value="errors">Критические ошибки</option><option value="warnings">Только замечания</option><option value="manual">Ручная проверка</option>
        </select>
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent">
          <option value="all">Все статусы</option><option value="active">Активные</option><option value="hidden">Скрытые</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Показано: <strong className="text-gray-900">{Math.min(visibleCount, filtered.length)}</strong> из {filtered.length}</span>
        {data?.generatedAt && <span className="hidden sm:inline">Расчёт: {new Date(data.generatedAt).toLocaleString('ru-RU')}</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-green-100 bg-green-50 py-16 text-center text-green-800"><CheckCircle2 className="mx-auto mb-3" size={44} /><div className="font-black">По выбранному фильтру замечаний нет</div></div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex min-w-0 gap-3 lg:w-[320px] lg:shrink-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">{item.imageUrl || item.photo ? <img src={(item.imageUrl || item.photo) as string} alt="" loading="lazy" className="h-full w-full object-contain" /> : null}</div>
                  <div className="min-w-0"><div className="font-bold leading-snug text-gray-900">{item.name}</div><div className="mt-1 text-xs text-gray-400">{item.category?.name || 'Без категории'}{item.externalId ? ` · ${item.externalId}` : ''}</div><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${item.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isActive ? 'АКТИВЕН' : 'СКРЫТ'}</span></div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {item.review?.status === 'PENDING' && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Ручная проверка:</strong> {item.review.note || 'Комментарий не указан'}</div>}
                  {item.issues.map((qualityIssue) => (
                    <div key={qualityIssue.code} className={`flex gap-2 rounded-xl border p-3 ${qualityIssue.severity === 'error' ? 'border-red-100 bg-red-50 text-red-900' : 'border-amber-100 bg-amber-50 text-amber-900'}`}>
                      {qualityIssue.severity === 'error' ? <CircleAlert size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
                      <div className="text-sm"><strong>{qualityIssue.title}</strong><div className="mt-0.5 text-xs opacity-80">{qualityIssue.details}</div></div>
                    </div>
                  ))}
                </div>

                <div className="flex shrink-0 flex-row gap-2 lg:w-[180px] lg:flex-col">
                  <Link href={`/admin/products/${item.id}/edit?return_to=${encodeURIComponent('/admin/product-review')}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white no-underline"><Pencil size={16} /> Исправить</Link>
                  {item.review?.status === 'PENDING' && <button onClick={() => resolveManual(item.review!.id)} disabled={resolving === item.review.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-700 disabled:opacity-50"><CheckCircle2 size={16} /> Проверено</button>}
                </div>
              </div>
            </article>
          ))}
          {visibleItems.length < filtered.length && (
            <button onClick={() => setVisibleCount((count) => count + 30)} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 shadow-sm hover:border-accent hover:text-accent">Показать ещё 30</button>
          )}
        </div>
      )}
    </div>
  );
}
