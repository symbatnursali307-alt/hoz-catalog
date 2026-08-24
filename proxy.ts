import { NextRequest, NextResponse } from 'next/server';
import { isAdminOrdersVisible } from '@/lib/admin-features';

const MAIN_HOSTS = new Set(['almatytovar.kz', 'www.almatytovar.kz']);
const CATALOG_HOST = 'catalog.almatytovar.kz';
const ADMIN_HOST = 'admin.almatytovar.kz';
const MARKETING_PATHS = ['/categories', '/optom', '/delivery', '/contacts', '/about', '/for-ai', '/llms.txt', '/company.json'];
const ORDER_PATH = '/order/';
const ADMIN_ORDERS_PATH = '/admin/cart-submissions';
const ADMIN_ORDERS_API_PATH = '/api/admin/cart-submissions';

function hostname(request: NextRequest) {
  return (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(':')[0].toLowerCase();
}

function isMarketingPath(pathname: string) {
  return MARKETING_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function withNoIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

function withPrivateOrderHeaders(response: NextResponse) {
  withNoIndex(response);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export function proxy(request: NextRequest) {
  const host = hostname(request);
  const { pathname, search } = request.nextUrl;

  if (!isAdminOrdersVisible()) {
    if (pathname === ADMIN_ORDERS_API_PATH || pathname.startsWith(`${ADMIN_ORDERS_API_PATH}/`)) {
      return withNoIndex(new NextResponse(null, { status: 404 }));
    }
    if (pathname === ADMIN_ORDERS_PATH || pathname.startsWith(`${ADMIN_ORDERS_PATH}/`)) {
      const adminOrigin = host === ADMIN_HOST ? 'https://admin.almatytovar.kz' : 'https://catalog.almatytovar.kz';
      return withNoIndex(NextResponse.redirect(new URL('/admin', adminOrigin), 307));
    }
  }

  if (host === 'www.almatytovar.kz') {
    return NextResponse.redirect(new URL(`${pathname}${search}`, 'https://almatytovar.kz'), 308);
  }

  if (host === ADMIN_HOST) {
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      // Nginx forwards the public HTTPS scheme, while the Next.js upstream is HTTP.
      // Keeping https here turns an internal rewrite into a failed TLS request to localhost.
      url.protocol = 'http:';
      return withNoIndex(NextResponse.rewrite(url));
    }
    return withNoIndex(NextResponse.next());
  }

  if (host === CATALOG_HOST) {
    if (isMarketingPath(pathname) || pathname === '/site') {
      const targetPath = pathname === '/site' ? '/' : pathname;
      return NextResponse.redirect(new URL(`${targetPath}${search}`, 'https://almatytovar.kz'), 308);
    }
    const response = NextResponse.next();
    if (pathname.startsWith(ORDER_PATH)) return withPrivateOrderHeaders(response);
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin') || pathname.startsWith('/m/') || request.nextUrl.searchParams.has('manager')) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }
    return response;
  }

  if (MAIN_HOSTS.has(host)) {
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/site';
      url.protocol = 'http:';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/catalog' || pathname.startsWith('/m/') || pathname.startsWith(ORDER_PATH)) {
      const target = pathname === '/catalog' ? '/' : `${pathname}${search}`;
      return pathname.startsWith(ORDER_PATH)
        ? withPrivateOrderHeaders(NextResponse.redirect(new URL(target, 'https://catalog.almatytovar.kz'), 308))
        : NextResponse.redirect(new URL(target, 'https://catalog.almatytovar.kz'), 308);
    }
    if (pathname.startsWith('/admin')) {
      return withNoIndex(NextResponse.redirect(new URL(`${pathname}${search}`, 'https://catalog.almatytovar.kz'), 308));
    }
  }

  const response = NextResponse.next();
  if (pathname.startsWith(ORDER_PATH)) return withPrivateOrderHeaders(response);
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) return withNoIndex(response);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pwa-icon-|company-logo-original.jpg).*)'],
};
