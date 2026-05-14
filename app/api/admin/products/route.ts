import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple admin secret check
function checkAdminSecret(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  const envSecret = process.env.ADMIN_SECRET;
  
  if (!envSecret || secret !== envSecret) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await prisma.product.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        category: true
      }
    });
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to fetch admin products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    
    const product = await prisma.product.create({
      data: {
        externalId: data.externalId || null,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description || null,
        unit: data.unit || null,
        price: data.price || null,
        photo: data.photo || null,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 });
  }
}
