export const VAT_RATE = 0.3;
export const VAT_MULTIPLIER = 1 + VAT_RATE;

export function calculatePriceWithVat(priceWithoutVat: number | null | undefined) {
  if (priceWithoutVat == null || !Number.isFinite(priceWithoutVat) || priceWithoutVat <= 0) {
    return null;
  }

  return Number((priceWithoutVat * VAT_MULTIPLIER).toFixed(2));
}

export function resolvePriceWithVat(
  priceWithVat: number | null | undefined,
  priceWithoutVat: number | null | undefined,
) {
  return priceWithVat ?? calculatePriceWithVat(priceWithoutVat) ?? 0;
}
