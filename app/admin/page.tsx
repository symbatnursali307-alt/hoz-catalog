'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, FolderTree, Users, Eye, EyeOff, TrendingUp } from 'lucide-react';

interface Stats {
  totalProducts: number;
  activeProducts: number;
  hiddenProducts: number;
  totalCategories: number;
  totalClients: number;
  recentProducts: { id: string; name: string; photo: string | null; createdAt: string; isActive: boolean }[];
  recentClients: { id: string; name: string; city: string; phone: string; createdAt: string; _count: { selectedProducts: number } }[];
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <div className="text-3xl font-black text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 font-medium mt-1">{title}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 font-bold animate-pulse">Загрузка статистики...</div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-20 text-gray-500">Не удалось загрузить данные</div>;
  }

  return (
    <div className="max-w-[1200px]">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Всего товаров" value={stats.totalProducts} icon={Package} color="bg-blue-500" />
        <StatCard title="Активных" value={stats.activeProducts} icon={Eye} color="bg-green-500" />
        <StatCard title="Скрытых" value={stats.hiddenProducts} icon={EyeOff} color="bg-gray-400" />
        <StatCard title="Категорий" value={stats.totalCategories} icon={FolderTree} color="bg-purple-500" />
        <StatCard title="Заявок" value={stats.totalClients} icon={Users} color="bg-amber-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Последние товары</h3>
            <Link href="/admin/products" className="text-accent text-sm font-medium hover:underline">
              Все товары →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentProducts.length === 0 ? (
              <div className="p-5 text-gray-400 text-sm text-center">Товаров пока нет</div>
            ) : (
              stats.recentProducts.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Package size={16} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {p.isActive ? 'Активен' : 'Скрыт'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Clients */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Последние заявки</h3>
            <Link href="/admin/clients" className="text-accent text-sm font-medium hover:underline">
              Все заявки →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentClients.length === 0 ? (
              <div className="p-5 text-gray-400 text-sm text-center">Заявок пока нет</div>
            ) : (
              stats.recentClients.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-400">
                      {c.city} · {c.phone}
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                    {c._count.selectedProducts} товаров
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
