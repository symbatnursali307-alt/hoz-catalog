import fs from "fs";
import path from "path";
import sharp from "sharp";
import { parse } from "csv-parse/sync";

const ROOT = process.cwd();

const CSV_PATH = path.join(ROOT, "imports", "products.csv");
const RAW_DIR = path.join(ROOT, "imports", "images-raw");
const READY_DIR = path.join(ROOT, "imports", "images-ready");

const IMAGE_SIZE = 1000;
const WEBP_QUALITY = 82;

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
  [key: string]: any;
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function convertImage(row: ProductRow) {
  const inputPath = path.join(RAW_DIR, row.image_raw!);
  const outputPath = path.join(READY_DIR, row.image_filename);

  if (!fs.existsSync(inputPath)) {
    console.warn(`❌ Нет исходного фото: ${row.image_raw}`);
    return;
  }

  if (!row.image_filename.endsWith(".webp")) {
    console.warn(`❌ image_filename должен быть .webp: ${row.image_filename}`);
    return;
  }

  await sharp(inputPath)
    .rotate()
    .resize(IMAGE_SIZE, IMAGE_SIZE, {
      fit: "cover",
      position: "center",
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 6,
    })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  const sizeKb = Math.round(stats.size / 1024);

  console.log(`✅ ${row.image_raw} → ${row.image_filename} (${sizeKb} KB)`);
}

async function main() {
  ensureDir(READY_DIR);

  const csv = fs.readFileSync(CSV_PATH, "utf8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as ProductRow[];

  console.log(`Найдено товаров в CSV: ${rows.length}`);

  for (const row of rows) {
    if (!row.image_raw || !row.image_filename) {
      console.warn(`⚠️ Пропущено фото у товара: ${row.name}`);
      continue;
    }

    await convertImage(row);
  }

  console.log("Готово: фото сконвертированы.");
}

main().catch((error) => {
  console.error("Ошибка конвертации:", error);
  process.exit(1);
});
