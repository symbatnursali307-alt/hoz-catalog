import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/admin-auth';

export async function GET() {
  const isValid = await verifySession();

  if (!isValid) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json({ authenticated: true });
}
