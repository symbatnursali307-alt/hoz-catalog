'use client';

import Image from 'next/image';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useCartStore, Product } from '@/store/cart';
import { Search, ImageIcon, LogIn, ArrowUp, Menu } from 'lucide-react';
import ProductModal from '@/components/ProductModal';
import CartModal from '@/components/CartModal';
import { formatPrice } from '@/lib/utils';
import { CART_ENABLED } from '@/lib/features';

interface Subcategory {
  id: string;
  slug: string;
  name: string;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  subcategories?: Subcategory[];
}

interface ProductsResponse {
  items: Product[];
  total: number;
  nextOffset: number;
  hasMore: boolean;
}

const PAGE_SIZE = 24;

export default function CatalogPage() {
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

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then((cats) => {
      if (Array.isArray(cats)) {
        setCategories(cats);
        if (cats.length > 0) {
          setActiveCategoryId(cats[0].id); // Default to first category
        }
      }
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching data:', err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { items, getTotalItems, getTotalPrice } = useCartStore();
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setActiveSubcategoryId('all');
  };

  const activeCategory = useMemo(() => 
    categories.find(c => c.id === activeCategoryId), 
  [activeCategoryId, categories]);

  const loadProducts = useCallback(async (offset: number, reset: boolean) => {
    const requestId = ++requestIdRef.current;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    if (debouncedSearchQuery) {
      params.set('search', debouncedSearchQuery);
    } else {
      if (activeCategoryId !== 'all') params.set('categoryId', activeCategoryId);
      if (activeSubcategoryId !== 'all') params.set('subcategoryId', activeSubcategoryId);
    }

    setProductsLoading(true);

    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json() as ProductsResponse;

      if (requestId !== requestIdRef.current) return;

      const nextProducts = Array.isArray(data.items) ? data.items : [];
      setProducts(prev => reset ? nextProducts : [...prev, ...nextProducts]);
      setProductsTotal(typeof data.total === 'number' ? data.total : nextProducts.length);
      setHasMoreProducts(Boolean(data.hasMore));
    } catch (err) {
      console.error('Error fetching products:', err);
      if (requestId === requestIdRef.current && reset) {
        setProducts([]);
        setProductsTotal(0);
        setHasMoreProducts(false);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setProductsLoading(false);
      }
    }
  }, [activeCategoryId, activeSubcategoryId, debouncedSearchQuery]);

  useEffect(() => {
    if (loading) return;
    setProducts([]);
    setProductsTotal(0);
    setHasMoreProducts(false);
    loadProducts(0, true);
  }, [loading, activeCategoryId, activeSubcategoryId, debouncedSearchQuery, loadProducts]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToCategories = () => {
    const el = document.getElementById('categories-nav');
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLoadMore = () => {
    if (!productsLoading && hasMoreProducts) {
      loadProducts(products.length, false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl font-bold text-gray-500 animate-pulse">Загрузка каталога...</div>
      </div>
    );
  }

  return (
    <div className={CART_ENABLED ? 'min-h-screen pb-[120px]' : 'min-h-screen pb-8'}>
      <header className="bg-gradient-to-br from-gray-900 to-gray-800 text-white px-4 pt-6 pb-[22px] relative">
        <div className="absolute top-4 right-4 sm:right-6">
          <a href="/admin" className="text-white/30 hover:text-white/80 transition-colors flex items-center gap-1.5 text-[13px] font-medium" title="Вход в админ-панель">
            <LogIn size={16} />
            <span className="hidden sm:inline">Вход</span>
          </a>
        </div>
        <div className="max-w-[1120px] mx-auto">
          <h1 className="m-0 mb-2.5 text-[clamp(26px,6vw,48px)] leading-[1.05] tracking-tight font-bold">
            Каталог хозтоваров
          </h1>
          <p className="m-0 text-gray-300 text-[15px] max-w-[760px]">
            Ознакомьтесь с ассортиментом и характеристиками товаров.
          </p>
        </div>
      </header>

      {/* Sticky Search & Navigation Area */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md shadow-sm border-b border-line">
        <div className="max-w-[1120px] mx-auto">
          {/* Search Bar */}
          <div className="px-4 py-3 flex gap-3 items-center">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={20} />
              </div>
              <input 
                type="search" 
                className="w-full pl-10 pr-4 py-3.5 border border-line rounded-xl text-base outline-none bg-white focus:border-accent transition-colors"
                placeholder="Поиск: перчатки, пакет, плёнка..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="hidden sm:block text-muted text-sm whitespace-nowrap font-medium">
              Товаров: {productsTotal}
            </div>
          </div>

          {/* Main Categories Nav */}
          {!searchQuery.trim() && (
            <div id="categories-nav" className="overflow-x-auto hide-scrollbar px-4 pb-3 flex gap-2">
              <button
                onClick={() => handleCategoryClick('all')}
                className={`px-4 py-2 rounded-full font-bold text-[14px] whitespace-nowrap transition-colors shrink-0 ${
                  activeCategoryId === 'all' 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Все товары
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`px-4 py-2 rounded-full font-bold text-[14px] whitespace-nowrap transition-colors shrink-0 ${
                    activeCategoryId === cat.id 
                      ? 'bg-accent text-white shadow-md shadow-accent/20' 
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subcategories Nav */}
      {!searchQuery.trim() && activeCategory && activeCategory.subcategories && activeCategory.subcategories.length > 0 && (
        <div className="bg-white border-b border-line">
          <div className="max-w-[1120px] mx-auto overflow-x-auto hide-scrollbar px-4 py-2.5 flex gap-2">
            <button
              onClick={() => setActiveSubcategoryId('all')}
              className={`px-4 py-1.5 rounded-full font-bold text-[13px] whitespace-nowrap transition-colors shrink-0 border ${
                activeSubcategoryId === 'all' 
                  ? 'bg-gray-100 border-gray-300 text-gray-900' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Все
            </button>
            {activeCategory.subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubcategoryId(sub.id)}
                className={`px-4 py-1.5 rounded-full font-bold text-[13px] whitespace-nowrap transition-colors shrink-0 border ${
                  activeSubcategoryId === sub.id 
                    ? 'bg-gray-100 border-gray-300 text-gray-900' 
                    : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <main id="catalog" className="max-w-[1120px] mx-auto px-4 pt-6 pb-8">
        
        {searchQuery && (
          <h2 className="text-xl font-bold mb-4">Результаты поиска: {searchQuery}</h2>
        )}

        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map((product, index) => (
              <article 
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="bg-white border border-line rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2.5 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-200 h-full group"
              >
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-50/50 border border-line flex flex-col items-center justify-center text-gray-500 text-xs font-bold text-center relative shrink-0 group-hover:border-accent/30 transition-colors">
                  {product.photo ? (
                    <Image
                      src={product.photo} 
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px"
                      quality={68}
                      loading={index < 4 ? 'eager' : 'lazy'}
                      fetchPriority={index < 2 ? 'high' : 'auto'}
                      className="object-contain p-2 mix-blend-multiply"
                    />
                  ) : (
                    <>
                      <ImageIcon size={24} className="mb-1.5 opacity-30" />
                      <span className="opacity-60">Фото позже</span>
                    </>
                  )}
                </div>
                <div className="flex flex-col flex-1">
                  <h3 className="m-0 text-[14px] sm:text-[15px] leading-snug font-bold text-gray-900 mb-1 line-clamp-3">
                    {product.name}
                  </h3>
                  <div className="mt-auto pt-2">
                    <div className="text-[17px] sm:text-[20px] font-black tracking-tight text-dark leading-none mb-1">
                      {product.price || 'Цена по запросу'}
                    </div>
                    {product.unit && (
                      <div className="text-muted text-[12px] leading-tight opacity-80 font-medium">
                        {product.unit}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="bg-white border border-line rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2.5 h-full">
                <div className="aspect-square w-full rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-4 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
                <div className="mt-auto pt-2">
                  <div className="h-5 w-1/2 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Ничего не найдено</h3>
            <p>По вашему запросу или выбранным фильтрам нет товаров.</p>
            {(activeCategoryId !== 'all' || activeSubcategoryId !== 'all' || searchQuery) && (
              <button 
                onClick={() => {
                  handleCategoryClick('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold text-sm transition-colors cursor-pointer"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        {products.length > 0 && (
          <div className="mt-6 flex justify-center">
            {hasMoreProducts ? (
              <button
                onClick={handleLoadMore}
                disabled={productsLoading}
                className="px-6 py-3 rounded-xl bg-white border border-line text-gray-800 hover:bg-gray-50 disabled:opacity-60 font-bold text-sm shadow-sm transition-colors"
              >
                {productsLoading ? 'Загрузка...' : 'Показать ещё'}
              </button>
            ) : (
              <div className="text-muted text-sm font-medium">
                Показаны все товары
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Buttons */}
      <div className={`fixed right-4 z-40 flex flex-col gap-2 ${CART_ENABLED ? 'bottom-[88px] sm:bottom-[100px]' : 'bottom-4'}`}>
        <button 
          onClick={scrollToCategories}
          className="w-12 h-12 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full flex items-center justify-center text-gray-700 shadow-lg hover:bg-white hover:text-accent transition-colors lg:hidden"
          title="К категориям"
        >
          <Menu size={22} />
        </button>
        
        {showScrollTop && (
          <button 
            onClick={scrollToTop}
            className="w-12 h-12 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full flex items-center justify-center text-gray-700 shadow-lg hover:bg-white hover:text-accent transition-colors animate-in fade-in zoom-in duration-200"
            title="Наверх"
          >
            <ArrowUp size={22} />
          </button>
        )}
      </div>

      {CART_ENABLED && (
        <div className="fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-line px-4 py-3 shadow-[0_-8px_28px_rgba(17,24,39,0.08)]">
          <div className="max-w-[1120px] mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="text-center sm:text-left flex-1">
              <div className="font-black text-gray-900 text-[19px] leading-none">
                {totalItems > 0 && totalPrice > 0 ? `Итого: ${formatPrice(totalPrice)}` : totalItems > 0 ? `В корзине: ${totalItems} шт.` : 'Корзина пустая'}
              </div>
              <div className="text-muted text-[13px] font-medium mt-1">
                {totalItems > 0 
                  ? `${items.length} позиций — можно отправить заказ` 
                  : 'Откройте товар и добавьте количество'}
              </div>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-extrabold text-[15px] transition-colors whitespace-nowrap shadow-sm shadow-accent/20"
            >
              Открыть корзину
            </button>
          </div>
        </div>
      )}

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}

      {CART_ENABLED && isCartOpen && (
        <CartModal onClose={() => setIsCartOpen(false)} />
      )}
    </div>
  );
}
