import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { resolvePriceWithVat } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, city, phone, cartItems, utm } = body;

    // 1-4. Проверка обязательных полей
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Имя обязательно' }, { status: 400 });
    }
    if (!city || typeof city !== 'string' || !city.trim()) {
      return NextResponse.json({ success: false, error: 'Город обязателен' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ success: false, error: 'Телефон обязателен' }, { status: 400 });
    }
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Необходимо выбрать хотя бы один товар' }, { status: 400 });
    }

    const productIds = cartItems.map((i: any) => i.id);

    // 5. Найти выбранные товары в базе
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      }
    });

    if (products.length === 0) {
      return NextResponse.json({ success: false, error: 'Выбранные товары не найдены' }, { status: 400 });
    }

    // Создаем запись клиента и привязываем товары в транзакции
    const client = await prisma.$transaction(async (tx) => {
      // 6. Создать Client
      const newClient = await tx.client.create({
        data: {
          name: name.trim(),
          city: city.trim(),
          phone: phone.trim(),
          source: utm?.source || null,
          utmSource: utm?.source || null,
          utmMedium: utm?.medium || null,
          utmCampaign: utm?.campaign || null,
          utmContent: utm?.content || null,
          utmTerm: utm?.term || null,
        }
      });

      // 7-8. Создать ClientSelectedProduct для каждого выбранного товара
      const selectedProductsData = products.map((product) => ({
        clientId: newClient.id,
        productId: product.id,
        productNameSnapshot: product.name,
      }));

      await tx.clientSelectedProduct.createMany({
        data: selectedProductsData
      });

      return newClient;
    });

    // 9. Сформировать текст для WhatsApp
    const lines: string[] = [];
    lines.push('Здравствуйте, хочу заказать:');
    lines.push('');
    
    let totalSumNoVat = 0;
    let totalSumWithVat = 0;

    cartItems.forEach((item: any, i: number) => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        const qty = item.qty || 1;
        const priceNoVat = product.priceWithoutVat || 0;
        const priceWithVat = resolvePriceWithVat(product.priceWithVat, priceNoVat);
        const pkgQty = product.packageQuantity || 1;
        
        const lineTotalNoVat = priceNoVat * pkgQty * qty;
        const lineTotalWithVat = priceWithVat * pkgQty * qty;
        
        totalSumNoVat += lineTotalNoVat;
        totalSumWithVat += lineTotalWithVat;

        lines.push(`${i + 1}. ${product.name}`);
        lines.push(`Цена без НДС: ${priceNoVat.toLocaleString('ru-RU')} ₸ / ${product.unit || 'шт'}`);
        lines.push(`Цена с НДС: ${priceWithVat.toLocaleString('ru-RU')} ₸ / ${product.unit || 'шт'}`);
        
        if (product.packageType && product.packageQuantity) {
          lines.push(`Фасовка: ${product.packageType} — ${product.packageQuantity} ${product.packageUnit || product.unit}`);
        }
        
        lines.push(`Количество: ${qty} ${product.packageType || 'шт'}`);
        
        if (lineTotalNoVat > 0) {
          lines.push(`Сумма без НДС: ${lineTotalNoVat.toLocaleString('ru-RU')} ₸`);
          lines.push(`Сумма с НДС: ${lineTotalWithVat.toLocaleString('ru-RU')} ₸`);
        }
        lines.push('');
      }
    });
    
    if (totalSumNoVat > 0) {
      lines.push(`Итого без НДС: ${totalSumNoVat.toLocaleString('ru-RU')} ₸`);
      lines.push(`Итого с НДС: ${totalSumWithVat.toLocaleString('ru-RU')} ₸`);
      lines.push('');
    }
    
    lines.push(`Имя: ${client.name}`);
    lines.push(`Город: ${client.city}`);
    lines.push(`Контактный номер: ${client.phone}`);
    lines.push('');
    lines.push('Отправлено из каталога.');

    // 10. Закодировать текст
    const encodedMessage = encodeURIComponent(lines.join('\n'));
    
    const whatsappPhone = process.env.WHATSAPP_PHONE || '';
    if (!whatsappPhone) {
      console.warn('WHATSAPP_PHONE environment variable is not set');
    }

    // 11. Вернуть whatsappUrl
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodedMessage}`;

    return NextResponse.json({
      success: true,
      clientId: client.id,
      whatsappUrl
    });

  } catch (error) {
    console.error('Failed to process client request:', error);
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
