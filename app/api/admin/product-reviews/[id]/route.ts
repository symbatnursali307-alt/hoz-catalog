import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { getProductQualityIssues } from '@/lib/product-quality';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const action = body.action === 'reopen' ? 'reopen' : 'resolve';
  const existing = await prisma.productReview.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'Проверка не найдена' }, { status: 404 });

  const review = await prisma.productReview.update({
    where: { id },
    data: action === 'reopen'
      ? { status: 'PENDING', resolvedAt: null }
      : { status: 'RESOLVED', resolvedAt: new Date() },
  });
  const remainingIssues = getProductQualityIssues(existing.product);

  return NextResponse.json({ success: true, review, remainingIssues });
}
