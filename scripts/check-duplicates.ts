import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, externalId: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  console.log(`\nВсего товаров: ${products.length}\n`);

  // Group by name
  const byName = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }

  console.log('=== ДУБЛИ ПО ИМЕНИ ===');
  let dupeCount = 0;
  for (const [name, items] of byName) {
    if (items.length > 1) {
      dupeCount += items.length - 1;
      console.log(`\n"${items[0].name}" — ${items.length} шт:`);
      items.forEach(p => console.log(`  id=${p.id}  externalId=${p.externalId}  active=${p.isActive}`));
    }
  }

  if (dupeCount === 0) {
    console.log('Дублей не найдено.');
  } else {
    console.log(`\nИтого лишних записей: ${dupeCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
