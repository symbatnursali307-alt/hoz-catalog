import assert from 'node:assert/strict';
import { calculatePackagePrice, resolvePriceWithVat, roundPriceUp } from '../lib/pricing';
import { formatPrice } from '../lib/utils';

assert.equal(roundPriceUp(97), 97);
assert.equal(roundPriceUp(97.1), 98);
assert.equal(roundPriceUp(97.5), 98);
assert.equal(roundPriceUp(97.99), 98);
assert.equal(resolvePriceWithVat(84.5), 85);
assert.equal(calculatePackagePrice(97.1, 600), 58_800);
assert.equal(formatPrice(59.8), '60 ₸');

console.log('price rounding tests: ok');
