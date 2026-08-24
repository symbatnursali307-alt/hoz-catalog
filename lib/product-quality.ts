import { extractPackage, normalizeSalesUnit } from '@/lib/package-extraction';

export type ProductQualitySeverity = 'error' | 'warning';

export interface ProductQualityIssue {
  code: string;
  severity: ProductQualitySeverity;
  title: string;
  details: string;
  fields: string[];
}

export interface ProductQualityProductLike {
  id: string;
  name: string;
  slug?: string | null;
  externalId?: string | null;
  categoryId?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
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
  metaCatalogId?: string | null;
}

const STANDARD_UNITS = new Set(['шт', 'пара', 'рулон', 'кг', 'пачка', 'м', 'л']);
const STANDARD_PACKAGES = new Set(['мешок', 'коробка', 'пачка', 'тюк', 'ящик', 'упаковка', 'пакет', 'рулон', 'бухта']);
const TECHNICAL_TEXT_RE = /(?:Источник:\s*output|WhatsApp\s+product_id|image_sha256|Требует\s+ручной\s+проверки)/iu;
const PRICE_IN_NAME_RE = /(?:^|\s)(?:[-–—]\s*)?\d+(?:[.,]\d+)?\s*(?:тг|₸)(?=$|\s|[.,;:!?()])/iu;
const GENERIC_NAME_RE = /^(?:без\s+коллекции|товар|без\s+названия|[.\s-]+)(?:\s|$)/iu;

function issue(
  code: string,
  severity: ProductQualitySeverity,
  title: string,
  details: string,
  fields: string[],
): ProductQualityIssue {
  return { code, severity, title, details, fields };
}

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

export function getProductQualityIssues(product: ProductQualityProductLike) {
  const issues: ProductQualityIssue[] = [];
  const unitName = clean(product.unitName) || clean(product.unit);
  const packageType = clean(product.packageType).toLocaleLowerCase('ru-RU');
  const unitsPerPackage = product.unitsPerPackage ?? product.packageQuantity;
  const packageUnit = clean(product.packageUnit);
  const image = clean(product.imageUrl) || clean(product.photo);
  const combinedDescription = [product.description, product.shortDescription, product.fullDescription]
    .filter(Boolean)
    .join('\n');

  if (!clean(product.name)) {
    issues.push(issue('NAME_MISSING', 'error', 'Нет названия', 'Укажите понятное название товара.', ['name']));
  } else {
    if (GENERIC_NAME_RE.test(product.name)) {
      issues.push(issue('NAME_GENERIC', 'warning', 'Название требует уточнения', 'Название выглядит техническим или слишком общим.', ['name']));
    }
    if (PRICE_IN_NAME_RE.test(product.name)) {
      issues.push(issue('PRICE_IN_NAME', 'warning', 'Цена зашита в название', 'Удалите старую цену из названия: актуальная цена хранится в отдельном поле.', ['name', 'priceWithVat']));
    }
  }

  if (!product.categoryId) {
    issues.push(issue('CATEGORY_MISSING', 'error', 'Нет категории', 'Выберите категорию товара.', ['categoryId']));
  }
  if (!(typeof product.priceWithVat === 'number' && Number.isFinite(product.priceWithVat) && product.priceWithVat > 0)) {
    issues.push(issue('PRICE_MISSING', 'error', 'Нет цены с НДС', 'Укажите подтверждённую цену за единицу с НДС.', ['priceWithVat']));
  }
  if (!unitName) {
    issues.push(issue('UNIT_MISSING', 'error', 'Нет единицы цены', 'Укажите, за что установлена цена: шт, пара, рулон и т. п.', ['unitName']));
  } else if (!STANDARD_UNITS.has(unitName.toLocaleLowerCase('ru-RU'))) {
    issues.push(issue('UNIT_NON_STANDARD', 'warning', 'Нестандартная единица цены', `Проверьте единицу «${unitName}» и приведите её к единому справочнику.`, ['unitName']));
  }

  if (!packageType) {
    issues.push(issue('PACKAGE_TYPE_MISSING', 'error', 'Нет типа упаковки', 'Укажите внешнюю упаковку: мешок, коробка, пачка и т. п.', ['packageType']));
  } else if (!STANDARD_PACKAGES.has(packageType)) {
    issues.push(issue('PACKAGE_TYPE_NON_STANDARD', 'warning', 'Нестандартный тип упаковки', `Проверьте значение «${product.packageType}».`, ['packageType']));
  }

  if (!(typeof unitsPerPackage === 'number' && Number.isInteger(unitsPerPackage) && unitsPerPackage > 0)) {
    issues.push(issue('PACKAGE_QUANTITY_MISSING', 'error', 'Нет количества в упаковке', 'Укажите целое количество единиц во внешней упаковке.', ['unitsPerPackage']));
  }
  if (!packageUnit) {
    issues.push(issue('PACKAGE_UNIT_MISSING', 'error', 'Нет подписи фасовки', 'Укажите подпись количества: шт, пар, рулонов, пачек и т. п.', ['packageUnit']));
  }
  if (
    product.unitsPerPackage &&
    product.packageQuantity &&
    product.unitsPerPackage !== product.packageQuantity
  ) {
    issues.push(issue('PACKAGE_QUANTITY_CONFLICT', 'error', 'Конфликт количества', 'Старое и новое поля количества в упаковке не совпадают.', ['unitsPerPackage', 'packageQuantity']));
  }

  const normalizedPriceUnit = unitName ? normalizeSalesUnit(unitName)?.unitName : null;
  const normalizedPackageUnit = packageUnit ? normalizeSalesUnit(packageUnit)?.unitName : null;
  if (normalizedPriceUnit && normalizedPackageUnit && normalizedPriceUnit !== normalizedPackageUnit) {
    issues.push(issue('PACKAGE_UNIT_CONFLICT', 'error', 'Единицы цены и фасовки не совпадают', `Цена указана за «${unitName}», а в упаковке считаются «${packageUnit}».`, ['unitName', 'packageUnit']));
  }

  if (!(typeof product.minOrderPackages === 'number' && Number.isInteger(product.minOrderPackages) && product.minOrderPackages > 0)) {
    issues.push(issue('MINIMUM_INVALID', 'error', 'Некорректный минимум заказа', 'Минимальный заказ должен быть целым числом упаковок от 1.', ['minOrderPackages']));
  }
  if (!image) {
    issues.push(issue('IMAGE_MISSING', 'warning', 'Нет фотографии', 'Добавьте фотографию товара.', ['imageUrl']));
  }
  if (!clean(product.metaCatalogId)) {
    issues.push(issue('META_ID_MISSING', 'warning', 'Нет Meta Catalog ID', 'Укажите стабильный ID для рекламы и аналитики.', ['metaCatalogId']));
  }
  if (!clean(product.shortDescription) && !clean(product.fullDescription) && !clean(product.description)) {
    issues.push(issue('DESCRIPTION_MISSING', 'warning', 'Нет описания', 'Добавьте краткое или полное описание для покупателя.', ['shortDescription', 'fullDescription']));
  } else if (TECHNICAL_TEXT_RE.test(combinedDescription)) {
    issues.push(issue('DESCRIPTION_TECHNICAL', 'warning', 'В описании технические данные', 'Уберите служебные ID, хеши и пометку о ручной проверке из покупательского описания.', ['shortDescription', 'fullDescription']));
  }

  const packageExtraction = extractPackage(product);
  if (packageExtraction.status === 'ambiguous') {
    issues.push(issue('PACKAGE_AMBIGUOUS', 'error', 'Несколько вариантов фасовки', 'Разделите варианты на отдельные товары или выберите одну точную фасовку.', ['name', 'shortDescription', 'unitsPerPackage']));
  } else if (packageExtraction.status === 'existing-conflict') {
    issues.push(issue('PACKAGE_SOURCE_CONFLICT', 'error', 'Фасовка не совпадает с описанием', packageExtraction.reason, ['unitName', 'packageType', 'unitsPerPackage', 'packageUnit']));
  }

  return issues;
}

export function summarizeProductQuality(issues: ProductQualityIssue[]) {
  return {
    needsReview: issues.length > 0,
    issueCount: issues.length,
    errorCount: issues.filter((item) => item.severity === 'error').length,
    warningCount: issues.filter((item) => item.severity === 'warning').length,
  };
}
