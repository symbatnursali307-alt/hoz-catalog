'use client';

import { useState, useRef } from 'react';
import { Upload, FileJson, CheckCircle, AlertTriangle, Copy } from 'lucide-react';

const EXAMPLE_JSON = `[
  {
    "category": "Перчатки",
    "name": "Перчатки х/б белые",
    "external_id": "GLV-011",
    "price_without_vat": 150,
    "price_with_vat": 195,
    "unit": "пара",
    "description": "Описание товара",
    "package_type": "мешок",
    "package_quantity": 600,
    "package_unit": "пар",
    "image_url": "",
    "is_active": true,
    "sort_order": 11
  }
]`;

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  error?: string;
}

export default function AdminImportPage() {
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText(ev.target?.result as string || '');
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setResult(null);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch {
      setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'Невалидный JSON' }], error: 'Невалидный JSON' });
      return;
    }

    if (!Array.isArray(parsed)) {
      setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'JSON должен быть массивом' }], error: 'JSON должен быть массивом' });
      return;
    }

    setImporting(true);

    try {
      const res = await fetch('/api/admin/import/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [], error: 'Ошибка соединения' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-[900px]">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Массовый импорт товаров</h2>
      <p className="text-sm text-gray-500 mb-6">Вставьте JSON-массив товаров или загрузите .json файл</p>

      {/* File upload */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
        >
          <FileJson size={16} />
          Загрузить .json файл
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />

        <button
          onClick={() => { setJsonText(EXAMPLE_JSON); setResult(null); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
        >
          <Copy size={16} />
          Вставить пример
        </button>
      </div>

      {/* JSON textarea */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setResult(null); }}
          className="w-full min-h-[300px] font-mono text-sm p-3 border border-gray-200 rounded-xl outline-none focus:border-accent bg-gray-50 resize-y"
          placeholder='[\n  {\n    "category": "Перчатки",\n    "name": "Название товара",\n    ...\n  }\n]'
        />
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={importing || !jsonText.trim()}
        className="w-full sm:w-auto px-8 h-[48px] rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {importing ? 'Импорт...' : <><Upload size={16} />Импортировать</>}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            {result.success && !result.error ? (
              <><CheckCircle size={18} className="text-green-500" />Импорт завершён</>
            ) : (
              <><AlertTriangle size={18} className="text-red-500" />Ошибка импорта</>
            )}
          </h3>

          {result.error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{result.error}</div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-green-600">{result.created}</div>
              <div className="text-xs text-green-600 font-medium">Добавлено</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-blue-600">{result.updated}</div>
              <div className="text-xs text-blue-600 font-medium">Обновлено</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-amber-600">{result.skipped}</div>
              <div className="text-xs text-amber-600 font-medium">Пропущено</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-2 text-sm font-bold text-red-600">Ошибки ({result.errors.length})</div>
              <div className="divide-y divide-red-100 max-h-[200px] overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="px-4 py-2 text-sm text-red-700">
                    <strong>Строка {err.row}:</strong> {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Format reference */}
      <div className="mt-6 bg-gray-50 rounded-2xl border border-gray-200 p-5">
        <h4 className="font-bold text-gray-700 mb-2 text-sm">Формат JSON</h4>
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Обязательные:</strong> <code>category</code>, <code>name</code></p>
          <p><strong>Желательные:</strong> <code>external_id</code> (для обновления существующих)</p>
          <p><strong>Опциональные:</strong> <code>price_without_vat</code>, <code>price_with_vat</code>, <code>unit</code>, <code>description</code>, <code>package_type</code>, <code>package_quantity</code>, <code>package_unit</code>, <code>image_url</code>, <code>is_active</code>, <code>sort_order</code></p>
        </div>
      </div>
    </div>
  );
}
