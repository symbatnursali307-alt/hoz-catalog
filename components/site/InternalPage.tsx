import Link from 'next/link';
import { ChevronRight, Grid2X2, MessageCircle } from 'lucide-react';
import { CATALOG_SITE_URL } from '@/lib/site-content';
import type { SiteContact } from '@/lib/site-data';

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="site-breadcrumbs" aria-label="Хлебные крошки">
      <Link href="/">Главная</Link>
      {items.map((item) => (
        <span key={item.label}>
          <ChevronRight size={13} />
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
export function PageHero({ eyebrow, title, lead, items, contact, catalogHref = CATALOG_SITE_URL }: {
  eyebrow: string;
  title: string;
  lead: string;
  items: Array<{ label: string; href?: string }>;
  contact: SiteContact;
  catalogHref?: string;
}) {
  return (
    <section className="site-page-hero">
      <div className="site-container">
        <Breadcrumbs items={items} />
        <span className="site-kicker" style={{ marginTop: 26 }}>{eyebrow}</span>
        <h1>{title}</h1>
        <p className="site-page-hero__lead">{lead}</p>
        <div className="site-page-hero__actions">
          <a className="site-button" href={catalogHref}><Grid2X2 size={19} /> Открыть каталог</a>
          <a className="site-button site-button--outline" href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={19} /> Написать менеджеру</a>
        </div>
      </div>
    </section>
  );
}

export function InlineCta({ contact, title = 'Соберите оптовый заказ в каталоге' }: { contact: SiteContact; title?: string }) {
  return (
    <section className="site-final-cta">
      <div className="site-container site-final-cta__inner">
        <div><span className="site-kicker site-kicker--light">Следующий шаг</span><h2>{title}</h2><p>Проверьте цены и фасовки, затем отправьте готовую корзину в WhatsApp.</p></div>
        <div><a className="site-button site-button--light" href={CATALOG_SITE_URL}><Grid2X2 size={19} /> Каталог</a><a className="site-button site-button--ghost" href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={19} /> WhatsApp</a></div>
      </div>
    </section>
  );
}
