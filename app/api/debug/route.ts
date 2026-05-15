import { NextResponse } from 'next/server';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.substring(0, 40) + '...'
      : 'NOT SET',
    dbUrlLength: process.env.DATABASE_URL?.length ?? 0,
    prismaVersion: null,
    dbConnection: null,
    productCount: null,
    categoryCount: null,
  };

  // Check if Prisma client can be imported
  try {
    const { prisma } = await import('@/lib/prisma');
    diagnostics.prismaVersion = 'import OK';

    // Test raw connection
    try {
      const result = await prisma.$queryRaw`SELECT 1 as alive`;
      diagnostics.dbConnection = { status: 'OK', result };
    } catch (connErr: any) {
      diagnostics.dbConnection = {
        status: 'FAILED',
        message: connErr?.message,
        code: connErr?.code,
        name: connErr?.name,
      };
    }

    // Test product count
    try {
      diagnostics.productCount = await prisma.product.count();
    } catch (e: any) {
      diagnostics.productCount = { error: e?.message };
    }

    // Test category count
    try {
      diagnostics.categoryCount = await prisma.category.count();
    } catch (e: any) {
      diagnostics.categoryCount = { error: e?.message };
    }
  } catch (importErr: any) {
    diagnostics.prismaVersion = {
      status: 'IMPORT FAILED',
      message: importErr?.message,
      name: importErr?.name,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
