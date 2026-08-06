export const WHATSAPP_NUMBER = '77773042030';

export type Product = {
  id: string;
  category: string;
  subcategory?: string;
  name: string;
  sku: string;
  
  priceWithoutVat: number;
  priceWithVat: number;
  
  unit: string;
  
  packageType: string;
  packageQuantity: number;
  packageUnit: string;
  
  desc: string;
  imageUrl: string | null;
};

export const products: Product[] = [
  {
    id: "glv-001",
    category: "Перчатки",
    subcategory: "Перчатки",
    name: "Перчатки х/б белые с ПВХ-точкой, 4 нити / 10 класс",
    sku: "GLV-001",
    priceWithoutVat: 75,
    priceWithVat: 97.5,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 600,
    packageUnit: "пар",
    desc: "Белые х/б перчатки с синей ПВХ-точкой на ладони и пальцах. Подходят для склада, погрузки, упаковки, хозяйственных и производственных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-hb-belye-pvh-tochka-4-niti-10-klass.webp"
  },
  {
    id: "glv-002",
    category: "Перчатки",
    subcategory: "Перчатки",
    name: "Перчатки х/б чёрные с ПВХ-точкой",
    sku: "GLV-002",
    priceWithoutVat: 100,
    priceWithVat: 130,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 300,
    packageUnit: "пар",
    desc: "Чёрные х/б перчатки с синей ПВХ-точкой. Используются для складских, хозяйственных, погрузочных и производственных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-hb-chernye-pvh-tochka.webp"
  },
  {
    id: "glv-003",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки белые с чёрным покрытием WELLSTRONG",
    sku: "GLV-003",
    priceWithoutVat: 95,
    priceWithVat: 123.5,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Рабочие перчатки с белой трикотажной основой и чёрным покрытием ладони и пальцев. Подходят для склада, стройки, погрузки и технических работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-belye-chernoe-pokrytie-wellstrong.webp"
  },
  {
    id: "glv-004",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки серые с чёрным покрытием 300#",
    sku: "GLV-004",
    priceWithoutVat: 95,
    priceWithVat: 123.5,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Серые рабочие перчатки с чёрным покрытием ладони и пальцев. Подходят для строительных, складских, погрузочных и хозяйственных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-serye-chernoe-pokrytie-300.webp"
  },
  {
    id: "glv-005",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки зелёные с чёрным покрытием RAMBO 10",
    sku: "GLV-005",
    priceWithoutVat: 190,
    priceWithVat: 247,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 600,
    packageUnit: "пар",
    desc: "Рабочие перчатки с зелёной текстильной основой и чёрным покрытием ладони. Подходят для склада, строительства, погрузки и работ, где нужен уверенный хват.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-zelenye-chernoe-pokrytie-rambo-10.webp"
  },
  {
    id: "glv-006",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки салатовые с чёрным рельефным покрытием",
    sku: "GLV-006",
    priceWithoutVat: 100,
    priceWithVat: 130,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Перчатки с салатовой основой и чёрным рельефным покрытием ладони. Подходят для строительных, складских и погрузочных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-salatovye-chernoe-relefnoe-pokrytie.webp"
  },
  {
    id: "glv-007",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки фиолетовые с чёрным рельефным покрытием 300#",
    sku: "GLV-007",
    priceWithoutVat: 95,
    priceWithVat: 123.5,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Фиолетовые рабочие перчатки с салатовыми полосами и чёрным рельефным покрытием ладони. Используются для склада, стройки, погрузки и хозяйственных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-fioletovye-chernoe-relefnoe-pokrytie-300.webp"
  },
  {
    id: "glv-008",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки фиолетовые с чёрным гладким покрытием",
    sku: "GLV-008",
    priceWithoutVat: 90,
    priceWithVat: 117,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Рабочие перчатки с фиолетовой текстильной основой и чёрным гладким покрытием ладони и пальцев. Подходят для складских, строительных, погрузочных и производственных задач.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-fioletovye-chernoe-gladkoe-pokrytie.webp"
  },
  {
    id: "glv-009",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки серо-красные с чёрным покрытием",
    sku: "GLV-009",
    priceWithoutVat: 85,
    priceWithVat: 110.5,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Серо-красные рабочие перчатки с чёрным покрытием ладони. Подходят для склада, стройки, производства, погрузки и хозяйственных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-sero-krasnye-chernoe-pokrytie.webp"
  },
  {
    id: "glv-010",
    category: "Перчатки",
    subcategory: "Прорезиненные перчатки",
    name: "Перчатки голубые с жёлтым покрытием A688-1",
    sku: "GLV-010",
    priceWithoutVat: 150,
    priceWithVat: 195,
    unit: "пара",
    packageType: "мешок",
    packageQuantity: 960,
    packageUnit: "пар",
    desc: "Перчатки с голубой текстильной основой и жёлтым покрытием ладони. Подходят для складских, строительных, погрузочных и хозяйственных работ.",
    imageUrl: "https://oywqbwpoy68mrgbq.public.blob.vercel-storage.com/products/gloves/perchatki-golubye-zheltoe-pokrytie-a688-1.webp"
  }
];

export const categories = [
  {
    title: 'Перчатки',
    items: products.filter(p => p.category === 'Перчатки')
  }
];
