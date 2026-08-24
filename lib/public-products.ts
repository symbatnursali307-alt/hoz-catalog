import type { Prisma } from '@prisma/client';
import {
  getProductImage,
  getProductPackagePrice,
  getProductValidationErrors,
  getUnitName,
  getUnitsPerPackage,
} from '@/lib/catalog';
import { resolvePriceWithVat } from '@/lib/pricing';

export const publicProductSelect = {
  id: true,
  externalId: true,
  slug: true,
  name: true,
  description: true,
  shortDescription: true,
  fullDescription: true,
  characteristics: true,
  searchKeywords: true,
  buyerHint: true,
  unit: true,
  unitName: true,
  price: true,
  priceWithoutVat: true,
  priceWithVat: true,
  packageType: true,
  packageQuantity: true,
  unitsPerPackage: true,
  packageUnit: true,
  minOrderPackages: true,
  photo: true,
  imageUrl: true,
  isFeatured: true,
  metaCatalogId: true,
  brand: true,
  googleProductCategory: true,
  fbProductCategory: true,
  categoryId: true,
  category: { select: { id: true, slug: true, name: true } },
  subcategory: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ProductSelect;

export type PublicProductRecord = Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>;

export function serializePublicProduct(product: PublicProductRecord) {
  const validationErrors = getProductValidationErrors(product);
  const unitName = getUnitName(product);
  const unitsPerPackage = getUnitsPerPackage(product);
  const imageUrl = getProductImage(product);

  return {
    ...product,
    priceWithVat: resolvePriceWithVat(product.priceWithVat) || null,
    unit: unitName,
    unitName,
    packageQuantity: unitsPerPackage || null,
    unitsPerPackage: unitsPerPackage || null,
    photo: imageUrl || null,
    imageUrl: imageUrl || null,
    packagePrice: getProductPackagePrice(product) || null,
    orderable: validationErrors.length === 0,
    validationErrors,
  };
}
