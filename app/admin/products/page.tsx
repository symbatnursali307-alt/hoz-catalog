'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Eye, EyeOff, Pencil, Plus, ImageIcon, Flag, ShieldAlert } from 'lucide-react';

interface Product {
  id: string;
  externalId: string | null;
  name: string;
  photo: string | null;
  imageUrl: string | null;
  priceWithoutVat: number | null;
  priceWithVat: number | null;
  unit: string | null;
  unitName: string | null;
  packageType: string | null;
  packageQuantity: number | null;
  unitsPerPackage: number | null;
  packageUnit: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  category: { id: string; name: string } | null;
  review: { id: string; status: string; note: string | null } | null;
  quality: { needsReview: boolean; issueCount: number; errorCount: number; warningCount: number };
}

function AdminProductsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>((searchParams.get('active') as any) || 'all');
  const [filterReview, setFilterReview] = useState<'all' | 'needs' | 'clean' | 'manual'>((searchParams.get('review') as any) || 'all');

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterCategory) params.set('category', filterCategory);
    if (filterActive !== 'all') params.set('active', filterActive);
    if (filterReview !== 'all') params.set('review', filterReview);
    
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [search, filterCategory, filterActive, filterReview, pathname, router]);

  const fetchProducts = () => {
    fetch('/api/admin/products')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    products.forEach((p) => {
      if (p.category) cats.set(p.category.id, p.category.name);
    });
    return Array.from(cats, ([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.externalId?.toLowerCase().includes(q)) return false;
      }
      if (filterCategory && p.category?.id !== filterCategory) return false;
      if (filterActive === 'active' && !p.isActive) return false;
      if (filterActive === 'hidden' && p.isActive) return false;
      if (filterReview === 'needs' && !p.quality.needsReview && p.review?.status !== 'PENDING') return false;
      if (filterReview === 'clean' && (p.quality.needsReview || p.review?.status === 'PENDING')) return false;
      if (filterReview === 'manual' && p.review?.status !== 'PENDING') return false;
      return true;
    });
  }, [products, search, filterCategory, filterActive, filterReview]);

  const toggleActive = async (id: string, currentActive: boolean) => {
    setActionError('');
    setActionSuccess('');
    const response = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionError(data.error || 'Не удалось изменить статус');
      return;
    }
    fetchProducts();
  };

  const markForReview = async (product: Product) => {
    const note = window.prompt('Что именно нужно проверить или исправить?', product.review?.note || '');
    if (note === null) return;
    if (!note.trim()) {
      setActionError('Добавьте комментарий для проверки');
      return;
    }
    setActionError('');
    setActionSuccess('');
    const response = await fetch('/api/admin/product-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, note }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionError(data.error || 'Не удалось отправить товар на проверку');
      return;
    }
    setActionSuccess(`«${product.name}» добавлен в очередь проверки`);
    fetchProducts();
  };

  if (loading) {
    return <div className="text-gray-400 font-bold animate-pulse py-20 text-center">Загрузка товаров...</div>;
  }

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Товары</h2>
          <p className="text-sm text-gray-500">{products.length} всего · {filtered.length} показано</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/admin/product-review" className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 no-underline"><ShieldAlert size={18} /> Проверка данных</Link>
          <Link href="/admin/products/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-dark"><Plus size={18} /> Добавить товар</Link>
        </div>
      </div>

      {actionError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
      {actionSuccess && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{actionSuccess}</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию или артикулу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as any)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white"
        >
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="hidden">Скрытые</option>
        </select>
        <select value={filterReview} onChange={(event) => setFilterReview(event.target.value as typeof filterReview)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white">
          <option value="all">Любая проверка</option>
          <option value="needs">Требуют проверки</option>
          <option value="manual">Отмечены вручную</option>
          <option value="clean">Без замечаний</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-bold text-gray-600 w-12">Фото</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Название</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600 hidden md:table-cell">Категория</th>
                <th className="text-right px-4 py-3 font-bold text-gray-600 hidden lg:table-cell">Цена</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600 hidden lg:table-cell">Ед.</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600 hidden xl:table-cell">Фасовка</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600 w-28">Проверка</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600 w-20">Статус</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600 w-24">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">Товаров не найдено</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                        {p.imageUrl || p.photo ? (
                          <img src={(p.imageUrl || p.photo) as string} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon size={14} className="text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 leading-tight">{p.name}</div>
                      {p.isFeatured && <div className="mt-0.5 text-[10px] font-bold text-amber-600">ПОПУЛЯРНОЕ</div>}
                      {p.externalId && <div className="text-xs text-gray-400 mt-0.5">{p.externalId}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">{p.category?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium hidden lg:table-cell">
                      {p.priceWithVat ? `${p.priceWithVat.toLocaleString('ru-RU')} ₸ с НДС` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">{p.unitName || p.unit || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 hidden xl:table-cell text-xs">
                      {p.packageType && (p.unitsPerPackage || p.packageQuantity)
                        ? `${p.packageType} / ${p.unitsPerPackage || p.packageQuantity} ${p.packageUnit || ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.quality.errorCount > 0 ? (
                        <Link href="/admin/product-review" className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700 no-underline">{p.quality.errorCount} ошибок</Link>
                      ) : p.quality.warningCount > 0 || p.review?.status === 'PENDING' ? (
                        <Link href="/admin/product-review" className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 no-underline">{p.quality.warningCount + Number(p.review?.status === 'PENDING')} замеч.</Link>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-black text-green-700">Готово</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                          p.isActive
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {p.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                        {p.isActive ? 'Вкл' : 'Выкл'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-2">
                      <Link
                        href={`/admin/products/${p.id}/edit?return_to=${encodeURIComponent(pathname + '?' + searchParams.toString())}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent-dark transition-colors no-underline"
                      >
                        <Pencil size={14} />
                        Изменить
                      </Link>
                      <button onClick={() => markForReview(p)} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900"><Flag size={13} /> На проверку</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 font-bold animate-pulse py-20 text-center">Загрузка интерфейса...</div>}>
      <AdminProductsPageInner />
    </Suspense>
  );
}
