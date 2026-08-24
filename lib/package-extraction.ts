export interface PackageSourceProduct {
  id: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  unit?: string | null;
  unitName?: string | null;
  packageType?: string | null;
  packageQuantity?: number | string | null;
  unitsPerPackage?: number | string | null;
  packageUnit?: string | null;
}

export interface PackageCandidate {
  packageType: string;
  unitsPerPackage: number;
  unitName: string;
  packageUnit: string;
  sourceField: 'description' | 'shortDescription' | 'fullDescription' | 'name';
  evidence: string;
  pattern: 'container-phrase' | 'box-symbol';
}

export interface PackageExtractionResult {
  status: 'ready' | 'no-match' | 'ambiguous' | 'existing-conflict';
  candidate: PackageCandidate | null;
  candidates: PackageCandidate[];
  reason: string;
}

const CONTAINER_PATTERN = 'мешке|пачке|тюке|коробке|ящике|упаковке|пакете|рулоне|бухте';
const UNIT_PATTERN = 'пар(?:а|ы)?|шт(?:\\.|ук(?:и)?)?|пач(?:ка|ки|ек)|рулон(?:а|ы|ов)?|кг|м|л';

const CONTAINER_RE = new RegExp(
  `(?:^|[\\s.;:!?—-])в\\s*(?<container>${CONTAINER_PATTERN}|📦)\\s*(?:лежит\\s+)?(?<quantity>\\d{1,6})\\s*(?<unit>${UNIT_PATTERN})(?=$|[\\s.,;:!?()])`,
  'giu',
);

const REVERSE_CONTAINER_RE = new RegExp(
  `(?:^|[\\s.;:!?—-])(?<quantity>\\d{1,6})\\s*(?<unit>${UNIT_PATTERN})\\s+в\\s+(?<container>${CONTAINER_PATTERN})(?=$|[\\s.,;:!?()])`,
  'giu',
);

const BOX_SYMBOL_RE = new RegExp(
  `(?:^|[\\s.;:!?—-])📦\\s*(?<quantity>\\d{1,6})\\s*(?<unit>${UNIT_PATTERN})(?=$|[\\s.,;:!?()])`,
  'giu',
);

function normalizeContainer(raw: string) {
  const value = raw.toLocaleLowerCase('ru-RU');
  if (value === '📦' || value.startsWith('короб')) return 'коробка';
  if (value.startsWith('меш')) return 'мешок';
  if (value.startsWith('пач')) return 'пачка';
  if (value.startsWith('тюк')) return 'тюк';
  if (value.startsWith('ящик')) return 'ящик';
  if (value.startsWith('упаков')) return 'упаковка';
  if (value.startsWith('пакет')) return 'пакет';
  if (value.startsWith('рулон')) return 'рулон';
  if (value.startsWith('бухт')) return 'бухта';
  return null;
}

export function normalizeSalesUnit(raw: string) {
  const value = raw.toLocaleLowerCase('ru-RU').replace(/\.$/, '');
  if (value.startsWith('пар')) return { unitName: 'пара', packageUnit: 'пар' };
  if (value === 'шт' || value.startsWith('штук')) return { unitName: 'шт', packageUnit: 'шт' };
  if (value.startsWith('пач')) return { unitName: 'пачка', packageUnit: 'пачек' };
  if (value.startsWith('рулон')) return { unitName: 'рулон', packageUnit: 'рулонов' };
  if (value === 'кг') return { unitName: 'кг', packageUnit: 'кг' };
  if (value === 'м') return { unitName: 'м', packageUnit: 'м' };
  if (value === 'л') return { unitName: 'л', packageUnit: 'л' };
  return null;
}

function toPositiveInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function candidateKey(candidate: PackageCandidate) {
  return [
    candidate.packageType,
    candidate.unitsPerPackage,
    candidate.unitName,
    candidate.packageUnit,
  ].join('|');
}

function parseMatches(
  text: string,
  sourceField: PackageCandidate['sourceField'],
  regex: RegExp,
  pattern: PackageCandidate['pattern'],
) {
  const candidates: PackageCandidate[] = [];
  regex.lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const quantity = Number(match.groups?.quantity);
    const container = normalizeContainer(match.groups?.container || '📦');
    const unit = normalizeSalesUnit(match.groups?.unit || '');
    if (!container || !unit || !Number.isSafeInteger(quantity) || quantity < 1) continue;

    candidates.push({
      packageType: container,
      unitsPerPackage: quantity,
      unitName: unit.unitName,
      packageUnit: unit.packageUnit,
      sourceField,
      evidence: match[0].trim().replace(/^[.;:!?—-]+\s*/, ''),
      pattern,
    });
  }

  return candidates;
}

export function extractPackage(product: PackageSourceProduct): PackageExtractionResult {
  const sources: Array<[PackageCandidate['sourceField'], string]> = [
    ['description', product.description || ''],
    ['shortDescription', product.shortDescription || ''],
    ['fullDescription', product.fullDescription || ''],
    ['name', product.name || ''],
  ];
  const seenText = new Set<string>();
  const candidates: PackageCandidate[] = [];

  for (const [field, rawText] of sources) {
    const text = rawText.trim();
    if (!text || seenText.has(text)) continue;
    seenText.add(text);

    candidates.push(...parseMatches(text, field, CONTAINER_RE, 'container-phrase'));
    candidates.push(...parseMatches(text, field, REVERSE_CONTAINER_RE, 'container-phrase'));
    candidates.push(...parseMatches(text, field, BOX_SYMBOL_RE, 'box-symbol'));
  }

  const unique = new Map<string, PackageCandidate>();
  for (const candidate of candidates) unique.set(candidateKey(candidate), candidate);
  const distinctCandidates = [...unique.values()];

  if (distinctCandidates.length === 0) {
    return { status: 'no-match', candidate: null, candidates: [], reason: 'Нет однозначной фразы о фасовке' };
  }

  if (distinctCandidates.length > 1) {
    return {
      status: 'ambiguous',
      candidate: null,
      candidates: distinctCandidates,
      reason: 'Найдено несколько разных вариантов фасовки',
    };
  }

  const candidate = distinctCandidates[0];
  const currentPackageType = product.packageType?.trim() || null;
  const currentQuantity = toPositiveInteger(product.unitsPerPackage ?? product.packageQuantity);
  const currentPackageUnit = product.packageUnit?.trim() || null;
  const conflicts: string[] = [];

  if (currentPackageType && currentPackageType !== candidate.packageType) {
    conflicts.push(`тип упаковки: ${currentPackageType} ≠ ${candidate.packageType}`);
  }
  if (currentQuantity && currentQuantity !== candidate.unitsPerPackage) {
    conflicts.push(`количество: ${currentQuantity} ≠ ${candidate.unitsPerPackage}`);
  }
  if (currentPackageUnit && normalizeSalesUnit(currentPackageUnit)?.unitName !== candidate.unitName) {
    conflicts.push(`единица фасовки: ${currentPackageUnit} ≠ ${candidate.packageUnit}`);
  }

  if (conflicts.length > 0) {
    return {
      status: 'existing-conflict',
      candidate,
      candidates: distinctCandidates,
      reason: conflicts.join('; '),
    };
  }

  return {
    status: 'ready',
    candidate,
    candidates: distinctCandidates,
    reason: 'Фасовка однозначно извлечена из карточки',
  };
}
