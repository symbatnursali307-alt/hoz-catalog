# Перенос «Каталог Хоз» на VPS PS.KZ

Этот документ описывает безопасный порядок переноса. Команды установки ОС намеренно не зафиксированы до проверки дистрибутива и версии VPS.

## Принятые значения

- системный пользователь: `kataloghoz`;
- корень приложения: `/srv/katalog-hoz`;
- активный релиз: `/srv/katalog-hoz/current`;
- общие файлы: `/srv/katalog-hoz/shared`;
- окружение: `/etc/katalog-hoz.env`;
- внутренний порт Next.js: `3000`;
- процесс: systemd;
- reverse proxy: Nginx;
- PostgreSQL: отдельная база и роль на VPS, если не будет выбрана внешняя БД;
- Vercel и Neon остаются включёнными до приёмки.

## 1. Сначала проверить сервер

После подключения выполнить только диагностические команды:

```bash
cat /etc/os-release
uname -a
df -h
free -h
ss -lntup
```

По результату выбрать команды установки Node.js LTS, npm, Git, Nginx, PostgreSQL, firewall и Certbot. Next.js требует Node.js не ниже 20.9.0.

## 2. Пользователь и директории

Нужен отдельный пользователь без интерактивного root-запуска приложения:

```text
/srv/katalog-hoz/
├── current -> releases/<release-id>
├── releases/
└── shared/
    ├── uploads/products/
    └── backups/
```

Пользователь `kataloghoz` должен владеть `/srv/katalog-hoz`. Nginx получает только чтение файлов из `shared/uploads`.

## 3. Исходники и сборка

Предпочтительный способ — clone из GitHub. Аварийный способ — проверенный bundle:

```bash
git clone /path/to/hoz-catalog-main.bundle release
cd release
npm ci
npx prisma generate
npm run build
```

Сборку выполнять до переключения симлинка `current`. Не копировать на VPS каталоги `.next` и `node_modules` с Windows.

## 4. Окружение

Создать `/etc/katalog-hoz.env` с правами `0600`, владельцем `root`:

```dotenv
DATABASE_URL="postgresql://kataloghoz:CHANGE_ME@127.0.0.1:5432/kataloghoz"
ADMIN_LOGIN="CHANGE_ME"
ADMIN_PASSWORD="CHANGE_ME"
ADMIN_SECRET="GENERATE_A_LONG_RANDOM_VALUE"
WHATSAPP_PHONE="CHANGE_ME"
BLOB_READ_WRITE_TOKEN="KEEP_ONLY_UNTIL_LOCAL_UPLOADS_ARE_ENABLED"
```

Старые Sensitive-значения Vercel не переносить. Для VPS создать новые административные реквизиты.

## 5. PostgreSQL

1. Создать отдельную роль и пустую базу `kataloghoz`.
2. Ограничить PostgreSQL локальным интерфейсом, если внешний доступ не нужен.
3. Применить схему:

   ```bash
   npx prisma db push
   ```

4. Восстановить `_recovery_backup_2026-08-20/neon/data.sql` через `psql`.
5. Сравнить итог с `neon/summary.json`: 6 таблиц и 492 строки.
6. До приёмки не изменять и не отключать Neon.

Перед рабочим восстановлением обязательно выполнить пробное восстановление в отдельную временную базу.

## 6. Изображения

Полная копия находится в `vercel-blob/objects/` и содержит 476 объектов. На первом серверном запуске приложение может продолжать читать Vercel Blob.

Для перехода на VPS:

1. Скопировать объекты в `/srv/katalog-hoz/shared/uploads/` с сохранением путей.
2. Реализовать файловый storage adapter для загрузок из админки.
3. Обновить `Product.photo` только после проверки новых URL.
4. Сверить 476 файлов, размеры и SHA-256 с манифестом.
5. Vercel Blob не удалять.

## 7. systemd

1. Скопировать `deploy/systemd/katalog-hoz.service` в `/etc/systemd/system/`.
2. Проверить путь `/usr/bin/npm` командой `command -v npm` и при необходимости исправить `ExecStart`.
3. Выполнить `systemctl daemon-reload`.
4. Запустить и включить сервис.
5. Проверить `systemctl status katalog-hoz` и `journalctl -u katalog-hoz`.
6. Проверить `curl http://127.0.0.1:3000/` до настройки Nginx.

## 8. Nginx, DNS и SSL

1. Заменить `__DOMAIN__` в `deploy/nginx/katalog-hoz.conf` на точное доменное имя.
2. Установить конфигурацию сайта и проверить `nginx -t`.
3. Направить A-запись домена на IPv4 VPS; AAAA добавлять только при настроенном IPv6.
4. Проверить HTTP по домену.
5. Выпустить сертификат Let's Encrypt через Certbot.
6. Проверить HTTPS, автоматическое продление и редирект HTTP → HTTPS.

## 9. Firewall

Разрешить только:

- SSH-порт;
- TCP 80;
- TCP 443.

Порт 3000 и PostgreSQL 5432 наружу не открывать.

Перед включением firewall сначала разрешить фактический SSH-порт и открыть вторую SSH-сессию для проверки, чтобы не потерять доступ.

## 10. Приёмка и откат

Проверить главную, категории, 450 товаров, изображения, вход в админку и API. Затем выполнить сценарии из этапа 21 ТЗ.

Откат приложения — вернуть симлинк `current` на предыдущий релиз и перезапустить systemd. Откат данных — только из проверенного backup. Vercel остаётся доступным резервным контуром и не переключается автоматически.
