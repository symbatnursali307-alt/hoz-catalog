import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { normalizeManagerInput } from '@/lib/managers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const managers = await prisma.manager.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { cartSubmissions: true, analyticsEvents: true } } },
  });
  return NextResponse.json(managers);
}

export async function POST(request: NextRequest) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const normalized = normalizeManagerInput(await request.json());
    const count = await prisma.manager.count();
    const isDefault = normalized.isDefault || count === 0;
    const manager = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.manager.updateMany({ data: { isDefault: false } });
      return tx.manager.create({ data: { ...normalized, isDefault } });
    });
    return NextResponse.json({ success: true, manager }, { status: 201 });
  } catch (error: any) {
    const duplicate = error?.code === 'P2002';
    return NextResponse.json(
      { success: false, error: duplicate ? 'Такой slug уже используется' : error?.message || 'Ошибка сохранения' },
      { status: duplicate ? 409 : 400 },
    );
  }
}
