'use client';

import { useState, useRef } from 'react';
import { Upload, ImageIcon, Copy, Check, X } from 'lucide-react';

interface UploadedImage {
  url: string;
  filename: string;
}

export default function AdminImagesPage() {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setError('');
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/admin/upload/image', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Ошибка загрузки');
          continue;
        }

        setImages((prev) => [{ url: data.url, filename: data.filename }, ...prev]);
      } catch {
        setError('Ошибка соединения');
      }
    }

    setUploading(false);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="max-w-[900px]">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Загрузка фото</h2>
      <p className="text-sm text-gray-500 mb-6">Загрузите фото, скопируйте URL и вставьте в карточку товара</p>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="bg-white border-2 border-dashed border-gray-200 hover:border-accent rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6"
      >
        <Upload size={32} className="mx-auto text-gray-400 mb-3" />
        <div className="text-sm font-medium text-gray-700 mb-1">
          {uploading ? 'Загрузка...' : 'Перетащите фото сюда или нажмите для выбора'}
        </div>
        <div className="text-xs text-gray-400">PNG, JPG, JPEG, WebP</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>
      )}

      {/* Uploaded images */}
      {images.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Загруженные фото ({images.length})</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <div className="aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={img.url} alt="" className="w-full h-full object-contain p-1" />
                </div>
                <button
                  onClick={() => copyUrl(img.url)}
                  className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
                >
                  {copiedUrl === img.url ? (
                    <><Check size={12} className="text-green-500" />Скопировано!</>
                  ) : (
                    <><Copy size={12} />Копировать URL</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
