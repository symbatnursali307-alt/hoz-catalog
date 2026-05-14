import { PrismaClient } from '@prisma/client';
import { products } from '../lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating prices and packaging in DB...');

  for (const prod of products) {
    const result = await prisma.product.updateMany({
      where: { externalId: prod.id },
      data: {
        priceWithoutVat: prod.priceWithoutVat,
        priceWithVat: prod.priceWithVat,
        price: `${prod.priceWithoutVat} тг.`,
        packageType: prod.packageType,
        packageQuantity: prod.packageQuantity,
        packageUnit: prod.packageUnit,
        unit: prod.unit,
        description: prod.desc,
        photo: prod.imageUrl || null,
      }
    });
    console.log(`Updated ${prod.name}: ${result.count} row(s)`);
  }

  console.log('Done.');
}

main().finally(() => prisma.$disconnect());
