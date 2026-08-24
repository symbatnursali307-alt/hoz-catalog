import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { calculatePackagePrice } from '../lib/pricing';
import { extractPackage, type PackageSourceProduct } from '../lib/package-extraction';

interface CsvRow extends PackageSourceProduct {
  externalId?: string;
  slug?: string;
  priceWithVat?: string;
  isActive?: string;
}

const defaultSource = path.join(
  process.cwd(),
  '_recovery_backup_2026-08-20',
  'vps-post-b2b',
  'product-packaging-source.csv',
);
const sourcePath = path.resolve(process.argv[2] || defaultSource);
const outputDirectory = path.dirname(sourcePath);
const analysisPath = path.join(outputDirectory, 'packaging-analysis.csv');
const updatesPath = path.join(outputDirectory, 'packaging-updates.csv');

if (!fs.existsSync(sourcePath)) throw new Error(`Source CSV not found: ${sourcePath}`);

const rows = parse(fs.readFileSync(sourcePath, 'utf8'), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
}) as CsvRow[];

const analysis = rows.map((row) => {
  const result = extractPackage(row);
  const candidate = result.candidate;
  const priceWithVat = Number(row.priceWithVat) || 0;
  const packagePrice = candidate
    ? calculatePackagePrice(priceWithVat, candidate.unitsPerPackage)
    : 0;

  return {
    id: row.id,
    externalId: row.externalId || '',
    name: row.name,
    status: result.status,
    reason: result.reason,
    evidence: candidate?.evidence || '',
    sourceField: candidate?.sourceField || '',
    currentUnitName: row.unitName || row.unit || '',
    proposedUnitName: candidate?.unitName || '',
    currentPackageType: row.packageType || '',
    proposedPackageType: candidate?.packageType || '',
    proposedUnitsPerPackage: candidate?.unitsPerPackage || '',
    proposedPackageUnit: candidate?.packageUnit || '',
    priceWithVat: priceWithVat || '',
    packagePrice: packagePrice || '',
    orderableAfterUpdate: result.status === 'ready' && packagePrice > 0 ? 'true' : 'false',
    description: row.description || '',
  };
});

const updates = rows.flatMap((row) => {
  const result = extractPackage(row);
  if (result.status !== 'ready' || !result.candidate) return [];
  const candidate = result.candidate;
  return [{
    id: row.id,
    expectedName: row.name,
    expectedDescription: row.description || '',
    expectedUnitName: row.unitName || '',
    expectedPackageType: row.packageType || '',
    expectedPackageQuantity: row.packageQuantity || '',
    expectedUnitsPerPackage: row.unitsPerPackage || '',
    expectedPackageUnit: row.packageUnit || '',
    proposedUnitName: candidate.unitName,
    proposedPackageType: candidate.packageType,
    proposedUnitsPerPackage: candidate.unitsPerPackage,
    proposedPackageUnit: candidate.packageUnit,
    evidence: candidate.evidence,
  }];
});

fs.writeFileSync(analysisPath, stringify(analysis, { header: true }));
fs.writeFileSync(updatesPath, stringify(updates, { header: true }));

const counts = analysis.reduce<Record<string, number>>((accumulator, row) => {
  accumulator[row.status] = (accumulator[row.status] || 0) + 1;
  return accumulator;
}, {});
const orderable = analysis.filter((row) => row.orderableAfterUpdate === 'true').length;
const unitCorrections = analysis.filter(
  (row) => row.status === 'ready' && row.currentUnitName !== row.proposedUnitName,
).length;

console.log(JSON.stringify({
  sourcePath,
  total: rows.length,
  counts,
  updates: updates.length,
  orderableAfterUpdate: orderable,
  unitCorrections,
  analysisPath,
  updatesPath,
}, null, 2));
