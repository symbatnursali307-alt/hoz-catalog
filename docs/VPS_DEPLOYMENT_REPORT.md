# Отчёт о переносе «Каталог Хоз» на VPS

Дата выполнения: 20 августа 2026 года.

## Результат

- Production URL каталога: <https://catalog.almatytovar.kz>
- Основной домен под главную страницу: <https://almatytovar.kz>
- Дополнительное имя основного домена: <https://www.almatytovar.kz>
- VPS: `46.247.41.103`, Ubuntu 22.04.5 LTS.
- Рабочее ядро после обновления: `5.15.0-190-generic`.
- Node.js: `24.19.0` LTS.
- PostgreSQL: `14.24`.
- Nginx: `1.18.0`.
- HTTPS: Let's Encrypt для `almatytovar.kz`, `www.almatytovar.kz` и `catalog.almatytovar.kz`, срок текущего сертификата до 18 ноября 2026 года.

Vercel и Neon не отключались и не удалялись. Production-копия теперь работает с локальным PostgreSQL и локальными изображениями VPS.

## Восстановленные данные

| Таблица | Строк |
|---|---:|
| AppSettings | 1 |
| Category | 11 |
| Subcategory | 23 |
| Product | 450 |
| Client | 7 |
| ClientSelectedProduct | 0 |
| **Всего** | **492** |

- Восстановлено 476 объектов Vercel Blob.
- Общий размер изображений: 133 714 065 байт.
- URL фотографий всех 450 товаров переключены на `/uploads/...`.
- Новые изображения из админки сохраняются в локальное хранилище VPS.

## Размещение на сервере

- Текущий релиз: `/srv/katalog-hoz/current`.
- Релизы: `/srv/katalog-hoz/releases/`.
- Изображения: `/srv/katalog-hoz/shared/uploads/`.
- Резервные копии: `/srv/katalog-hoz/shared/backups/`.
- Runtime-переменные: `/etc/katalog-hoz.env`, права `640`, группа `kataloghoz`.
- Admin-реквизиты: `/root/katalog-hoz-admin.txt`, права `600`.
- systemd-сервис: `/etc/systemd/system/katalog-hoz.service`.
- Nginx-конфигурация: `/etc/nginx/sites-available/katalog-hoz`.

Admin-реквизиты намеренно не записаны в этот отчёт и не выведены в чат. Получить их на VPS:

```bash
sudo cat /root/katalog-hoz-admin.txt
```

## Защита и эксплуатация

- UFW активен; наружу разрешены только TCP 22, 80 и 443.
- Next.js слушает только `127.0.0.1:3000` и доступен через Nginx.
- Production `/api/debug` возвращает 404.
- Ошибки публичных API больше не раскрывают фрагмент `DATABASE_URL`.
- Создан swap 2 ГБ.
- Все пакеты Ubuntu обновлены; ожидающих обновлений после reboot нет.
- Certbot timer активен и отвечает за автоматическое продление TLS.
- Ежедневный `pg_dump` запускается в 02:30 UTC; автоматическая ротация — 14 дней.
- Первичная backup-копия исходников, Neon SQL и Vercel Blob сохранена отдельно и проверена по SHA-256.

## Проверенные маршруты

- `/` — 200.
- `www` — 200.
- `/api/categories` — 11 категорий.
- `/api/products?limit=5&offset=0` — 5 записей, total 450.
- локальное изображение `/uploads/...` — 200, корректный `Content-Type`.
- `/admin/login` — 200.
- `/api/admin/me` без сессии — 401.
- `/api/debug` в production — 404.
- HTTP перенаправляется на HTTPS кодом 301.

## Команды обслуживания

```bash
sudo systemctl status katalog-hoz
sudo journalctl -u katalog-hoz -f
sudo systemctl restart katalog-hoz
sudo systemctl status katalog-hoz-backup.timer
sudo systemctl status certbot.timer
```

## Оставшееся действие владельца

Начальный пароль SSH был передан в переписке. После добавления и проверки личного SSH-ключа его следует сменить, а вход по паролю затем можно отключить. До проверки входа по ключу отключать пароль нельзя, чтобы не потерять доступ к VPS.

Локальные изменения проекта не были закоммичены и не отправлялись в GitHub без отдельного разрешения владельца.

## Обновление B2B-каталога — 21 августа 2026 года

- Применены Prisma-миграции `20260820000000_baseline` и `20260820010000_b2b_catalog`.
- Production переключён на B2B-релиз, затем на app-only hotfix изображений `image-hotfix-20260820T190939Z`.
- Добавлены упаковочная модель, корзина упаковками, ввод телефона, снимки заявок, routing менеджеров, внутренняя аналитика, Meta Pixel/CAPI-контур, Meta CSV-feed, административные отчёты, импорт/экспорт CSV и Excel XML `.xls`.
- Корзина в production оставлена выключенной: у всех 450 восстановленных товаров отсутствует достоверное `unitsPerPackage`.
- Визуально проверены desktop и viewport 390×844: 24 карточки на первой странице, поиск, модальное окно товара, отсутствие горизонтального переполнения и broken images.
- Ежедневный backup теперь включает PostgreSQL и полный архив `/uploads`; БД хранится 14 дней, архивы изображений — минимум 7 дней.
- Успешно выполнено полное восстановление последнего дампа в отдельную проверочную БД; после сверки тестовая БД удалена.
- Свежий post-release дамп и архив всех 476 изображений скачаны на этот компьютер и проверены по SHA-256.

Подробности и список данных, которые ещё должен предоставить владелец, находятся в `docs/B2B_IMPLEMENTATION_REPORT.md`.
