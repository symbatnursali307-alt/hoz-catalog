#!/usr/bin/env node
/**
 * Dry-run or atomically apply an audited cleaned-catalog patch.
 *
 * Run this from a deployed application directory so createRequire can resolve
 * the release's own Prisma client and slugify dependency.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const requireFromRelease = createRequire(path.join(process.cwd(), 'package.json'));
const { PrismaClient } = requireFromRelease('@prisma/client');
const slugify = requireFromRelease('slugify');

const args = process.argv.slice(2);
const patchFlag = args.indexOf('--patch');
if (patchFlag === -1 || !args[patchFlag + 1]) {
  throw new Error('Usage: apply-cleaned-catalog.mjs --patch FILE [--apply]');
}
const patchPath = path.resolve(args[patchFlag + 1]);
const apply = args.includes('--apply');
const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
const prisma = new PrismaClient();

const ALLOWED_PRODUCT_FIELDS = new Set([
  'name',
  'description',
  'shortDescription',
  'fullDescription',
  'characteristics',
  'searchKeywords',
  'buyerHint',
  'unitName',
  'packageType',
  'unitsPerPackage',
  'packageUnit',
  'minOrderPackages',
  'brand',
  'googleProductCategory',
  'fbProductCategory',
  'sortOrder',
  'isFeatured',
  'categoryId',
  'subcategoryId',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values) {
  return [...new Set(values)];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function equal(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function validatePatch() {
  assert(patch.schemaVersion === 1, 'Unsupported patch schema version');
  assert(Array.isArray(patch.items) && patch.items.length === 445, `Expected 445 product updates, got ${patch.items?.length}`);
  assert(Array.isArray(patch.reviews) && patch.reviews.length === 366, `Expected 366 review directives, got ${patch.reviews?.length}`);
  assert(patch.policy?.deleteAbsentRows === false, 'Patch must not delete absent rows');
  assert(patch.policy?.blockPriceChanges === true, 'Patch must block price changes');
  assert(patch.policy?.blockActiveStateChanges === true, 'Patch must block active-state changes');

  const productIds = patch.items.map((item) => clean(item.externalId));
  const reviewIds = patch.reviews.map((item) => clean(item.externalId));
  assert(productIds.every(Boolean), 'A product update has no externalId');
  assert(reviewIds.every(Boolean), 'A review directive has no externalId');
  assert(unique(productIds).length === productIds.length, 'Product patch contains duplicate externalIds');
  assert(unique(reviewIds).length === reviewIds.length, 'Review patch contains duplicate externalIds');

  for (const item of patch.items) {
    assert(clean(item.id), `Missing database id for ${item.externalId}`);
    assert(clean(item.expectedUpdatedAt), `Missing concurrency timestamp for ${item.externalId}`);
    assert(item.changes && typeof item.changes === 'object', `Missing changes for ${item.externalId}`);
    assert(item.classification && typeof item.classification === 'object', `Missing classification for ${item.externalId}`);
    assert(clean(item.classification.categoryId), `Missing category id for ${item.externalId}`);
    assert(clean(item.classification.categoryName), `Missing category name for ${item.externalId}`);
    for (const field of Object.keys(item.changes)) {
      assert(ALLOWED_PRODUCT_FIELDS.has(field), `Forbidden product field ${field} for ${item.externalId}`);
    }
    assert(!Object.hasOwn(item.changes, 'priceWithVat'), `Price change is forbidden for ${item.externalId}`);
    assert(!Object.hasOwn(item.changes, 'isActive'), `Active-state change is forbidden for ${item.externalId}`);
  }
}

async function loadAndValidateCurrent(client) {
  const targetIds = unique([
    ...patch.items.map((item) => item.externalId),
    ...patch.reviews.map((item) => item.externalId),
  ]);
  const products = await client.product.findMany({
    where: { externalId: { in: targetIds } },
    include: {
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });
  const byExternalId = new Map(products.map((product) => [product.externalId, product]));
  const missing = targetIds.filter((id) => !byExternalId.has(id));
  assert(missing.length === 0, `Production products missing: ${missing.join(', ')}`);

  const stale = [];
  for (const item of patch.items) {
    const product = byExternalId.get(item.externalId);
    if (product.id !== item.id || product.updatedAt.toISOString() !== item.expectedUpdatedAt) {
      stale.push(item.externalId);
    }
  }
  assert(stale.length === 0, `Production changed since the snapshot: ${stale.join(', ')}`);
  return byExternalId;
}

async function resolveClassifications(client, { createMissing }) {
  const categoryPairs = unique(
    patch.items.map((item) => `${item.classification.categoryId}\u0000${item.classification.categoryName}`),
  ).map((value) => value.split('\u0000'));

  const categoryById = new Map();
  for (const [id, name] of categoryPairs) {
    const category = await client.category.findUnique({ where: { id } });
    assert(category && category.name === name, `Category mismatch: ${id} / ${name}`);
    categoryById.set(id, category);
  }

  const desiredPairs = unique(
    patch.items
      .filter((item) => clean(item.classification.subcategoryName))
      .map((item) => `${item.classification.categoryId}\u0000${item.classification.subcategoryName}`),
  ).map((value) => value.split('\u0000'));

  const subcategoryByPair = new Map();
  const missingSubcategories = [];
  for (const [categoryId, name] of desiredPairs) {
    const matches = await client.subcategory.findMany({ where: { categoryId, name } });
    assert(matches.length <= 1, `Duplicate subcategory names under category: ${categoryId} / ${name}`);
    const pairKey = `${categoryId}\u0000${name}`;
    if (matches.length === 1) {
      subcategoryByPair.set(pairKey, matches[0]);
      continue;
    }
    const category = categoryById.get(categoryId);
    missingSubcategories.push({ categoryId, categoryName: category.name, name });
    if (!createMissing) continue;

    const base = slugify(`${category.name}-${name}`, { lower: true, strict: true, locale: 'ru' }) || 'subcategory';
    let slug = base;
    let suffix = 2;
    while (await client.subcategory.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    const aggregate = await client.subcategory.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });
    const created = await client.subcategory.create({
      data: {
        categoryId,
        name,
        slug,
        sortOrder: (aggregate._max.sortOrder ?? 0) + 10,
        isActive: true,
      },
    });
    subcategoryByPair.set(pairKey, created);
  }
  return { categoryById, subcategoryByPair, missingSubcategories };
}

function summarizePatch(classifications) {
  const fieldCounts = {};
  for (const item of patch.items) {
    for (const field of Object.keys(item.changes)) {
      fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
    }
  }
  return {
    mode: apply ? 'apply' : 'dry-run',
    patch: patchPath,
    source: patch.source,
    productsFound: unique([
      ...patch.items.map((item) => item.externalId),
      ...patch.reviews.map((item) => item.externalId),
    ]).length,
    productUpdates: patch.items.length,
    reviewUpserts: patch.reviews.length,
    fieldCounts,
    missingSubcategories: classifications.missingSubcategories,
    deletes: 0,
    priceChanges: 0,
    activeStateChanges: 0,
  };
}

async function applyTransaction() {
  return prisma.$transaction(async (tx) => {
    const byExternalId = await loadAndValidateCurrent(tx);
    const classifications = await resolveClassifications(tx, { createMissing: true });
    let updated = 0;

    for (const item of patch.items) {
      const data = { ...item.changes };
      delete data.categoryId;
      delete data.subcategoryId;
      data.categoryId = item.classification.categoryId;
      const subcategoryName = clean(item.classification.subcategoryName);
      data.subcategoryId = subcategoryName
        ? classifications.subcategoryByPair.get(`${item.classification.categoryId}\u0000${subcategoryName}`).id
        : null;
      await tx.product.update({ where: { id: item.id }, data });
      updated += 1;
    }

    let reviewsUpserted = 0;
    for (const directive of patch.reviews) {
      const product = byExternalId.get(directive.externalId);
      await tx.productReview.upsert({
        where: { productId: product.id },
        update: { status: 'PENDING', note: directive.note, resolvedAt: null },
        create: { productId: product.id, status: 'PENDING', note: directive.note },
      });
      reviewsUpserted += 1;
    }

    const verificationRows = await tx.product.findMany({
      where: { externalId: { in: patch.items.map((item) => item.externalId) } },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });
    const verificationById = new Map(verificationRows.map((product) => [product.externalId, product]));
    for (const item of patch.items) {
      const product = verificationById.get(item.externalId);
      for (const [field, expected] of Object.entries(item.changes)) {
        if (field === 'categoryId' || field === 'subcategoryId') continue;
        assert(equal(product[field], expected), `Post-update mismatch ${item.externalId}.${field}`);
      }
      assert(product.category.id === item.classification.categoryId, `Post-update category mismatch ${item.externalId}`);
      assert(product.category.name === item.classification.categoryName, `Post-update category name mismatch ${item.externalId}`);
      assert((product.subcategory?.name ?? '') === clean(item.classification.subcategoryName), `Post-update subcategory mismatch ${item.externalId}`);
    }
    const pendingReviews = await tx.productReview.count({
      where: {
        productId: { in: patch.reviews.map((item) => byExternalId.get(item.externalId).id) },
        status: 'PENDING',
      },
    });
    assert(pendingReviews === patch.reviews.length, `Post-update review count mismatch: ${pendingReviews}`);

    return {
      ...summarizePatch(classifications),
      updated,
      reviewsUpserted,
      pendingReviews,
      createdSubcategories: classifications.missingSubcategories,
      verified: true,
    };
  }, { maxWait: 10_000, timeout: 120_000 });
}

try {
  validatePatch();
  if (!apply) {
    await loadAndValidateCurrent(prisma);
    const classifications = await resolveClassifications(prisma, { createMissing: false });
    console.log(JSON.stringify({ ...summarizePatch(classifications), verified: true }, null, 2));
  } else {
    console.log(JSON.stringify(await applyTransaction(), null, 2));
  }
} finally {
  await prisma.$disconnect();
}
