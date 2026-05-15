import { create } from 'zustand';

export interface Product {
  id: string;
  externalId: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  price: string | null;
  priceWithoutVat: number | null;
  priceWithVat: number | null;
  packageType: string | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  photo: string | null;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  subcategory?: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface CartItem extends Product {
  qty: number;
}

interface CartState {
  items: CartItem[];
  addToCart: (product: Product, qty: number) => void;
  removeFromCart: (productId: string) => void;
  updateQty: (productId: string, diff: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addToCart: (product, qty) => {
    set((state) => {
      const existing = state.items.find(i => i.id === product.id);
      if (existing) {
        return {
          items: state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i)
        };
      }
      return { items: [...state.items, { ...product, qty }] };
    });
  },
  removeFromCart: (productId) => {
    set((state) => ({
      items: state.items.filter(i => i.id !== productId)
    }));
  },
  updateQty: (productId, diff) => {
    set((state) => ({
      items: state.items.map(i => {
        if (i.id === productId) {
          const newQty = i.qty + diff;
          return newQty > 0 ? { ...i, qty: newQty } : i;
        }
        return i;
      }).filter(i => i.qty > 0)
    }));
  },
  clearCart: () => set({ items: [] }),
  getTotalItems: () => get().items.reduce((sum, item) => sum + item.qty, 0),
  getTotalPrice: () => get().items.reduce((sum, item) => {
    const price = item.priceWithoutVat ?? parseFloat((item.price || '0').replace(/[^\d.]/g, '') || '0');
    const pkgQty = item.packageQuantity ?? 1;
    return sum + (price * pkgQty * item.qty);
  }, 0),
}));
