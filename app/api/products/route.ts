import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categorySlug = searchParams.get('category');

    const whereClause: any = { isActive: true };
    if (categorySlug && categorySlug.trim() !== '') {
      whereClause.category = {
        slug: categorySlug
      };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        externalId: true,
        name: true,
        description: true,
        unit: true,
        price: true,
        priceWithoutVat: true,
        priceWithVat: true,
        packageType: true,
        packageQuantity: true,
        packageUnit: true,
        photo: true,
        category: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });
    
    return NextResponse.json(products);
  } catch (error: any) {
    console.error('API ERROR [/api/products]:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        hasDbUrl: !!process.env.DATABASE_URL,
        dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
      },
      { status: 500 }
    );
  }
}
