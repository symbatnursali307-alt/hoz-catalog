import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

interface SubmissionItem { productId?: string; categoryId?: string; name?: string; categoryName?: string; lineTotal?: number; packageQuantity?: number }

export async function GET(request: NextRequest) {
  if (!(await checkAdminAuth(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date(); const defaultFrom = new Date(now.getTime() - 29 * 86_400_000);
  const requestedFrom = request.nextUrl.searchParams.get('from'); const requestedTo = request.nextUrl.searchParams.get('to');
  let from = requestedFrom ? new Date(`${requestedFrom}T00:00:00`) : defaultFrom;
  let to = requestedTo ? new Date(`${requestedTo}T23:59:59.999`) : now;
  if (Number.isNaN(from.valueOf())) from = defaultFrom; if (Number.isNaN(to.valueOf())) to = now;
  if (to.getTime() - from.getTime() > 366 * 86_400_000) from = new Date(to.getTime() - 366 * 86_400_000);
  const eventWhere = { isTest: false, createdAt: { gte: from, lte: to } };

  const [eventGroups, productGroups, categoryGroups, managerGroups, submissions, products, categories, managers] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ['eventName'], where: eventWhere, _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({ by: ['productId', 'eventName'], where: { ...eventWhere, productId: { not: null } }, _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({ by: ['categoryId', 'eventName'], where: { ...eventWhere, categoryId: { not: null } }, _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({ by: ['managerId', 'eventName'], where: { ...eventWhere, managerId: { not: null } }, _count: { _all: true } }),
    prisma.cartSubmission.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { id: true, managerId: true, totalAmount: true, items: true, createdAt: true } }),
    prisma.product.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.manager.findMany({ select: { id: true, name: true, slug: true } }),
  ]);

  const eventTotals = Object.fromEntries(eventGroups.map((group) => [group.eventName, group._count._all]));
  const productMap = new Map(products.map((item) => [item.id, item])); const categoryMap = new Map(categories.map((item) => [item.id, item])); const managerMap = new Map(managers.map((item) => [item.id, item]));
  const productStats = new Map<string, any>(); const categoryStats = new Map<string, any>(); const managerStats = new Map<string, any>(); const daily = new Map<string, any>();
  const productStat = (id: string) => { if (!productStats.has(id)) productStats.set(id, { id, name: productMap.get(id)?.name || 'Удалённый товар', slug: productMap.get(id)?.slug || '', views: 0, adds: 0, whatsapp: 0, submissionAmount: 0, packages: 0 }); return productStats.get(id); };
  const categoryStat = (id: string) => { if (!categoryStats.has(id)) categoryStats.set(id, { id, name: categoryMap.get(id)?.name || 'Удалённая категория', views: 0, adds: 0 }); return categoryStats.get(id); };
  const managerStat = (id: string) => { if (!managerStats.has(id)) managerStats.set(id, { id, name: managerMap.get(id)?.name || 'Удалённый менеджер', slug: managerMap.get(id)?.slug || '', catalogOpened: 0, carts: 0, whatsapp: 0, submissions: 0, amount: 0, products: {} as Record<string, number> }); return managerStats.get(id); };
  for (const group of productGroups) { if (!group.productId) continue; const stat = productStat(group.productId); if (group.eventName === 'product_viewed') stat.views += group._count._all; if (group.eventName === 'add_to_cart') stat.adds += group._count._all; }
  for (const group of categoryGroups) { if (!group.categoryId) continue; const stat = categoryStat(group.categoryId); if (group.eventName === 'category_viewed' || group.eventName === 'product_viewed') stat.views += group._count._all; if (group.eventName === 'add_to_cart') stat.adds += group._count._all; }
  for (const group of managerGroups) { if (!group.managerId) continue; const stat = managerStat(group.managerId); if (group.eventName === 'catalog_opened') stat.catalogOpened += group._count._all; if (group.eventName === 'cart_opened') stat.carts += group._count._all; if (group.eventName === 'whatsapp_clicked') stat.whatsapp += group._count._all; }
  for (const submission of submissions) {
    const date = submission.createdAt.toISOString().slice(0, 10); const day = daily.get(date) || { date, submissions: 0, amount: 0 }; day.submissions++; day.amount += submission.totalAmount; daily.set(date, day);
    if (submission.managerId) { const stat = managerStat(submission.managerId); stat.submissions++; stat.amount += submission.totalAmount; }
    const snapshot = Array.isArray(submission.items) ? submission.items as unknown as SubmissionItem[] : [];
    for (const item of snapshot) {
      if (item.productId) { const stat = productStat(item.productId); stat.whatsapp++; stat.submissionAmount += Number(item.lineTotal) || 0; stat.packages += Number(item.packageQuantity) || 0; }
      if (submission.managerId && item.name) { const stat = managerStat(submission.managerId); stat.products[item.name] = (stat.products[item.name] || 0) + (Number(item.packageQuantity) || 0); }
    }
  }
  const topProducts = [...productStats.values()].sort((a, b) => (b.views + b.adds * 3 + b.whatsapp * 8) - (a.views + a.adds * 3 + a.whatsapp * 8)).slice(0, 30);
  const topCategories = [...categoryStats.values()].sort((a, b) => b.views + b.adds * 3 - (a.views + a.adds * 3)).slice(0, 20);
  const managerRows = [...managerStats.values()].map((item) => ({ ...item, products: Object.entries(item.products).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).map(([name, packages]) => ({ name, packages })) })).sort((a, b) => b.amount - a.amount);
  const views = eventTotals.product_viewed || 0; const adds = eventTotals.add_to_cart || 0; const carts = eventTotals.cart_opened || 0; const whatsapp = eventTotals.whatsapp_clicked || 0; const amount = submissions.reduce((sum, item) => sum + item.totalAmount, 0);
  return NextResponse.json({ period: { from, to }, summary: { views, adds, carts, whatsapp, submissions: submissions.length, amount, averageCheck: submissions.length ? amount / submissions.length : 0, viewToCart: views ? adds / views : 0, cartToWhatsapp: carts ? whatsapp / carts : 0 }, topProducts, topCategories, managers: managerRows, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)) });
}
