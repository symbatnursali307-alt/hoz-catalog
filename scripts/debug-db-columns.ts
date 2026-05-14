import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Product'
    `);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}

main().finally(() => prisma.$disconnect());
