import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        sortOrder: true
      }
    });
    
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('API ERROR [/api/categories]:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch categories',
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
