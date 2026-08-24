import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { isAdminOrdersVisible } from '@/lib/admin-features';
import { getProductQualityIssues } from '@/lib/product-quality';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const isAuthed = await checkAdminAuth();
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ordersVisible = isAdminOrdersVisible();
    const [
      totalProducts,
      activeProducts,
      hiddenProducts,
      totalCategories,
      totalClients,
      totalCartSubmissions,
      recentProducts,
      recentClients,
      recentCartSubmissions,
      qualityProducts,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.category.count(),
      prisma.client.count(),
      ordersVisible ? prisma.cartSubmission.count() : Promise.resolve(0),
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
      ordersVisible ? prisma.cartSubmission.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          publicId: true,
          customerName: true,
          phone: true,
          totalAmount: true,
          createdAt: true,
          manager: { select: { name: true } },
        },
      }) : Promise.resolve([]),
      prisma.product.findMany({ include: { review: true } }),
    ]);

    const quality = qualityProducts.map((product) => ({
      issues: getProductQualityIssues(product),
      manualPending: product.review?.status === 'PENDING',
    }));

    return NextResponse.json({
      totalProducts,
      activeProducts,
      hiddenProducts,
      totalCategories,
      totalClients,
      totalCartSubmissions,
      ordersVisible,
      recentProducts,
      recentClients,
      recentCartSubmissions,
      productsNeedingReview: quality.filter((product) => product.issues.length > 0 || product.manualPending).length,
      productsWithQualityErrors: quality.filter((product) => product.issues.some((issue) => issue.severity === 'error')).length,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
