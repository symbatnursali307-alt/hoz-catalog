import { BadgeCheck, Boxes, Calculator, FileCheck2, MapPin, MessageCircle, PackageCheck, SearchCheck, ShieldCheck, Truck } from 'lucide-react';
import { InlineCta, PageHero } from '@/components/site/InternalPage';
import { SeoJsonLd } from '@/components/site/SeoJsonLd';
import { SiteShell } from '@/components/site/SiteChrome';
import { MAIN_SITE_URL } from '@/lib/site-content';
import type { SiteContact } from '@/lib/site-data';

const iconMap = { boxes: Boxes, package: PackageCheck, file: FileCheck2, calculator: Calculator, search: SearchCheck, shield: ShieldCheck, truck: Truck, location: MapPin, message: MessageCircle, badge: BadgeCheck };

export type InfoPageCard = { icon: keyof typeof iconMap; title: string; text: string };

export function StandardInfoPage({
  slug,
  eyebrow,
  title,
  lead,
  sectionTitle,
  paragraphs,
  bullets,
  cards,
  contact,
  note,
}: {
  slug: string;
  eyebrow: string;
  title: string;
  lead: string;
  sectionTitle: string;
  paragraphs: string[];
  bullets: string[];
  cards: InfoPageCard[];
  contact: SiteContact;
  note?: string;
}) {
  const canonical = `${MAIN_SITE_URL}/${slug}`;
  return (
    <SiteShell contact={contact}>
      <SeoJsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: MAIN_SITE_URL },
        { '@type': 'ListItem', position: 2, name: title, item: canonical },
      ] }} />
      <main>
        <PageHero eyebrow={eyebrow} title={title} lead={lead} items={[{ label: title }]} contact={contact} />
        <section className="site-content-section">
          <div className="site-container site-content-grid">
            <div className="site-content-copy">
              <h2>{sectionTitle}</h2>
              {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <ul>{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              {note ? <div className="site-note">{note}</div> : null}
            </div>
            <div className="site-info-cards">
              {cards.map((card) => {
                const Icon = iconMap[card.icon];
                return <article className="site-info-card" key={card.title}><Icon /><h3>{card.title}</h3><p>{card.text}</p></article>;
              })}
            </div>
          </div>
        </section>
        <InlineCta contact={contact} />
      </main>
    </SiteShell>
  );
}
