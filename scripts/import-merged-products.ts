import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import slugify from "slugify";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import { calculatePriceWithVat } from "../lib/pricing";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "output_merged", "products-with-images.csv");
const SHOULD_RESET = process.argv.includes("--reset");
const DRY_RUN = process.argv.includes("--dry-run");

type ProductRow = {
  category: string;
  subcategory?: string;
  name: string;
  sku: string;
  price_without_vat?: string;
  price_with_vat?: string;
  unit?: string;
  description?: string;
  package_info?: string;
  image_url?: string;
  is_active?: string;
  sort_order?: string;
  notes?: string;
  [key: string]: string | undefined;
};

function ensureReady() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local or .env");
  }

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Missing ${CSV_PATH}. Run scripts/upload-merged-images.ts first.`);
  }
}

function makeSlug(text: string, fallback: string) {
  return slugify(text || fallback, {
    lower: true,
    strict: true,
    locale: "ru",
  }) || fallback;
}

function toNumber(value?: string) {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function toInt(value?: string) {
  const number = toNumber(value);
  return number === null ? null : Math.round(number);
}

function toBoolean(value?: string, defaultValue = true) {
  if (value === undefined || value === "") return defaultValue;
  return ["true", "1", "yes", "да"].includes(value.trim().toLowerCase());
}

function parsePackage(description?: string) {
  const text = String(description || "").toLowerCase().replace(/ё/g, "е");
  let packageType: string | null = null;
  let packageQuantity: number | null = null;
  let packageUnit: string | null = null;

  if (text.includes("мешке") || text.includes("мешок")) packageType = "мешок";
  else if (text.includes("тюке") || text.includes("тюк")) packageType = "тюк";
  else if (text.includes("короб") || text.includes("📦")) packageType = "коробка";
  else if (text.includes("рулон")) packageType = "рулон";
  else if (text.includes("пачк")) packageType = "пачка";

  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(пар|пара|шт|штук|рулон|рулонов|кг|м)\b/);
  if (match) {
    packageQuantity = toInt(match[1]);
    const rawUnit = match[2];
    if (rawUnit.startsWith("пар") || rawUnit === "пара") packageUnit = "пар";
    else if (rawUnit.startsWith("шт") || rawUnit === "штук") packageUnit = "шт";
    else if (rawUnit.startsWith("рулон")) packageUnit = "рулон";
    else packageUnit = rawUnit;
  }

  return { packageType, packageQuantity, packageUnit };
}

async function resetCatalog() {
  console.log("Resetting catalog tables...");
  await prisma.clientSelectedProduct.deleteMany();
  await prisma.product.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  console.log("Catalog tables reset.");
}

async function getOrCreateCategory(name: string, sortOrder: number) {
  const slug = makeSlug(name, "category");
  return prisma.category.upsert({
    where: { slug },
    update: { name, sortOrder, isActive: true },
    create: { name, slug, sortOrder, isActive: true },
  });
}

async function getOrCreateSubcategory(categoryId: string, name: string, sortOrder: number) {
  const slug = makeSlug(name, `subcategory-${sortOrder}`);
  return prisma.subcategory.upsert({
    where: { slug },
    update: { name, categoryId, sortOrder, isActive: true },
    create: { name, slug, categoryId, sortOrder, isActive: true },
  });
}

function readRows() {
  const csv = fs.readFileSync(CSV_PATH, "utf8");
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as ProductRow[];
}

async function main() {
  ensureReady();

  if (!SHOULD_RESET && !DRY_RUN) {
    throw new Error("Refusing to import without --reset. Use --dry-run to inspect or --reset to replace catalog data.");
  }

  const rows = readRows();
  const missingUrls = rows.filter((row) => !row.image_url).length;
  const missingNames = rows.filter((row) => !row.name).length;

  console.log(JSON.stringify({
    csv: CSV_PATH,
    rows: rows.length,
    missingUrls,
    missingNames,
    dryRun: DRY_RUN,
    reset: SHOULD_RESET,
  }, null, 2));

  if (DRY_RUN) return;

  await resetCatalog();

  const categoryOrder = new Map<string, number>();
  const subcategoryOrder = new Map<string, number>();
  let created = 0;
  let updated = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const categoryName = row.category?.trim() || "Без категории";
    const subcategoryName = row.subcategory?.trim() || "";

    if (!categoryOrder.has(categoryName)) categoryOrder.set(categoryName, categoryOrder.size + 1);
    const category = await getOrCreateCategory(categoryName, categoryOrder.get(categoryName)!);

    let subcategoryId: string | null = null;
    if (subcategoryName) {
      const subKey = `${categoryName}/${subcategoryName}`;
      if (!subcategoryOrder.has(subKey)) subcategoryOrder.set(subKey, subcategoryOrder.size + 1);
      const subcategory = await getOrCreateSubcategory(category.id, subcategoryName, subcategoryOrder.get(subKey)!);
      subcategoryId = subcategory.id;
    }

    const priceWithoutVat = toInt(row.price_without_vat);
    const priceWithVat = calculatePriceWithVat(priceWithoutVat);
    const packageData = parsePackage(row.package_info || row.description);
    const externalId = row.sku?.trim() || `WA-${String(index + 1).padStart(4, "0")}`;

    const data = {
      externalId,
      categoryId: category.id,
      subcategoryId,
      name: row.name?.trim() || externalId,
      description: row.description?.trim() || row.notes?.trim() || null,
      unit: row.unit?.trim() || null,
      priceWithoutVat,
      priceWithVat,
      price: priceWithoutVat ? `${priceWithoutVat} тг.` : null,
      packageType: packageData.packageType,
      packageQuantity: packageData.packageQuantity,
      packageUnit: packageData.packageUnit,
      photo: row.image_url?.trim() || null,
      sortOrder: toInt(row.sort_order) || index + 1,
      isActive: toBoolean(row.is_active, true),
    };

    const existing = await prisma.product.findUnique({ where: { externalId } });
    if (existing) {
      await prisma.product.update({ where: { externalId }, data });
      updated += 1;
    } else {
      await prisma.product.create({ data });
      created += 1;
    }

    if ((index + 1) % 50 === 0) {
      console.log(`Imported ${index + 1}/${rows.length}`);
    }
  }

  const [products, categories, subcategories] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.subcategory.count(),
  ]);

  console.log(JSON.stringify({
    created,
    updated,
    products,
    categories,
    subcategories,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to import merged products:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
