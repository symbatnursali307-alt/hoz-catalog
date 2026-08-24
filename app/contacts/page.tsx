import type { Metadata } from 'next';
import { StandardInfoPage } from '@/components/site/StandardInfoPage';
import { MAIN_SITE_URL } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Контакты Almaty.tovar | Алматы',
  description: 'Связаться с менеджером Almaty.tovar по оптовому заказу хозяйственных товаров в Алматы.',
  alternates: { canonical: `${MAIN_SITE_URL}/contacts` },
};

export default async function ContactsPage() {
  const { contact } = await getSiteData();
  return <StandardInfoPage
    slug="contacts"
    eyebrow="Связь с менеджером"
    title="Контакты Almaty.tovar"
    lead="Самый быстрый способ обсудить оптовый заказ — собрать корзину в каталоге и отправить её менеджеру в WhatsApp."
    sectionTitle="Как связаться"
    paragraphs={[
      contact.phoneLabel ? `Действующий номер WhatsApp: ${contact.phoneLabel}.` : 'Нажмите кнопку WhatsApp — каталог направит обращение действующему менеджеру.',
      'Компания работает в Алматы. Точный адрес получения, время встречи и условия доставки согласовываются с менеджером отдельно.',
    ]}
    bullets={['Город: Алматы, Казахстан', 'WhatsApp: действующий менеджер каталога', 'Реквизиты и документы — по подтверждённому заказу', 'Условия получения — по согласованию']}
    cards={[
      { icon: 'message', title: contact.phoneLabel || 'WhatsApp', text: 'Для заявки, проверки наличия и уточнения условий.' },
      { icon: 'location', title: 'Алматы', text: 'Точный адрес и способ получения согласуйте до поездки.' },
      { icon: 'file', title: 'Реквизиты', text: 'Предоставляются для оформления подтверждённого заказа.' },
      { icon: 'search', title: 'Перед обращением', text: 'Соберите корзину — так менеджер ответит быстрее и точнее.' },
    ]}
    contact={contact}
    note="Мы сознательно не публикуем неподтверждённый адрес или режим работы. Актуальные данные сообщит менеджер."
  />;
}
