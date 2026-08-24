import assert from 'node:assert/strict';
import { extractPackage } from '../lib/package-extraction';

function product(description: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'test',
    name: 'Тестовый товар',
    description,
    unitName: 'пара',
    ...overrides,
  };
}

const bag = extractPackage(product('В мешке 780пар', { packageType: 'мешок' }));
assert.equal(bag.status, 'ready');
assert.deepEqual(bag.candidate && {
  packageType: bag.candidate.packageType,
  unitsPerPackage: bag.candidate.unitsPerPackage,
  unitName: bag.candidate.unitName,
  packageUnit: bag.candidate.packageUnit,
}, { packageType: 'мешок', unitsPerPackage: 780, unitName: 'пара', packageUnit: 'пар' });

const pack = extractPackage(product('В пачке 50шт', { unitName: 'шт', packageType: 'пачка' }));
assert.equal(pack.status, 'ready');
assert.equal(pack.candidate?.unitsPerPackage, 50);

const reverse = extractPackage(product('', {
  name: 'Коврик 30 шт в пачке',
  unitName: 'шт',
  packageType: 'пачка',
}));
assert.equal(reverse.status, 'ready');
assert.equal(reverse.candidate?.unitsPerPackage, 30);

const box = extractPackage(product('📦120пар', { packageType: 'коробка' }));
assert.equal(box.status, 'ready');
assert.equal(box.candidate?.packageType, 'коробка');

const priceOnly = extractPackage(product('В мешке 480тг', { packageType: 'мешок' }));
assert.equal(priceOnly.status, 'no-match');

const metadata = extractPackage(product(
  'Источник: output; WhatsApp product_id: 27401258739480923; image_sha256: abc123',
));
assert.equal(metadata.status, 'no-match');

const ambiguous = extractPackage(product('Ф125 📦480шт; Ф230 📦100шт', {
  unitName: 'шт',
  packageType: 'коробка',
}));
assert.equal(ambiguous.status, 'ambiguous');

const conflict = extractPackage(product('В мешке 600 пар', { packageType: 'коробка' }));
assert.equal(conflict.status, 'existing-conflict');

console.log('package extraction tests: ok');
