import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  
  console.log(`Products in DB: ${productCount}`);
  console.log(`Categories in DB: ${categoryCount}`);
  
  const sampleProducts = await prisma.product.findMany({
    take: 3,
    include: { category: true }
  });
  
  console.log("Sample Products:");
  sampleProducts.forEach(p => {
    console.log(`- ${p.name} [${p.externalId}] in category ${p.category.name}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
