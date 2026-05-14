import { PrismaClient } from '@prisma/client';
import { products } from '../lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Raw SQL Update...');
  
  for (const prod of products) {
    console.log(`Updating ${prod.name}...`);
    try {
      // Use raw SQL to ensure we hit the right columns regardless of Prisma Client state
      const query = `
        UPDATE "Product" 
        SET 
          "priceWithoutVat" = $1, 
          "priceWithVat" = $2, 
          "price" = $3,
          "packageType" = $4,
          "packageQuantity" = $5,
          "packageUnit" = $6,
          "unit" = $7,
          "description" = $8
        WHERE "externalId" = $9
      `;
      
      const priceStr = `${prod.priceWithoutVat} тг.`;
      
      await prisma.$executeRawUnsafe(
        query,
        prod.priceWithoutVat,
        prod.priceWithVat,
        priceStr,
        prod.packageType,
        prod.packageQuantity,
        prod.packageUnit,
        prod.unit,
        prod.desc,
        prod.id
      );
    } catch (e) {
      console.error(`Failed to update ${prod.name}:`, e);
    }
  }
  
  console.log('Raw SQL Update Finished.');
}

main().finally(() => prisma.$disconnect());
