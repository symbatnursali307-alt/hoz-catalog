import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, ImageOff, MessageCircle, PackageCheck, ShoppingBag } from 'lucide-react';
import { parseCartSnapshots, parseOrderAccessKey } from '@/lib/cart-submission';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Заказ — Almaty.tovar',
  description: 'Приватная страница заказа с фотографиями товаров.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

function formatOrderDate(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Almaty',
  }).format(value);
}

function characteristicLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
    .slice(0, 6)
    .map(([key, item]) => `${key}: ${String(item)}`);
}

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<{ accessKey: string }>;
}) {
  const { accessKey } = await params;
  const access = parseOrderAccessKey(accessKey);
  if (!access) notFound();

  const order = await prisma.cartSubmission.findFirst({
    where: access,
    include: { manager: true },
  });
  if (!order) notFound();

  const items = parseCartSnapshots(order.items);
  if (!items.length) notFound();
  const packages = items.reduce((sum, item) => sum + item.packageQuantity, 0);
  const managerName = order.manager?.name || order.managerNameSnapshot || 'менеджером';
  const managerPhone = order.manager?.whatsappPhone || order.managerPhoneSnapshot || '';
  const managerMessage = encodeURIComponent(`Здравствуйте! Хочу уточнить информацию по заказу №${order.orderNumber}.`);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3 no-underline">
            <img src="/company-logo-original.jpg" alt="Almaty.tovar" className="h-11 w-11 rounded-full object-contain" />
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-slate-950">Almaty.tovar</div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Каталог хозтоваров</div>
            </div>
          </Link>
          <Link href="/" className="shrink-0 text-sm font-bold text-teal-700 no-underline hover:text-teal-900">
            В каталог
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-teal-300">Сохранённый заказ</div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Заказ №{order.orderNumber}</h1>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <CalendarDays size={17} /> {formatOrderDate(order.createdAt)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-2xl font-black">{items.length}</div>
                <div className="text-xs text-slate-300">позиций</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-2xl font-black">{packages}</div>
                <div className="text-xs text-slate-300">упаковок</div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-3 flex items-center gap-2 px-1">
          <ShoppingBag size={20} className="text-teal-700" />
          <h2 className="text-xl font-black">Товары в заказе</h2>
        </div>

        <section className="grid gap-3">
          {items.map((item, index) => {
            const characteristics = characteristicLines(item.characteristics);
            return (
              <article key={`${item.productId}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5 sm:p-5">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : (
                      <ImageOff size={30} className="text-slate-300" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-teal-700">
                      Позиция {index + 1}{item.sku ? ` · Артикул ${item.sku}` : ''}
                    </div>
                    <h3 className="break-words text-[15px] font-black leading-snug sm:text-lg">{item.name}</h3>
                    {item.brand && <div className="mt-1 text-xs font-bold text-slate-500">Бренд: {item.brand}</div>}
                    {characteristics.length > 0 && (
                      <div className="mt-2 hidden text-xs leading-relaxed text-slate-500 sm:block">
                        {characteristics.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-sm sm:grid-cols-4">
                  <div className="bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Цена с НДС</div>
                    <div className="mt-0.5 font-black">{formatPrice(item.priceWithVat)} / {item.unitName}</div>
                  </div>
                  <div className="bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Фасовка</div>
                    <div className="mt-0.5 font-black">{item.packageType}, {item.unitsPerPackage} {item.packageUnit}</div>
                  </div>
                  <div className="bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Количество</div>
                    <div className="mt-0.5 font-black">{item.packageQuantity} уп.</div>
                  </div>
                  <div className="bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Сумма</div>
                    <div className="mt-0.5 font-black text-teal-800">{formatPrice(item.lineTotal)}</div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-5 rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><PackageCheck size={18} /> Итого с НДС</div>
              <div className="mt-1 text-3xl font-black text-slate-950">{formatPrice(order.totalAmount)}</div>
            </div>
            <div className="text-right text-xs text-slate-500">{items.length} поз.<br />{packages} уп.</div>
          </div>

          {managerPhone && (
            <a
              href={`https://wa.me/${managerPhone}?text=${managerMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-center font-black text-white no-underline hover:bg-teal-700"
            >
              <MessageCircle size={21} /> Написать менеджеру {managerName}
            </a>
          )}
        </section>

        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
          Эта приватная страница доступна только по защищённой ссылке. Наличие и окончательные условия поставки подтвердит менеджер.
        </p>
      </div>
    </main>
  );
}
