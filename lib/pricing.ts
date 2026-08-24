/**
 * Customer-facing prices must use the explicit VAT-inclusive value saved by a
 * manager. A tax rate is deliberately not inferred from legacy net prices.
 */
export function calculatePriceWithVat(_priceWithoutVat: number | null | undefined): number | null {
  return null;
}

export function roundPriceUp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : 0;
}

export function resolvePriceWithVat(
  priceWithVat: number | null | undefined,
  _priceWithoutVat?: number | null | undefined,
) {
  return roundPriceUp(priceWithVat);
}

export function calculatePackagePrice(
  priceWithVat: number | null | undefined,
  unitsPerPackage: number | null | undefined,
) {
  const price = resolvePriceWithVat(priceWithVat);
  if (!price || !unitsPerPackage || unitsPerPackage < 1) return 0;
  return price * unitsPerPackage;
}
