import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const isAuthed = await checkAdminAuth();
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      totalProducts,
      activeProducts,
      hiddenProducts,
      totalCategories,
      totalClients,
      recentProducts,
      recentClients,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.category.count(),
      prisma.client.count(),
      prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, photo: true, createdAt: true, isActive: true },
      }),
      prisma.client.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          city: true,
          phone: true,
          createdAt: true,
          _count: { select: { selectedProducts: true } },
        },
      }),
    ]);

    return NextResponse.json({
      totalProducts,
      activeProducts,
      hiddenProducts,
      totalCategories,
      totalClients,
      recentProducts,
      recentClients,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
