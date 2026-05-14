import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function checkAdminSecret(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  const envSecret = process.env.ADMIN_SECRET;
  
  if (!envSecret || secret !== envSecret) {
    return false;
  }
  return true;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await request.json();
    
    // Only extract fields that are allowed to be updated
    const updateData: any = {};
    if (data.externalId !== undefined) updateData.externalId = data.externalId;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const product = await prisma.product.update({
      where: { id },
      data: updateData
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
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    // Soft delete
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Failed to hide product:', error);
    return NextResponse.json({ success: false, error: 'Failed to hide product' }, { status: 500 });
  }
}
