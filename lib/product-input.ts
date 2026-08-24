import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { prisma } from '@/lib/prisma';
import { roundPriceUp } from '@/lib/pricing';

function text(value: unknown, maxLength = 10_000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function positiveInteger(value: unknown, fallback: number | null = null) {
  if (value === '' || value == null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: unknown) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCharacteristics(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null || value === '') return Prisma.JsonNull;
  if (typeof value === 'object') return value as Prisma.InputJsonValue;
  if (typeof value !== 'string') return Prisma.JsonNull;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as Prisma.InputJsonValue;
  } catch {
    // Admins may use one "Название: значение" characteristic per line.
  }

  const result: Record<string, string> = {};
  value.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator < 1) return;
    const key = line.slice(0, separator).trim();
    const itemValue = line.slice(separator + 1).trim();
    if (key && itemValue) result[key] = itemValue;
  });
  return Object.keys(result).length ? result : Prisma.JsonNull;
}

export function makeSlug(value: unknown, fallback: string) {
  return slugify(text(value) || fallback, { lower: true, strict: true, locale: 'ru' }) || fallback;
}

export async function uniqueProductSlug(candidate: string, excludeId?: string) {
  let slug = candidate;
  let counter = 2;
  while (
    await prisma.product.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${candidate}-${counter++}`;
  }
  return slug;
}

export function normalizeProductData(data: Record<string, unknown>, slug: string) {
  const name = text(data.name, 500);
  const categoryId = text(data.categoryId, 100);
  if (!name) throw new Error('Название обязательно');
  if (!categoryId) throw new Error('Категория обязательна');

  const parsedPriceWithVat = positiveNumber(data.priceWithVat);
  const priceWithVat = parsedPriceWithVat ? roundPriceUp(parsedPriceWithVat) : null;
  const priceWithoutVat = positiveInteger(data.priceWithoutVat);
  const unitName = text(data.unitName ?? data.unit, 100) || null;
  const unitsPerPackage = positiveInteger(data.unitsPerPackage ?? data.packageQuantity);
  const packageType = text(data.packageType, 100) || null;
  const packageUnit = text(data.packageUnit, 100) || unitName;
  const imageUrl = text(data.imageUrl ?? data.photo, 2_000) || null;
  const shortDescription = text(data.shortDescription ?? data.description, 2_000) || null;
  const fullDescription = text(data.fullDescription ?? data.description, 20_000) || null;
  const minOrderPackages = positiveInteger(data.minOrderPackages, 1) || 1;
  const metaCatalogId = makeSlug(data.metaCatalogId, slug);

  return {
    externalId: text(data.externalId, 200) || null,
    slug,
    categoryId,
    subcategoryId: text(data.subcategoryId, 100) || null,
    name,
    description: shortDescription,
    shortDescription,
    fullDescription,
    characteristics: parseCharacteristics(data.characteristics),
    searchKeywords: text(data.searchKeywords, 2_000) || null,
    buyerHint: text(data.buyerHint, 2_000) || null,
    unit: unitName,
    unitName,
    priceWithoutVat,
    priceWithVat,
    price: priceWithVat ? `${priceWithVat} ₸ с НДС` : null,
    packageType,
    packageQuantity: unitsPerPackage,
    unitsPerPackage,
    packageUnit,
    photo: imageUrl,
    imageUrl,
    minOrderPackages,
    isFeatured: data.isFeatured === true,
    metaCatalogId,
    brand: text(data.brand, 200) || null,
    googleProductCategory: text(data.googleProductCategory, 500) || null,
    fbProductCategory: text(data.fbProductCategory, 500) || null,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Math.round(Number(data.sortOrder)) : 0,
    isActive: data.isActive !== false,
  } satisfies Prisma.ProductUncheckedCreateInput;
}

export function productPublicationErrors(data: ReturnType<typeof normalizeProductData>) {
  const errors: string[] = [];
  if (!data.priceWithVat) errors.push('цена с НДС');
  if (!data.unitName) errors.push('единица измерения');
  if (!data.packageType) errors.push('тип упаковки');
  if (!data.unitsPerPackage) errors.push('количество в упаковке');
  if (!data.categoryId) errors.push('категория');
  return errors;
}
