'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';

interface SettingsData { companyName: string; catalogTitle: string; catalogDescription: string; whatsappPhone: string; showPrices: boolean; cartEnabled: boolean }

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SettingsData>({ companyName: '', catalogTitle: '', catalogDescription: '', whatsappPhone: '', showPrices: true, cartEnabled: false });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { fetch('/api/admin/settings').then((response) => response.json()).then((data) => setForm({ companyName: data.companyName || '', catalogTitle: data.catalogTitle || '', catalogDescription: data.catalogDescription || '', whatsappPhone: data.whatsappPhone || '', showPrices: data.showPrices !== false, cartEnabled: data.cartEnabled === true })).finally(() => setLoading(false)); }, []);
  const save = async () => { setSaving(true); setError(''); setMessage(''); try { const response = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Ошибка сохранения'); setMessage('Настройки сохранены'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка сервера'); } finally { setSaving(false); } };
  if (loading) return <div className="py-20 text-center text-gray-400">Загрузка...</div>;
  const input = 'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-accent'; const label = 'mb-1.5 block text-sm font-bold';
  return <div className="max-w-[700px]"><h2 className="mb-6 text-xl font-bold">Настройки каталога</h2><div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
    <div><label className={label}>Название компании</label><input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} className={input} /></div>
    <div><label className={label}>Заголовок каталога</label><input value={form.catalogTitle} onChange={(event) => setForm({ ...form, catalogTitle: event.target.value })} className={input} /></div>
    <div><label className={label}>Описание каталога</label><textarea value={form.catalogDescription} onChange={(event) => setForm({ ...form, catalogDescription: event.target.value })} className={`${input} min-h-24`} /></div>
    <div className="space-y-3 border-t pt-5"><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={form.showPrices} onChange={(event) => setForm({ ...form, showPrices: event.target.checked })} className="h-5 w-5" />Показывать цены с НДС</label><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={form.cartEnabled} onChange={(event) => setForm({ ...form, cartEnabled: event.target.checked })} className="h-5 w-5" />Включить корзину и переход в WhatsApp</label></div>
    {form.cartEnabled && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={18} className="shrink-0" />Включайте только после заполнения реальной цены с НДС и фасовки товаров. Неполные товары останутся недоступны для заказа.</div>}
    <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">Номера и персональные ссылки настраиваются в разделе «Менеджеры». Старый резервный номер: {form.whatsappPhone || 'не задан'}.</div>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message && <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <button onClick={() => void save()} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white disabled:opacity-50"><Save size={17} />{saving ? 'Сохранение...' : 'Сохранить'}</button>
  </div></div>;
}
