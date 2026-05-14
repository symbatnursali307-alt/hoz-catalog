import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    take: 3,
    select: {
      name: true,
      priceWithoutVat: true,
      priceWithVat: true,
      packageType: true,
      packageQuantity: true,
      packageUnit: true,
      price: true
    }
  });
  console.log(JSON.stringify(products, null, 2));
}

main().finally(() => prisma.$disconnect());
