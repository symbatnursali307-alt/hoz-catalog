import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicProductSelect, serializePublicProduct } from '@/lib/public-products';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: publicProductSelect,
  });
  if (!product) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
  return NextResponse.json(serializePublicProduct(product));
}
