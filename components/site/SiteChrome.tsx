import Image from 'next/image';
import Link from 'next/link';
import { Download, Grid2X2, Mail, MapPin, Menu, MessageCircle, X } from 'lucide-react';
import { CATALOG_SITE_URL, marketingCategories } from '@/lib/site-content';
import type { SiteContact } from '@/lib/site-data';

const navigation = [
  { href: '/categories', label: 'Категории' },
  { href: '/optom', label: 'Оптовым покупателям' },
  { href: '/delivery', label: 'Доставка и оплата' },
  { href: '/about', label: 'О компании' },
  { href: '/contacts', label: 'Контакты' },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="site-brand" aria-label="Almaty.tovar — главная">
      <Image src="/pwa-icon-192.png" alt="Логотип Almaty.tovar" width={compact ? 44 : 54} height={compact ? 44 : 54} priority />
      <span>
        <strong>Almaty.<em>tovar</em></strong>
        <small>ПЕРЧАТКИ · ХОЗТОВАРЫ</small>
      </span>
    </Link>
  );
}

export function SiteHeader({ contact }: { contact: SiteContact }) {
  return (
    <>
      <div className="site-topbar">
        <div className="site-container site-topbar__inner">
          <span><MapPin size={13} /> Алматы, Казахстан</span>
          <span className="site-topbar__note">Оптовый каталог для бизнеса · цены с НДС</span>
          <Link href="/delivery">Доставка и оплата</Link>
          <Link href="/contacts">Контакты</Link>
        </div>
      </div>
      <header className="site-header">
        <div className="site-container site-header__inner">
          <Brand />
          <nav className="site-nav" aria-label="Основная навигация">
            {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          </nav>
          <div className="site-header__actions">
            <a className="site-button site-button--outline site-button--sm" href={contact.whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              <span>{contact.phoneLabel || 'Написать в WhatsApp'}</span>
            </a>
            <a className="site-button site-button--sm" href={CATALOG_SITE_URL}>
              <Grid2X2 size={17} /> Каталог
            </a>
          </div>
          <details className="site-mobile-menu">
            <summary aria-label="Открыть меню"><Menu className="menu-open" /><X className="menu-close" /></summary>
            <div className="site-mobile-menu__panel">
              {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
              <a href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
              <a href={CATALOG_SITE_URL}><Grid2X2 size={18} /> Перейти в каталог</a>
              <a href={`${CATALOG_SITE_URL}/?install=1`}><Download size={18} /> Установить каталог</a>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ contact }: { contact: SiteContact }) {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__grid">
        <div className="site-footer__brand">
          <Brand compact />
          <p>Оптовый B2B-каталог хозяйственных товаров и рабочих перчаток в Алматы. Цены в каталоге указаны с НДС.</p>
        </div>
        <div>
          <h2>Каталог</h2>
          <Link href="/categories">Все категории</Link>
          {marketingCategories.slice(0, 5).map((category) => <Link key={category.slug} href={`/categories/${category.slug}`}>{category.shortTitle}</Link>)}
        </div>
        <div>
          <h2>Покупателям</h2>
          <Link href="/optom">Оптовым покупателям</Link>
          <Link href="/delivery">Доставка и оплата</Link>
          <Link href="/about">О компании</Link>
          <Link href="/contacts">Контакты</Link>
          <Link href="/for-ai">Информация для AI</Link>
        </div>
        <div>
          <h2>Связаться</h2>
          <span><MapPin size={16} /> Алматы, Казахстан</span>
          <a href={contact.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} /> {contact.phoneLabel || 'WhatsApp менеджера'}</a>
          <span><Mail size={16} /> Реквизиты — по запросу</span>
        </div>
      </div>
      <div className="site-container site-footer__bottom">
        <span>© {new Date().getFullYear()} Almaty.tovar</span>
        <span>Для юридических лиц и ИП · с НДС</span>
      </div>
    </footer>
  );
}

export function SiteShell({ children, contact }: { children: React.ReactNode; contact: SiteContact }) {
  return (
    <div className="marketing-site">
      <SiteHeader contact={contact} />
      {children}
      <SiteFooter contact={contact} />
    </div>
  );
}
