'use client';

import { useEffect, useState } from 'react';
import { Users, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  city: string;
  phone: string;
  source: string | null;
  createdAt: string;
  _count: { selectedProducts: number };
}

interface ClientDetail extends Client {
  selectedProducts: {
    id: string;
    productNameSnapshot: string;
    product: {
      id: string;
      name: string;
      priceWithoutVat: number | null;
      priceWithVat: number | null;
      unit: string | null;
      photo: string | null;
    } | null;
  }[];
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch('/api/admin/clients')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }

    setExpandedId(id);
    setLoadingDetail(true);

    try {
      const res = await fetch(`/api/admin/clients/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400 font-bold animate-pulse py-20 text-center">Загрузка...</div>;
  }

  return (
    <div className="max-w-[900px]">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Клиенты / Заявки</h2>
      <p className="text-sm text-gray-500 mb-6">{clients.length} заявок</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {clients.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Заявок пока нет</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {clients.map((client) => (
              <div key={client.id}>
                <div
                  onClick={() => toggleExpand(client.id)}
                  className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900">{client.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {client.city} · {client.phone} · {new Date(client.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                    {client._count.selectedProducts} товаров
                  </span>
                  {expandedId === client.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>

                {/* Expanded detail */}
                {expandedId === client.id && (
                  <div className="px-5 pb-4 bg-gray-50">
                    {loadingDetail ? (
                      <div className="text-sm text-gray-400 py-4 text-center">Загрузка деталей...</div>
                    ) : detail ? (
                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div><strong>Имя:</strong> {detail.name}</div>
                            <div><strong>Город:</strong> {detail.city}</div>
                            <div><strong>Телефон:</strong> {detail.phone}</div>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {detail.selectedProducts.map((sp) => (
                            <div key={sp.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                                {sp.product?.photo ? (
                                  <img src={sp.product.photo} alt="" className="w-full h-full object-contain" />
                                ) : (
                                  <Package size={14} className="text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {sp.product?.name || sp.productNameSnapshot}
                                </div>
                              </div>
                              {sp.product?.priceWithoutVat && (
                                <span className="text-sm font-bold text-gray-700">
                                  {sp.product.priceWithoutVat.toLocaleString('ru-RU')} ₸
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 py-4 text-center">Не удалось загрузить</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
