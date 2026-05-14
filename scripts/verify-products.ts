import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      priceWithoutVat: true,
      priceWithVat: true,
      price: true,
      packageType: true,
      packageQuantity: true,
      packageUnit: true,
    }
  });
  console.log('Count:', products.length);
  console.log('Sample Product:', JSON.stringify(products[0], null, 2));
}

main().finally(() => prisma.$disconnect());
