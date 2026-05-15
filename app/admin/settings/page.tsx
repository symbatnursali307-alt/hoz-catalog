'use client';

import { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';

interface SettingsData {
  companyName: string;
  catalogTitle: string;
  catalogDescription: string;
  whatsappPhone: string;
  showPrices: boolean;
  showVatPrices: boolean;
}

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SettingsData>({
    companyName: '',
    catalogTitle: '',
    catalogDescription: '',
    whatsappPhone: '',
    showPrices: true,
    showVatPrices: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({
            companyName: data.companyName || '',
            catalogTitle: data.catalogTitle || '',
            catalogDescription: data.catalogDescription || '',
            whatsappPhone: data.whatsappPhone || '',
            showPrices: data.showPrices ?? true,
            showVatPrices: data.showVatPrices ?? true,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка сохранения');
      }

      setSuccess('Настройки сохранены');
    } catch (err: any) {
      setError(err.message || 'Ошибка сервера');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400 font-bold animate-pulse py-20 text-center">Загрузка...</div>;
  }

  const inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent bg-white transition-colors';
  const labelClass = 'block text-sm font-bold text-gray-700 mb-1.5';

  return (
    <div className="max-w-[600px]">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Настройки каталога</h2>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid gap-5">
          <div>
            <label className={labelClass}>Название компании</label>
            <input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className={inputClass}
              placeholder="Каталог хозтоваров"
            />
          </div>

          <div>
            <label className={labelClass}>Заголовок каталога</label>
            <input
              value={form.catalogTitle}
              onChange={(e) => setForm({ ...form, catalogTitle: e.target.value })}
              className={inputClass}
              placeholder="Каталог хозтоваров"
            />
          </div>

          <div>
            <label className={labelClass}>Описание каталога</label>
            <textarea
              value={form.catalogDescription}
              onChange={(e) => setForm({ ...form, catalogDescription: e.target.value })}
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="Описание для SEO..."
            />
          </div>

          <div>
            <label className={labelClass}>Номер WhatsApp</label>
            <input
              value={form.whatsappPhone}
              onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
              className={inputClass}
              placeholder="77773042030"
            />
            <p className="text-xs text-gray-400 mt-1">Только цифры, без + и пробелов</p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h4 className="font-bold text-gray-700 text-sm mb-3">Отображение</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showPrices}
                  onChange={(e) => setForm({ ...form, showPrices: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-accent"
                />
                <span className="text-sm text-gray-700">Показывать цены в каталоге</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showVatPrices}
                  onChange={(e) => setForm({ ...form, showVatPrices: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-accent"
                />
                <span className="text-sm text-gray-700">Показывать цены с НДС</span>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm font-medium">{success}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 w-full h-[48px] rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? 'Сохранение...' : <><Save size={16} />Сохранить настройки</>}
        </button>
      </div>
    </div>
  );
}
