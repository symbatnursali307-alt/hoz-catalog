import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import slugify from "slugify";
import { put } from "@vercel/blob";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

dotenv.config({ path: ".env.local" });
dotenv.config();

const ROOT = process.cwd();
const MERGED_DIR = path.join(ROOT, "output_merged");
const CSV_PATH = path.join(MERGED_DIR, "products.csv");
const EXTENDED_CSV_PATH = path.join(MERGED_DIR, "products_extended.csv");
const OUTPUT_CSV_PATH = path.join(MERGED_DIR, "products-with-images.csv");
const OUTPUT_EXTENDED_CSV_PATH = path.join(MERGED_DIR, "products_extended-with-images.csv");
const READY_DIR = path.join(MERGED_DIR, "images-ready");

type ProductRow = {
  category: string;
  subcategory?: string;
  name: string;
  sku: string;
  image_filename: string;
  image_url?: string;
  [key: string]: string | undefined;
};

function ensureFile(file: string) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file: ${file}`);
  }
}

function folderSlug(category: string) {
  return slugify(category || "other", {
    lower: true,
    strict: true,
    locale: "ru",
  }) || "other";
}

function readCsv(file: string) {
  ensureFile(file);
  return parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as ProductRow[];
}

async function uploadImage(row: ProductRow) {
  if (!row.image_filename) return "";

  const imagePath = path.join(READY_DIR, row.image_filename);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing image for ${row.sku}: ${imagePath}`);
  }

  const blobPath = `products/${folderSlug(row.category)}/${row.image_filename}`;
  const blob = await put(blobPath, fs.readFileSync(imagePath), {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log(`Uploaded ${row.sku}: ${blobPath}`);
  return blob.url;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set in .env.local or .env");
  }

  const rows = readCsv(CSV_PATH);
  const extendedRows = readCsv(EXTENDED_CSV_PATH);
  const urlsBySku = new Map<string, string>();

  for (const row of rows) {
    const imageUrl = await uploadImage(row);
    urlsBySku.set(row.sku, imageUrl);
  }

  const rowsWithUrls = rows.map((row) => ({
    ...row,
    image_url: urlsBySku.get(row.sku) || row.image_url || "",
  }));

  const extendedRowsWithUrls = extendedRows.map((row) => ({
    ...row,
    image_url: urlsBySku.get(row.sku) || row.image_url || "",
  }));

  fs.writeFileSync(OUTPUT_CSV_PATH, stringify(rowsWithUrls, { header: true }), "utf8");
  fs.writeFileSync(OUTPUT_EXTENDED_CSV_PATH, stringify(extendedRowsWithUrls, { header: true }), "utf8");

  const missingUrls = rowsWithUrls.filter((row) => !row.image_url).length;
  console.log(JSON.stringify({
    products: rowsWithUrls.length,
    uploaded: rowsWithUrls.length - missingUrls,
    missingUrls,
    outputCsv: OUTPUT_CSV_PATH,
    outputExtendedCsv: OUTPUT_EXTENDED_CSV_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error("Failed to upload merged images:", error);
  process.exit(1);
});
