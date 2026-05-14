import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2
  }).format(value) + " ₸";
}

export function formatPackageCount(count: number, packageType?: string) {
  if (!packageType) return `${count}`;

  const forms: Record<string, [string, string, string]> = {
    "мешок": ["мешок", "мешка", "мешков"],
    "коробка": ["коробка", "коробки", "коробок"],
    "пачка": ["пачка", "пачки", "пачек"],
    "рулон": ["рулон", "рулона", "рулонов"],
    "упаковка": ["упаковка", "упаковки", "упаковок"],
    "пакет": ["пакет", "пакета", "пакетов"]
  };

  const wordForms = forms[packageType.toLowerCase()];

  if (!wordForms) return `${count} ${packageType}`;

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) return `${count} ${wordForms[2]}`;
  if (mod10 === 1) return `${count} ${wordForms[0]}`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} ${wordForms[1]}`;
  return `${count} ${wordForms[2]}`;
}
