import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { makeSlug, normalizeProductData, productPublicationErrors, uniqueProductSlug } from '@/lib/product-input';
import { getProductQualityIssues, summarizeProductQuality } from '@/lib/product-quality';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await prisma.product.findMany({
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true, subcategory: true, review: true },
    });
    return NextResponse.json(products.map((product) => {
      const issues = getProductQualityIssues(product);
      return { ...product, quality: summarizeProductQuality(issues) };
    }));
  } catch (error) {
    console.error('Failed to fetch admin products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const baseSlug = makeSlug(body.slug, body.externalId || body.name || 'product');
    const slug = await uniqueProductSlug(baseSlug);
    const data = normalizeProductData(body, slug);
    const validationErrors = productPublicationErrors(data);
    if (data.isActive && validationErrors.length) {
      return NextResponse.json(
        { success: false, error: `Для публикации заполните: ${validationErrors.join(', ')}` },
        { status: 400 },
      );
    }
    const product = await prisma.product.create({ data });
    return NextResponse.json({ success: true, product, validationErrors }, { status: 201 });
  } catch (error: any) {
    const duplicate = error?.code === 'P2002';
    console.error('Failed to create product:', error);
    return NextResponse.json(
      { success: false, error: duplicate ? 'Артикул или Meta ID уже используется' : error?.message || 'Ошибка сохранения' },
      { status: duplicate ? 409 : 400 },
    );
  }
}
