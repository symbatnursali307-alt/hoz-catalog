'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Home, ImageIcon, LogIn, Menu, Search, ShoppingCart } from 'lucide-react';
import CartModal from '@/components/CartModal';
import ProductModal from '@/components/ProductModal';
import PwaInstallButton from '@/components/pwa/PwaInstallButton';
import { captureAttribution, getSessionId, trackCatalogEvent } from '@/lib/analytics-client';
import { formatPrice } from '@/lib/utils';
import { ManagerSelection, Product, useCartStore } from '@/store/cart';

interface Subcategory { id: string; slug: string; name: string }
interface Category { id: string; slug: string; name: string; subcategories?: Subcategory[] }
interface ProductsResponse { items: Product[]; total: number; hasMore: boolean }
interface CatalogConfig {
  companyName: string;
  catalogTitle: string;
  catalogDescription: string | null;
  showPrices: boolean;
  cartEnabled: boolean;
  contactStepEnabled: boolean;
  managers: ManagerSelection[];
}

const PAGE_SIZE = 24;

export default function CatalogPage() {
  const [config, setConfig] = useState<CatalogConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'all'>('all');
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | 'all'>('all');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const requestIdRef = useRef(0);

  const { items, manager, hydrated, setManager, getTotalPackages, getTotalPrice } = useCartStore();
  const totalPackages = hydrated ? getTotalPackages() : 0;
  const totalPrice = hydrated ? getTotalPrice() : 0;
  const cartEnabled = config?.cartEnabled === true;

  useEffect(() => {
    captureAttribution();
    Promise.all([
      fetch('/api/catalog-config').then((response) => response.json()),
      fetch('/api/categories').then((response) => response.json()),
    ])
      .then(([nextConfig, nextCategories]) => {
        setConfig(nextConfig);
        setCategories(Array.isArray(nextCategories) ? nextCategories : []);

        const params = new URLSearchParams(window.location.search);
        const requestedSearch = params.get('search')?.trim();
        if (requestedSearch) setSearchQuery(requestedSearch);

        const requestedCategorySlug = params.get('category')?.toLowerCase();
        const requestedCategory = Array.isArray(nextCategories)
          ? nextCategories.find((item: Category) => item.slug === requestedCategorySlug)
          : null;
        if (requestedCategory) {
          setActiveCategoryId(requestedCategory.id);
          setActiveSubcategoryId('all');
        }

        const requestedSlug = params.get('manager')?.toLowerCase();
        const availableManagers: ManagerSelection[] = Array.isArray(nextConfig.managers) ? nextConfig.managers : [];
        const selected =
          availableManagers.find((item) => item.slug === requestedSlug) ||
          availableManagers.find((item) => item.id === useCartStore.getState().manager?.id) ||
          availableManagers.find((item) => item.isDefault) ||
          availableManagers[0];
        if (selected) setManager(selected);

        const sessionId = getSessionId();
        const openedKey = `catalog_opened:${sessionId}`;
        if (!sessionStorage.getItem(openedKey)) {
          sessionStorage.setItem(openedKey, '1');
          trackCatalogEvent('catalog_opened', { managerId: selected?.id || null });
        }

        const productSlug = params.get('product');
        if (productSlug) {
          void fetch(`/api/products/${encodeURIComponent(productSlug)}`)
            .then((response) => response.ok ? response.json() : null)
            .then((product) => product?.id && setSelectedProduct(product))
            .catch(() => {});
        }
      })
      .catch((error) => console.error('Catalog initialization error:', error))
      .finally(() => setLoading(false));
  }, [setManager]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId),
    [activeCategoryId, categories],
  );

  const loadProducts = useCallback(async (offset: number, reset: boolean) => {
    const requestId = ++requestIdRef.current;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
    else {
      if (activeCategoryId !== 'all') params.set('categoryId', activeCategoryId);
      if (activeSubcategoryId !== 'all') params.set('subcategoryId', activeSubcategoryId);
    }
    setProductsLoading(true);
    try {
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error('Не удалось загрузить товары');
      const data = await response.json() as ProductsResponse;
      if (requestId !== requestIdRef.current) return;
      const nextProducts = Array.isArray(data.items) ? data.items : [];
      setProducts((previous) => reset ? nextProducts : [...previous, ...nextProducts]);
      setProductsTotal(typeof data.total === 'number' ? data.total : nextProducts.length);
      setHasMoreProducts(Boolean(data.hasMore));
    } catch (error) {
      console.error(error);
      if (requestId === requestIdRef.current && reset) setProducts([]);
    } finally {
      if (requestId === requestIdRef.current) setProductsLoading(false);
    }
  }, [activeCategoryId, activeSubcategoryId, debouncedSearchQuery]);

  useEffect(() => {
    if (loading) return;
    setProducts([]);
    setProductsTotal(0);
    setHasMoreProducts(false);
    void loadProducts(0, true);
  }, [loading, activeCategoryId, activeSubcategoryId, debouncedSearchQuery, loadProducts]);

  const chooseCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setActiveSubcategoryId('all');
    if (categoryId !== 'all') {
      trackCatalogEvent('category_viewed', { managerId: manager?.id, categoryId });
    }
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    const url = new URL(window.location.href);
    url.searchParams.set('product', product.slug);
    window.history.replaceState({}, '', url);
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('product');
    window.history.replaceState({}, '', url);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-xl font-bold text-gray-500 animate-pulse">Загрузка каталога...</div>;
  }

  return (
    <div className={cartEnabled ? 'min-h-screen pb-[120px]' : 'min-h-screen pb-8'}>
      <header className="bg-gradient-to-br from-gray-900 to-gray-800 text-white px-4 pt-16 pb-6 relative">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <a href="https://almatytovar.kz" className="flex items-center gap-1.5 text-[13px] font-medium text-white/50 hover:text-white/90" title="На сайт компании">
            <Home size={16} /><span className="hidden sm:inline">О компании</span>
          </a>
          <PwaInstallButton source="catalog_header" variant="dark" />
          <a href="/admin" className="flex items-center gap-1.5 text-[13px] font-medium text-white/50 hover:text-white/90" title="Вход в админ-панель">
            <LogIn size={16} /><span className="hidden sm:inline">Вход</span>
          </a>
        </div>
        <div className="max-w-[1120px] mx-auto">
          <h1 className="mb-2.5 text-[clamp(26px,6vw,48px)] leading-[1.05] tracking-tight font-bold">
            {config?.catalogTitle || 'Каталог хозтоваров'}
          </h1>
          <p className="text-gray-300 text-[15px] max-w-[760px]">
            {config?.catalogDescription || 'Оптовый B2B-каталог. Все цены указаны с НДС.'}
          </p>
          {manager && (
            <div className="mt-3 inline-flex rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-200">
              Ваш менеджер: {manager.name}
            </div>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md shadow-sm border-b border-line">
        <div className="max-w-[1120px] mx-auto">
          <div className="px-4 py-3 flex gap-3 items-center">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                className="w-full pl-10 pr-4 py-3.5 border border-line rounded-xl text-base outline-none bg-white focus:border-accent"
                placeholder="Поиск: перчатки, пакет, плёнка..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="hidden sm:block text-gray-500 text-sm whitespace-nowrap font-medium">Товаров: {productsTotal}</div>
          </div>

          {!searchQuery.trim() && (
            <div id="categories-nav" className="overflow-x-auto hide-scrollbar px-4 pb-3 flex gap-2">
              <button onClick={() => chooseCategory('all')} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap ${activeCategoryId === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>Все товары</button>
              {categories.map((category) => (
                <button key={category.id} onClick={() => chooseCategory(category.id)} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap ${activeCategoryId === category.id ? 'bg-accent text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!searchQuery.trim() && activeCategory?.subcategories?.length ? (
        <div className="bg-white border-b border-line">
          <div className="max-w-[1120px] mx-auto overflow-x-auto hide-scrollbar px-4 py-2.5 flex gap-2">
            <button onClick={() => setActiveSubcategoryId('all')} className={`px-4 py-1.5 rounded-full font-bold text-[13px] whitespace-nowrap ${activeSubcategoryId === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>Все</button>
            {activeCategory.subcategories.map((subcategory) => (
              <button key={subcategory.id} onClick={() => setActiveSubcategoryId(subcategory.id)} className={`px-4 py-1.5 rounded-full font-bold text-[13px] whitespace-nowrap ${activeSubcategoryId === subcategory.id ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>{subcategory.name}</button>
            ))}
          </div>
        </div>
      ) : null}

      <main className="max-w-[1120px] mx-auto px-4 pt-6 pb-8">
        {debouncedSearchQuery && <h2 className="text-xl font-bold mb-4">Результаты поиска: {debouncedSearchQuery}</h2>}
        {products.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map((product, index) => (
              <article key={product.id} onClick={() => openProduct(product)} className="bg-white border border-line rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2.5 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all h-full group">
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-50 border border-line flex items-center justify-center relative">
                  {product.imageUrl || product.photo ? (
                    <Image src={(product.imageUrl || product.photo) as string} alt={product.name} fill sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px" quality={70} loading={index < 4 ? 'eager' : 'lazy'} unoptimized={(product.imageUrl || product.photo)?.startsWith('/uploads/')} className="object-contain p-2 mix-blend-multiply" />
                  ) : <ImageIcon size={26} className="text-gray-300" />}
                  {product.isFeatured && <span className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-amber-950">Популярное</span>}
                </div>
                <div className="flex flex-col flex-1">
                  <div className="text-[11px] text-gray-400 font-bold mb-1">{product.category.name}</div>
                  <h3 className="text-[14px] sm:text-[15px] leading-snug font-bold text-gray-900 mb-1 line-clamp-3">{product.name}</h3>
                  <div className="mt-auto pt-2">
                    {config?.showPrices && product.priceWithVat ? (
                      <div className="text-[17px] sm:text-[20px] font-black text-gray-900 leading-none">
                        {formatPrice(product.priceWithVat)}
                        <div className="text-[11px] text-gray-500 font-bold mt-1">/ {product.unitName || product.unit} с НДС</div>
                      </div>
                    ) : <div className="text-sm font-bold text-gray-500">Цена уточняется</div>}
                    {product.orderable ? (
                      <div className="mt-2 text-[11px] text-gray-500">{product.packageType}: {product.unitsPerPackage} {product.packageUnit || product.unitName}</div>
                    ) : (
                      <div className="mt-2 text-[10px] text-amber-700 font-bold">Фасовка уточняется</div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : productsLoading ? (
          <div className="text-center py-20 text-gray-400 font-bold animate-pulse">Загрузка товаров...</div>
        ) : (
          <div className="text-center py-20 text-gray-500 bg-white rounded-3xl border border-dashed border-gray-200">Ничего не найдено</div>
        )}

        {products.length > 0 && hasMoreProducts && (
          <div className="mt-6 flex justify-center">
            <button onClick={() => loadProducts(products.length, false)} disabled={productsLoading} className="px-6 py-3 rounded-xl bg-white border border-line font-bold text-sm disabled:opacity-50">
              {productsLoading ? 'Загрузка...' : 'Показать ещё'}
            </button>
          </div>
        )}
      </main>

      <div className={`fixed right-4 z-40 flex flex-col gap-2 ${cartEnabled ? 'bottom-[92px]' : 'bottom-4'}`}>
        <button onClick={() => document.getElementById('categories-nav')?.scrollIntoView({ behavior: 'smooth' })} className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-lg lg:hidden"><Menu size={22} /></button>
        {showScrollTop && <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-lg"><ArrowUp size={22} /></button>}
      </div>

      {cartEnabled && (
        <div className="fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-line px-4 py-3 shadow-[0_-8px_28px_rgba(17,24,39,0.08)]">
          <div className="max-w-[1120px] mx-auto flex gap-3 items-center justify-between">
            <div>
              <div className="font-black text-gray-900 text-lg">{totalPackages ? `Итого: ${formatPrice(totalPrice)}` : 'Корзина пустая'}</div>
              <div className="text-gray-500 text-xs mt-1">{totalPackages ? `${totalPackages} упаковок · ${items.length} позиций` : 'Добавляйте товары упаковками'}</div>
            </div>
            <button onClick={() => setIsCartOpen(true)} className="px-5 sm:px-8 h-12 rounded-xl bg-accent text-white font-extrabold flex items-center gap-2"><ShoppingCart size={18} />Корзина</button>
          </div>
        </div>
      )}

      {selectedProduct && <ProductModal product={selectedProduct} cartEnabled={cartEnabled} onClose={closeProduct} />}
      {cartEnabled && isCartOpen && (
        <CartModal
          contactStepEnabled={config?.contactStepEnabled === true}
          onClose={() => setIsCartOpen(false)}
        />
      )}
    </div>
  );
}
