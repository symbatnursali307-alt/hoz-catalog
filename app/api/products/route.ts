import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categorySlug = searchParams.get('category');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
    const search = searchParams.get('search')?.trim() || '';
    const limitParam = Number(searchParams.get('limit'));
    const offsetParam = Number(searchParams.get('offset'));
    const shouldPaginate =
      searchParams.has('limit') ||
      searchParams.has('offset') ||
      searchParams.has('search') ||
      searchParams.has('categoryId') ||
      searchParams.has('subcategoryId');
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.round(limitParam), 100) : 24;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.round(offsetParam) : 0;

    const whereClause: any = { isActive: true };
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { subcategory: { name: { contains: search, mode: 'insensitive' } } },
      ];
    } else if (categoryId && categoryId !== 'all') {
      whereClause.categoryId = categoryId;
    } else if (categorySlug && categorySlug.trim() !== '') {
      whereClause.category = {
        slug: categorySlug
      };
    }
    if (!search && subcategoryId && subcategoryId !== 'all') {
      whereClause.subcategoryId = subcategoryId;
    }

    const productQuery = {
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
        },
        subcategory: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    } as const;

    if (!shouldPaginate) {
      const products = await prisma.product.findMany(productQuery);
      return NextResponse.json(products);
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        ...productQuery,
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where: whereClause }),
    ]);
    
    return NextResponse.json({
      items: products,
      total,
      limit,
      offset,
      nextOffset: offset + products.length,
      hasMore: offset + products.length < total,
    });
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
