import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Box } from 'lucide-react';
import { PageHero, InlineCta } from '@/components/site/InternalPage';
import { SeoJsonLd } from '@/components/site/SeoJsonLd';
import { SiteShell } from '@/components/site/SiteChrome';
import { MAIN_SITE_URL, marketingCategories } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Категории хозяйственных товаров оптом | Almaty.tovar',
  description: 'Категории оптового каталога Almaty.tovar: рабочие перчатки, пакеты, упаковка, хозяйственный инвентарь, спецодежда и другие товары для бизнеса.',
  alternates: { canonical: `${MAIN_SITE_URL}/categories` },
};

export default async function CategoriesPage() {
  const { contact } = await getSiteData();
  return (
    <SiteShell contact={contact}>
      <SeoJsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: MAIN_SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Категории', item: `${MAIN_SITE_URL}/categories` },
      ] }} />
      <main>
        <PageHero eyebrow="Ассортимент" title="Категории хозяйственных товаров" lead="Выберите направление закупки. На каждой странице — краткая информация, а актуальные позиции, цены и фасовки находятся в действующем каталоге." items={[{ label: 'Категории' }]} contact={contact} />
        <section className="site-content-section site-content-section--soft">
          <div className="site-container site-all-categories">
            {marketingCategories.map((category) => (
              <Link className="site-all-category" href={`/categories/${category.slug}`} key={category.slug}>
                <div className="site-all-category__image">{category.image ? <img src={category.image} alt="" loading="lazy" /> : <Box />}</div>
                <h2>{category.shortTitle}</h2>
                <p>{category.description}</p>
                <span>Подробнее <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>
        <InlineCta contact={contact} />
      </main>
    </SiteShell>
  );
}
