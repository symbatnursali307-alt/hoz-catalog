import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up tables...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ClientSelectedProduct", "Product", "Category", "Client" CASCADE');
  console.log('Tables cleaned.');
}

main().finally(() => prisma.$disconnect());
