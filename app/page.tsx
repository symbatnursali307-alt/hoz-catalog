'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCartStore, Product } from '@/store/cart';
import { Search, ChevronDown, ChevronUp, ImageIcon, LogIn } from 'lucide-react';
import ProductModal from '@/components/ProductModal';
import CartModal from '@/components/CartModal';
import { formatPrice } from '@/lib/utils';

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Track which categories are open
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(res => res.json()),
      fetch('/api/products').then(res => res.json())
    ]).then(([cats, prods]) => {
      if (Array.isArray(cats)) {
        setCategories(cats);
        if (cats.length > 0) {
          setOpenCategories({ [cats[0].name]: true });
        }
      }
      
      if (Array.isArray(prods)) {
        setProducts(prods);
      }
      
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching data:', err);
      setLoading(false);
    });
  }, []);

  const { items, getTotalItems, getTotalPrice } = useCartStore();
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const toggleCategory = (title: string) => {
    setOpenCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.category?.name?.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [searchQuery, products]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl font-bold text-gray-500 animate-pulse">Загрузка каталога...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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
            Выберите нужные товары, добавьте количество и отправьте список менеджеру в WhatsApp.
          </p>
          
          <div className="flex flex-wrap gap-2.5 mt-4">
            <a 
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold no-underline text-[15px] min-h-[48px] text-white border border-white/25 bg-white/10 hover:bg-white/20 transition-colors"
              href="#catalog"
            >
              Открыть каталог
            </a>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-line px-4 py-3">
        <div className="max-w-[1120px] mx-auto flex gap-3 items-center">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={20} />
            </div>
            <input 
              type="search" 
              className="w-full pl-10 pr-4 py-3.5 border border-line rounded-xl text-base outline-none bg-white focus:border-accent transition-colors"
              placeholder="Поиск: перчатки, пакет, плёнка, коврик..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden sm:block text-muted text-sm whitespace-nowrap font-medium">
            Товаров: {filteredProducts.length}
          </div>
        </div>
      </div>

      <main id="catalog" className="max-w-[1120px] mx-auto px-4 pt-[18px] pb-5">
        {categories.map((category) => {
          // Filter items for this category
          const categoryProducts = filteredProducts.filter(p => p.category?.id === category.id);
          
          // Hide category if search yields no results for it
          if (categoryProducts.length === 0) return null;
          
          // Force open if searching
          const isOpen = searchQuery.trim() ? true : openCategories[category.name];

          return (
            <div key={category.id} className="bg-white border border-line rounded-[18px] mb-3.5 overflow-hidden">
              <div 
                className="cursor-pointer p-[18px] flex justify-between items-center bg-white hover:bg-gray-50 transition-colors"
                onClick={() => toggleCategory(category.name)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg sm:text-[20px] font-black tracking-tight">{category.name}</span>
                  <b className="text-[13px] text-muted bg-gray-100 rounded-full px-2.5 py-1.5 whitespace-nowrap font-bold">
                    {categoryProducts.length} товаров
                  </b>
                </div>
                <div className="text-gray-400">
                  {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              {isOpen && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 pb-2.5 sm:pb-3.5">
                  {categoryProducts.map(product => (
                    <article 
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="bg-white border border-line rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2.5 cursor-pointer hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(17,24,39,0.08)] transition-all duration-150 h-full"
                    >
                      <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-50 border border-line flex flex-col items-center justify-center text-gray-500 text-xs font-bold text-center relative shrink-0">
                        {product.photo ? (
                          <img 
                            src={product.photo} 
                            alt={product.name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <>
                            <ImageIcon size={20} className="mb-1 opacity-50" />
                            Фото позже
                          </>
                        )}
                      </div>
                      <div className="flex flex-col flex-1">
                        <h3 className="m-0 text-[14px] sm:text-[16px] leading-tight font-bold text-gray-900 mb-1 line-clamp-2 h-[2.5em] sm:h-[2.5em]">
                          {product.name}
                        </h3>
                        <div className="mt-auto pt-1">
                          <div className="text-[18px] sm:text-[22px] font-black tracking-tight text-dark leading-none mb-1">
                            {product.price || 'Цена по запросу'}
                          </div>
                          {product.unit && (
                            <div className="text-muted text-[11px] sm:text-[13px] leading-tight opacity-80 font-medium">
                              {product.unit}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

            </div>
          );
        })}
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-20 text-muted">
            По вашему запросу ничего не найдено.
          </div>
        )}
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-line px-4 py-2.5 shadow-[0_-8px_28px_rgba(17,24,39,0.08)]">
        <div className="max-w-[1120px] mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="text-center sm:text-left flex-1">
            <div className="font-black text-gray-900 text-lg">
              {totalItems > 0 && totalPrice > 0 ? `Итого: ${formatPrice(totalPrice)}` : totalItems > 0 ? `В корзине: ${totalItems} шт.` : 'Корзина пустая'}
            </div>
            <div className="text-muted text-[13px] font-medium mt-0.5">
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

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}

      {isCartOpen && (
        <CartModal onClose={() => setIsCartOpen(false)} />
      )}
    </div>
  );
}
