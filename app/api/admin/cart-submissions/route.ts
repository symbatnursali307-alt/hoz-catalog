import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { checkAdminAuth } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const take = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 200);
  const managerId = params.get('managerId') || undefined;
  const query = (params.get('q') || '').trim().slice(0, 100);
  const from = params.get('from') ? new Date(params.get('from') as string) : undefined;
  const to = params.get('to') ? new Date(params.get('to') as string) : undefined;
  const normalizedNumber = Number(query.replace(/[^0-9]/g, ''));
  const where: Prisma.CartSubmissionWhereInput = {
    ...(managerId ? { managerId } : {}),
    ...(from || to
      ? { createdAt: { ...(from && !Number.isNaN(from.valueOf()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.valueOf()) ? { lte: to } : {}) } }
      : {}),
    ...(query
      ? {
          OR: [
            ...(Number.isSafeInteger(normalizedNumber) && normalizedNumber > 0 && normalizedNumber <= 2_147_483_647
              ? [{ orderNumber: normalizedNumber }]
              : []),
            { publicId: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { customerName: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.cartSubmission.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        publicId: true,
        phone: true,
        customerName: true,
        itemCount: true,
        totalAmount: true,
        managerNameSnapshot: true,
        utmSource: true,
        utmCampaign: true,
        createdAt: true,
        manager: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.cartSubmission.count({ where }),
  ]);

  return NextResponse.json({ items, total });
}
