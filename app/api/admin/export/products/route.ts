import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { csvDocument, xmlCell } from '@/lib/csv';
import { prisma } from '@/lib/prisma';

const columns = [
  'external_id', 'slug', 'meta_catalog_id', 'name', 'category', 'subcategory', 'price_with_vat', 'unit_name',
  'package_type', 'units_per_package', 'package_unit', 'min_order_packages', 'short_description', 'full_description',
  'characteristics', 'search_keywords', 'buyer_hint', 'image_url', 'brand', 'google_product_category',
  'fb_product_category', 'sort_order', 'is_featured', 'is_active',
];

function productRow(product: any) {
  return [
    product.externalId, product.slug, product.metaCatalogId, product.name, product.category.name, product.subcategory?.name,
    product.priceWithVat, product.unitName || product.unit, product.packageType,
    product.unitsPerPackage ?? product.packageQuantity, product.packageUnit, product.minOrderPackages,
    product.shortDescription || product.description, product.fullDescription,
    product.characteristics ? JSON.stringify(product.characteristics) : '', product.searchKeywords, product.buyerHint,
    product.imageUrl || product.photo, product.brand, product.googleProductCategory, product.fbProductCategory,
    product.sortOrder, product.isFeatured, product.isActive,
  ];
}

export async function GET(request: NextRequest) {
  if (!(await checkAdminAuth(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const format = request.nextUrl.searchParams.get('format') === 'xls' ? 'xls' : 'csv';
  const products = await prisma.product.findMany({ include: { category: true, subcategory: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  const rows = [columns, ...products.map(productRow)];
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    return new NextResponse(csvDocument(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="products-${stamp}.csv"`, 'Cache-Control': 'no-store' } });
  }

  const table = rows.map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${xmlCell(value)}</Data></Cell>`).join('')}</Row>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Products"><Table>${table}</Table></Worksheet></Workbook>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/vnd.ms-excel; charset=utf-8', 'Content-Disposition': `attachment; filename="products-${stamp}.xls"`, 'Cache-Control': 'no-store' } });
}
