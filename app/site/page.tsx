import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Box,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileCheck2,
  Grid2X2,
  Hand,
  Headphones,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  UsersRound,
  Warehouse,
  X,
} from 'lucide-react';
import { SeoJsonLd } from '@/components/site/SeoJsonLd';
import { SiteShell } from '@/components/site/SiteChrome';
import {
  CATALOG_SITE_URL,
  faqItems,
  featuredCategorySlugs,
  MAIN_SITE_URL,
  marketingCategories,
} from '@/lib/site-content';
import { getSiteData, type SiteProduct } from '@/lib/site-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Хозяйственные товары оптом в Алматы с НДС | Almaty.tovar',
  description: 'Оптовый каталог рабочих перчаток, пакетов, упаковки и хозяйственных товаров для бизнеса в Алматы. Цены с НДС, заказ упаковками через каталог.',
  alternates: { canonical: MAIN_SITE_URL },
  openGraph: {
    type: 'website',
    locale: 'ru_KZ',
    url: MAIN_SITE_URL,
    siteName: 'Almaty.tovar',
    title: 'Хозяйственные товары оптом в Алматы с НДС',
    description: 'Каталог для юридических лиц и ИП: актуальные цены, фасовка и заказ через WhatsApp.',
    images: [{ url: `${MAIN_SITE_URL}/company-logo-original.jpg`, width: 1254, height: 1254, alt: 'Almaty.tovar' }],
  },
};

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

function packagingLabel(product: SiteProduct) {
  if (!product.unitsPerPackage) return 'Фасовка указана в каталоге';
  const container = (product.packageType || '').toLowerCase();
  const prefixes: Record<string, string> = {
    'мешок': 'В мешке',
    'коробка': 'В коробке',
    'пачка': 'В пачке',
    'тюк': 'В тюке',
    'упаковка': 'В упаковке',
  };
  return `${prefixes[container] || 'В упаковке'}: ${product.unitsPerPackage} ${product.unit}`;
}

function ProductCard({ product }: { product: SiteProduct }) {
  const packagePrice = product.unitsPerPackage ? Math.ceil(product.price * product.unitsPerPackage) : null;
  return (
    <article className="site-product-card">
      <div className="site-product-card__badges"><span>Цена с НДС</span>{product.unitsPerPackage ? <span>Опт. упаковка</span> : null}</div>
      <a href={`${CATALOG_SITE_URL}/?product=${encodeURIComponent(product.slug)}`} className="site-product-card__image" aria-label={`Открыть ${product.name} в каталоге`}>
        {/* Product photos live in the recovered shared upload storage on the VPS. */}
        <img src={product.image} alt={product.name} loading="lazy" />
      </a>
      <div className="site-product-card__body">
        <h3>{product.name}</h3>
        <p>{packagingLabel(product)}</p>
        <div className="site-product-card__price">
          <strong>{money.format(product.price)} ₸</strong><span>/ {product.unit}</span>
        </div>
        {packagePrice ? <small>Упаковка: {money.format(packagePrice)} ₸</small> : null}
        <a className="site-product-card__button" href={`${CATALOG_SITE_URL}/?product=${encodeURIComponent(product.slug)}`}>
          Открыть в каталоге <ChevronRight size={16} />
        </a>
      </div>
    </article>
  );
}

export default async function MarketingHomePage() {
  const { products, contact } = await getSiteData();
  const categories = featuredCategorySlugs.flatMap((slug) => {
    const category = marketingCategories.find((item) => item.slug === slug);
    return category ? [category] : [];
  });

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': ['Organization', 'WholesaleStore'],
      name: 'Almaty.tovar',
      url: MAIN_SITE_URL,
      logo: `${MAIN_SITE_URL}/company-logo-original.jpg`,
      description: 'Оптовый поставщик рабочих перчаток и хозяйственных товаров для бизнеса в Алматы.',
      areaServed: [{ '@type': 'City', name: 'Алматы' }, { '@type': 'Country', name: 'Казахстан' }],
      address: { '@type': 'PostalAddress', addressLocality: 'Алматы', addressCountry: 'KZ' },
      ...(contact.phone ? { telephone: `+${contact.phone}`, contactPoint: { '@type': 'ContactPoint', telephone: `+${contact.phone}`, contactType: 'sales', availableLanguage: ['ru', 'kk'] } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <SiteShell contact={contact}>
      <SeoJsonLd data={structuredData} />
      <main>
        <section className="site-hero">
          <div className="site-container site-hero__grid">
            <div className="site-hero__copy">
              <span className="site-eyebrow"><BadgeCheck size={17} /> Оптовые поставки для бизнеса</span>
              <h1>Хозяйственные товары оптом в Алматы <em>с НДС</em></h1>
              <p>Рабочие перчатки, пакеты, упаковка, инвентарь и другие товары для бизнеса — с понятной фасовкой и актуальными ценами.</p>
              <div className="site-hero__actions">
                <a className="site-button site-button--lg" href={CATALOG_SITE_URL}><Grid2X2 size={21} /> Перейти в каталог</a>
                <a className="site-button site-button--outline site-button--lg" href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={21} /> Написать в WhatsApp</a>
              </div>
              <div className="site-hero__micro">
                <span><Check /> Цены с НДС</span>
                <span><Check /> Оптовые упаковки</span>
                <span><Check /> Документы для бизнеса</span>
              </div>
            </div>
            <div className="site-hero__visual" aria-label="Примеры товаров из каталога">
              <div className="site-warehouse-lines" />
              <img className="hero-product hero-product--glove" src="/uploads/products/perchatki/hb-perchatki-40-tg-wa1-0001.webp" alt="Рабочие перчатки" fetchPriority="high" />
              <img className="hero-product hero-product--bags" src="/uploads/products/pakety/majki-s-ruchkami-400gr-430-tg-wa1-0144.webp" alt="Пакеты для бизнеса" fetchPriority="high" />
              <img className="hero-product hero-product--roll" src="/uploads/products/upakovka/plenka-strejch-plenki-ot-5-wa1-0142.webp" alt="Упаковочные материалы" fetchPriority="high" />
              <div className="site-hero__badge site-hero__badge--vat"><FileCheck2 /> <span><strong>С НДС</strong><small>официально</small></span></div>
              <div className="site-hero__badge site-hero__badge--pack"><PackageCheck /> <span><strong>Фасовка</strong><small>видна до заказа</small></span></div>
              <div className="site-hero__pack-card"><span>Выберите упаковку</span><div><b>1 мешок</b><b>2 мешка</b><b>3 мешка</b></div></div>
            </div>
          </div>
          <div className="site-container site-advantages">
            <div><ShieldCheck /><span><strong>С НДС</strong><small>для юридических лиц и ИП</small></span></div>
            <div><Box /><span><strong>Оптовые фасовки</strong><small>количество видно заранее</small></span></div>
            <div><Search /><span><strong>Удобный подбор</strong><small>поиск и категории</small></span></div>
            <div><ClipboardCheck /><span><strong>Готовая заявка</strong><small>отправка менеджеру</small></span></div>
          </div>
        </section>

        <section className="site-section site-section--white" id="categories">
          <div className="site-container">
            <div className="site-section-heading">
              <div><span className="site-kicker">Ассортимент</span><h2>Категории товаров</h2></div>
              <Link href="/categories">Смотреть все <ArrowRight size={18} /></Link>
            </div>
            <div className="site-category-grid">
              {categories.map((category, index) => (
                <Link className={`site-category-card site-category-card--${index + 1}`} href={`/categories/${category.slug}`} key={category.slug}>
                  <span className="site-category-card__number">0{index + 1}</span>
                  <div className="site-category-card__media">
                    {category.image ? <img src={category.image} alt="" loading="lazy" /> : index === 5 ? <Sparkles /> : <Box />}
                  </div>
                  <div className="site-category-card__body"><h3>{category.shortTitle}</h3><span>Подробнее <ChevronRight size={15} /></span></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section site-process">
          <div className="site-container">
            <div className="site-section-heading site-section-heading--center"><div><span className="site-kicker">Простой процесс</span><h2>Как сделать заказ</h2><p>От выбора товара до готовой заявки — без ручного переписывания позиций.</p></div></div>
            <div className="site-process__steps">
              {[
                [Grid2X2, 'Выберите категорию', 'Откройте нужный раздел каталога'],
                [PackageCheck, 'Выберите фасовку', 'Проверьте количество в упаковке'],
                [ShoppingCart, 'Добавьте в корзину', 'Укажите число упаковок'],
                [MessageCircle, 'Отправьте в WhatsApp', 'Менеджер получит готовый список'],
                [FileCheck2, 'Получите документы', 'После подтверждения заказа'],
              ].map(([Icon, title, text], index) => {
                const StepIcon = Icon as typeof Grid2X2;
                return <div key={String(title)} className="site-process__step"><span className="site-process__index">{index + 1}</span><div className="site-process__icon"><StepIcon /></div><h3>{String(title)}</h3><p>{String(text)}</p>{index < 4 ? <ArrowRight className="site-process__arrow" /> : null}</div>;
              })}
            </div>
          </div>
        </section>

        <section className="site-section site-section--white">
          <div className="site-container">
            <div className="site-section-heading"><div><span className="site-kicker">Для регулярных закупок</span><h2>Кому подходит оптовый каталог</h2></div></div>
            <div className="site-audience-grid">
              {[
                [Building2, 'Офисы и организации', 'Снабжение хозяйственными расходниками с документами.'],
                [Warehouse, 'Склады и производства', 'Перчатки, упаковка и инвентарь оптовыми партиями.'],
                [Store, 'Магазины и торговые точки', 'Пакеты и товары ежедневного спроса для бизнеса.'],
                [UsersRound, 'Клининг и подрядчики', 'Комплектация расходных материалов под объём работ.'],
              ].map(([Icon, title, text]) => {
                const AudienceIcon = Icon as typeof Building2;
                return <article key={String(title)}><AudienceIcon /><h3>{String(title)}</h3><p>{String(text)}</p></article>;
              })}
            </div>
          </div>
        </section>

        <section className="site-section site-compare">
          <div className="site-container">
            <div className="site-section-heading"><div><span className="site-kicker">Заказ без путаницы</span><h2>Почему удобнее заказывать через каталог</h2></div></div>
            <div className="site-compare__panel">
              <div className="site-compare__side site-compare__side--old">
                <h3>Заказ по сообщениям и прайсам</h3>
                {['Поиск товаров в длинной переписке', 'Неясная фасовка и ручной пересчёт', 'Риск пропустить позицию', 'Долгое согласование списка'].map((item) => <p key={item}><X /> {item}</p>)}
              </div>
              <div className="site-compare__middle"><span>VS</span><MessageCircle /></div>
              <div className="site-compare__side site-compare__side--new">
                <h3>Заказ в каталоге Almaty.tovar</h3>
                {['Цена за единицу и упаковку с НДС', 'Фасовка видна в карточке товара', 'Корзина считает итог автоматически', 'Готовая заявка уходит в WhatsApp'].map((item) => <p key={item}><Check /> {item}</p>)}
              </div>
            </div>
          </div>
        </section>

        <section className="site-section site-section--white">
          <div className="site-container">
            <div className="site-section-heading">
              <div><span className="site-kicker">Из действующего каталога</span><h2>Популярные позиции</h2></div>
              <a href={CATALOG_SITE_URL}>Все товары <ArrowRight size={18} /></a>
            </div>
            <div className="site-products-grid">{products.slice(0, 5).map((product) => <ProductCard product={product} key={product.slug} />)}</div>
          </div>
        </section>

        <section className="site-section site-business">
          <div className="site-container site-business__panel">
            <div className="site-business__title"><span>Работаем с бизнесом</span><h2>Прозрачные условия закупки</h2><p>Данные по товару проверяются до подтверждения заказа.</p></div>
            <div className="site-business__features">
              <div><BadgeCheck /><strong>Цены с НДС</strong><span>видны в каталоге</span></div>
              <div><FileCheck2 /><strong>Документы</strong><span>по подтверждённому заказу</span></div>
              <div><Banknote /><strong>Понятный расчёт</strong><span>за единицу и упаковку</span></div>
              <div><Headphones /><strong>Менеджер</strong><span>проверит заявку</span></div>
            </div>
          </div>
        </section>

        <section className="site-section site-section--white site-faq">
          <div className="site-container site-faq__grid">
            <div><span className="site-kicker">FAQ</span><h2>Часто задаваемые вопросы</h2><p>Коротко о заказе, фасовке, документах и доставке.</p><a className="site-button site-button--outline" href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={19} /> Задать вопрос</a></div>
            <div className="site-faq__items">
              {faqItems.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="site-final-cta">
          <div className="site-container site-final-cta__inner">
            <div><span className="site-kicker site-kicker--light">Готовы собрать заказ?</span><h2>Откройте каталог и выберите нужные упаковки</h2><p>Корзина сформирует понятную заявку для менеджера в WhatsApp.</p></div>
            <div><a className="site-button site-button--light site-button--lg" href={CATALOG_SITE_URL}><Grid2X2 size={21} /> Перейти в каталог</a><a className="site-button site-button--ghost site-button--lg" href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={21} /> WhatsApp</a></div>
          </div>
        </section>
      </main>
      <div className="site-mobile-actions">
        <a href={`${CATALOG_SITE_URL}/?install=1`} aria-label="Установить каталог"><Download size={19} /></a>
        <a href={CATALOG_SITE_URL}><Grid2X2 size={19} /> Каталог</a>
        <a href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={19} /> WhatsApp</a>
      </div>
    </SiteShell>
  );
}
