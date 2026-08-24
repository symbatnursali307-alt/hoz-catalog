export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-5">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm">
        <img src="/pwa-icon-192.png" alt="Логотип Алматы Товар" className="mx-auto h-20 w-20 rounded-2xl border border-gray-200 object-contain" />
        <h1 className="mt-5 text-2xl font-black">Нет подключения к интернету</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Каталог установлен. Подключитесь к интернету и повторите попытку, чтобы увидеть актуальные товары и цены.
        </p>
        <a href="/" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-green-600 px-5 font-extrabold text-white">Повторить</a>
      </section>
    </main>
  );
}
