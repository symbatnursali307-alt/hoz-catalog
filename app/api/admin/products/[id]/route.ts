import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { isProductOrderable } from '@/lib/catalog';
import { makeSlug, normalizeProductData, productPublicationErrors, uniqueProductSlug } from '@/lib/product-input';
import { getProductQualityIssues } from '@/lib/product-quality';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, subcategory: true, review: true },
  });
  if (!product) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
  return NextResponse.json({ ...product, qualityIssues: getProductQualityIssues(product) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });

    const body = await request.json();
    const baseSlug = makeSlug(body.slug, body.externalId || body.name || existing.slug);
    const slug = await uniqueProductSlug(baseSlug, id);
    const data = normalizeProductData(body, slug);
    const validationErrors = productPublicationErrors(data);
    if (!existing.isActive && data.isActive && validationErrors.length) {
      return NextResponse.json(
        { success: false, error: `Для публикации заполните: ${validationErrors.join(', ')}` },
        { status: 400 },
      );
    }

    const product = await prisma.product.update({ where: { id }, data });
    const qualityIssues = getProductQualityIssues(product);
    if (!qualityIssues.length) {
      await prisma.productReview.updateMany({
        where: { productId: id, status: 'PENDING' },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
    }
    return NextResponse.json({ success: true, product, validationErrors, qualityIssues });
  } catch (error: any) {
    const duplicate = error?.code === 'P2002';
    console.error('Failed to update product:', error);
    return NextResponse.json(
      { success: false, error: duplicate ? 'Артикул, slug или Meta ID уже используется' : error?.message || 'Ошибка сохранения' },
      { status: duplicate ? 409 : 400 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });

  if (body.isActive === true && !isProductOrderable(existing)) {
    return NextResponse.json(
      { success: false, error: 'Нельзя включить товар без цены с НДС, единицы и полной фасовки' },
      { status: 409 },
    );
  }

  const data: { isActive?: boolean; isFeatured?: boolean; sortOrder?: number } = {};
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (typeof body.isFeatured === 'boolean') data.isFeatured = body.isFeatured;
  if (Number.isFinite(Number(body.sortOrder))) data.sortOrder = Math.round(Number(body.sortOrder));
  if (!Object.keys(data).length) return NextResponse.json({ error: 'Нет допустимых полей' }, { status: 400 });

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ success: true, product });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const product = await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true, product });
}
