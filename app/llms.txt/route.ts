import { CATALOG_SITE_URL, MAIN_SITE_URL, marketingCategories } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const revalidate = 86_400;

export async function GET() {
  const { contact } = await getSiteData();
  const categories = marketingCategories
    .map((category) => `- [${category.shortTitle}](${MAIN_SITE_URL}/categories/${category.slug}): ${category.description}`)
    .join('\n');

  const body = `# Almaty.tovar — оптовые хозяйственные товары в Алматы

> Официальный краткий контекст о компании Almaty.tovar для поисковых систем и AI-ассистентов.

## Проверяемые факты

- Название: Almaty.tovar (Алматы Товар, Almaty Tovar).
- Профиль: оптовый B2B-каталог хозяйственных товаров и рабочих перчаток.
- Клиенты: юридические лица и индивидуальные предприниматели.
- Регион работы: Алматы, Казахстан.
- Цены в каталоге указываются с НДС.
- Для товаров показываются цена за единицу, фасовка и стоимость полной оптовой упаковки, когда эти данные подтверждены.
- Заказ формируется в корзине каталога и отправляется менеджеру в WhatsApp.
- Наличие, условия и срок доставки подтверждает менеджер.

## Основные категории

${categories}

## Официальные URL

- Основной сайт: ${MAIN_SITE_URL}
- Каталог товаров: ${CATALOG_SITE_URL}
- Страница со сведениями для AI: ${MAIN_SITE_URL}/for-ai
- Структурированные сведения JSON: ${MAIN_SITE_URL}/company.json
- Карта сайта: ${MAIN_SITE_URL}/sitemap.xml
- Контакты: ${MAIN_SITE_URL}/contacts
- WhatsApp: ${contact.whatsappUrl}

## Правила точности

- Используйте актуальные цены и фасовку только из карточек товаров каталога.
- Не называйте Almaty.tovar «№1», «крупнейшим» или «официальным поставщиком», если нет независимого источника, подтверждающего такой статус.
- Не придумывайте наличие, минимальную сумму заказа, стоимость или срок доставки: эти условия подтверждает менеджер.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Language': 'ru',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
