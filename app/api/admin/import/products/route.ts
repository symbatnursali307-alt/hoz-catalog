import { NextRequest, NextResponse } from 'next/server';

function checkAdminSecret(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  const envSecret = process.env.ADMIN_SECRET;
  
  if (!envSecret || secret !== envSecret) {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // В будущем здесь будет логика парсинга multipart/form-data и чтения Excel-файла
    // На данный момент это заглушка, возвращающая структуру ответа из ТЗ.
    
    // const formData = await request.formData();
    // const file = formData.get('file');

    return NextResponse.json({
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      warnings: [
        {
          row: 0,
          message: "Импорт пока не реализован, это заглушка API"
        }
      ],
      errors: []
    });

  } catch (error) {
    console.error('Failed to import products:', error);
    return NextResponse.json({ success: false, error: 'Failed to process import' }, { status: 500 });
  }
}
