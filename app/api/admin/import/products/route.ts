import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { makeSlug, normalizeProductData, productPublicationErrors, uniqueProductSlug } from '@/lib/product-input';
import { prisma } from '@/lib/prisma';

const aliases: Record<string, string[]> = {
  externalId: ['externalId', 'external_id', 'артикул'], slug: ['slug'], metaCatalogId: ['metaCatalogId', 'meta_catalog_id'],
  name: ['name', 'название'], categoryId: ['categoryId', 'category_id'], category: ['category', 'категория'],
  subcategoryId: ['subcategoryId', 'subcategory_id'], priceWithVat: ['priceWithVat', 'price_with_vat', 'цена_с_ндс'],
  unitName: ['unitName', 'unit_name', 'unit', 'единица'], packageType: ['packageType', 'package_type', 'тип_упаковки'],
  unitsPerPackage: ['unitsPerPackage', 'units_per_package', 'package_quantity', 'единиц_в_упаковке'],
  packageUnit: ['packageUnit', 'package_unit'], minOrderPackages: ['minOrderPackages', 'min_order_packages'],
  shortDescription: ['shortDescription', 'short_description', 'description', 'короткое_описание'],
  fullDescription: ['fullDescription', 'full_description', 'полное_описание'], characteristics: ['characteristics', 'характеристики'],
  searchKeywords: ['searchKeywords', 'search_keywords'], buyerHint: ['buyerHint', 'buyer_hint'],
  imageUrl: ['imageUrl', 'image_url', 'photo'], brand: ['brand'], googleProductCategory: ['googleProductCategory', 'google_product_category'],
  fbProductCategory: ['fbProductCategory', 'fb_product_category'], sortOrder: ['sortOrder', 'sort_order'],
  isFeatured: ['isFeatured', 'is_featured'], isActive: ['isActive', 'is_active'],
};

function sourceValue(row: Record<string, unknown>, field: string) {
  const key = aliases[field]?.find((candidate) => Object.prototype.hasOwnProperty.call(row, candidate));
  return key ? { present: true, value: row[key] } : { present: false, value: undefined };
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'да'].includes(String(value).trim().toLowerCase());
}

function existingInput(existing: Record<string, any> | null) {
  if (!existing) return { isActive: false, isFeatured: false, minOrderPackages: 1, sortOrder: 0 };
  return {
    externalId: existing.externalId, slug: existing.slug, metaCatalogId: existing.metaCatalogId, name: existing.name,
    categoryId: existing.categoryId, subcategoryId: existing.subcategoryId, priceWithVat: existing.priceWithVat,
    unitName: existing.unitName || existing.unit, packageType: existing.packageType,
    unitsPerPackage: existing.unitsPerPackage ?? existing.packageQuantity, packageUnit: existing.packageUnit,
    minOrderPackages: existing.minOrderPackages, shortDescription: existing.shortDescription || existing.description,
    fullDescription: existing.fullDescription, characteristics: existing.characteristics,
    searchKeywords: existing.searchKeywords, buyerHint: existing.buyerHint, imageUrl: existing.imageUrl || existing.photo,
    brand: existing.brand, googleProductCategory: existing.googleProductCategory, fbProductCategory: existing.fbProductCategory,
    sortOrder: existing.sortOrder, isFeatured: existing.isFeatured, isActive: existing.isActive,
  };
}

export async function POST(request: NextRequest) {
  if (!(await checkAdminAuth(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : body.items;
    const dryRun = !Array.isArray(body) && body.dryRun === true;
    if (!Array.isArray(items)) return NextResponse.json({ success: false, error: 'Ожидается массив товаров' }, { status: 400 });
    if (items.length > 5_000) return NextResponse.json({ success: false, error: 'Не более 5000 строк за один импорт' }, { status: 413 });

    let created = 0; let updated = 0; let skipped = 0;
    const errors: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];

    for (let index = 0; index < items.length; index++) {
      const rowNumber = index + 1;
      const row = items[index] as Record<string, unknown>;
      try {
        if (!row || typeof row !== 'object') throw new Error('Строка должна быть объектом');
        const external = sourceValue(row, 'externalId');
        const requestedSlug = sourceValue(row, 'slug');
        const metaId = sourceValue(row, 'metaCatalogId');
        const existing = await prisma.product.findFirst({
          where: {
            OR: [
              ...(external.present && String(external.value).trim() ? [{ externalId: String(external.value).trim() }] : []),
              ...(requestedSlug.present && String(requestedSlug.value).trim() ? [{ slug: String(requestedSlug.value).trim() }] : []),
              ...(metaId.present && String(metaId.value).trim() ? [{ metaCatalogId: String(metaId.value).trim() }] : []),
            ],
          },
        });

        const input: Record<string, unknown> = existingInput(existing as unknown as Record<string, any> | null);
        for (const field of Object.keys(aliases)) {
          const source = sourceValue(row, field);
          if (source.present) input[field] = ['isActive', 'isFeatured'].includes(field) ? booleanValue(source.value) : source.value;
        }
        if (!String(input.name || '').trim()) throw new Error('Нет названия');

        const categoryIdSource = sourceValue(row, 'categoryId');
        const categoryNameSource = sourceValue(row, 'category');
        if (categoryIdSource.present && String(categoryIdSource.value).trim()) {
          const category = await prisma.category.findUnique({ where: { id: String(categoryIdSource.value).trim() } });
          if (!category) throw new Error('Категория по category_id не найдена');
          input.categoryId = category.id;
        } else if (categoryNameSource.present && String(categoryNameSource.value).trim()) {
          const categoryName = String(categoryNameSource.value).trim();
          const categorySlug = makeSlug(categoryName, `category-${rowNumber}`);
          const found = await prisma.category.findUnique({ where: { slug: categorySlug } });
          if (found) input.categoryId = found.id;
          else if (dryRun) input.categoryId = `new:${categorySlug}`;
          else input.categoryId = (await prisma.category.create({ data: { name: categoryName, slug: categorySlug } })).id;
        }
        if (!String(input.categoryId || '').trim()) throw new Error('Нет категории');

        const baseSlug = makeSlug(input.slug, String(input.externalId || input.name || `product-${rowNumber}`));
        const slug = await uniqueProductSlug(baseSlug, existing?.id);
        const data = normalizeProductData(input, slug);
        const publicationErrors = productPublicationErrors(data);
        if (data.isActive && publicationErrors.length) throw new Error(`Нельзя опубликовать: ${publicationErrors.join(', ')}`);
        if (!data.isActive && publicationErrors.length) warnings.push({ row: rowNumber, message: `Черновик: заполните ${publicationErrors.join(', ')}` });

        if (!dryRun) {
          if (existing) await prisma.product.update({ where: { id: existing.id }, data });
          else await prisma.product.create({ data });
        }
        if (existing) updated++; else created++;
      } catch (reason) {
        skipped++; errors.push({ row: rowNumber, message: reason instanceof Error ? reason.message : 'Неизвестная ошибка' });
      }
    }

    return NextResponse.json({ success: errors.length === 0, dryRun, created, updated, skipped, errors, warnings });
  } catch (reason) {
    return NextResponse.json({ success: false, error: reason instanceof Error ? reason.message : 'Ошибка импорта', created: 0, updated: 0, skipped: 0, errors: [] }, { status: 400 });
  }
}
