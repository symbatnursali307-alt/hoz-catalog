import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all AUTO-* duplicates
  const dupes = await prisma.product.findMany({
    where: {
      externalId: { startsWith: 'AUTO-' }
    },
    select: { id: true, externalId: true, name: true }
  });

  console.log(`Найдено ${dupes.length} дублей (AUTO-*):\n`);
  dupes.forEach(p => console.log(`  ${p.externalId} — ${p.name}`));

  if (dupes.length === 0) {
    console.log('Нечего удалять.');
    return;
  }

  const dupeIds = dupes.map(p => p.id);

  // First delete any ClientSelectedProduct referencing these
  const deletedSelections = await prisma.clientSelectedProduct.deleteMany({
    where: { productId: { in: dupeIds } }
  });
  console.log(`\nУдалено связей ClientSelectedProduct: ${deletedSelections.count}`);

  // Then delete the duplicate products
  const deleted = await prisma.product.deleteMany({
    where: { id: { in: dupeIds } }
  });
  console.log(`Удалено дублей товаров: ${deleted.count}`);

  const remaining = await prisma.product.count();
  console.log(`\nОсталось товаров в базе: ${remaining}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
