import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { normalizeManagerInput } from '@/lib/managers';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.manager.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Менеджер не найден' }, { status: 404 });
    const normalized = normalizeManagerInput(await request.json());
    if (existing.isDefault && !normalized.isActive) {
      return NextResponse.json({ success: false, error: 'Сначала назначьте другого менеджера основным' }, { status: 409 });
    }
    if (existing.isDefault) normalized.isDefault = true;
    const manager = await prisma.$transaction(async (tx) => {
      if (normalized.isDefault) await tx.manager.updateMany({ data: { isDefault: false } });
      return tx.manager.update({ where: { id }, data: normalized });
    });
    return NextResponse.json({ success: true, manager });
  } catch (error: any) {
    const duplicate = error?.code === 'P2002';
    return NextResponse.json(
      { success: false, error: duplicate ? 'Такой slug уже используется' : error?.message || 'Ошибка сохранения' },
      { status: duplicate ? 409 : 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const manager = await prisma.manager.findUnique({ where: { id } });
  if (!manager) return NextResponse.json({ error: 'Менеджер не найден' }, { status: 404 });
  if (manager.isDefault) {
    return NextResponse.json({ error: 'Сначала назначьте другого менеджера основным' }, { status: 409 });
  }
  await prisma.manager.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
