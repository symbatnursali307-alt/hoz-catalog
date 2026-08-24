import { prisma } from '@/lib/prisma';
import { cleanPhone } from '@/lib/catalog';

export async function resolveManager(input?: { id?: string | null; slug?: string | null }) {
  const requestedId = input?.id?.trim();
  const requestedSlug = input?.slug?.trim().toLowerCase();

  if (requestedId || requestedSlug) {
    const requested = await prisma.manager.findFirst({
      where: {
        isActive: true,
        OR: [
          ...(requestedId ? [{ id: requestedId }] : []),
          ...(requestedSlug ? [{ slug: requestedSlug }] : []),
        ],
      },
    });
    if (requested) return requested;
  }

  return prisma.manager.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export function normalizeManagerInput(data: Record<string, unknown>) {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const slug = typeof data.slug === 'string' ? data.slug.trim().toLowerCase() : '';
  const whatsappPhone = cleanPhone(data.whatsappPhone);

  if (!name) throw new Error('Укажите имя менеджера');
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(slug)) {
    throw new Error('Slug: латиница, цифры и дефис, до 50 символов');
  }
  if (whatsappPhone.length < 7 || whatsappPhone.length > 15) {
    throw new Error('Некорректный WhatsApp-номер');
  }

  return {
    name,
    slug,
    whatsappPhone,
    isActive: data.isActive !== false,
    isDefault: data.isDefault === true,
  };
}
