import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, CheckCircle2, FileCheck2, PackageCheck, SearchCheck } from 'lucide-react';
import { InlineCta, PageHero } from '@/components/site/InternalPage';
import { SeoJsonLd } from '@/components/site/SeoJsonLd';
import { SiteShell } from '@/components/site/SiteChrome';
import { getMarketingCategory, MAIN_SITE_URL, marketingCategories } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

type CategoryPageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return marketingCategories.map((category) => ({ slug: category.slug }));
}
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getMarketingCategory(slug);
  if (!category) return {};
  const canonical = `${MAIN_SITE_URL}/categories/${category.slug}`;
  return {
    title: `${category.title} | Almaty.tovar`,
    description: category.description,
    alternates: { canonical },
    openGraph: { type: 'website', locale: 'ru_KZ', url: canonical, title: category.title, description: category.description },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getMarketingCategory(slug);
  if (!category) notFound();
  const { contact } = await getSiteData();
  const canonical = `${MAIN_SITE_URL}/categories/${category.slug}`;
  return (
    <SiteShell contact={contact}>
      <SeoJsonLd data={{
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: MAIN_SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Категории', item: `${MAIN_SITE_URL}/categories` },
          { '@type': 'ListItem', position: 3, name: category.shortTitle, item: canonical },
        ],
      }} />
      <main>
        <PageHero eyebrow="Оптовая категория" title={category.title} lead={category.intro} items={[{ label: 'Категории', href: '/categories' }, { label: category.shortTitle }]} contact={contact} catalogHref={category.catalogHref} />
        <section className="site-content-section">
          <div className="site-container site-category-detail">
            <div className="site-content-copy">
              <h2>Что важно при оптовом заказе</h2>
              <p>{category.description} Каталог показывает только действующие карточки, а итоговую доступность и комплектацию подтверждает менеджер.</p>
              <ul>{category.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              <h3>Как формируется стоимость</h3>
              <p>Цена единицы умножается на количество единиц в заводской упаковке. Например, если в мешке 780 пар, стоимость мешка рассчитывается как цена одной пары × 780. Все дробные значения цены на сайте округляются вверх до целого тенге.</p>
              <h3>Как заказать</h3>
              <p>Откройте каталог, выберите позицию и количество упаковок, добавьте товар в корзину и отправьте сформированную заявку в WhatsApp. Менеджер проверит наличие и продолжит оформление.</p>
              <div className="site-note">Для групп, где карточки ещё проходят проверку или ассортимент не опубликован, мы предлагаем запросить актуальные позиции у менеджера. Так на сайте не появляются неподтверждённые обещания.</div>
            </div>
            <aside className="site-category-aside">
              <div className="site-category-aside__image">{category.image ? <img src={category.image} alt={category.shortTitle} /> : <Box />}</div>
              <h2>{category.shortTitle}</h2>
              <p>Откройте отфильтрованный каталог или поиск по этой товарной группе.</p>
              <a className="site-button" href={category.catalogHref}><SearchCheck size={18} /> Смотреть товары</a>
            </aside>
          </div>
        </section>
        <section className="site-content-section site-content-section--soft">
          <div className="site-container site-info-cards">
            <article className="site-info-card"><PackageCheck /><h3>Фасовка до заказа</h3><p>Количество единиц в мешке, коробке, пачке или тюке показывается в карточке.</p></article>
            <article className="site-info-card"><FileCheck2 /><h3>Цены с НДС</h3><p>На витрине используются целые цены с НДС, удобные для предварительного расчёта.</p></article>
            <article className="site-info-card"><CheckCircle2 /><h3>Проверка менеджером</h3><p>Перед оформлением менеджер подтверждает актуальность товара и заказа.</p></article>
            <article className="site-info-card"><SearchCheck /><h3>Быстрый поиск</h3><p>Категории и поиск помогают быстро собрать список без ручной переписки.</p></article>
          </div>
        </section>
        <InlineCta contact={contact} title={`Перейдите в каталог: ${category.shortTitle.toLowerCase()}`} />
      </main>
    </SiteShell>
  );
}
