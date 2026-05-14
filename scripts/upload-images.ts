import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { put } from "@vercel/blob";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

dotenv.config({ path: ".env.local" });

const ROOT = process.cwd();

const CSV_PATH = path.join(ROOT, "imports", "products.csv");
const OUTPUT_CSV_PATH = path.join(ROOT, "imports", "products-with-images.csv");
const READY_DIR = path.join(ROOT, "imports", "images-ready");

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
  image_filename: string;
  image_url?: string;
  is_active?: string;
  is_popular?: string;
  sort_order?: string;
};

function categoryToFolder(category: string) {
  const map: Record<string, string> = {
    "Перчатки": "gloves",
    "Пакеты": "bags",
    "Плёнка": "film",
    "Пленка": "film",
    "Уборка": "cleaning",
    "Хозтовары": "household",
    "Инвентарь": "inventory",
    "Краги": "kragi",
  };

  return map[category] || "other";
}

async function uploadImage(row: ProductRow) {
  const imagePath = path.join(READY_DIR, row.image_filename);

  if (!fs.existsSync(imagePath)) {
    console.warn(`❌ Нет готового WebP: ${row.image_filename}`);
    return "";
  }

  const fileBuffer = fs.readFileSync(imagePath);
  const folder = categoryToFolder(row.category);

  const blobPath = `products/${folder}/${row.image_filename}`;

  const blob = await put(blobPath, fileBuffer, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
  });

  console.log(`✅ Загружено: ${blobPath}`);

  return blob.url;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Нет BLOB_READ_WRITE_TOKEN в .env.local");
  }

  const csv = fs.readFileSync(CSV_PATH, "utf8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ProductRow[];

  const updatedRows: ProductRow[] = [];

  for (const row of rows) {
    if (!row.image_filename) {
      console.warn(`⚠️ Нет image_filename у товара: ${row.name}`);
      updatedRows.push(row);
      continue;
    }

    const imageUrl = await uploadImage(row);

    updatedRows.push({
      ...row,
      image_url: imageUrl,
    });
  }

  const outputCsv = stringify(updatedRows, {
    header: true,
  });

  fs.writeFileSync(OUTPUT_CSV_PATH, outputCsv, "utf8");

  console.log(`Готово: создан файл ${OUTPUT_CSV_PATH}`);
}

main().catch((error) => {
  console.error("Ошибка загрузки в Blob:", error);
  process.exit(1);
});
