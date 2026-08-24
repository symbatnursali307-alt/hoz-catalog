import assert from 'node:assert/strict';
import { getProductQualityIssues } from '../lib/product-quality';

const complete = {
  id: 'complete',
  name: 'Перчатки хлопковые',
  slug: 'perchatki-hlopkovye',
  externalId: 'SKU-1',
  categoryId: 'category-1',
  description: 'Плотные рабочие перчатки',
  shortDescription: 'Плотные рабочие перчатки',
  fullDescription: 'Плотные рабочие перчатки для хозяйственных работ.',
  unitName: 'пара',
  priceWithVat: 52,
  packageType: 'мешок',
  packageQuantity: 780,
  unitsPerPackage: 780,
  packageUnit: 'пар',
  minOrderPackages: 1,
  imageUrl: '/uploads/gloves.webp',
  metaCatalogId: 'perchatki-hlopkovye',
};

assert.deepEqual(getProductQualityIssues(complete), []);

const missing = getProductQualityIssues({ id: 'missing', name: 'Товар', minOrderPackages: 0 });
const missingCodes = new Set(missing.map((item) => item.code));
for (const code of [
  'CATEGORY_MISSING',
  'PRICE_MISSING',
  'UNIT_MISSING',
  'PACKAGE_TYPE_MISSING',
  'PACKAGE_QUANTITY_MISSING',
  'PACKAGE_UNIT_MISSING',
  'MINIMUM_INVALID',
  'IMAGE_MISSING',
  'META_ID_MISSING',
  'DESCRIPTION_MISSING',
]) assert.ok(missingCodes.has(code), `Expected ${code}`);

const legacy = getProductQualityIssues({
  ...complete,
  name: 'ХБ перчатки - 40 тг',
  description: 'Источник: output; WhatsApp product_id: 123; image_sha256: abc',
  shortDescription: 'Источник: output; WhatsApp product_id: 123; image_sha256: abc',
  fullDescription: 'Источник: output; WhatsApp product_id: 123; image_sha256: abc',
});
assert.ok(legacy.some((item) => item.code === 'PRICE_IN_NAME'));
assert.ok(legacy.some((item) => item.code === 'DESCRIPTION_TECHNICAL'));

const conflict = getProductQualityIssues({
  ...complete,
  description: 'В мешке 600 пар',
  shortDescription: 'В мешке 600 пар',
  fullDescription: 'В мешке 600 пар',
});
assert.ok(conflict.some((item) => item.code === 'PACKAGE_SOURCE_CONFLICT'));

console.log('product quality tests: ok');
