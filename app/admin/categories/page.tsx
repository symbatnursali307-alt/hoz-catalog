'use client';

import { useEffect, useState } from 'react';
import { FolderTree, Plus, Eye, EyeOff, Save, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', sortOrder: '0' });
  const [saving, setSaving] = useState(false);

  const fetchCategories = () => {
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, sortOrder: form.sortOrder }),
    });
    setShowCreate(false);
    setForm({ name: '', sortOrder: '0' });
    setSaving(false);
    fetchCategories();
  };

  const handleUpdate = async (id: string) => {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, sortOrder: form.sortOrder }),
    });
    setEditingId(null);
    setForm({ name: '', sortOrder: '0' });
    setSaving(false);
    fetchCategories();
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    fetchCategories();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, sortOrder: cat.sortOrder.toString() });
    setShowCreate(false);
  };

  if (loading) {
    return <div className="text-gray-400 font-bold animate-pulse py-20 text-center">Загрузка...</div>;
  }

  return (
    <div className="max-w-[700px]">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Категории</h2>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', sortOrder: '0' }); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-colors"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <h3 className="font-bold text-gray-900 mb-3 text-sm">Новая категория</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Название категории"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white"
              />
            </div>
            <div className="w-24">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                placeholder="Порядок"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white"
              />
            </div>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-sm">
              <Save size={16} />
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Categories list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Категорий пока нет</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {categories.map((cat) => (
              <div key={cat.id} className="px-5 py-3 flex items-center gap-3">
                {editingId === cat.id ? (
                  <>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-accent"
                    />
                    <button onClick={() => handleUpdate(cat.id)} disabled={saving} className="text-accent hover:text-accent-dark">
                      <Save size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <FolderTree size={16} className="text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{cat.name}</div>
                      <div className="text-xs text-gray-400">slug: {cat.slug} · порядок: {cat.sortOrder}</div>
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {cat._count.products} товаров
                    </span>
                    <button
                      onClick={() => toggleActive(cat.id, cat.isActive)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                        cat.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {cat.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      onClick={() => startEdit(cat)}
                      className="text-xs font-bold text-accent hover:text-accent-dark"
                    >
                      Изменить
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
