import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.category.findMany({
    select: {
      id: true,
      name: true
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
