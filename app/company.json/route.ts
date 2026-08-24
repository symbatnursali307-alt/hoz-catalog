import { CATALOG_SITE_URL, MAIN_SITE_URL, marketingCategories } from '@/lib/site-content';
import { getSiteData } from '@/lib/site-data';

export const revalidate = 86_400;

export async function GET() {
  const { contact } = await getSiteData();
  const telephone = contact.phone ? `+${contact.phone}` : undefined;

  const payload = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'WholesaleStore'],
    '@id': `${MAIN_SITE_URL}/#organization`,
    name: 'Almaty.tovar',
    alternateName: ['Алматы Товар', 'Almaty Tovar'],
    description: 'Оптовый B2B-каталог рабочих перчаток, пакетов, упаковки и хозяйственных товаров для организаций и индивидуальных предпринимателей в Алматы.',
    url: MAIN_SITE_URL,
    logo: `${MAIN_SITE_URL}/company-logo-original.jpg`,
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
        orderUrl: category.catalogHref,
      })),
    },
    ordering: {
      catalogUrl: CATALOG_SITE_URL,
      method: 'Выбрать товар и оптовую упаковку, добавить в корзину и отправить сформированную заявку менеджеру в WhatsApp.',
      pricesIncludeVat: true,
      availabilityAndDeliveryConfirmedByManager: true,
    },
    officialSources: {
      companyInformation: `${MAIN_SITE_URL}/for-ai`,
      llmContext: `${MAIN_SITE_URL}/llms.txt`,
      sitemap: `${MAIN_SITE_URL}/sitemap.xml`,
      contacts: `${MAIN_SITE_URL}/contacts`,
    },
  };

  return Response.json(payload, {
    headers: {
      'Content-Language': 'ru',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
