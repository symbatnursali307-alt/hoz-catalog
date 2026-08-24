import { NextResponse } from 'next/server';
import { csvDocument } from '@/lib/csv';
import { prisma } from '@/lib/prisma';
import { resolvePriceWithVat } from '@/lib/pricing';

function absoluteUrl(value: string | null, base: string) {
  if (!value) return '';
  try { return new URL(value, base).toString(); } catch { return ''; }
}

export async function GET() {
  const base = (process.env.SITE_URL || 'https://catalog.almatytovar.kz').replace(/\/$/, '');
  const products = await prisma.product.findMany({
    where: { isActive: true, priceWithVat: { gt: 0 }, unitName: { not: null }, packageType: { not: null }, unitsPerPackage: { gt: 0 } },
    include: { category: { select: { name: true } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const rows: unknown[][] = [['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'google_product_category', 'fb_product_category']];
  for (const product of products) {
    const id = product.metaCatalogId || product.slug;
    rows.push([
      id, product.name, product.fullDescription || product.shortDescription || product.description || product.name,
      'in stock', 'new', `${resolvePriceWithVat(product.priceWithVat)} KZT`, `${base}/?product=${encodeURIComponent(product.slug)}`,
      absoluteUrl(product.imageUrl || product.photo, base), product.brand || '', product.googleProductCategory || product.category.name,
      product.fbProductCategory || '',
    ]);
  }
  return new NextResponse(csvDocument(rows, ','), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'inline; filename="meta-catalog.csv"', 'Cache-Control': 'public, max-age=900, s-maxage=900' } });
}
