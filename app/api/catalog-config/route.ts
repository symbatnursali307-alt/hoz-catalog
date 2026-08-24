import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [settings, managers] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 'default' } }),
    prisma.manager.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, isDefault: true },
    }),
  ]);

  return NextResponse.json(
    {
      companyName: settings?.companyName || 'Каталог хозтоваров',
      catalogTitle: settings?.catalogTitle || 'Каталог хозтоваров',
      catalogDescription: settings?.catalogDescription || null,
      showPrices: settings?.showPrices ?? true,
      cartEnabled: settings?.cartEnabled ?? false,
      contactStepEnabled: process.env.CART_CONTACT_STEP_ENABLED === 'true',
      metaPixelId: process.env.META_PIXEL_ID || null,
      managers,
    },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
