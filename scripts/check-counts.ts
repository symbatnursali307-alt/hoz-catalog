import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
  console.log(JSON.stringify(categories, null, 2));
}

main().finally(() => prisma.$disconnect());
