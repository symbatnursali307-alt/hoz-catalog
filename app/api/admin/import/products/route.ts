import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin-auth';
import slugify from 'slugify';

function makeSlug(text: string) {
  return slugify(text, { lower: true, strict: true, locale: 'ru' });
}

export async function POST(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const items = body.items || body;

    if (!Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: 'Ожидается JSON-массив товаров',
      }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
          errors.push({ row: rowNum, message: 'Нет поля name' });
          skipped++;
          continue;
        }

        if (!row.category || typeof row.category !== 'string' || !row.category.trim()) {
          errors.push({ row: rowNum, message: 'Нет поля category' });
          skipped++;
          continue;
        }

        // Find or create category
        const categoryName = row.category.trim();
        const categorySlug = makeSlug(categoryName);

        const category = await prisma.category.upsert({
          where: { slug: categorySlug },
          update: { name: categoryName },
          create: { name: categoryName, slug: categorySlug, isActive: true },
        });

        // Map snake_case -> camelCase
        const externalId = row.external_id?.trim() || null;
        const data = {
          name: row.name.trim(),
          categoryId: category.id,
          externalId,
          priceWithoutVat: row.price_without_vat != null ? Math.round(Number(row.price_without_vat)) : null,
          priceWithVat: row.price_with_vat != null ? parseFloat(String(row.price_with_vat)) : null,
          price: row.price_without_vat != null ? `${Math.round(Number(row.price_without_vat))} тг.` : null,
          unit: row.unit?.trim() || null,
          description: row.description?.trim() || null,
          packageType: row.package_type?.trim() || null,
          packageQuantity: row.package_quantity != null ? Math.round(Number(row.package_quantity)) : null,
          packageUnit: row.package_unit?.trim() || null,
          photo: row.image_url?.trim() || null,
          isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
          sortOrder: row.sort_order != null ? Math.round(Number(row.sort_order)) : rowNum,
        };

        // Upsert by externalId if available
        if (externalId) {
          const existing = await prisma.product.findUnique({
            where: { externalId },
          });

          if (existing) {
            await prisma.product.update({
              where: { externalId },
              data,
            });
            updated++;
          } else {
            await prisma.product.create({ data });
            created++;
          }
        } else {
          await prisma.product.create({ data });
          created++;
        }
      } catch (rowError: any) {
        errors.push({ row: rowNum, message: rowError?.message || 'Неизвестная ошибка' });
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Ошибка импорта',
    }, { status: 500 });
  }
}
