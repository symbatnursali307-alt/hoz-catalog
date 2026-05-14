import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.product.findMany({
    select: {
      name: true,
      isActive: true
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
