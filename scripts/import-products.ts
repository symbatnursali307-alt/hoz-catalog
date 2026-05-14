import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import slugify from "slugify";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "imports", "products-with-images.csv");

type ProductRow = {
  category: string;
  subcategory?: string;
  name: string;
  sku?: string;
  price_without_vat?: string;
  price_with_vat?: string;
  unit?: string;
  description?: string;
  package_info?: string;
  image_raw?: string;
  image_filename?: string;
  image_url?: string;
  is_active?: string;
  is_popular?: string;
  sort_order?: string;
  [key: string]: any;
};

function makeSlug(text: string) {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: "ru",
  });
}

function toNumber(value?: string) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!cleaned) return null;

  return Math.round(Number(cleaned));
}

function toBoolean(value?: string, defaultValue = false) {
  if (!value) return defaultValue;

  const normalized = String(value).trim().toLowerCase();

  return ["true", "1", "yes", "да", "истина"].includes(normalized);
}

async function getOrCreateCategory(name: string) {
  const slug = makeSlug(name);

  return prisma.category.upsert({
    where: { slug },
    update: {
      name,
      isActive: true,
    },
    create: {
      name,
      slug,
      isActive: true,
    },
  });
}

async function importProduct(row: ProductRow, index: number) {
  if (!row.name) {
    console.warn(`⚠️ Пропуск строки ${index + 1}: нет name`);
    return;
  }

  if (!row.category) {
    console.warn(`⚠️ Пропуск товара "${row.name}": нет category`);
    return;
  }

  const category = await getOrCreateCategory(row.category);

  const sku = row.sku?.trim() || `AUTO-${index + 1}`;

  const data = {
    name: row.name.trim(),
    sku,
    categoryId: category.id,
    subcategory: row.subcategory?.trim() || null,

    priceWithoutVat: toNumber(row.price_without_vat),
    priceWithVat: toNumber(row.price_with_vat),

    unit: row.unit?.trim() || null,
    description: row.description?.trim() || null,
    packageInfo: row.package_info?.trim() || null,

    imageFilename: row.image_filename?.trim() || null,
    imageUrl: row.image_url?.trim() || null,

    isActive: toBoolean(row.is_active, true),
    isPopular: toBoolean(row.is_popular, false),
    sortOrder: toNumber(row.sort_order) || index + 1,
  };

  await prisma.product.upsert({
    where: { sku },
    update: data,
    create: data,
  });

  console.log(`✅ Импортирован товар: ${row.name}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Нет DATABASE_URL в .env.local");
  }

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Нет файла: ${CSV_PATH}. Сначала запусти upload-images.ts`);
  }

  const csv = fs.readFileSync(CSV_PATH, "utf8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as ProductRow[];

  console.log(`Найдено товаров для импорта: ${rows.length}`);

  for (let i = 0; i < rows.length; i++) {
    await importProduct(rows[i], i);
  }

  console.log("Готово: товары импортированы в базу.");
}

main()
  .catch((error) => {
    console.error("Ошибка импорта:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
