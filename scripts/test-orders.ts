import assert from 'node:assert/strict';
import {
  buildOrderPath,
  buildOrderUrl,
  buildWhatsappText,
  createCartSnapshots,
  createOrderAccessToken,
  parseCartSnapshots,
  parseOrderAccessKey,
  type SubmissionProduct,
} from '../lib/cart-submission';

const product: SubmissionProduct = {
  id: 'product-1',
  externalId: 'SKU-777',
  slug: 'perchatki-test',
  name: 'Перчатки тестовые',
  unitName: 'пара',
  priceWithVat: 98,
  packageType: 'мешок',
  unitsPerPackage: 780,
  packageUnit: 'пар',
  minOrderPackages: 1,
  imageUrl: '/uploads/products/perchatki-v1.webp',
  brand: 'Almaty.tovar',
  characteristics: { Цвет: 'зелёный' },
  metaCatalogId: 'meta-777',
  categoryId: 'category-1',
  category: { id: 'category-1', name: 'Перчатки', slug: 'perchatki' },
};

const snapshots = createCartSnapshots([product], [{ id: product.id, packageQuantity: 2 }]);
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0].imageUrl, '/uploads/products/perchatki-v1.webp');
assert.equal(snapshots[0].sku, 'SKU-777');
assert.equal(snapshots[0].priceWithVat, 98);
assert.equal(snapshots[0].packagePrice, 98 * 780);
assert.equal(snapshots[0].lineTotal, 98 * 780 * 2);

// Product edits cannot mutate the already-created scalar snapshot.
product.imageUrl = '/uploads/products/perchatki-v2.webp';
product.priceWithVat = 120;
product.name = 'Новое название';
assert.equal(snapshots[0].imageUrl, '/uploads/products/perchatki-v1.webp');
assert.equal(snapshots[0].priceWithVat, 98);
assert.equal(snapshots[0].name, 'Перчатки тестовые');

const token = createOrderAccessToken();
assert.match(token, /^[A-Za-z0-9_-]{43}$/);
const path = buildOrderPath(10001, token);
assert.deepEqual(parseOrderAccessKey(path.replace('/order/', '')), { orderNumber: 10001, accessToken: token });
assert.equal(parseOrderAccessKey(`10002-${token.slice(0, 20)}`), null);
assert.equal(parseOrderAccessKey(`10002-${token}!`), null);
assert.equal(buildOrderUrl(10001, token, 'https://catalog.example/'), `https://catalog.example${path}`);

const parsed = parseCartSnapshots(JSON.parse(JSON.stringify(snapshots)));
assert.deepEqual(parsed, snapshots);

const whatsapp = buildWhatsappText(10001, `https://catalog.example${path}`, snapshots, snapshots[0].lineTotal);
assert.match(whatsapp, /Заказ №10001/);
assert.match(whatsapp, /Товары с фотографиями:/);
assert.match(whatsapp, /https:\/\/catalog\.example\/order\/10001-/);
assert.match(whatsapp, /Перчатки тестовые — 2 уп\./);

const manyItems = Array.from({ length: 20 }, (_, index) => ({
  ...snapshots[0],
  productId: `product-${index}`,
  name: `Товар ${index + 1}`,
}));
const conciseWhatsapp = buildWhatsappText(10002, 'https://catalog.example/order/private', manyItems, 1000);
assert.match(conciseWhatsapp, /…и ещё 8 поз\./);
assert.doesNotMatch(conciseWhatsapp, /Товар 20/);

console.log('order snapshot and secure-link tests: ok');
