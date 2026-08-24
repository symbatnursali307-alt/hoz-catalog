import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath) throw new Error('Usage: node build_catalog_workbook.mjs source.json output.xlsx');

const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const products = source.items;
const dataStartRow = 4;
const dataEndRow = dataStartRow + products.length - 1;

const priceSuffix = /\s*[-–—]?\s*\d+(?:[.,]\d+)?\s*(?:тг|₸|тенге)\.?\s*$/iu;
const stripPrice = (name) => String(name || '').replace(priceSuffix, '').replace(/\s{2,}/g, ' ').trim();
const normalizedName = (name) => stripPrice(name)
  .toLocaleLowerCase('ru-RU')
  .replace(/[^a-zа-яё0-9]+/giu, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();
const text = (value) => value == null ? '' : String(value);
const yesNo = (value) => value ? 'Да' : 'Нет';
const characteristicsText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => text(item)).join('\n');
  return Object.entries(value).map(([key, item]) => `${key}: ${text(item)}`).join('\n');
};

const exactCounts = new Map();
const normalizedCounts = new Map();
for (const product of products) {
  const exact = product.name.trim().toLocaleLowerCase('ru-RU');
  const normalized = normalizedName(product.name);
  exactCounts.set(exact, (exactCounts.get(exact) || 0) + 1);
  if (normalized) normalizedCounts.set(normalized, (normalizedCounts.get(normalized) || 0) + 1);
}

const duplicateKeys = [...normalizedCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort(([left], [right]) => left.localeCompare(right, 'ru'));
const duplicateGroups = new Map(duplicateKeys.map(([key], index) => [key, `DUP-${String(index + 1).padStart(3, '0')}`]));

const editableRows = products.map((product) => {
  const issues = product.issues || [];
  const normalized = normalizedName(product.name);
  const duplicateCount = normalizedCounts.get(normalized) || 1;
  return [
    text(product.externalId),
    text(product.slug),
    text(product.metaCatalogId),
    text(product.name),
    text(product.category?.name),
    text(product.subcategory?.name),
    product.priceWithVat ?? null,
    text(product.unitName || product.unit),
    text(product.packageType),
    product.unitsPerPackage ?? product.packageQuantity ?? null,
    text(product.packageUnit),
    product.minOrderPackages ?? 1,
    text(product.shortDescription || product.description),
    text(product.fullDescription || product.description),
    characteristicsText(product.characteristics),
    text(product.searchKeywords),
    text(product.buyerHint),
    text(product.imageUrl || product.photo),
    text(product.brand),
    text(product.googleProductCategory),
    text(product.fbProductCategory),
    product.sortOrder ?? 0,
    yesNo(product.isFeatured),
    yesNo(product.isActive),
    stripPrice(product.name),
    issues.map((item) => `${item.severity === 'error' ? 'Ошибка' : 'Предупреждение'}: ${item.title}`).join('; '),
    issues.map((item) => item.code).join('; '),
    [...new Set(issues.flatMap((item) => item.fields || []))].join('; '),
    duplicateGroups.get(normalized) || '',
    duplicateCount > 1 ? duplicateCount : 1,
    null,
    null,
    '',
    '',
  ];
});

const duplicateRows = [];
for (let productIndex = 0; productIndex < products.length; productIndex++) {
  const product = products[productIndex];
  const normalized = normalizedName(product.name);
  const count = normalizedCounts.get(normalized) || 1;
  if (count <= 1) continue;
  const exact = product.name.trim().toLocaleLowerCase('ru-RU');
  duplicateRows.push([
    duplicateGroups.get(normalized),
    exactCounts.get(exact) > 1 ? 'Точный дубль' : 'Совпадение после удаления цены',
    count,
    text(product.externalId),
    text(product.name),
    stripPrice(product.name),
    text(product.category?.name),
    text(product.subcategory?.name),
    product.priceWithVat ?? null,
    yesNo(product.isActive),
    text(product.imageUrl || product.photo),
    dataStartRow + productIndex,
  ]);
}
duplicateRows.sort((left, right) => String(left[0]).localeCompare(String(right[0])) || String(left[4]).localeCompare(String(right[4]), 'ru'));

const categories = [...new Set(products.map((item) => text(item.category?.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
const subcategories = [...new Set(products.map((item) => text(item.subcategory?.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
const currentUnits = [...new Set(products.map((item) => text(item.unitName || item.unit)).filter(Boolean))];
const currentPackages = [...new Set(products.map((item) => text(item.packageType)).filter(Boolean))];
const currentPackageUnits = [...new Set(products.map((item) => text(item.packageUnit)).filter(Boolean))];
const units = [...new Set(['шт', 'пара', 'рулон', 'кг', 'пачка', 'м', 'л', ...currentUnits])].sort((a, b) => a.localeCompare(b, 'ru'));
const packages = [...new Set(['мешок', 'коробка', 'пачка', 'тюк', 'ящик', 'упаковка', 'пакет', 'рулон', 'бухта', ...currentPackages])].sort((a, b) => a.localeCompare(b, 'ru'));
const packageUnits = [...new Set(['шт', 'пар', 'рулонов', 'кг', 'пачек', 'м', 'л', ...currentPackageUnits])].sort((a, b) => a.localeCompare(b, 'ru'));

const workbook = Workbook.create();
const guide = workbook.worksheets.add('Инструкция');
const edit = workbook.worksheets.add('Редактирование');
const duplicates = workbook.worksheets.add('Дубликаты');
const refs = workbook.worksheets.add('Справочники');
const importSheet = workbook.worksheets.add('Импорт');

workbook.comments.setSelf({ displayName: 'User' });

const navy = '#17324D';
const blue = '#245B88';
const paleBlue = '#EAF2F8';
const paleGreen = '#EAF6EE';
const paleGray = '#F1F4F6';
const paleYellow = '#FFF4CC';
const paleRed = '#FDE8E7';
const green = '#207A4B';
const amber = '#A36200';
const red = '#B42318';
const white = '#FFFFFF';
const line = '#D5DEE5';

// Инструкция
guide.showGridLines = false;
guide.mergeCells('A1:H2');
guide.getRange('A1').values = [['Каталог товаров — файл для корректировки']];
guide.getRange('A1:H2').format = { fill: navy, font: { bold: true, color: white, size: 20 }, verticalAlignment: 'center', horizontalAlignment: 'left' };
guide.getRange('A4:B9').values = [
  ['Показатель', 'Значение'],
  ['Всего товаров', null],
  ['Цена находится в названии', null],
  ['Без характеристик', null],
  ['Строки в группах дублей', null],
  ['Критические ошибки сейчас', source.stats.withErrors],
];
guide.getRange('B5').formulas = [[`=COUNTA('Редактирование'!$A$${dataStartRow}:$A$${dataEndRow})`]];
guide.getRange('B6').formulas = [[`=COUNTIF('Редактирование'!$AA$${dataStartRow}:$AA$${dataEndRow},"*PRICE_IN_NAME*")`]];
guide.getRange('B7').formulas = [[`=COUNTBLANK('Редактирование'!$O$${dataStartRow}:$O$${dataEndRow})`]];
guide.getRange('B8').formulas = [[`=COUNTIF('Редактирование'!$AD$${dataStartRow}:$AD$${dataEndRow},">1")`]];
guide.getRange('A4:B4').format = { fill: blue, font: { bold: true, color: white }, borders: { preset: 'outside', style: 'thin', color: blue } };
guide.getRange('A5:A9').format = { fill: paleBlue, font: { bold: true, color: navy } };
guide.getRange('B5:B9').format = { fill: white, font: { bold: true, color: navy }, numberFormat: '#,##0' };
guide.getRange('A4:B9').format.borders = { preset: 'inside', style: 'thin', color: line };
guide.mergeCells('D4:H4');
guide.getRange('D4').values = [['Как работать с файлом']];
guide.getRange('D4:H4').format = { fill: blue, font: { bold: true, color: white } };
guide.getRange('D5:H11').values = [[
  '1. Работайте на листе «Редактирование». Серые столбцы с ID и диагностикой не меняйте.', '', '', '', '',
], [
  '2. Удаляйте цену из названия товара. Актуальная цена должна оставаться только в «Цена с НДС».', '', '', '', '',
], [
  '3. Характеристики заполняйте построчно: «Материал: хлопок», «Класс вязки: 10». Не придумывайте неизвестные сведения.', '', '', '', '',
], [
  '4. Дубли проверяйте по листу «Дубликаты». Решение укажите в зелёном столбце «Решение по карточке».', '', '', '', '',
], [
  '5. Не удаляйте строки и не меняйте external_id, slug и meta_catalog_id. Для отключения поставьте «Активен = Нет».', '', '', '', '',
], [
  '6. Сохраните этот же .xlsx и отправьте обратно. Перед загрузкой я выполню проверку без изменения базы.', '', '', '', '',
], [
  '7. Лист «Импорт» формируется формулами и нужен для обратной загрузки — его не редактируйте.', '', '', '', '',
]];
for (let row = 5; row <= 11; row++) guide.mergeCells(`D${row}:H${row}`);
guide.getRange('D5:H11').format = { fill: white, font: { color: '#273746', size: 11 }, wrapText: true, verticalAlignment: 'center', borders: { preset: 'inside', style: 'thin', color: line } };
guide.getRange('D5:H11').format.rowHeight = 34;
guide.mergeCells('A12:H12');
guide.getRange('A12').values = [['Цвета: зелёный — можно редактировать; серый — служебное поле; жёлтый — требует проверки; красный — критическая ошибка.']];
guide.getRange('A12:H12').format = { fill: paleYellow, font: { bold: true, color: amber }, wrapText: true };
guide.getRange('A:A').format.columnWidth = 34;
guide.getRange('B:B').format.columnWidth = 16;
guide.getRange('C:C').format.columnWidth = 4;
guide.getRange('D:H').format.columnWidth = 19;
guide.getRange('1:2').format.rowHeight = 30;

// Основной лист редактирования
edit.showGridLines = false;
edit.mergeCells('A1:AH1');
edit.getRange('A1').values = [['Редактирование товаров — зелёные поля можно менять, серые не менять']];
edit.getRange('A1:AH1').format = { fill: navy, font: { bold: true, color: white, size: 16 }, verticalAlignment: 'center' };
edit.getRange('A2:AH2').values = [[
  'Идентификаторы', '', '',
  'Карточка товара', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  'Автоматическая диагностика', '', '', '', '', '', '', '',
  'Ваше решение', '',
]];
edit.mergeCells('A2:C2');
edit.mergeCells('D2:X2');
edit.mergeCells('Y2:AF2');
edit.mergeCells('AG2:AH2');
edit.getRange('A2:C2').format = { fill: '#607D8B', font: { bold: true, color: white }, horizontalAlignment: 'center' };
edit.getRange('D2:X2').format = { fill: green, font: { bold: true, color: white }, horizontalAlignment: 'center' };
edit.getRange('Y2:AF2').format = { fill: blue, font: { bold: true, color: white }, horizontalAlignment: 'center' };
edit.getRange('AG2:AH2').format = { fill: amber, font: { bold: true, color: white }, horizontalAlignment: 'center' };

const editHeaders = [
  'external_id — не менять', 'slug — не менять', 'meta_catalog_id — не менять', 'Название товара', 'Категория', 'Подкатегория',
  'Цена с НДС, ₸', 'Единица цены', 'Тип упаковки', 'Количество в упаковке', 'Единица в упаковке', 'Минимум упаковок',
  'Краткое описание', 'Полное описание', 'Характеристики', 'Поисковые слова', 'Подсказка покупателю', 'Фото / URL',
  'Бренд', 'Google Product Category', 'Facebook Product Category', 'Сортировка', 'Популярное', 'Активен',
  'Предлагаемое название без цены', 'Текущая проверка', 'Коды проблем', 'Поля для проверки', 'Группа дублей', 'Совпадений',
  'Цена упаковки, ₸', 'Контроль после правки', 'Решение по карточке', 'Комментарий владельца',
];
edit.getRange('A3:AH3').values = [editHeaders];
edit.getRange('A3:AH3').format = { fill: blue, font: { bold: true, color: white, size: 10 }, wrapText: true, verticalAlignment: 'center', borders: { preset: 'inside', style: 'thin', color: '#B7C9D6' } };
edit.getRange('A3:AH3').format.rowHeight = 48;
edit.getRange(`A${dataStartRow}:AH${dataEndRow}`).values = editableRows;
edit.getRange(`AE${dataStartRow}:AE${dataEndRow}`).formulas = products.map((_, index) => {
  const row = dataStartRow + index;
  return [`=IF(AND(ISNUMBER(G${row}),ISNUMBER(J${row})),G${row}*J${row},"")`];
});
edit.getRange(`AF${dataStartRow}:AF${dataEndRow}`).formulas = products.map((_, index) => {
  const row = dataStartRow + index;
  return [`=IF(OR(D${row}="",E${row}="",G${row}="",H${row}="",I${row}="",J${row}="",K${row}="",L${row}=""),"ОШИБКА: заполните обязательные поля",IF(OR(ISNUMBER(SEARCH(" тг",LOWER(D${row}))),ISNUMBER(SEARCH("₸",D${row})),ISNUMBER(SEARCH(" тенге",LOWER(D${row})))),"ПРОВЕРИТЬ: цена в названии",IF(O${row}="","ПРОВЕРИТЬ: нет характеристик",IF(COUNTIF($D$${dataStartRow}:$D$${dataEndRow},D${row})>1,"ПРОВЕРИТЬ: точный дубль","ГОТОВО"))))`];
});
edit.getRange(`A${dataStartRow}:C${dataEndRow}`).format = { fill: paleGray, font: { color: '#52616B' } };
edit.getRange(`D${dataStartRow}:X${dataEndRow}`).format.fill = paleGreen;
edit.getRange(`Y${dataStartRow}:AF${dataEndRow}`).format = { fill: paleGray, font: { color: '#52616B' } };
edit.getRange(`AG${dataStartRow}:AH${dataEndRow}`).format.fill = paleGreen;
edit.getRange(`A${dataStartRow}:AH${dataEndRow}`).format.borders = { insideHorizontal: { style: 'thin', color: '#E6ECEF' } };
edit.getRange(`M${dataStartRow}:U${dataEndRow}`).format.wrapText = true;
edit.getRange(`Y${dataStartRow}:AF${dataEndRow}`).format.wrapText = true;
edit.getRange(`AH${dataStartRow}:AH${dataEndRow}`).format.wrapText = true;
edit.getRange(`G${dataStartRow}:G${dataEndRow}`).format.numberFormat = '#,##0.00';
edit.getRange(`J${dataStartRow}:L${dataEndRow}`).format.numberFormat = '#,##0';
edit.getRange(`V${dataStartRow}:V${dataEndRow}`).format.numberFormat = '#,##0';
edit.getRange(`AD${dataStartRow}:AD${dataEndRow}`).format.numberFormat = '#,##0';
edit.getRange(`AE${dataStartRow}:AE${dataEndRow}`).format.numberFormat = '#,##0.00';
edit.getRange(`A${dataStartRow}:AH${dataEndRow}`).format.rowHeight = 42;

const widths = {
  A: 18, B: 26, C: 24, D: 38, E: 22, F: 24, G: 15, H: 16, I: 17, J: 16, K: 17, L: 16,
  M: 38, N: 44, O: 36, P: 28, Q: 30, R: 46, S: 20, T: 24, U: 24, V: 11, W: 12, X: 11,
  Y: 38, Z: 48, AA: 32, AB: 34, AC: 14, AD: 12, AE: 17, AF: 32, AG: 20, AH: 34,
};
for (const [column, width] of Object.entries(widths)) edit.getRange(`${column}:${column}`).format.columnWidth = width;
edit.freezePanes.freezeRows(3);
edit.freezePanes.freezeColumns(3);
const editTable = edit.tables.add(`A3:AH${dataEndRow}`, true, 'ProductsEditingTable');
editTable.style = 'TableStyleMedium2';
editTable.showBandedRows = false;

edit.getRange(`E${dataStartRow}:E${dataEndRow}`).dataValidation = { rule: { type: 'list', formula1: `'Справочники'!$A$2:$A$${categories.length + 1}` } };
edit.getRange(`F${dataStartRow}:F${dataEndRow}`).dataValidation = { rule: { type: 'list', formula1: `'Справочники'!$B$2:$B$${subcategories.length + 1}` } };
edit.getRange(`H${dataStartRow}:H${dataEndRow}`).dataValidation = { rule: { type: 'list', formula1: `'Справочники'!$C$2:$C$${units.length + 1}` } };
edit.getRange(`I${dataStartRow}:I${dataEndRow}`).dataValidation = { rule: { type: 'list', formula1: `'Справочники'!$D$2:$D$${packages.length + 1}` } };
edit.getRange(`K${dataStartRow}:K${dataEndRow}`).dataValidation = { rule: { type: 'list', formula1: `'Справочники'!$E$2:$E$${packageUnits.length + 1}` } };
edit.getRange(`W${dataStartRow}:X${dataEndRow}`).dataValidation = { rule: { type: 'list', values: ['Да', 'Нет'] } };
edit.getRange(`AG${dataStartRow}:AG${dataEndRow}`).dataValidation = { rule: { type: 'list', values: ['', 'Оставить', 'Отключить', 'Объединить', 'Проверить'] } };
edit.getRange(`G${dataStartRow}:G${dataEndRow}`).dataValidation = { rule: { type: 'decimal', operator: 'greaterThan', formula1: 0 } };
edit.getRange(`J${dataStartRow}:J${dataEndRow}`).dataValidation = { rule: { type: 'whole', operator: 'greaterThan', formula1: 0 } };
edit.getRange(`L${dataStartRow}:L${dataEndRow}`).dataValidation = { rule: { type: 'whole', operator: 'greaterThan', formula1: 0 } };

edit.getRange(`AF${dataStartRow}:AF${dataEndRow}`).conditionalFormats.add('containsText', { text: 'ОШИБКА', format: { fill: paleRed, font: { color: red, bold: true } } });
edit.getRange(`AF${dataStartRow}:AF${dataEndRow}`).conditionalFormats.add('containsText', { text: 'ПРОВЕРИТЬ', format: { fill: paleYellow, font: { color: amber, bold: true } } });
edit.getRange(`AF${dataStartRow}:AF${dataEndRow}`).conditionalFormats.add('containsText', { text: 'ГОТОВО', format: { fill: '#DDF3E4', font: { color: green, bold: true } } });
edit.getRange(`AD${dataStartRow}:AD${dataEndRow}`).conditionalFormats.add('cellIs', { operator: 'greaterThan', formula: 1, format: { fill: paleYellow, font: { color: amber, bold: true } } });
edit.getRange(`Z${dataStartRow}:Z${dataEndRow}`).conditionalFormats.add('containsText', { text: 'Ошибка:', format: { fill: paleRed, font: { color: red } } });

// Лист дублей
duplicates.showGridLines = false;
duplicates.mergeCells('A1:L1');
duplicates.getRange('A1').values = [['Проверка дублей — решения указывайте на листе «Редактирование»']];
duplicates.getRange('A1:L1').format = { fill: navy, font: { bold: true, color: white, size: 16 } };
const duplicateHeaders = ['Группа', 'Тип совпадения', 'Строк в группе', 'external_id', 'Текущее название', 'Название без цены', 'Категория', 'Подкатегория', 'Цена с НДС', 'Активен', 'Фото / URL', 'Строка на листе редактирования'];
duplicates.getRange('A3:L3').values = [duplicateHeaders];
duplicates.getRange('A3:L3').format = { fill: blue, font: { bold: true, color: white }, wrapText: true };
if (duplicateRows.length) duplicates.getRange(`A4:L${duplicateRows.length + 3}`).values = duplicateRows;
duplicates.getRange(`A4:L${duplicateRows.length + 3}`).format.borders = { insideHorizontal: { style: 'thin', color: '#E6ECEF' } };
duplicates.getRange(`B4:B${duplicateRows.length + 3}`).conditionalFormats.add('containsText', { text: 'Точный', format: { fill: paleRed, font: { color: red, bold: true } } });
duplicates.getRange(`B4:B${duplicateRows.length + 3}`).conditionalFormats.add('containsText', { text: 'Совпадение', format: { fill: paleYellow, font: { color: amber } } });
duplicates.getRange(`I4:I${duplicateRows.length + 3}`).format.numberFormat = '#,##0.00';
duplicates.getRange('A:A').format.columnWidth = 14;
duplicates.getRange('B:B').format.columnWidth = 30;
duplicates.getRange('C:C').format.columnWidth = 15;
duplicates.getRange('D:D').format.columnWidth = 18;
duplicates.getRange('E:F').format.columnWidth = 40;
duplicates.getRange('G:H').format.columnWidth = 22;
duplicates.getRange('I:J').format.columnWidth = 14;
duplicates.getRange('K:K').format.columnWidth = 48;
duplicates.getRange('L:L').format.columnWidth = 18;
duplicates.freezePanes.freezeRows(3);
if (duplicateRows.length) {
  const duplicateTable = duplicates.tables.add(`A3:L${duplicateRows.length + 3}`, true, 'DuplicateReviewTable');
  duplicateTable.style = 'TableStyleMedium2';
}

// Справочники
refs.showGridLines = false;
refs.mergeCells('A1:I1');
refs.getRange('A1').values = [['Справочники и правила заполнения']];
refs.getRange('A1:I1').format = { fill: navy, font: { bold: true, color: white, size: 16 } };
refs.getRange('A3:I3').values = [['Категории', 'Подкатегории', 'Единицы цены', 'Типы упаковки', 'Единицы в упаковке', 'Да / Нет', 'Решение по карточке', 'Поле', 'Как заполнять']];
refs.getRange('A3:I3').format = { fill: blue, font: { bold: true, color: white }, wrapText: true };
const refRows = Math.max(categories.length, subcategories.length, units.length, packages.length, packageUnits.length, 5, 24);
const fieldHelp = [
  ['name', 'Название без цены, артикула и служебных пометок.'],
  ['price_with_vat', 'Числовая цена за единицу с НДС.'],
  ['unit_name', 'За какую единицу указана цена: шт, пара, рулон и т. п.'],
  ['package_type', 'Внешняя оптовая упаковка: мешок, коробка, пачка и т. п.'],
  ['units_per_package', 'Целое количество единиц в одной внешней упаковке.'],
  ['package_unit', 'Подпись количества: шт, пар, рулонов, пачек.'],
  ['characteristics', 'По одной строке «Название: значение». Не придумывать неизвестные факты.'],
  ['is_active', '«Нет» отключает товар от публикации.'],
  ['external_id / slug', 'Не менять: по этим полям находится существующий товар при импорте.'],
];
const decisions = ['', 'Оставить', 'Отключить', 'Объединить', 'Проверить'];
const refsData = Array.from({ length: refRows }, (_, index) => [
  categories[index] || '', subcategories[index] || '', units[index] || '', packages[index] || '', packageUnits[index] || '',
  ['Да', 'Нет'][index] || '', decisions[index] || '', fieldHelp[index]?.[0] || '', fieldHelp[index]?.[1] || '',
]);
refs.getRange(`A4:I${refRows + 3}`).values = refsData;
refs.getRange(`A4:I${refRows + 3}`).format.borders = { insideHorizontal: { style: 'thin', color: '#E6ECEF' } };
refs.getRange('A:G').format.columnWidth = 24;
refs.getRange('H:H').format.columnWidth = 24;
refs.getRange('I:I').format.columnWidth = 58;
refs.getRange(`I4:I${refRows + 3}`).format.wrapText = true;
refs.freezePanes.freezeRows(3);

// Машинный лист импорта
importSheet.showGridLines = false;
const importHeaders = [
  'external_id', 'slug', 'meta_catalog_id', 'name', 'category', 'subcategory', 'price_with_vat', 'unit_name',
  'package_type', 'units_per_package', 'package_unit', 'min_order_packages', 'short_description', 'full_description',
  'characteristics', 'search_keywords', 'buyer_hint', 'image_url', 'brand', 'google_product_category',
  'fb_product_category', 'sort_order', 'is_featured', 'is_active',
];
importSheet.getRange('A1:X1').values = [importHeaders];
importSheet.getRange('A1:X1').format = { fill: navy, font: { bold: true, color: white }, wrapText: true };
const sourceColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'];
const importFormulas = products.map((_, index) => {
  const row = dataStartRow + index;
  const formulas = sourceColumns.map((column) => `='Редактирование'!${column}${row}`);
  formulas.push(`=IF('Редактирование'!W${row}="Да",TRUE,FALSE)`);
  formulas.push(`=IF('Редактирование'!X${row}="Да",TRUE,FALSE)`);
  return formulas;
});
importSheet.getRange(`A2:X${products.length + 1}`).formulas = importFormulas;
importSheet.getRange(`G2:G${products.length + 1}`).format.numberFormat = '#,##0.00';
importSheet.getRange(`J2:L${products.length + 1}`).format.numberFormat = '#,##0';
importSheet.getRange(`V2:V${products.length + 1}`).format.numberFormat = '#,##0';
importSheet.getRange(`A2:X${products.length + 1}`).format.borders = { insideHorizontal: { style: 'thin', color: '#E6ECEF' } };
importSheet.getRange('A:C').format.columnWidth = 22;
importSheet.getRange('D:F').format.columnWidth = 30;
importSheet.getRange('G:L').format.columnWidth = 18;
importSheet.getRange('M:U').format.columnWidth = 34;
importSheet.getRange('V:X').format.columnWidth = 14;
importSheet.freezePanes.freezeRows(1);
const importTable = importSheet.tables.add(`A1:X${products.length + 1}`, true, 'ProductsImportTable');
importTable.style = 'TableStyleMedium2';

// Комментарии к ключевым полям
workbook.comments.addThread({ cell: edit.getRange('D3') }, 'Уберите из названия цену и валюту. Например: «ХБ перчатки 7 нитей», без «100 тг».');
workbook.comments.addThread({ cell: edit.getRange('O3') }, 'Заполняйте построчно в формате «Название: значение». Не добавляйте сведения, которых нет в исходных данных.');
workbook.comments.addThread({ cell: edit.getRange('AG3') }, 'Для дублей выберите решение. Отключение товара подтверждается отдельно в столбце «Активен».');

await fs.mkdir(path.dirname(outputPath), { recursive: true });

const inspection = await workbook.inspect({
  kind: 'table',
  range: `Редактирование!A1:AH10`,
  include: 'values,formulas',
  tableMaxRows: 10,
  tableMaxCols: 34,
  maxChars: 12000,
});
await fs.writeFile(path.join(path.dirname(outputPath), 'inspection-editing.ndjson'), inspection.ndjson, 'utf8');

const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
});
await fs.writeFile(path.join(path.dirname(outputPath), 'formula-errors.ndjson'), errorScan.ndjson, 'utf8');

for (const [sheetName, range, fileName] of [
  ['Инструкция', 'A1:H12', 'preview-instructions.png'],
  ['Редактирование', 'A1:AH14', 'preview-editing.png'],
  ['Дубликаты', 'A1:L16', 'preview-duplicates.png'],
  ['Справочники', 'A1:I18', 'preview-references.png'],
  ['Импорт', 'A1:X12', 'preview-import.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(path.dirname(outputPath), fileName), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, products: products.length, duplicateGroups: duplicateKeys.length, duplicateRows: duplicateRows.length, stats: source.stats }));
