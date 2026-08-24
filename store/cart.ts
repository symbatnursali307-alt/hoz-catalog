'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getMinimumPackages, getProductPackagePrice, getUnitsPerPackage } from '@/lib/catalog';

export interface Product {
  id: string;
  externalId: string | null;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  characteristics: Record<string, unknown> | unknown[] | null;
  searchKeywords: string | null;
  buyerHint: string | null;
  unit: string | null;
  unitName: string | null;
  price: string | null;
  priceWithoutVat: number | null;
  priceWithVat: number | null;
  packageType: string | null;
  packageQuantity: number | null;
  unitsPerPackage: number | null;
  packageUnit: string | null;
  minOrderPackages: number;
  photo: string | null;
  imageUrl: string | null;
  packagePrice: number | null;
  isFeatured: boolean;
  metaCatalogId: string | null;
  brand: string | null;
  orderable: boolean;
  validationErrors: string[];
  category: { id: string; slug: string; name: string };
  subcategory?: { id: string; slug: string; name: string } | null;
}

export interface CartItem extends Product {
  packages: number;
}

export interface ManagerSelection {
  id: string;
  name: string;
  slug: string;
  isDefault?: boolean;
}

interface CartState {
  items: CartItem[];
  manager: ManagerSelection | null;
  updatedAt: number;
  hydrated: boolean;
  addToCart: (product: Product, packages: number) => void;
  removeFromCart: (productId: string) => void;
  updatePackages: (productId: string, diff: number) => void;
  clearCart: () => void;
  setManager: (manager: ManagerSelection) => void;
  setHydrated: () => void;
  getTotalPackages: () => number;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  isStale: () => boolean;
}

const CART_TTL = 24 * 60 * 60 * 1000;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      manager: null,
      updatedAt: Date.now(),
      hydrated: false,
      addToCart: (product, packages) => {
        if (!product.orderable) return;
        const minimum = getMinimumPackages(product);
        const amount = Math.max(minimum, Math.round(packages));
        set((state) => {
          const existing = state.items.find((item) => item.id === product.id);
          return {
            updatedAt: Date.now(),
            items: existing
              ? state.items.map((item) =>
                  item.id === product.id ? { ...item, packages: item.packages + amount } : item,
                )
              : [...state.items, { ...product, packages: amount }],
          };
        });
      },
      removeFromCart: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
          updatedAt: Date.now(),
        }));
      },
      updatePackages: (productId, diff) => {
        set((state) => ({
          items: state.items
            .map((item) => {
              if (item.id !== productId) return item;
              const minimum = getMinimumPackages(item);
              return { ...item, packages: Math.max(minimum, item.packages + diff) };
            }),
          updatedAt: Date.now(),
        }));
      },
      clearCart: () => set({ items: [], updatedAt: Date.now() }),
      setManager: (manager) => set({ manager }),
      setHydrated: () => set({ hydrated: true }),
      getTotalPackages: () => get().items.reduce((sum, item) => sum + item.packages, 0),
      getTotalItems: () =>
        get().items.reduce((sum, item) => sum + item.packages * getUnitsPerPackage(item), 0),
      getTotalPrice: () =>
        get().items.reduce((sum, item) => sum + getProductPackagePrice(item) * item.packages, 0),
      isStale: () => get().items.length > 0 && Date.now() - get().updatedAt > CART_TTL,
    }),
    {
      name: 'catalog_cart_v2',
      version: 2,
      partialize: (state) => ({ items: state.items, manager: state.manager, updatedAt: state.updatedAt }),
      migrate: (persisted: any) => ({
        ...persisted,
        items: Array.isArray(persisted?.items)
          ? persisted.items.map((item: any) => ({ ...item, packages: item.packages ?? item.qty ?? 1 }))
          : [],
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
