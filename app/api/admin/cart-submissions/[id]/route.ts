import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { buildOrderUrl } from '@/lib/cart-submission';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const submission = await prisma.cartSubmission.findUnique({
    where: { id },
    include: { manager: true },
  });
  if (!submission) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  return NextResponse.json(
    { ...submission, orderUrl: buildOrderUrl(submission.orderNumber, submission.accessToken) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
