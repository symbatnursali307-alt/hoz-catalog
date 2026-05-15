import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { checkAdminAuth } from '@/lib/admin-auth';
import slugify from 'slugify';

export async function POST(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Файл не найден' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Поддерживаются только PNG, JPG, JPEG, WebP',
      }, { status: 400 });
    }

    // Generate filename
    const originalName = file.name.replace(/\.[^.]+$/, '');
    const ext = file.name.split('.').pop() || 'webp';
    const slugName = slugify(originalName, { lower: true, strict: true, locale: 'ru' });
    const uniqueSuffix = Date.now().toString(36);
    const filename = `products/${slugName}-${uniqueSuffix}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: blob.pathname,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Ошибка загрузки',
    }, { status: 500 });
  }
}
