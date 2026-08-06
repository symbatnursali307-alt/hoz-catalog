import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin-auth';
import { calculatePriceWithVat } from '@/lib/pricing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await request.json();
    const priceWithoutVat = data.priceWithoutVat ? parseInt(data.priceWithoutVat) : null;
    const priceWithVat = data.priceWithVat ? parseFloat(data.priceWithVat) : calculatePriceWithVat(priceWithoutVat);

    const product = await prisma.product.update({
      where: { id },
      data: {
        externalId: data.externalId || null,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        name: data.name,
        description: data.description || null,
        unit: data.unit || null,
        priceWithoutVat,
        priceWithVat,
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
    console.error('Failed to update product:', error);
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await request.json();

    const updateData: any = {};
    if (data.externalId !== undefined) updateData.externalId = data.externalId;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.priceWithoutVat !== undefined) {
      updateData.priceWithoutVat = data.priceWithoutVat ? parseInt(data.priceWithoutVat) : null;
      if (data.priceWithVat === undefined) {
        updateData.priceWithVat = calculatePriceWithVat(updateData.priceWithoutVat);
      }
    }
    if (data.priceWithVat !== undefined) {
      updateData.priceWithVat = data.priceWithVat
        ? parseFloat(data.priceWithVat)
        : calculatePriceWithVat(updateData.priceWithoutVat);
    }
    if (data.price !== undefined) updateData.price = data.price;
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.packageType !== undefined) updateData.packageType = data.packageType;
    if (data.packageQuantity !== undefined) updateData.packageQuantity = data.packageQuantity ? parseInt(data.packageQuantity) : null;
    if (data.packageUnit !== undefined) updateData.packageUnit = data.packageUnit;
    if (data.sortOrder !== undefined) updateData.sortOrder = parseInt(data.sortOrder);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Failed to update product:', error);
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    // Soft delete
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Failed to hide product:', error);
    return NextResponse.json({ success: false, error: 'Failed to hide product' }, { status: 500 });
  }
}
