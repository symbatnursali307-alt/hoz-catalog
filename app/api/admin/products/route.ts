import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await prisma.product.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        category: true,
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to fetch admin products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();

    const product = await prisma.product.create({
      data: {
        externalId: data.externalId || null,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        name: data.name,
        description: data.description || null,
        unit: data.unit || null,
        priceWithoutVat: data.priceWithoutVat ? parseInt(data.priceWithoutVat) : null,
        priceWithVat: data.priceWithVat ? parseFloat(data.priceWithVat) : null,
        price: data.priceWithoutVat ? `${data.priceWithoutVat} тг.` : null,
        packageType: data.packageType || null,
        packageQuantity: data.packageQuantity ? parseInt(data.packageQuantity) : null,
        packageUnit: data.packageUnit || null,
        photo: data.photo || null,
        sortOrder: data.sortOrder ? parseInt(data.sortOrder) : 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 });
  }
}
