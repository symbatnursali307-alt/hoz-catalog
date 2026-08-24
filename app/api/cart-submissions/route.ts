import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { cleanPhone, isProductOrderable } from '@/lib/catalog';
import {
  buildOrderUrl,
  buildWhatsappText,
  createCartSnapshots,
  createOrderAccessToken,
  createSubmissionPublicId,
  type RequestedCartItem,
  type SubmissionProduct,
} from '@/lib/cart-submission';
import { resolveManager } from '@/lib/managers';
import { prisma } from '@/lib/prisma';

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanOptional(value: unknown, maxLength = 255) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function validIdempotencyKey(value: unknown) {
  const key = cleanText(value, 100);
  if (!key) return null;
  return /^[A-Za-z0-9_-]{16,100}$/.test(key) ? key : false;
}

function responseForSubmission(submission: any, created: boolean) {
  const orderUrl = buildOrderUrl(submission.orderNumber, submission.accessToken);
  const managerPhone = submission.managerPhoneSnapshot || submission.manager?.whatsappPhone || '';
  return NextResponse.json(
    {
      success: true,
      created,
      submissionId: submission.id,
      publicId: submission.publicId,
      orderNumber: submission.orderNumber,
      orderUrl,
      totalAmount: submission.totalAmount,
      manager: {
        id: submission.manager?.id || submission.managerId || null,
        name: submission.manager?.name || submission.managerNameSnapshot || 'Менеджер',
        slug: submission.manager?.slug || null,
      },
      whatsappUrl: `https://wa.me/${managerPhone}?text=${encodeURIComponent(submission.whatsappText)}`,
    },
    { status: created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const visitorId = cleanText(body.visitorId, 100);
    const sessionId = cleanText(body.sessionId, 100);
    if (!visitorId || !sessionId) {
      return NextResponse.json({ success: false, error: 'Не удалось определить сессию каталога' }, { status: 400 });
    }

    const checkedIdempotencyKey = validIdempotencyKey(body.idempotencyKey);
    if (checkedIdempotencyKey === false) {
      return NextResponse.json({ success: false, error: 'Некорректный идентификатор оформления' }, { status: 400 });
    }
    const idempotencyKey = checkedIdempotencyKey || null;
    if (idempotencyKey) {
      const existing = await prisma.cartSubmission.findUnique({
        where: { idempotencyKey },
        include: { manager: true },
      });
      if (existing) {
        if (existing.visitorId !== visitorId || existing.sessionId !== sessionId) {
          return NextResponse.json({ success: false, error: 'Конфликт идентификатора оформления' }, { status: 409 });
        }
        return responseForSubmission(existing, false);
      }
    }

    const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.cartEnabled) {
      return NextResponse.json(
        { success: false, error: 'Корзина временно недоступна до заполнения фасовок товаров' },
        { status: 503 },
      );
    }

    const suppliedPhone = cleanPhone(body.phone);
    const hasValidPhone = suppliedPhone.length >= 7 && suppliedPhone.length <= 15;
    const contactStepEnabled = process.env.CART_CONTACT_STEP_ENABLED === 'true';
    if ((contactStepEnabled && !hasValidPhone) || (suppliedPhone && !hasValidPhone)) {
      return NextResponse.json({ success: false, error: 'Введите корректный номер телефона' }, { status: 400 });
    }
    const phone = hasValidPhone ? suppliedPhone : '';

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
      return NextResponse.json({ success: false, error: 'Корзина пуста или содержит слишком много позиций' }, { status: 400 });
    }

    const requestedItems: RequestedCartItem[] = body.items.map((item: any) => ({
      id: cleanText(item?.id, 100),
      packageQuantity: Number(item?.packageQuantity),
    }));
    if (requestedItems.some((item) => !item.id || !Number.isInteger(item.packageQuantity) || item.packageQuantity < 1 || item.packageQuantity > 10000)) {
      return NextResponse.json({ success: false, error: 'Некорректное количество упаковок' }, { status: 400 });
    }
    if (new Set(requestedItems.map((item) => item.id)).size !== requestedItems.length) {
      return NextResponse.json({ success: false, error: 'Корзина содержит повторяющиеся товары' }, { status: 400 });
    }

    const manager = await resolveManager({ id: body.managerId, slug: body.managerSlug });
    if (!manager) {
      return NextResponse.json({ success: false, error: 'Менеджер WhatsApp ещё не настроен' }, { status: 503 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: requestedItems.map((item) => item.id) }, isActive: true },
      include: { category: true },
    });
    if (products.length !== requestedItems.length) {
      return NextResponse.json({ success: false, error: 'Один из товаров скрыт или не найден' }, { status: 409 });
    }

    const incomplete = products.find((product) => !isProductOrderable(product));
    if (incomplete) {
      return NextResponse.json(
        { success: false, error: `Для товара «${incomplete.name}» не заполнена фасовка или цена с НДС` },
        { status: 409 },
      );
    }

    let snapshots;
    try {
      snapshots = createCartSnapshots(products as SubmissionProduct[], requestedItems);
    } catch (validationError) {
      return NextResponse.json(
        { success: false, error: validationError instanceof Error ? validationError.message : 'Некорректная корзина' },
        { status: 409 },
      );
    }
    const totalAmount = snapshots.reduce((sum, item) => sum + item.lineTotal, 0);
    const publicId = createSubmissionPublicId();
    const accessToken = createOrderAccessToken();
    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};

    try {
      const submission = await prisma.$transaction(async (tx) => {
        const draft = await tx.cartSubmission.create({
          data: {
            publicId,
            accessToken,
            idempotencyKey,
            visitorId,
            sessionId,
            managerId: manager.id,
            managerNameSnapshot: manager.name,
            managerPhoneSnapshot: manager.whatsappPhone,
            phone,
            customerName: cleanOptional(body.customerName, 120),
            items: snapshots as unknown as Prisma.InputJsonValue,
            itemCount: snapshots.length,
            totalAmount,
            whatsappText: '',
            source: cleanOptional(utm.source),
            utmSource: cleanOptional(utm.source),
            utmMedium: cleanOptional(utm.medium),
            utmCampaign: cleanOptional(utm.campaign),
            utmContent: cleanOptional(utm.content),
            utmTerm: cleanOptional(utm.term),
          },
        });
        const orderUrl = buildOrderUrl(draft.orderNumber, accessToken);
        const whatsappText = buildWhatsappText(draft.orderNumber, orderUrl, snapshots, totalAmount);
        return tx.cartSubmission.update({
          where: { id: draft.id },
          data: { whatsappText },
          include: { manager: true },
        });
      });
      return responseForSubmission(submission, true);
    } catch (createError: any) {
      if (createError?.code === 'P2002' && idempotencyKey) {
        const existing = await prisma.cartSubmission.findUnique({
          where: { idempotencyKey },
          include: { manager: true },
        });
        if (existing && existing.visitorId === visitorId && existing.sessionId === sessionId) {
          return responseForSubmission(existing, false);
        }
      }
      throw createError;
    }
  } catch (error: any) {
    console.error('Cart submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить заявку' },
      { status: 500 },
    );
  }
}
