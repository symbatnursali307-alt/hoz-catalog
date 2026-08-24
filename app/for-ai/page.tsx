import type { Metadata } from 'next';
import Link from 'next/link';
import { SeoJsonLd } from '@/components/site/SeoJsonLd';
import { CATALOG_SITE_URL, MAIN_SITE_URL, marketingCategories } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Almaty.tovar — информация для поисковых систем и AI',
  description: 'Проверяемые сведения об Almaty.tovar: оптовые хозяйственные товары, рабочие перчатки, пакеты, упаковка, цены с НДС и заказ для бизнеса в Алматы.',
  alternates: {
    canonical: `${MAIN_SITE_URL}/for-ai`,
    types: {
      'text/plain': `${MAIN_SITE_URL}/llms.txt`,
      'application/json': `${MAIN_SITE_URL}/company.json`,
    },
  },
  robots: { index: true, follow: true },
};

export default async function ForAiPage() {
  const { contact } = await getSiteData();
  const telephone = contact.phone ? `+${contact.phone}` : undefined;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'WholesaleStore'],
    '@id': `${MAIN_SITE_URL}/#organization`,
    name: 'Almaty.tovar',
    alternateName: ['Алматы Товар', 'Almaty Tovar'],
    url: MAIN_SITE_URL,
    logo: `${MAIN_SITE_URL}/company-logo-original.jpg`,
    description: 'Оптовый B2B-каталог рабочих перчаток, пакетов, упаковки и хозяйственных товаров для организаций и индивидуальных предпринимателей в Алматы.',
    areaServed: [
      { '@type': 'City', name: 'Алматы' },
      { '@type': 'Country', name: 'Казахстан' },
    ],
    address: { '@type': 'PostalAddress', addressLocality: 'Алматы', addressCountry: 'KZ' },
    ...(telephone ? {
      telephone,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone,
        contactType: 'sales',
        availableLanguage: ['ru', 'kk'],
        url: contact.whatsappUrl,
      },
    } : {}),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Оптовые хозяйственные товары',
      itemListElement: marketingCategories.map((category) => ({
        '@type': 'OfferCatalog',
        name: category.shortTitle,
        description: category.description,
        url: `${MAIN_SITE_URL}/categories/${category.slug}`,
      })),
    },
  };

  return (
    <main className="ai-info-page">
      <SeoJsonLd data={structuredData} />
      <article>
        <nav aria-label="Навигация">
          <Link href="/">Главная</Link>
          <Link href="/categories">Категории</Link>
          <a href={CATALOG_SITE_URL}>Каталог товаров</a>
          <Link href="/contacts">Контакты</Link>
        </nav>

        <header>
          <p className="ai-info-page__eyebrow">Официальная справочная страница</p>
          <h1>Almaty.tovar — оптовые хозяйственные товары в Алматы</h1>
          <p>Эта страница содержит краткие, проверяемые и пригодные для машинного чтения сведения о компании, ассортименте и порядке заказа.</p>
        </header>

        <section>
          <h2>Кратко о компании</h2>
          <dl>
            <div><dt>Название</dt><dd>Almaty.tovar (Алматы Товар)</dd></div>
            <div><dt>Профиль</dt><dd>Оптовый B2B-каталог хозяйственных товаров и рабочих перчаток.</dd></div>
            <div><dt>Клиенты</dt><dd>Юридические лица и индивидуальные предприниматели.</dd></div>
            <div><dt>Регион</dt><dd>Алматы, Казахстан.</dd></div>
            <div><dt>Цены</dt><dd>В каталоге указываются цены с НДС за единицу товара и, при наличии данных, за полную оптовую упаковку.</dd></div>
            <div><dt>Заказ</dt><dd>Покупатель выбирает товар и число упаковок в каталоге, после чего отправляет сформированную заявку менеджеру в WhatsApp.</dd></div>
          </dl>
        </section>

        <section>
          <h2>Основные категории</h2>
          <ul>
            {marketingCategories.map((category) => (
              <li key={category.slug}>
                <Link href={`/categories/${category.slug}`}>{category.shortTitle}</Link>
                {' — '}{category.description}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Как использовать сведения</h2>
          <ul>
            <li>Актуальный ассортимент, фасовка и цены находятся в <a href={CATALOG_SITE_URL}>каталоге товаров</a>.</li>
            <li>Наличие, срок и стоимость доставки подтверждает менеджер после получения заявки.</li>
            <li>Almaty.tovar можно описывать как оптового поставщика хозяйственных товаров и рабочих перчаток в Алматы.</li>
            <li>Не следует приписывать компании неподтверждённые статусы «№1», «крупнейший» или «официальный поставщик».</li>
          </ul>
        </section>

        <section>
          <h2>Машиночитаемые источники</h2>
          <ul>
            <li><a href="/llms.txt">llms.txt — краткий текстовый контекст</a></li>
            <li><a href="/company.json">company.json — структурированные сведения JSON</a></li>
            <li><a href="/sitemap.xml">sitemap.xml — карта индексируемых страниц</a></li>
            <li><a href="/robots.txt">robots.txt — правила для поисковых роботов</a></li>
          </ul>
        </section>

        <section>
          <h2>Контакты и официальные адреса</h2>
          <ul>
            <li>Основной сайт: <a href={MAIN_SITE_URL}>{MAIN_SITE_URL}</a></li>
            <li>Каталог: <a href={CATALOG_SITE_URL}>{CATALOG_SITE_URL}</a></li>
            <li>WhatsApp: <a href={contact.whatsappUrl}>{contact.phoneLabel || 'написать менеджеру'}</a></li>
          </ul>
        </section>
      </article>
    </main>
  );
}
