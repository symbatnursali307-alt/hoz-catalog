import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin-auth';

const DEFAULT_ID = 'default';

export async function GET(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let settings = await prisma.appSettings.findUnique({
      where: { id: DEFAULT_ID },
    });

    // Create default if not exists
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          id: DEFAULT_ID,
          whatsappPhone: process.env.WHATSAPP_PHONE || null,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();

    const settings = await prisma.appSettings.upsert({
      where: { id: DEFAULT_ID },
      update: {
        companyName: data.companyName,
        catalogTitle: data.catalogTitle,
        catalogDescription: data.catalogDescription || null,
        whatsappPhone: data.whatsappPhone || null,
        showPrices: data.showPrices ?? true,
        showVatPrices: data.showVatPrices ?? true,
      },
      create: {
        id: DEFAULT_ID,
        companyName: data.companyName,
        catalogTitle: data.catalogTitle,
        catalogDescription: data.catalogDescription || null,
        whatsappPhone: data.whatsappPhone || null,
        showPrices: data.showPrices ?? true,
        showVatPrices: data.showVatPrices ?? true,
      },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}
