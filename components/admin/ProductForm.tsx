'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

interface Subcategory { id: string; name: string; slug: string }
interface Category { id: string; name: string; slug: string; subcategories?: Subcategory[] }
interface ProductFormProps { productId?: string }
interface QualityIssue { code: string; severity: 'error' | 'warning'; title: string; details: string }

const emptyForm = {
  name: '', slug: '', categoryId: '', subcategoryId: '', externalId: '', metaCatalogId: '',
  priceWithVat: '', unitName: '', packageType: '', unitsPerPackage: '', packageUnit: '', minOrderPackages: '1',
  shortDescription: '', fullDescription: '', characteristics: '', searchKeywords: '', buyerHint: '',
  imageUrl: '', brand: '', googleProductCategory: '', fbProductCategory: '', sortOrder: '0',
  isFeatured: false, isActive: false,
};

type FormState = typeof emptyForm;

function characteristicsToText(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`).join('\n');
}

function ProductFormInner({ productId }: ProductFormProps) {
  const router = useRouter();
  const returnTo = useSearchParams().get('return_to') || '/admin/products';
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    const requests: Promise<unknown>[] = [
      fetch('/api/admin/categories').then((response) => response.json()).then((data) => {
        if (Array.isArray(data)) setCategories(data);
      }),
    ];
    if (productId) {
      requests.push(fetch(`/api/admin/products/${productId}`).then((response) => response.json()).then((data) => {
        if (!data?.id) throw new Error(data?.error || 'Товар не найден');
        setQualityIssues(Array.isArray(data.qualityIssues) ? data.qualityIssues : []);
        setReviewNote(data.review?.status === 'PENDING' ? data.review.note || 'Ручная проверка' : '');
        setForm({
          name: data.name || '', slug: data.slug || '', categoryId: data.categoryId || '',
          subcategoryId: data.subcategoryId || '', externalId: data.externalId || '',
          metaCatalogId: data.metaCatalogId || '', priceWithVat: data.priceWithVat?.toString() || '',
          unitName: data.unitName || data.unit || '', packageType: data.packageType || '',
          unitsPerPackage: (data.unitsPerPackage ?? data.packageQuantity)?.toString() || '',
          packageUnit: data.packageUnit || '', minOrderPackages: data.minOrderPackages?.toString() || '1',
          shortDescription: data.shortDescription || data.description || '',
          fullDescription: data.fullDescription || data.description || '',
          characteristics: characteristicsToText(data.characteristics), searchKeywords: data.searchKeywords || '',
          buyerHint: data.buyerHint || '', imageUrl: data.imageUrl || data.photo || '', brand: data.brand || '',
          googleProductCategory: data.googleProductCategory || '', fbProductCategory: data.fbProductCategory || '',
          sortOrder: data.sortOrder?.toString() || '0', isFeatured: Boolean(data.isFeatured), isActive: Boolean(data.isActive),
        });
      }));
    }
    Promise.all(requests).catch((reason) => setError(reason instanceof Error ? reason.message : 'Ошибка загрузки')).finally(() => setLoading(false));
  }, [productId]);

  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  const publicationErrors = useMemo(() => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('название');
    if (!form.categoryId) missing.push('категория');
    if (!(Number(form.priceWithVat) > 0)) missing.push('цена с НДС');
    if (!form.unitName.trim()) missing.push('единица измерения');
    if (!form.packageType.trim()) missing.push('тип упаковки');
    if (!(Number(form.unitsPerPackage) > 0)) missing.push('количество в упаковке');
    return missing;
  }, [form]);

  const change = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    const nextValue = type === 'checkbox' ? (event.target as HTMLInputElement).checked : value;
    setForm((current) => ({ ...current, [name]: nextValue, ...(name === 'categoryId' ? { subcategoryId: '' } : {}) }));
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = 'dataTransfer' in event ? event.dataTransfer.files?.[0] : event.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch('/api/admin/upload/image', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Ошибка загрузки');
      setForm((current) => ({ ...current, imageUrl: data.url }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка загрузки');
    } finally { setUploading(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (form.isActive && publicationErrors.length) {
      setError(`Нельзя опубликовать товар: заполните ${publicationErrors.join(', ')}`); return;
    }
    setSaving(true);
    try {
      const response = await fetch(productId ? `/api/admin/products/${productId}` : '/api/admin/products', {
        method: productId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Ошибка сохранения');
      router.push(returnTo); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка сервера');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 text-center font-bold text-gray-400 animate-pulse">Загрузка...</div>;
  const input = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent';
  const label = 'mb-1.5 block text-sm font-bold text-gray-700';

  return (
    <div className="max-w-[900px]">
      <div className="mb-6 flex items-center gap-3"><Link href={returnTo} className="text-gray-400"><ArrowLeft size={20} /></Link><h2 className="text-xl font-bold">{productId ? 'Редактирование товара' : 'Новый товар'}</h2></div>
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        {(qualityIssues.length > 0 || reviewNote) && (
          <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 font-black text-amber-950"><AlertTriangle size={19} /> Что нужно проверить</div>
            {reviewNote && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Комментарий менеджера:</strong> {reviewNote}</div>}
            {qualityIssues.map((qualityIssue) => (
              <div key={qualityIssue.code} className={`rounded-xl border p-3 text-sm ${qualityIssue.severity === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-white text-amber-900'}`}>
                <strong>{qualityIssue.title}</strong><div className="mt-0.5 text-xs opacity-80">{qualityIssue.details}</div>
              </div>
            ))}
            <p className="text-xs text-amber-800">После сохранения очередь пересчитается автоматически. Если замечания устранены, товар исчезнет из списка проверки.</p>
          </section>
        )}
        <section className="grid gap-4">
          <h3 className="font-black">Основное</h3>
          <div><label className={label}>Название *</label><input name="name" value={form.name} onChange={change} className={input} required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label}>URL (slug)</label><input name="slug" value={form.slug} onChange={change} className={input} placeholder="создаётся автоматически" /></div>
            <div><label className={label}>Артикул</label><input name="externalId" value={form.externalId} onChange={change} className={input} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label}>Категория *</label><select name="categoryId" value={form.categoryId} onChange={change} className={input} required><option value="">— Выберите —</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div><label className={label}>Подкатегория</label><select name="subcategoryId" value={form.subcategoryId} onChange={change} className={input} disabled={!selectedCategory?.subcategories?.length}><option value="">— Нет —</option>{selectedCategory?.subcategories?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl bg-blue-50 p-4">
          <div><h3 className="font-black text-blue-950">Цена и оптовая упаковка</h3><p className="text-xs text-blue-700">На сайте показывается только цена с НДС. Корзина считает упаковками.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={label}>Цена за единицу с НДС, ₸ *</label><input name="priceWithVat" type="number" min="0" step="1" value={form.priceWithVat} onChange={change} className={input} /><p className="mt-1 text-xs text-blue-700">Дробная цена при сохранении округляется вверх.</p></div>
            <div><label className={label}>Единица цены *</label><input name="unitName" value={form.unitName} onChange={change} className={input} placeholder="шт, пара, рулон" /></div>
            <div><label className={label}>Тип упаковки *</label><input name="packageType" value={form.packageType} onChange={change} className={input} placeholder="коробка, мешок" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={label}>Единиц в упаковке *</label><input name="unitsPerPackage" type="number" min="1" value={form.unitsPerPackage} onChange={change} className={input} /></div>
            <div><label className={label}>Подпись количества</label><input name="packageUnit" value={form.packageUnit} onChange={change} className={input} placeholder="шт, пар" /></div>
            <div><label className={label}>Минимум упаковок</label><input name="minOrderPackages" type="number" min="1" value={form.minOrderPackages} onChange={change} className={input} /></div>
          </div>
          {Number(form.priceWithVat) > 0 && Number(form.unitsPerPackage) > 0 && <div className="text-sm font-black text-blue-950">Цена упаковки: {(Math.ceil(Number(form.priceWithVat)) * Number(form.unitsPerPackage)).toLocaleString('ru-RU')} ₸ с НДС</div>}
        </section>

        <section className="grid gap-4">
          <h3 className="font-black">Описание и характеристики</h3>
          <div><label className={label}>Короткое описание</label><textarea name="shortDescription" value={form.shortDescription} onChange={change} className={`${input} min-h-20`} /></div>
          <div><label className={label}>Полное описание</label><textarea name="fullDescription" value={form.fullDescription} onChange={change} className={`${input} min-h-32`} /></div>
          <div><label className={label}>Характеристики</label><textarea name="characteristics" value={form.characteristics} onChange={change} className={`${input} min-h-28 font-mono`} placeholder={'Материал: уточнить\nЦвет: белый'} /><p className="mt-1 text-xs text-gray-400">Одна строка — «Название: значение». Неизвестные факты оставляйте пустыми или пишите «уточнить».</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className={label}>Поисковые слова</label><textarea name="searchKeywords" value={form.searchKeywords} onChange={change} className={`${input} min-h-20`} /></div><div><label className={label}>Подсказка покупателю</label><textarea name="buyerHint" value={form.buyerHint} onChange={change} className={`${input} min-h-20`} /></div></div>
        </section>

        <section className="grid gap-4">
          <h3 className="font-black">Фото</h3>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1"><label className={label}>URL изображения</label><input name="imageUrl" value={form.imageUrl} onChange={change} className={input} /></div>
            {form.imageUrl && <img src={form.imageUrl} alt="Предпросмотр" className="h-24 w-24 rounded-xl border object-contain" />}
          </div>
          <div onDragOver={(event) => event.preventDefault()} onDrop={upload} onClick={() => document.getElementById('product-image')?.click()} className="cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm text-gray-500 hover:border-accent"><input id="product-image" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />{uploading ? 'Загрузка...' : 'Перетащите фото или нажмите для выбора'}</div>
        </section>

        <section className="grid gap-4">
          <h3 className="font-black">Meta и сортировка</h3>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className={label}>Meta Catalog ID</label><input name="metaCatalogId" value={form.metaCatalogId} onChange={change} className={input} placeholder="по умолчанию равен slug" /></div><div><label className={label}>Бренд</label><input name="brand" value={form.brand} onChange={change} className={input} /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className={label}>Google product category</label><input name="googleProductCategory" value={form.googleProductCategory} onChange={change} className={input} /></div><div><label className={label}>Facebook product category</label><input name="fbProductCategory" value={form.fbProductCategory} onChange={change} className={input} /></div></div>
          <div><label className={label}>Порядок сортировки</label><input name="sortOrder" type="number" value={form.sortOrder} onChange={change} className={input} /></div>
          <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="isFeatured" checked={form.isFeatured} onChange={change} className="h-5 w-5" />Популярный товар</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="isActive" checked={form.isActive} onChange={change} className="h-5 w-5" />Показывать в каталоге</label></div>
        </section>

        {publicationErrors.length > 0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="shrink-0" size={18} /><span>Для публикации заполните: {publicationErrors.join(', ')}. Сохранить черновик можно с выключенным показом.</span></div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white disabled:opacity-50"><Save size={17} />{saving ? 'Сохранение...' : 'Сохранить товар'}</button>
      </form>
    </div>
  );
}

export default function ProductForm(props: ProductFormProps) {
  return <Suspense fallback={<div className="py-20 text-center text-gray-400">Загрузка...</div>}><ProductFormInner {...props} /></Suspense>;
}
