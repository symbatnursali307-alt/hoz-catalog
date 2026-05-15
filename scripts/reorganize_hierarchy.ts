import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const HIERARCHY = [
  {
    name: "Перчатки",
    slug: "gloves",
    subcategories: [
      { name: "ХБ перчатки", slug: "hb-perchatki" },
      { name: "Прорезиненные", slug: "prorezinennye" },
      { name: "Резиновые", slug: "rezinovye" },
      { name: "Спецперчатки", slug: "specperchatki" },
      { name: "Краги", slug: "kragi" },
      { name: "Рукавицы", slug: "rukavicy" },
      { name: "Нитриловые", slug: "nitrilovye" },
      { name: "Антипорез", slug: "antiporez" },
      { name: "Диэлектрические", slug: "dielektricheskie" },
      { name: "Утепленные", slug: "uteplennye" },
    ],
  },
  {
    name: "Пакеты",
    slug: "bags",
    subcategories: [
      { name: "Майки", slug: "mayki" },
      { name: "Майки с ручками", slug: "mayki-ruchki" },
      { name: "Без ручек", slug: "bez-ruchek" },
      { name: "Фасовочные", slug: "fasovochnye" },
      { name: "ПНД", slug: "pnd" },
      { name: "ПВД", slug: "pvd" },
    ],
  },
  {
    name: "Мешки",
    slug: "sacks",
    subcategories: [
      { name: "Полипропиленовые", slug: "polypropylene" },
      { name: "Сетка", slug: "setka" },
      { name: "Мусорные", slug: "trash" },
    ],
  },
  {
    name: "Упаковка",
    slug: "packaging",
    subcategories: [
      { name: "Стрейч", slug: "stretch" },
      { name: "Пленка", slug: "film" },
    ],
  },
  {
    name: "Спецодежда",
    slug: "workwear",
    subcategories: [
      { name: "Жилеты", slug: "vests" },
      { name: "Каски", slug: "helmets" },
      { name: "Комбинезоны", slug: "coveralls" },
    ],
  },
  {
    name: "Хозтовары",
    slug: "household",
    subcategories: [
      { name: "Коврики", slug: "mats" },
      { name: "Салфетки", slug: "napkins" },
      { name: "Ветошь", slug: "rags" },
    ],
  },
];

async function main() {
  console.log("Starting hierarchy reorganization...");

  // 1. Create/Update Categories and Subcategories
  const catMap: Record<string, string> = {}; // slug -> id
  const subMap: Record<string, string> = {}; // slug -> id

  for (const catData of HIERARCHY) {
    const category = await prisma.category.upsert({
      where: { slug: catData.slug },
      update: { name: catData.name },
      create: { name: catData.name, slug: catData.slug },
    });
    catMap[catData.slug] = category.id;
    console.log(`Category: ${catData.name} (${category.id})`);

    for (const subData of catData.subcategories) {
      const subcategory = await prisma.subcategory.upsert({
        where: { slug: subData.slug },
        update: { name: subData.name, categoryId: category.id },
        create: { name: subData.name, slug: subData.slug, categoryId: category.id },
      });
      subMap[subData.slug] = subcategory.id;
      console.log(`  Subcategory: ${subData.name} (${subcategory.id})`);
    }
  }

  // 2. Get all products to reassign
  const products = await prisma.product.findMany({
    include: { category: true },
  });

  console.log(`Processing ${products.length} products...`);

  for (const product of products) {
    let newCatSlug = "";
    let newSubSlug = "";

    const oldCatName = product.category.name.toLowerCase();
    const prodName = product.name.toLowerCase();

    // Mapping Logic
    if (oldCatName.includes("ветошь")) {
      newCatSlug = "household";
      newSubSlug = "rags";
    } else if (oldCatName.includes("коврики")) {
      newCatSlug = "household";
      newSubSlug = "mats";
    } else if (oldCatName.includes("салфетки")) {
      newCatSlug = "household";
      newSubSlug = "napkins";
    } else if (oldCatName.includes("краги")) {
      newCatSlug = "gloves";
      newSubSlug = "kragi";
    } else if (oldCatName.includes("рукавицы")) {
      newCatSlug = "gloves";
      newSubSlug = "rukavicy";
    } else if (oldCatName.includes("майки с ручками")) {
      newCatSlug = "bags";
      newSubSlug = "mayki-ruchki";
    } else if (oldCatName.includes("майки")) {
      newCatSlug = "bags";
      newSubSlug = "mayki";
    } else if (oldCatName.includes("мешочки без ручки")) {
      newCatSlug = "bags";
      newSubSlug = "bez-ruchek";
    } else if (oldCatName.includes("мусорные")) {
      newCatSlug = "sacks";
      newSubSlug = "trash";
    } else if (oldCatName.includes("сетка")) {
      newCatSlug = "sacks";
      newSubSlug = "setka";
    } else if (oldCatName.includes("мешки")) {
      newCatSlug = "sacks";
      newSubSlug = "polypropylene";
    } else if (oldCatName.includes("пакеты")) {
      newCatSlug = "bags";
      newSubSlug = "fasovochnye";
    } else if (oldCatName.includes("плёнки")) {
      newCatSlug = "packaging";
      newSubSlug = "film";
    } else if (oldCatName.includes("стрейч")) {
      newCatSlug = "packaging";
      newSubSlug = "stretch";
    } else if (oldCatName.includes("хб перчатки") || oldCatName === "перчатки") {
      newCatSlug = "gloves";
      if (prodName.includes("пвх") || prodName.includes("точка")) newSubSlug = "hb-perchatki";
      else if (prodName.includes("нитрил")) newSubSlug = "nitrilovye";
      else if (prodName.includes("зимние") || prodName.includes("зима") || prodName.includes("утеплен")) newSubSlug = "uteplennye";
      else if (prodName.includes("диэлектрические")) newSubSlug = "dielektricheskie";
      else if (prodName.includes("антипорез")) newSubSlug = "antiporez";
      else newSubSlug = "hb-perchatki";
    } else if (oldCatName.includes("прорезиненные")) {
      newCatSlug = "gloves";
      newSubSlug = "prorezinennye";
    } else if (oldCatName.includes("резиновые")) {
      newCatSlug = "gloves";
      newSubSlug = "rezinovye";
    } else if (oldCatName.includes("спец перчатки") || oldCatName.includes("спецперчатки")) {
      newCatSlug = "gloves";
      newSubSlug = "specperchatki";
    } else if (oldCatName.includes("спецодежда") || oldCatName.includes("спец одежда")) {
      newCatSlug = "workwear";
      if (prodName.includes("каска")) newSubSlug = "helmets";
      else if (prodName.includes("жилет")) newSubSlug = "vests";
      else if (prodName.includes("комбинезон") || prodName.includes("костюм")) newSubSlug = "coveralls";
      else newSubSlug = "coveralls";
    }

    if (newCatSlug && newSubSlug) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: catMap[newCatSlug],
          subcategoryId: subMap[newSubSlug],
        },
      });
    }
  }

  // 3. Clean up old categories that are no longer used
  // First, identify categories that are not in our HIERARCHY
  const hierarchySlugs = HIERARCHY.map(h => h.slug);
  const oldCategories = await prisma.category.findMany({
    where: {
      slug: { notIn: hierarchySlugs }
    },
    include: { _count: { select: { products: true } } }
  });

  console.log(`Found ${oldCategories.length} old categories to clean up.`);
  for (const oldCat of oldCategories) {
    if (oldCat._count.products === 0) {
      await prisma.category.delete({ where: { id: oldCat.id } });
      console.log(`Deleted empty old category: ${oldCat.name}`);
    } else {
      console.log(`Old category ${oldCat.name} still has ${oldCat._count.products} products. Skipping deletion.`);
    }
  }

  console.log("Hierarchy reorganization complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
