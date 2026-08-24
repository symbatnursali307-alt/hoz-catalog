'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, FileSpreadsheet, SearchCheck, Upload } from 'lucide-react';

type Row = Record<string, unknown>;
interface Result { success: boolean; dryRun?: boolean; created: number; updated: number; skipped: number; errors: { row: number; message: string }[]; warnings?: { row: number; message: string }[]; error?: string }

function parseCsv(text: string): Row[] {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const separator = (firstLine.match(/;/g)?.length || 0) >= (firstLine.match(/,/g)?.length || 0) ? ';' : ',';
  const table: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted;
    } else if (character === separator && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index++;
      row.push(cell); if (row.some((value) => value.trim())) table.push(row); row = []; cell = '';
    } else cell += character;
  }
  row.push(cell); if (row.some((value) => value.trim())) table.push(row);
  const headers = (table.shift() || []).map((value) => value.trim());
  return table.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
}

function parseExcelXml(text: string): Row[] {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Не удалось прочитать Excel XML');
  const rows = Array.from(document.getElementsByTagNameNS('*', 'Row')).map((row) =>
    Array.from(row.getElementsByTagNameNS('*', 'Cell')).map((cell) => cell.textContent || ''),
  );
  const headers = rows.shift()?.map((value) => value.trim()) || [];
  return rows.filter((values) => values.some((value) => value.trim())).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export default function AdminImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [working, setWorking] = useState(false);
  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setResult(null); setFileName(file.name);
    try {
      const text = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();
      const parsed = extension === 'json' ? JSON.parse(text) : extension === 'xls' || extension === 'xml' ? parseExcelXml(text) : parseCsv(text);
      if (!Array.isArray(parsed)) throw new Error('Файл должен содержать таблицу товаров');
      setRows(parsed);
    } catch (reason) {
      setRows([]); setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [], error: reason instanceof Error ? reason.message : 'Ошибка чтения файла' });
    }
  };

  const send = async (dryRun: boolean) => {
    setWorking(true); setResult(null);
    try {
      const response = await fetch('/api/admin/import/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: rows, dryRun }) });
      const data = await response.json(); setResult(data);
    } catch { setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [], error: 'Ошибка соединения' }); }
    finally { setWorking(false); }
  };

  const columns = preview.length ? Object.keys(preview[0]) : [];
  return (
    <div className="max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">Импорт и экспорт товаров</h2><p className="mt-1 text-sm text-gray-500">CSV (UTF-8), Excel .xls или JSON. Сначала выполните проверку — база при ней не меняется.</p></div>
        <div className="flex gap-2"><a href="/api/admin/export/products?format=csv" className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold"><Download size={16} />CSV</a><a href="/api/admin/export/products?format=xls" className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold"><Download size={16} />Excel</a></div>
      </div>

      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center hover:border-accent">
        <input ref={fileRef} type="file" accept=".csv,.xls,.xml,.json,text/csv,application/json" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        <FileSpreadsheet className="mx-auto mb-3 text-accent" size={34} /><div className="font-black">{fileName || 'Выберите или перетащите файл'}</div><div className="mt-1 text-sm text-gray-400">до 5000 строк за импорт</div>
      </div>

      {rows.length > 0 && <>
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-white"><div className="border-b px-4 py-3 text-sm font-bold">Найдено строк: {rows.length}. Предпросмотр первых пяти:</div><table className="min-w-full text-xs"><thead className="bg-gray-50"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 text-left">{column}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t">{columns.map((column) => <td key={column} className="max-w-56 truncate px-3 py-2">{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => void send(true)} disabled={working} className="flex h-12 items-center gap-2 rounded-xl border bg-white px-6 font-bold disabled:opacity-50"><SearchCheck size={17} />Проверить без импорта</button><button onClick={() => void send(false)} disabled={working || !result?.dryRun || !result.success} className="flex h-12 items-center gap-2 rounded-xl bg-accent px-7 font-bold text-white disabled:opacity-40"><Upload size={17} />Импортировать</button></div>
      </>}

      {result && <div className={`mt-5 rounded-2xl border p-5 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center gap-2 font-black">{result.success ? <CheckCircle size={19} className="text-green-600" /> : <AlertTriangle size={19} className="text-red-600" />}{result.dryRun ? 'Результат проверки' : result.success ? 'Импорт завершён' : 'Найдены ошибки'}</div>
        <div className="mt-3 text-sm">Новых: {result.created} · обновлений: {result.updated} · пропущено: {result.skipped}</div>
        {result.error && <div className="mt-2 text-sm text-red-700">{result.error}</div>}
        {!!result.warnings?.length && <div className="mt-3 max-h-40 overflow-y-auto text-sm text-amber-800">{result.warnings.map((item, index) => <div key={index}>Строка {item.row}: {item.message}</div>)}</div>}
        {!!result.errors?.length && <div className="mt-3 max-h-56 overflow-y-auto text-sm text-red-700">{result.errors.map((item, index) => <div key={index}>Строка {item.row}: {item.message}</div>)}</div>}
      </div>}

      <div className="mt-6 rounded-2xl border bg-gray-50 p-5 text-sm text-gray-600"><strong>Ключевые столбцы:</strong> external_id, name, category, price_with_vat, unit_name, package_type, units_per_package, package_unit, min_order_packages, short_description, full_description, characteristics, image_url, is_active. Для массового обновления используйте неизменный external_id или slug. Активная строка с незаполненной ценой/фасовкой будет отклонена.</div>
    </div>
  );
}
