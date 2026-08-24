import slugify from 'slugify';
import { calculatePackagePrice, resolvePriceWithVat } from '@/lib/pricing';

export interface CatalogProductLike {
  id: string;
  externalId?: string | null;
  slug?: string | null;
  name: string;
  unit?: string | null;
  unitName?: string | null;
  priceWithVat?: number | null;
  packageType?: string | null;
  packageQuantity?: number | null;
  unitsPerPackage?: number | null;
  packageUnit?: string | null;
  minOrderPackages?: number | null;
  photo?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  category?: { id: string; name?: string; slug?: string } | null;
}

export function cleanPhone(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

export function getUnitName(product: CatalogProductLike) {
  return product.unitName?.trim() || product.unit?.trim() || '';
}

export function getUnitsPerPackage(product: CatalogProductLike) {
  const value = product.unitsPerPackage ?? product.packageQuantity;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

export function getProductImage(product: CatalogProductLike) {
  return product.imageUrl?.trim() || product.photo?.trim() || '';
}

export function getProductSlug(product: CatalogProductLike) {
  if (product.slug?.trim()) return product.slug.trim();
  const source = product.externalId?.trim() || product.name || product.id;
  return slugify(source, { lower: true, strict: true, locale: 'ru' }) || product.id;
}

export function getMinimumPackages(product: CatalogProductLike) {
  const value = product.minOrderPackages;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

export function getProductValidationErrors(product: CatalogProductLike) {
  const errors: string[] = [];
  if (!product.name?.trim()) errors.push('Нет названия');
  if (!product.categoryId && !product.category?.id) errors.push('Нет категории');
  if (!resolvePriceWithVat(product.priceWithVat)) errors.push('Нет цены с НДС');
  if (!getUnitName(product)) errors.push('Нет единицы измерения');
  if (!product.packageType?.trim()) errors.push('Нет типа упаковки');
  if (!getUnitsPerPackage(product)) errors.push('Нет количества в упаковке');
  return errors;
}

export function isProductOrderable(product: CatalogProductLike) {
  return getProductValidationErrors(product).length === 0;
}

export function getProductPackagePrice(product: CatalogProductLike) {
  return calculatePackagePrice(product.priceWithVat, getUnitsPerPackage(product));
}

export function pluralizePackages(quantity: number, packageType: string) {
  return `${quantity} ${packageType}`;
}
