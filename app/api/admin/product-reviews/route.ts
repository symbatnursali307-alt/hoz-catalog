import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { getProductQualityIssues, summarizeProductQuality } from '@/lib/product-quality';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!(await checkAdminAuth(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    include: {
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      review: true,
    },
  });

  const all = products.map((product) => {
    const issues = getProductQualityIssues(product);
    return { ...product, issues, quality: summarizeProductQuality(issues) };
  });
  const items = all
    .filter((product) => product.quality.needsReview || product.review?.status === 'PENDING')
    .sort((left, right) => {
      const manualDifference = Number(right.review?.status === 'PENDING') - Number(left.review?.status === 'PENDING');
      if (manualDifference) return manualDifference;
      if (right.quality.errorCount !== left.quality.errorCount) return right.quality.errorCount - left.quality.errorCount;
      return right.quality.warningCount - left.quality.warningCount;
    });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats: {
      totalProducts: all.length,
      needsReview: items.length,
      withErrors: all.filter((product) => product.quality.errorCount > 0).length,
      warningsOnly: all.filter((product) => product.quality.errorCount === 0 && product.quality.warningCount > 0).length,
      manualPending: all.filter((product) => product.review?.status === 'PENDING').length,
      clean: all.filter((product) => !product.quality.needsReview && product.review?.status !== 'PENDING').length,
    },
    items,
  });
}

export async function POST(request: NextRequest) {
  if (!(await checkAdminAuth(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
  if (!productId) return NextResponse.json({ success: false, error: 'Не выбран товар' }, { status: 400 });
  if (!note) return NextResponse.json({ success: false, error: 'Добавьте комментарий: что именно нужно проверить' }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return NextResponse.json({ success: false, error: 'Товар не найден' }, { status: 404 });

  const review = await prisma.productReview.upsert({
    where: { productId },
    update: { status: 'PENDING', note, resolvedAt: null },
    create: { productId, status: 'PENDING', note },
  });
  return NextResponse.json({ success: true, review }, { status: 201 });
}
