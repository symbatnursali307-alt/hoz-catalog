import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Generate a random token for the session
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Simple hash to store in cookie (not storing raw password)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieSecret() {
  return process.env.ADMIN_SECRET || '';
}

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signValue(value: string): string {
  const secret = cookieSecret();
  if (secret.length < 32) throw new Error('ADMIN_SECRET должен содержать минимум 32 символа');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('hex');
  return `${value}.${signature}`;
}

function verifySignedValue(signed: string): string | null {
  const secret = cookieSecret();
  if (secret.length < 32) return null;
  const lastDot = signed.lastIndexOf('.');
  if (lastDot === -1) return null;

  const value = signed.substring(0, lastDot);
  const signature = signed.substring(lastDot + 1);

  const expected = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('hex');

  if (!equalSecret(signature, expected)) return null;
  return value;
}

export function checkCredentials(login: string, password: string): boolean {
  if (typeof login !== 'string' || typeof password !== 'string') return false;

  const credentials = [
    [process.env.ADMIN_LOGIN, process.env.ADMIN_PASSWORD],
    [process.env.ADMIN_ADDITIONAL_LOGIN, process.env.ADMIN_ADDITIONAL_PASSWORD],
  ];

  return credentials.some(([envLogin, envPassword]) => (
    Boolean(envLogin && envPassword)
    && equalSecret(login.trim(), envLogin!.trim())
    && equalSecret(password, envPassword!)
  ));
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = generateToken();
  const signed = signValue(token);

  cookieStore.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);

  if (!cookie?.value) return false;

  const value = verifySignedValue(cookie.value);
  return value !== null;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// For API routes: check cookie OR x-admin-secret header
export async function checkAdminAuth(request?: NextRequest): Promise<boolean> {
  // Check cookie first
  const isSessionValid = await verifySession();
  if (isSessionValid) return true;

  // Fallback to header-based auth (for scripts/curl)
  if (request) {
    const secret = request.headers.get('x-admin-secret');
    const envSecret = process.env.ADMIN_SECRET;
    if (envSecret && secret && equalSecret(secret, envSecret)) return true;
  }

  return false;
}
