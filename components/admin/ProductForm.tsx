'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

interface ProductFormProps {
  productId?: string; // If provided, we're editing
}

function ProductFormInner({ productId }: ProductFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return_to') || '/admin/products';
  
  const isEditing = !!productId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    subcategoryId: '',
    externalId: '',
    priceWithoutVat: '',
    priceWithVat: '',
    unit: '',
    description: '',
    packageType: '',
    packageQuantity: '',
    packageUnit: '',
    photo: '',
    sortOrder: '',
    isActive: true,
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Load categories
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});

    // If editing, load product
    if (productId) {
      fetch(`/api/admin/products/${productId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.id) {
            setForm({
              name: data.name || '',
              categoryId: data.categoryId || '',
              subcategoryId: data.subcategoryId || '',
              externalId: data.externalId || '',
              priceWithoutVat: data.priceWithoutVat?.toString() || '',
              priceWithVat: data.priceWithVat?.toString() || '',
              unit: data.unit || '',
              description: data.description || '',
              packageType: data.packageType || '',
              packageQuantity: data.packageQuantity?.toString() || '',
              packageUnit: data.packageUnit || '',
              photo: data.photo || '',
              sortOrder: data.sortOrder?.toString() || '',
              isActive: data.isActive ?? true,
            });
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [productId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => {
        const newForm = { ...prev, [name]: value };
        if (name === 'categoryId') {
          newForm.subcategoryId = ''; // Reset subcategory when category changes
        }
        return newForm;
      });
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    let file: File | null = null;
    
    if ('dataTransfer' in e) {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload/image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка загрузки');
      }

      setForm((prev) => ({ ...prev, photo: data.url }));
    } catch (err: any) {
      setError(err.message || 'Ошибка сервера при загрузке');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Название обязательно');
      return;
    }
    if (!form.categoryId) {
      setError('Выберите категорию');
      return;
    }

    setSaving(true);

    try {
      const url = isEditing ? `/api/admin/products/${productId}` : '/api/admin/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка сохранения');
      }

      setSuccess(isEditing ? 'Товар обновлён' : 'Товар добавлен');

      if (!isEditing) {
        setTimeout(() => router.push(returnTo), 1000);
      } else {
        setTimeout(() => router.push(returnTo), 1000);
      }
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
    <div className="max-w-[700px]">
      <div className="flex items-center gap-3 mb-6">
        <Link href={returnTo} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold text-gray-900">
          {isEditing ? 'Редактирование товара' : 'Новый товар'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid gap-4">
          {/* Name */}
          <div>
            <label className={labelClass}>Название *</label>
            <input name="name" value={form.name} onChange={handleChange} className={inputClass} placeholder="Перчатки х/б белые" required />
          </div>

          {/* Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Категория *</label>
              <select name="categoryId" value={form.categoryId} onChange={handleChange} className={inputClass} required>
                <option value="">— Выберите —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Подкатегория</label>
              <select 
                name="subcategoryId" 
                value={form.subcategoryId} 
                onChange={handleChange} 
                className={inputClass} 
                disabled={!form.categoryId || subcategories.length === 0}
              >
                <option value="">— Нет —</option>
                {subcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* External ID */}
          <div>
            <label className={labelClass}>Артикул (external_id)</label>
            <input name="externalId" value={form.externalId} onChange={handleChange} className={inputClass} placeholder="GLV-011" />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Цена без НДС (₸)</label>
              <input name="priceWithoutVat" type="number" value={form.priceWithoutVat} onChange={handleChange} className={inputClass} placeholder="150" />
            </div>
            <div>
              <label className={labelClass}>Цена с НДС (₸)</label>
              <input name="priceWithVat" type="number" step="0.01" value={form.priceWithVat} onChange={handleChange} className={inputClass} placeholder="195" />
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className={labelClass}>Единица измерения</label>
            <input name="unit" value={form.unit} onChange={handleChange} className={inputClass} placeholder="пара, шт, кг" />
          </div>

          {/* Package */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Тип фасовки</label>
              <input name="packageType" value={form.packageType} onChange={handleChange} className={inputClass} placeholder="мешок" />
            </div>
            <div>
              <label className={labelClass}>Кол-во в фасовке</label>
              <input name="packageQuantity" type="number" value={form.packageQuantity} onChange={handleChange} className={inputClass} placeholder="600" />
            </div>
            <div>
              <label className={labelClass}>Ед. фасовки</label>
              <input name="packageUnit" value={form.packageUnit} onChange={handleChange} className={inputClass} placeholder="пар" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Описание</label>
            <textarea name="description" value={form.description} onChange={handleChange} className={`${inputClass} min-h-[80px] resize-y`} placeholder="Описание товара..." />
          </div>

          {/* Photo Upload */}
          <div>
            <label className={labelClass}>Фото товара</label>
            <input type="hidden" name="photo" value={form.photo} />
            
            <div className="flex gap-4 items-start">
              <div 
                className={`flex-1 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                  ${uploading ? 'bg-gray-50 border-gray-300' : 'border-gray-300 hover:border-accent hover:bg-accent/5 bg-white'}`}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('photo-upload')?.click()}
              >
                <input 
                  id="photo-upload" 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg, image/webp" 
                  className="hidden" 
                  onChange={handleFileDrop} 
                />
                
                {uploading ? (
                  <div className="text-accent font-bold text-sm animate-pulse">Загрузка...</div>
                ) : (
                  <>
                    <div className="text-gray-500 mb-1">
                      Перетащите фото сюда
                    </div>
                    <div className="text-sm text-gray-400">или нажмите для загрузки</div>
                  </>
                )}
              </div>

              {form.photo && (
                <div className="w-[100px] h-[100px] shrink-0 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 relative group">
                  <img src={form.photo} alt="Preview" className="w-full h-full object-contain" />
                  <button 
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, photo: '' }))}
                    className="absolute inset-0 bg-black/50 text-white font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sort + Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Порядок сортировки</label>
              <input name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} className={inputClass} placeholder="1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent"
                />
                <span className="text-sm font-bold text-gray-700">Активен (показывать в каталоге)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm font-medium">{success}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full h-[48px] rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? 'Сохранение...' : <><Save size={16} />{isEditing ? 'Сохранить изменения' : 'Добавить товар'}</>}
        </button>
      </form>
    </div>
  );
}

export default function ProductForm(props: ProductFormProps) {
  return (
    <Suspense fallback={<div className="text-gray-400 font-bold animate-pulse py-20 text-center">Загрузка...</div>}>
      <ProductFormInner {...props} />
    </Suspense>
  );
}
