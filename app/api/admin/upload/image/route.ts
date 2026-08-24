import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { checkAdminAuth } from '@/lib/admin-auth';
import slugify from 'slugify';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

export async function POST(request: NextRequest) {
  const isAuthed = await checkAdminAuth(request);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Файл не найден' },
        { status: 400 },
      );
    }

    const extension = EXTENSIONS[file.type];
    if (!extension) {
      return NextResponse.json(
        { success: false, error: 'Поддерживаются только PNG, JPG, JPEG и WebP' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Файл больше 20 МБ' },
        { status: 413 },
      );
    }

    const originalName = file.name.replace(/\.[^.]+$/, '');
    const slugName =
      slugify(originalName, { lower: true, strict: true, locale: 'ru' }) || 'image';
    const basename = `${slugName}-${Date.now().toString(36)}.${extension}`;
    const relativePath = `products/${basename}`;

    const uploadRoot = process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(process.cwd(), 'public', 'uploads');
    const productsDirectory = path.join(uploadRoot, 'products');
    await mkdir(productsDirectory, { recursive: true });
    await writeFile(
      path.join(productsDirectory, basename),
      Buffer.from(await file.arrayBuffer()),
      { flag: 'wx' },
    );

    return NextResponse.json({
      success: true,
      url: `/uploads/${relativePath}`,
      filename: relativePath,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Ошибка загрузки',
      },
      { status: 500 },
    );
  }
}
