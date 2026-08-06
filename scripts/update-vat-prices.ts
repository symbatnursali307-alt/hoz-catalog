import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { calculatePriceWithVat, VAT_RATE } from "../lib/pricing";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();
const SHOULD_APPLY = process.argv.includes("--apply");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local or .env");
  }

  const products = await prisma.product.findMany({
    where: {
      priceWithoutVat: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      priceWithoutVat: true,
      priceWithVat: true,
    },
  });

  const updates = products
    .map((product) => ({
      ...product,
      nextPriceWithVat: calculatePriceWithVat(product.priceWithoutVat),
    }))
    .filter((product) => product.nextPriceWithVat !== product.priceWithVat);

  console.log(JSON.stringify({
    mode: SHOULD_APPLY ? "apply" : "dry-run",
    vatRate: VAT_RATE,
    checked: products.length,
    needsUpdate: updates.length,
    sample: updates.slice(0, 10).map((product) => ({
      id: product.id,
      name: product.name,
      priceWithoutVat: product.priceWithoutVat,
      currentPriceWithVat: product.priceWithVat,
      nextPriceWithVat: product.nextPriceWithVat,
    })),
  }, null, 2));

  if (!SHOULD_APPLY) {
    console.log("Dry run only. Re-run with --apply to update the database.");
    return;
  }

  for (const product of updates) {
    await prisma.product.update({
      where: { id: product.id },
      data: { priceWithVat: product.nextPriceWithVat },
    });
  }

  console.log(`Updated ${updates.length} products.`);
}

main()
  .catch((error) => {
    console.error("Failed to update VAT prices:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
