import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createSession } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { login, password } = body;

    if (typeof login !== 'string' || typeof password !== 'string' || !login.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'Логин и пароль обязательны' },
        { status: 400 }
      );
    }

    if (!checkCredentials(login, password)) {
      return NextResponse.json(
        { success: false, error: 'Неверный логин или пароль' },
        { status: 401 }
      );
    }

    await createSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
