import fs from "fs";
import path from "path";
import sharp from "sharp";
import slugify from "slugify";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const ROOT = process.cwd();
const OUTPUTS = [
  { dir: "output", sourceLabel: "output", skuPrefix: "WA1" },
  { dir: "output_2", sourceLabel: "output_2", skuPrefix: "WA2" },
] as const;

const OUT_DIR = path.join(ROOT, "output_merged");
const RAW_IMAGE_DIR = path.join(OUT_DIR, "images-raw");
const READY_IMAGE_DIR = path.join(OUT_DIR, "images-ready");
const VIDEO_DIR = path.join(OUT_DIR, "videos");
const REPORT_DIR = path.join(OUT_DIR, "reports");

const CSV_COLUMNS = [
  "image_raw",
  "category",
  "subcategory",
  "name",
  "sku",
  "price_without_vat",
  "price_with_vat",
  "unit",
  "description",
  "package_info",
  "image_filename",
  "image_url",
  "is_active",
  "is_popular",
  "sort_order",
  "notes",
];

const EXTENDED_COLUMNS = [
  ...CSV_COLUMNS,
  "source",
  "source_product_id",
  "source_collection_names",
  "source_collection_ids",
  "source_name_raw",
  "source_name_without_price",
  "source_description_raw",
  "source_image_sha256",
  "source_main_image_local_path",
  "ready_image_paths",
  "raw_image_paths",
  "video_paths",
  "needs_review",
];

type SourceConfig = (typeof OUTPUTS)[number];

type SourceRow = {
  product_id: string;
  collection_names: string;
  collection_ids: string;
  name_raw: string;
  name_without_price: string;
  description_raw: string;
  extracted_price_kzt: string;
  image_count: string;
  video_count: string;
  main_image_local_path: string;
  all_image_local_paths: string;
  image_sha256: string;
  [key: string]: string;
};

type ProductRow = Record<(typeof CSV_COLUMNS)[number], string>;
type ExtendedProductRow = Record<(typeof EXTENDED_COLUMNS)[number], string>;

type CategoryInfo = {
  category: string;
  subcategory: string;
};

type PreparedProduct = {
  product: ProductRow;
  extended: ExtendedProductRow;
  json: Record<string, string | string[]>;
  duplicateKeys: {
    imageSha256: string;
    textKey: string;
  };
};

const COLLECTION_MAP: Record<string, CategoryInfo> = {
  "хб перчатки": { category: "Перчатки", subcategory: "ХБ перчатки" },
  "прорезиненные перчатки": { category: "Перчатки", subcategory: "Прорезиненные перчатки" },
  "резиновые перчатки": { category: "Перчатки", subcategory: "Резиновые перчатки" },
  "спец перчатки": { category: "Перчатки", subcategory: "Спецперчатки" },
  "спецперчатки": { category: "Перчатки", subcategory: "Спецперчатки" },
  "краги": { category: "Перчатки", subcategory: "Краги" },
  "рукавицы": { category: "Перчатки", subcategory: "Рукавицы" },
  "зимние перчатки": { category: "Перчатки", subcategory: "Зимние перчатки" },
  "спец одежда": { category: "Спецодежда", subcategory: "Спец одежда" },
  "ветошь": { category: "Хозтовары", subcategory: "Ветошь" },
  "ветошь и вафельный": { category: "Хозтовары", subcategory: "Ветошь и вафельный материал" },
  "мешки": { category: "Мешки и сумки", subcategory: "Мешки" },
  "мешки и сумки": { category: "Мешки и сумки", subcategory: "Мешки и сумки" },
  "плёнки": { category: "Упаковка", subcategory: "Пленка" },
  "пленки": { category: "Упаковка", subcategory: "Пленка" },
  "скотч,стрейч,пленка": { category: "Упаковка", subcategory: "Скотч, стрейч, пленка" },
  "майки с ручками": { category: "Пакеты", subcategory: "Майки с ручками" },
  "мешочки без ручки": { category: "Пакеты", subcategory: "Мешочки без ручки" },
  "мусорные мешки": { category: "Пакеты", subcategory: "Мусорные мешки" },
  "коврики": { category: "Коврики", subcategory: "Коврики" },
  "газоны, теневые сетки": { category: "Сад и хозяйство", subcategory: "Газоны и теневые сетки" },
  "веники и метла": { category: "Инвентарь", subcategory: "Веники и метла" },
  "лопаты и грабли": { category: "Инвентарь", subcategory: "Лопаты и грабли" },
  "арканы и ремни": { category: "Инвентарь", subcategory: "Арканы и ремни" },
  "для стройки": { category: "Стройка", subcategory: "Для стройки" },
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetGeneratedOutput() {
  for (const dir of [RAW_IMAGE_DIR, READY_IMAGE_DIR, VIDEO_DIR, REPORT_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  for (const file of [
    "catalog.json",
    "products.csv",
    "products.xlsx",
    "products.xlsx.inspect.ndjson",
    "products_extended.csv",
  ]) {
    fs.rmSync(path.join(OUT_DIR, file), { force: true });
  }
}

function normalizeText(value: string) {
  return String(value || "")
    .replace(/✅/g, "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[«»"'`]/g, "")
    .replace(/[.,;:!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSlug(value: string, fallback: string) {
  const slug = slugify(value, {
    lower: true,
    strict: true,
    locale: "ru",
  });

  return slug || fallback.toLowerCase();
}

function readCsv(config: SourceConfig) {
  const file = path.join(ROOT, config.dir, "catalog.csv");
  if (!fs.existsSync(file)) {
    throw new Error(`Missing source CSV: ${file}`);
  }

  const csv = fs.readFileSync(file, "utf8");
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as SourceRow[];
}

function getCategoryInfo(collectionNames: string): CategoryInfo {
  const collectionParts = String(collectionNames || "")
    .split("|")
    .map((item) => normalizeText(item))
    .filter(Boolean);

  for (const collectionPart of collectionParts) {
    const normalizedPart = normalizeKey(collectionPart);
    const mapped = Object.entries(COLLECTION_MAP).find(([key]) => normalizeKey(key) === normalizedPart);
    if (mapped) return mapped[1];
  }

  const normalized = normalizeKey(collectionNames);
  const mapped = Object.entries(COLLECTION_MAP).find(([key]) => normalizeKey(key) === normalized);
  if (mapped) return mapped[1];

  return {
    category: collectionParts[0] || "Без категории",
    subcategory: "",
  };
}

function cleanDescriptor(value: string) {
  const cleaned = normalizeText(value)
    .replace(/^[-–—]+/, "")
    .replace(/^(нет в наличии)$/i, "нет в наличии")
    .trim();

  if (!cleaned) return "";
  if (/^\d+\s*(тг|тенге|kzt)\.?$/i.test(cleaned)) return "";
  return cleaned;
}

function buildProductName(row: SourceRow, categoryInfo: CategoryInfo, sku: string) {
  const descriptor = cleanDescriptor(row.name_without_price);
  const rawName = cleanDescriptor(row.name_raw);
  const price = normalizeText(row.extracted_price_kzt);
  const label = categoryInfo.subcategory || categoryInfo.category;

  if (descriptor) {
    return price ? `${label} ${descriptor} - ${price} тг` : `${label} ${descriptor}`;
  }

  if (rawName && !/^\d+\s*(тг|тенге|kzt)\.?$/i.test(rawName)) {
    return rawName.toLowerCase() === "нет в наличии" ? `${label} - нет в наличии` : rawName;
  }

  if (price) {
    return `${label} - ${price} тг`;
  }

  return `${label} ${sku}`;
}

function inferUnit(categoryInfo: CategoryInfo, name: string, description: string) {
  const text = normalizeKey(`${categoryInfo.category} ${categoryInfo.subcategory} ${name} ${description}`);

  if (text.includes("перчат") || text.includes("краги") || text.includes("рукавицы")) return "пара";
  if (text.includes("рулон")) return "рулон";
  if (text.includes("кг")) return "кг";
  return "шт";
}

function parsePackageInfo(description: string) {
  const text = normalizeKey(description);
  let packageType = "";
  let packageQuantity = "";
  let packageUnit = "";

  if (text.includes("мешке") || text.includes("мешок")) packageType = "мешок";
  else if (text.includes("тюке") || text.includes("тюк")) packageType = "тюк";
  else if (text.includes("короб") || description.includes("📦")) packageType = "коробка";
  else if (text.includes("рулон")) packageType = "рулон";
  else if (text.includes("пачк")) packageType = "пачка";

  const quantityMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(пар|пара|шт|штук|рулон|рулонов|кг|м)\b/);
  if (quantityMatch) {
    packageQuantity = quantityMatch[1].replace(",", ".");
    const rawUnit = quantityMatch[2];
    if (rawUnit.startsWith("пар") || rawUnit === "пара") packageUnit = "пар";
    else if (rawUnit.startsWith("шт") || rawUnit === "штук") packageUnit = "шт";
    else if (rawUnit.startsWith("рулон")) packageUnit = "рулон";
    else packageUnit = rawUnit;
  }

  return { packageType, packageQuantity, packageUnit };
}

function formatMoney(value: string) {
  const num = Number(String(value || "").replace(",", "."));
  return Number.isFinite(num) && num > 0 ? String(Math.round(num)) : "";
}

function priceWithVat(value: string) {
  const price = Number(formatMoney(value));
  return Number.isFinite(price) && price > 0 ? (price * 1.12).toFixed(2) : "";
}

function splitPaths(value: string) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceMediaPath(config: SourceConfig, mediaPath: string) {
  return path.join(ROOT, config.dir, mediaPath.replace(/\//g, path.sep));
}

function mediaOutputName(baseSlug: string, index: number, ext: string) {
  return index === 0 ? `${baseSlug}${ext}` : `${baseSlug}-${String(index + 1).padStart(2, "0")}${ext}`;
}

async function copyAndConvertImages(config: SourceConfig, row: SourceRow, baseSlug: string) {
  const imagePaths = splitPaths(row.all_image_local_paths || row.main_image_local_path);
  const rawPaths: string[] = [];
  const readyPaths: string[] = [];

  for (let index = 0; index < imagePaths.length; index += 1) {
    const source = sourceMediaPath(config, imagePaths[index]);
    if (!fs.existsSync(source)) continue;

    const rawExt = path.extname(source).toLowerCase() || ".jpg";
    const rawName = mediaOutputName(baseSlug, index, rawExt);
    const readyName = mediaOutputName(baseSlug, index, ".webp");

    const rawTarget = path.join(RAW_IMAGE_DIR, rawName);
    const readyTarget = path.join(READY_IMAGE_DIR, readyName);

    if (!fs.existsSync(rawTarget)) {
      fs.copyFileSync(source, rawTarget);
    }

    if (!fs.existsSync(readyTarget)) {
      await sharp(source)
        .rotate()
        .resize(1400, 1400, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 84,
          effort: 5,
        })
        .toFile(readyTarget);
    }

    rawPaths.push(path.posix.join("images-raw", rawName));
    readyPaths.push(path.posix.join("images-ready", readyName));
  }

  return { rawPaths, readyPaths };
}

function findVideoPaths(config: SourceConfig, productId: string) {
  const productVideoDir = path.join(ROOT, config.dir, "videos", productId);
  if (!fs.existsSync(productVideoDir)) return [];

  return fs
    .readdirSync(productVideoDir)
    .filter((name) => name.toLowerCase().endsWith(".mp4"))
    .map((name) => path.join(productVideoDir, name));
}

function copyVideos(config: SourceConfig, productId: string, baseSlug: string) {
  const videos = findVideoPaths(config, productId);
  const copied: string[] = [];

  videos.forEach((source, index) => {
    const name = mediaOutputName(baseSlug, index, ".mp4");
    const target = path.join(VIDEO_DIR, name);
    if (!fs.existsSync(target)) {
      fs.copyFileSync(source, target);
    }
    copied.push(path.posix.join("videos", name));
  });

  return copied;
}

async function runLimited<T>(tasks: (() => Promise<T>)[], concurrency: number) {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );

  return results;
}

function duplicateTextKey(row: SourceRow, categoryInfo: CategoryInfo) {
  return [
    normalizeKey(categoryInfo.subcategory || categoryInfo.category),
    normalizeKey(row.name_without_price || row.name_raw),
    normalizeKey(row.description_raw),
    formatMoney(row.extracted_price_kzt),
  ].join("|");
}

function createPotentialDuplicateReport(products: PreparedProduct[]) {
  const rows: Record<string, string>[] = [];
  const bySha = new Map<string, PreparedProduct[]>();
  const byText = new Map<string, PreparedProduct[]>();

  for (const product of products) {
    if (product.duplicateKeys.imageSha256) {
      const group = bySha.get(product.duplicateKeys.imageSha256) || [];
      group.push(product);
      bySha.set(product.duplicateKeys.imageSha256, group);
    }

    if (product.duplicateKeys.textKey) {
      const group = byText.get(product.duplicateKeys.textKey) || [];
      group.push(product);
      byText.set(product.duplicateKeys.textKey, group);
    }
  }

  function appendGroups(kind: string, map: Map<string, PreparedProduct[]>) {
    for (const [key, group] of map.entries()) {
      if (group.length < 2) continue;
      const groupId = `${kind}:${key}`;
      for (const item of group) {
        rows.push({
          duplicate_type: kind,
          duplicate_key: key,
          group_id: groupId,
          sku: item.product.sku,
          name: item.product.name,
          category: item.product.category,
          subcategory: item.product.subcategory,
          price_without_vat: item.product.price_without_vat,
          image_filename: item.product.image_filename,
          source: item.extended.source,
          source_product_id: item.extended.source_product_id,
          source_name_raw: item.extended.source_name_raw,
        });
      }
    }
  }

  appendGroups("image_sha256", bySha);
  appendGroups("text", byText);

  return rows;
}

async function prepareProduct(config: SourceConfig, row: SourceRow, index: number, sortOrder: number): Promise<PreparedProduct> {
  const sku = `${config.skuPrefix}-${String(index + 1).padStart(4, "0")}`;
  const categoryInfo = getCategoryInfo(row.collection_names);
  const name = buildProductName(row, categoryInfo, sku);
  const fallbackSlug = sku.toLowerCase();
  const baseSlug = makeSlug(`${name} ${sku}`, fallbackSlug);
  const price = formatMoney(row.extracted_price_kzt);
  const description = normalizeText(row.description_raw);
  const packageInfo = description;
  const packageParts = parsePackageInfo(description);
  const media = await copyAndConvertImages(config, row, baseSlug);
  const videos = copyVideos(config, row.product_id, baseSlug);
  const needsReview = [
    !cleanDescriptor(row.name_without_price),
    !price,
    row.name_raw.toLowerCase().includes("нет в наличии"),
    media.readyPaths.length === 0,
  ].some(Boolean);

  const notes = [
    `Источник: ${config.sourceLabel}`,
    `WhatsApp product_id: ${row.product_id}`,
    `Исходная коллекция: ${normalizeText(row.collection_names)}`,
    `Исходное название: ${normalizeText(row.name_raw) || "-"}`,
    row.image_sha256 ? `image_sha256: ${row.image_sha256}` : "",
    videos.length > 0 ? `Видео: ${videos.join(" | ")}` : "",
    needsReview ? "Требует ручной проверки" : "",
  ].filter(Boolean).join("; ");

  const product: ProductRow = {
    image_raw: media.rawPaths[0] || "",
    category: categoryInfo.category,
    subcategory: categoryInfo.subcategory,
    name,
    sku,
    price_without_vat: price,
    price_with_vat: priceWithVat(price),
    unit: inferUnit(categoryInfo, name, description),
    description,
    package_info: packageInfo,
    image_filename: media.readyPaths[0]?.replace("images-ready/", "") || "",
    image_url: "",
    is_active: "true",
    is_popular: "false",
    sort_order: String(sortOrder),
    notes,
  };

  const extended: ExtendedProductRow = {
    ...product,
    source: config.sourceLabel,
    source_product_id: row.product_id,
    source_collection_names: normalizeText(row.collection_names),
    source_collection_ids: row.collection_ids,
    source_name_raw: normalizeText(row.name_raw),
    source_name_without_price: normalizeText(row.name_without_price),
    source_description_raw: description,
    source_image_sha256: row.image_sha256,
    source_main_image_local_path: row.main_image_local_path,
    ready_image_paths: media.readyPaths.join(" | "),
    raw_image_paths: media.rawPaths.join(" | "),
    video_paths: videos.join(" | "),
    needs_review: needsReview ? "true" : "false",
  };

  return {
    product,
    extended,
    json: {
      ...extended,
      ready_image_paths: media.readyPaths,
      raw_image_paths: media.rawPaths,
      video_paths: videos,
    },
    duplicateKeys: {
      imageSha256: row.image_sha256,
      textKey: duplicateTextKey(row, categoryInfo),
    },
  };
}

async function main() {
  resetGeneratedOutput();
  ensureDir(OUT_DIR);
  ensureDir(RAW_IMAGE_DIR);
  ensureDir(READY_IMAGE_DIR);
  ensureDir(VIDEO_DIR);
  ensureDir(REPORT_DIR);

  const tasks: (() => Promise<PreparedProduct>)[] = [];
  let sortOrder = 1;

  for (const config of OUTPUTS) {
    const rows = readCsv(config);
    for (let index = 0; index < rows.length; index += 1) {
      const currentSortOrder = sortOrder;
      tasks.push(() => prepareProduct(config, rows[index], index, currentSortOrder));
      sortOrder += 1;
    }
  }

  const products = await runLimited(tasks, 6);

  const productRows = products.map((item) => item.product);
  const extendedRows = products.map((item) => item.extended);
  const duplicateRows = createPotentialDuplicateReport(products);

  fs.writeFileSync(
    path.join(OUT_DIR, "products.csv"),
    stringify(productRows, { header: true, columns: CSV_COLUMNS }),
    "utf8",
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "products_extended.csv"),
    stringify(extendedRows, { header: true, columns: EXTENDED_COLUMNS }),
    "utf8",
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "catalog.json"),
    JSON.stringify(products.map((item) => item.json), null, 2),
    "utf8",
  );

  fs.writeFileSync(
    path.join(REPORT_DIR, "potential_duplicates.csv"),
    stringify(duplicateRows, { header: true }),
    "utf8",
  );

  const summary = {
    generated_at: new Date().toISOString(),
    sources: OUTPUTS.map((config) => ({
      source: config.sourceLabel,
      rows: products.filter((item) => item.extended.source === config.sourceLabel).length,
      sku_prefix: config.skuPrefix,
    })),
    products_total: products.length,
    images_ready_total: products.reduce((sum, item) => {
      const value = item.extended.ready_image_paths;
      return sum + (value ? value.split(" | ").length : 0);
    }, 0),
    videos_total: products.reduce((sum, item) => {
      const value = item.extended.video_paths;
      return sum + (value ? value.split(" | ").length : 0);
    }, 0),
    needs_review_total: products.filter((item) => item.extended.needs_review === "true").length,
    potential_duplicate_rows: duplicateRows.length,
    note: "No products were deleted or deduplicated. Duplicate report is for manual review only.",
  };

  fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
