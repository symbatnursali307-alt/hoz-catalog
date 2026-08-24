import { randomBytes } from 'node:crypto';
import {
  CatalogProductLike,
  getMinimumPackages,
  getProductImage,
  getProductPackagePrice,
  getProductSlug,
  getUnitName,
  getUnitsPerPackage,
} from '@/lib/catalog';
import { resolvePriceWithVat } from '@/lib/pricing';

export interface SubmissionProduct extends CatalogProductLike {
  metaCatalogId?: string | null;
  brand?: string | null;
  characteristics?: unknown;
  category: { id: string; name: string; slug: string };
}

export interface RequestedCartItem {
  id: string;
  packageQuantity: number;
}

export interface CartItemSnapshot {
  productId: string;
  metaCatalogId: string;
  productSlug: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string;
  brand: string;
  characteristics: unknown;
  priceWithVat: number;
  unitName: string;
  packageType: string;
  unitsPerPackage: number;
  packageUnit: string;
  packageQuantity: number;
  packagePrice: number;
  lineTotal: number;
}

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const ORDER_LIST_LIMIT = 12;

export function createSubmissionPublicId(now = new Date()) {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  return `AT-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function createOrderAccessToken() {
  return randomBytes(32).toString('base64url');
}

export function buildOrderPath(orderNumber: number, accessToken: string) {
  return `/order/${orderNumber}-${accessToken}`;
}

export function buildOrderUrl(
  orderNumber: number,
  accessToken: string,
  baseUrl = process.env.SITE_URL || 'https://catalog.almatytovar.kz',
) {
  return `${baseUrl.replace(/\/$/, '')}${buildOrderPath(orderNumber, accessToken)}`;
}

export function parseOrderAccessKey(value: string) {
  const match = /^(\d{1,12})-([A-Za-z0-9_-]{32,100})$/.exec(value);
  if (!match) return null;
  const orderNumber = Number(match[1]);
  if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) return null;
  return { orderNumber, accessToken: match[2] };
}

export function createCartSnapshots(
  products: SubmissionProduct[],
  requestedItems: RequestedCartItem[],
) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  return requestedItems.map((requested): CartItemSnapshot => {
    const product = productsById.get(requested.id);
    if (!product) throw new Error(`Товар ${requested.id} не найден или скрыт`);

    const priceWithVat = resolvePriceWithVat(product.priceWithVat);
    const unitsPerPackage = getUnitsPerPackage(product);
    const packagePrice = getProductPackagePrice(product);
    const minimum = getMinimumPackages(product);
    if (requested.packageQuantity < minimum) {
      throw new Error(`Минимальный заказ для «${product.name}»: ${minimum} уп.`);
    }

    return {
      productId: product.id,
      metaCatalogId: product.metaCatalogId || product.slug || product.externalId || product.id,
      productSlug: getProductSlug(product),
      sku: product.externalId?.trim() || product.metaCatalogId?.trim() || '',
      name: product.name,
      categoryId: product.category.id,
      categoryName: product.category.name,
      imageUrl: getProductImage(product),
      brand: product.brand?.trim() || '',
      characteristics: product.characteristics ?? null,
      priceWithVat,
      unitName: getUnitName(product),
      packageType: product.packageType || '',
      unitsPerPackage,
      packageUnit: product.packageUnit || getUnitName(product),
      packageQuantity: requested.packageQuantity,
      packagePrice,
      lineTotal: packagePrice * requested.packageQuantity,
    };
  });
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function parseCartSnapshots(value: unknown): CartItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      productId: textValue(source.productId),
      metaCatalogId: textValue(source.metaCatalogId),
      productSlug: textValue(source.productSlug),
      sku: textValue(source.sku),
      name: textValue(source.name),
      categoryId: textValue(source.categoryId),
      categoryName: textValue(source.categoryName),
      imageUrl: textValue(source.imageUrl),
      brand: textValue(source.brand),
      characteristics: source.characteristics ?? null,
      priceWithVat: numberValue(source.priceWithVat),
      unitName: textValue(source.unitName),
      packageType: textValue(source.packageType),
      unitsPerPackage: numberValue(source.unitsPerPackage),
      packageUnit: textValue(source.packageUnit),
      packageQuantity: numberValue(source.packageQuantity),
      packagePrice: numberValue(source.packagePrice),
      lineTotal: numberValue(source.lineTotal),
    };
  }).filter((item) => item.productId && item.name);
}

export function buildWhatsappText(
  orderNumber: number,
  orderUrl: string,
  items: CartItemSnapshot[],
  total: number,
) {
  const packageCount = items.reduce((sum, item) => sum + item.packageQuantity, 0);
  const lines = [
    `Здравствуйте! Заказ №${orderNumber}.`,
    `${items.length} позиций, ${packageCount} упаковок на сумму ${money.format(total)} ₸.`,
    '',
  ];

  items.slice(0, ORDER_LIST_LIMIT).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name} — ${item.packageQuantity} уп.`);
  });
  if (items.length > ORDER_LIST_LIMIT) lines.push(`…и ещё ${items.length - ORDER_LIST_LIMIT} поз.`);

  lines.push('');
  lines.push('Товары с фотографиями:');
  lines.push(orderUrl);
  lines.push('');
  lines.push(`Итого: ${money.format(total)} ₸ с НДС.`);
  lines.push('Все цены указаны с НДС.');
  return lines.join('\n');
}
