import { PrismaClient } from '@prisma/client';
import { categories, products } from '../lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data from mock-data.ts to Neon DB...');

  // 1. Create categories
  for (const cat of categories) {
    const slug = cat.title.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-');
    await prisma.category.upsert({
      where: { slug: slug },
      update: {},
      create: {
        slug: slug,
        name: cat.title,
        sortOrder: categories.indexOf(cat)
      }
    });
  }

  // Fetch created categories to link them
  const dbCategories = await prisma.category.findMany();
  const categoryMap = new Map(dbCategories.map(c => [c.name, c.id]));

  // 2. Create products
  for (const prod of products) {
    const categoryId = categoryMap.get(prod.category);
    if (!categoryId) {
      console.warn(`Category ${prod.category} not found for product ${prod.name}`);
      continue;
    }

    await prisma.product.upsert({
      where: { externalId: prod.id },
      update: {
        name: prod.name,
        description: prod.desc,
        unit: prod.unit,
        priceWithoutVat: prod.priceWithoutVat,
        priceWithVat: prod.priceWithVat,
        price: `${prod.priceWithoutVat} тг.`,
        packageType: prod.packageType,
        packageQuantity: prod.packageQuantity,
        packageUnit: prod.packageUnit,
        photo: prod.imageUrl || null,
      },
      create: {
        externalId: prod.id,
        categoryId: categoryId,
        name: prod.name,
        description: prod.desc,
        unit: prod.unit,
        priceWithoutVat: prod.priceWithoutVat,
        priceWithVat: prod.priceWithVat,
        price: `${prod.priceWithoutVat} тг.`,
        packageType: prod.packageType,
        packageQuantity: prod.packageQuantity,
        packageUnit: prod.packageUnit,
        photo: prod.imageUrl || null,
      }
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    // process is not typed, so just throw
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
