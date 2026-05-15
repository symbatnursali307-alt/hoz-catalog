'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Eye, EyeOff, Pencil, Package, Plus, ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  externalId: string | null;
  name: string;
  photo: string | null;
  priceWithoutVat: number | null;
  priceWithVat: number | null;
  unit: string | null;
  packageType: string | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  sortOrder: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
}

function AdminProductsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>((searchParams.get('active') as any) || 'all');

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterCategory) params.set('category', filterCategory);
    if (filterActive !== 'all') params.set('active', filterActive);
    
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [search, filterCategory, filterActive, pathname, router]);

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
      return true;
    });
  }, [products, search, filterCategory, filterActive]);

  const toggleActive = async (id: string, currentActive: boolean) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentActive }),
    });
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
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-colors no-underline"
        >
          <Plus size={18} />
          Добавить товар
        </Link>
      </div>

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
                <th className="text-center px-4 py-3 font-bold text-gray-600 w-20">Статус</th>
                <th className="text-center px-4 py-3 font-bold text-gray-600 w-24">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">Товаров не найдено</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                        {p.photo ? (
                          <img src={p.photo} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon size={14} className="text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 leading-tight">{p.name}</div>
                      {p.externalId && <div className="text-xs text-gray-400 mt-0.5">{p.externalId}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">{p.category?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium hidden lg:table-cell">
                      {p.priceWithoutVat ? `${p.priceWithoutVat.toLocaleString('ru-RU')} ₸` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">{p.unit || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 hidden xl:table-cell text-xs">
                      {p.packageType && p.packageQuantity
                        ? `${p.packageType} / ${p.packageQuantity} ${p.packageUnit || ''}`
                        : '—'}
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
                      <Link
                        href={`/admin/products/${p.id}/edit?return_to=${encodeURIComponent(pathname + '?' + searchParams.toString())}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent-dark transition-colors no-underline"
                      >
                        <Pencil size={14} />
                        Изменить
                      </Link>
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
