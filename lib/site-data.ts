import { prisma } from '@/lib/prisma';

export type SiteProduct = {
  slug: string;
  name: string;
  image: string;
  price: number;
  unit: string;
  unitsPerPackage: number | null;
  packageType: string | null;
};

export type SiteContact = {
  phone: string | null;
  phoneLabel: string | null;
  whatsappUrl: string;
};

const desiredProductSlugs = ['wa1-0001', 'wa1-0144', 'wa1-0137', 'wa2-0157', 'wa1-0124', 'wa1-0002'];

const fallbackProducts: SiteProduct[] = [
  { slug: 'wa1-0001', name: 'Перчатки хлопчатобумажные', image: '/uploads/products/perchatki/hb-perchatki-40-tg-wa1-0001.webp', price: 52, unit: 'пара', unitsPerPackage: 780, packageType: 'мешок' },
  { slug: 'wa1-0144', name: 'Пакеты-майки с ручками, 400 г', image: '/uploads/products/pakety/majki-s-ruchkami-400gr-430-tg-wa1-0144.webp', price: 559, unit: 'рулон', unitsPerPackage: 60, packageType: 'мешок' },
  { slug: 'wa1-0137', name: 'Мешки 55 × 95 см', image: '/uploads/products/meshki-i-sumki/meshki-5595sm-30-tg-wa1-0137.webp', price: 39, unit: 'шт', unitsPerPackage: 1000, packageType: 'тюк' },
  { slug: 'wa2-0157', name: 'Метла сорго', image: '/uploads/products/inventar/veniki-i-metla-metla-sorgo-1350-tg-wa2-0157.webp', price: 1755, unit: 'шт', unitsPerPackage: 25, packageType: 'пачка' },
  { slug: 'wa1-0124', name: 'Спецодежда', image: '/uploads/products/specodezhda/spec-odezhda-550-tg-wa1-0124.webp', price: 715, unit: 'шт', unitsPerPackage: 50, packageType: 'коробка' },
];

function cleanPhone(value: string | null | undefined) {
  return value?.replace(/\D/g, '') || '';
}

function formatPhone(value: string) {
  const digits = cleanPhone(value);
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }
  return digits ? `+${digits}` : null;
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Marketing data timeout')), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function getSiteData(): Promise<{ products: SiteProduct[]; contact: SiteContact }> {
  try {
    const [manager, products] = await withTimeout(Promise.all([
      prisma.manager.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: { whatsappPhone: true },
      }),
      prisma.product.findMany({
        where: { slug: { in: desiredProductSlugs }, isActive: true },
        select: {
          slug: true,
          name: true,
          imageUrl: true,
          photo: true,
          priceWithVat: true,
          unitName: true,
          unit: true,
          unitsPerPackage: true,
          packageType: true,
        },
      }),
    ]), 2_500);

    const bySlug = new Map(products.map((product) => [product.slug, product]));
    const normalized = desiredProductSlugs.flatMap((slug) => {
      const product = bySlug.get(slug);
      const image = product?.imageUrl || product?.photo;
      const price = Math.ceil(Number(product?.priceWithVat || 0));
      if (!product || !image || !price) return [];
      return [{
        slug: product.slug,
        name: product.name,
        image,
        price,
        unit: product.unitName || product.unit || 'шт',
        unitsPerPackage: product.unitsPerPackage,
        packageType: product.packageType,
      } satisfies SiteProduct];
    });

    const phone = cleanPhone(manager?.whatsappPhone || process.env.WHATSAPP_PHONE);
    return {
      products: normalized.length >= 4 ? normalized.slice(0, 6) : fallbackProducts,
      contact: {
        phone: phone || null,
        phoneLabel: formatPhone(phone),
        whatsappUrl: phone ? `https://wa.me/${phone}` : 'https://catalog.almatytovar.kz/',
      },
    };
  } catch (error) {
    console.error('Marketing site data fallback:', error);
    const phone = cleanPhone(process.env.WHATSAPP_PHONE);
    return {
      products: fallbackProducts,
      contact: {
        phone: phone || null,
        phoneLabel: formatPhone(phone),
        whatsappUrl: phone ? `https://wa.me/${phone}` : 'https://catalog.almatytovar.kz/',
      },
    };
  }
}
