import type { Metadata } from 'next';
import { StandardInfoPage } from '@/components/site/StandardInfoPage';
import { MAIN_SITE_URL } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Доставка и оплата оптового заказа | Almaty.tovar',
  description: 'Как согласовать доставку и оплату оптового заказа хозяйственных товаров в Almaty.tovar.',
  alternates: { canonical: `${MAIN_SITE_URL}/delivery` },
};

export default async function DeliveryPage() {
  const { contact } = await getSiteData();
  return <StandardInfoPage
    slug="delivery"
    eyebrow="Условия заказа"
    title="Доставка и оплата"
    lead="Способ, срок и стоимость доставки зависят от состава, объёма и адреса заказа. Точные условия менеджер подтверждает после получения корзины."
    sectionTitle="Как согласовываются условия"
    paragraphs={[
      'Сначала соберите товары и нужное количество упаковок в каталоге. Так менеджер сразу увидит полный объём и сможет проверить доступность позиций.',
      'После проверки заявки менеджер согласует с вами способ получения, стоимость доставки и порядок оплаты. До подтверждения заказа сайт не обещает фиксированный срок или бесплатную доставку.',
    ]}
    bullets={['Предварительная проверка состава заказа', 'Согласование адреса и способа получения', 'Подтверждение суммы до оплаты', 'Документы по согласованному заказу']}
    cards={[
      { icon: 'package', title: 'Соберите корзину', text: 'Количество считается оптовыми упаковками.' },
      { icon: 'search', title: 'Проверка наличия', text: 'Менеджер сверяет позиции перед подтверждением.' },
      { icon: 'truck', title: 'Согласование доставки', text: 'Условия зависят от адреса и объёма заказа.' },
      { icon: 'file', title: 'Оплата и документы', text: 'Порядок оплаты фиксируется после проверки заявки.' },
    ]}
    contact={contact}
    note="Если доставка нужна к определённой дате, укажите это менеджеру в сообщении — он подтвердит возможность отдельно."
  />;
}
