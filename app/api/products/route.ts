import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publicProductSelect, serializePublicProduct } from '@/lib/public-products';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categorySlug = searchParams.get('category');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
    const search = searchParams.get('search')?.trim() || '';
    const limitParam = Number(searchParams.get('limit'));
    const offsetParam = Number(searchParams.get('offset'));
    const shouldPaginate = ['limit', 'offset', 'search', 'categoryId', 'subcategoryId'].some((key) =>
      searchParams.has(key),
    );
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.round(limitParam), 100) : 24;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.round(offsetParam) : 0;

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { fullDescription: { contains: search, mode: 'insensitive' } },
        { searchKeywords: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { subcategory: { name: { contains: search, mode: 'insensitive' } } },
      ];
    } else if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    } else if (categorySlug?.trim()) {
      where.category = { slug: categorySlug };
    }
    if (!search && subcategoryId && subcategoryId !== 'all') where.subcategoryId = subcategoryId;

    const isDefaultCatalog =
      !search &&
      (!categoryId || categoryId === 'all') &&
      !categorySlug?.trim() &&
      (!subcategoryId || subcategoryId === 'all');

    const orderBy = [
      // The category order is the merchandising priority for the unfiltered catalog.
      // `perchatki` is category #1, so glove products occupy the first catalog pages.
      ...(isDefaultCatalog ? [{ category: { sortOrder: 'asc' as const } }] : []),
      { isFeatured: 'desc' as const },
      { sortOrder: 'asc' as const },
      { name: 'asc' as const },
    ] satisfies Prisma.ProductOrderByWithRelationInput[];

    const query = {
      where,
      orderBy,
      select: publicProductSelect,
    } satisfies Prisma.ProductFindManyArgs;

    if (!shouldPaginate) {
      const products = await prisma.product.findMany(query);
      return NextResponse.json(products.map(serializePublicProduct));
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({ ...query, skip: offset, take: limit }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      items: products.map(serializePublicProduct),
      total,
      limit,
      offset,
      nextOffset: offset + products.length,
      hasMore: offset + products.length < total,
    });
  } catch (error: any) {
    console.error('API ERROR [/api/products]:', error);
    return NextResponse.json(
      process.env.NODE_ENV === 'development'
        ? { error: 'Failed to fetch products', message: error?.message, code: error?.code }
        : { error: 'Failed to fetch products' },
      { status: 500 },
    );
  }
}
