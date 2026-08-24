import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { cleanPhone } from '@/lib/catalog';
import { META_EVENT_NAMES, sendMetaEvent, sha256 } from '@/lib/meta-capi';
import { prisma } from '@/lib/prisma';

const ALLOWED_EVENTS = new Set([
  'catalog_opened',
  'category_viewed',
  'product_viewed',
  'add_to_cart',
  'remove_from_cart',
  'cart_opened',
  'order_created',
  'phone_entered',
  'whatsapp_clicked',
  'pwa_install_prompt_shown',
  'pwa_install_clicked',
  'pwa_install_dismissed',
  'pwa_install_remind_later',
]);
const BOT_PATTERN = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp/i;

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function optionalText(value: unknown, maxLength = 255) {
  return text(value, maxLength) || null;
}

function getClientIp(request: NextRequest) {
  return (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '').trim();
}

function safeMetadata(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!value || typeof value !== 'object') return Prisma.JsonNull;
  const serialized = JSON.stringify(value);
  if (serialized.length > 10_000) return { truncated: true };
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  try {
    const referer = request.headers.get('referer') || '';
    const userAgent = request.headers.get('user-agent') || '';
    if (request.cookies.has('admin_session') || /\/admin(?:\/|$)/.test(referer) || BOT_PATTERN.test(userAgent)) {
      return NextResponse.json({ success: true, skipped: true }, { status: 202 });
    }

    const clientIp = getClientIp(request);
    const excludedIps = (process.env.ANALYTICS_EXCLUDED_IPS || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (clientIp && excludedIps.includes(clientIp)) {
      return NextResponse.json({ success: true, skipped: true }, { status: 202 });
    }

    const body = await request.json();
    const eventName = text(body.eventName, 50);
    const eventId = text(body.eventId, 200);
    const visitorId = text(body.visitorId, 100);
    const sessionId = text(body.sessionId, 100);
    if (!ALLOWED_EVENTS.has(eventName) || !eventId || !visitorId || !sessionId) {
      return NextResponse.json({ success: false, error: 'Некорректное событие аналитики' }, { status: 400 });
    }

    const managerId = optionalText(body.managerId, 100);
    const productId = optionalText(body.productId, 100);
    const categoryId = optionalText(body.categoryId, 100);
    const [managerExists, productExists, categoryExists] = await Promise.all([
      managerId ? prisma.manager.count({ where: { id: managerId, isActive: true } }) : 0,
      productId ? prisma.product.count({ where: { id: productId } }) : 0,
      categoryId ? prisma.category.count({ where: { id: categoryId } }) : 0,
    ]);

    const phone = cleanPhone(body.phone);
    const contentIds = Array.isArray(body.contentIds)
      ? body.contentIds.map((item: unknown) => text(item, 200)).filter(Boolean).slice(0, 100)
      : [];
    const cartTotal = Number(body.cartTotal);
    const itemsCount = Number(body.itemsCount);
    const isTest = body.isTest === true;
    const ipHash = clientIp
      ? createHash('sha256').update(`${process.env.ANALYTICS_SALT || process.env.ADMIN_SECRET || ''}:${clientIp}`).digest('hex')
      : null;

    let event;
    try {
      event = await prisma.analyticsEvent.create({
        data: {
          eventId,
          eventName,
          visitorId,
          sessionId,
          managerId: managerExists ? managerId : null,
          productId: productExists ? productId : null,
          categoryId: categoryExists ? categoryId : null,
          phoneHash: phone ? sha256(phone) : null,
          cartTotal: Number.isFinite(cartTotal) && cartTotal >= 0 ? cartTotal : null,
          itemsCount: Number.isInteger(itemsCount) && itemsCount >= 0 ? itemsCount : null,
          utmSource: optionalText(body.utm?.source),
          utmMedium: optionalText(body.utm?.medium),
          utmCampaign: optionalText(body.utm?.campaign),
          utmContent: optionalText(body.utm?.content),
          metadata: safeMetadata({
            ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
            ...(contentIds.length ? { contentIds } : {}),
          }),
          isTest,
          ipHash,
          userAgent: userAgent.slice(0, 2_000) || null,
          fbp: optionalText(body.fbp, 255),
          fbc: optionalText(body.fbc, 255),
          metaEventName: META_EVENT_NAMES[eventName] || null,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json({ success: true, duplicate: true, eventId });
      }
      throw error;
    }

    if (META_EVENT_NAMES[eventName]) {
      try {
        const result = await sendMetaEvent({
          eventName,
          eventId,
          eventSourceUrl: text(body.eventSourceUrl, 2_000) || referer || 'https://catalog.almatytovar.kz/',
          visitorId,
          phone: phone || undefined,
          clientIp: clientIp || undefined,
          userAgent: userAgent || undefined,
          fbp: optionalText(body.fbp, 255) || undefined,
          fbc: optionalText(body.fbc, 255) || undefined,
          value: Number.isFinite(cartTotal) ? cartTotal : undefined,
          contentIds,
          isTest,
        });
        if (!result.skipped) {
          await prisma.analyticsEvent.update({ where: { id: event.id }, data: { metaSentAt: new Date(), metaError: null } });
        }
      } catch (metaError: any) {
        console.error('Meta CAPI error:', metaError);
        await prisma.analyticsEvent.update({
          where: { id: event.id },
          data: { metaError: String(metaError?.message || metaError).slice(0, 2_000) },
        });
      }
    }

    return NextResponse.json({ success: true, eventId }, { status: 201 });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, error: 'Не удалось записать событие' }, { status: 500 });
  }
}
