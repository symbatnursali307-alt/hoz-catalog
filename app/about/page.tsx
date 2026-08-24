import type { Metadata } from 'next';
import { StandardInfoPage } from '@/components/site/StandardInfoPage';
import { MAIN_SITE_URL } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'О компании Almaty.tovar | Оптовые хозтовары в Алматы',
  description: 'Almaty.tovar — оптовый каталог рабочих перчаток и хозяйственных товаров для бизнеса в Алматы.',
  alternates: { canonical: `${MAIN_SITE_URL}/about` },
};

export default async function AboutPage() {
  const { contact } = await getSiteData();
  return <StandardInfoPage
    slug="about"
    eyebrow="Almaty.tovar"
    title="О компании"
    lead="Мы развиваем удобный B2B-каталог хозяйственных товаров, чтобы закупщик видел не только название, но и цену с НДС, фасовку и итог упаковки."
    sectionTitle="Каталог, ориентированный на закупщика"
    paragraphs={[
      'Almaty.tovar работает с оптовыми заказами для компаний и предпринимателей в Алматы. Основные направления — рабочие перчатки, пакеты, упаковка, инвентарь и сопутствующие хозяйственные товары.',
      'Данные каталога восстанавливаются и приводятся к единому стандарту: некорректные или неполные карточки направляются на проверку в админ-панели, а не маскируются на витрине.',
    ]}
    bullets={['Цены с НДС в целых тенге', 'Фасовка на уровне карточки товара', 'Отдельная очередь проверки качества данных', 'Корзина и заявка ответственному менеджеру']}
    cards={[
      { icon: 'badge', title: 'Для бизнеса', text: 'Интерфейс рассчитан на повторные оптовые закупки.' },
      { icon: 'shield', title: 'Контроль данных', text: 'Проблемные поля помечаются для проверки в админке.' },
      { icon: 'calculator', title: 'Прозрачный расчёт', text: 'Стоимость упаковки считается по реальной фасовке.' },
      { icon: 'message', title: 'Живой менеджер', text: 'Финальная проверка проходит перед оформлением.' },
    ]}
    contact={contact}
  />;
}
