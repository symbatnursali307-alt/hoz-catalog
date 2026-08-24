import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "imports", "products_import_ready.csv");

type CSVRow = {
  externalId: string;
  category: string;
  categoryId: string; // This is the slug we want to use
  name: string;
  unit: string;
  description: string;
  photo: string;
  price: string;
  priceWithoutVat: string;
  priceWithVat: string;
  packageQuantity: string;
  packageType: string;
  packageUnit: string;
  isActive: string;
  sortOrder: string;
  [key: string]: any;
};

function toNumber(value?: string) {
  if (!value) return null;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function toInt(value?: string) {
  const num = toNumber(value);
  return num !== null ? Math.round(num) : null;
}

function toBoolean(value?: string) {
  if (!value) return true;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "да", "истина"].includes(normalized);
}

async function getOrCreateCategory(slug: string, name: string) {
  return prisma.category.upsert({
    where: { slug },
    update: { name },
    create: {
      slug,
      name,
      isActive: true,
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not found in .env.local");
  }

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  console.log("Reading CSV...");
  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CSVRow[];

  console.log(`Total items to import: ${rows.length}`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      if (!row.name || !row.category) {
        console.warn(`[${rowNum}] Skipping: missing name or category`);
        continue;
      }

      // Use categoryId from CSV as slug
      const category = await getOrCreateCategory(row.categoryId || "general", row.category);

      const externalId = row.externalId?.trim() || `ID-${rowNum}`;

      const data = {
        slug: String(externalId).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || `product-${rowNum}`,
        name: row.name.trim(),
        description: row.description?.trim() || null,
        unit: row.unit?.trim() || null,
        
        priceWithoutVat: toInt(row.priceWithoutVat),
        priceWithVat: toNumber(row.priceWithVat),
        price: row.price?.trim() || (row.priceWithoutVat ? `${toInt(row.priceWithoutVat)} тг.` : null),

        packageType: row.packageType?.trim() || null,
        packageQuantity: toInt(row.packageQuantity),
        packageUnit: row.packageUnit?.trim() || null,

        photo: row.photo?.trim() || null,
        
        isActive: toBoolean(row.isActive),
        sortOrder: toInt(row.sortOrder) || rowNum,
        
        categoryId: category.id,
      };

      await prisma.product.upsert({
        where: { externalId },
        update: data,
        create: data,
      });

      if (rowNum % 50 === 0) {
        console.log(`Processed ${rowNum}/${rows.length} items...`);
      }
    } catch (error: any) {
      console.error(`[${rowNum}] Error importing "${row.name}":`, error.message);
    }
  }

  console.log("Success: All products imported to Neon!");
}

main()
  .catch((e) => {
    console.error("Fatal error during import:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
