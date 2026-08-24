# Перенос каталога на поддомен

Дата переключения: 21 августа 2026 года.

## Итоговая схема

- B2B-каталог и админка: <https://catalog.almatytovar.kz>
- Основной домен под будущую главную страницу: <https://almatytovar.kz>
- `www`: <https://www.almatytovar.kz>
- VPS: `46.247.41.103`

Основной домен не отключён и пока продолжает открывать текущее приложение. Это исключает простой до появления готовой главной страницы. Когда главная страница будет реализована или предоставлен адрес другого приложения, `almatytovar.kz` можно переключить отдельно, не меняя адрес каталога.

## Выполнено

- Проверено, что DNS `catalog.almatytovar.kz` указывает на VPS; TTL — 3600 секунд.
- Nginx принимает `almatytovar.kz`, `www.almatytovar.kz` и `catalog.almatytovar.kz`.
- HTTP нового поддомена перенаправляется на HTTPS.
- Существующий сертификат Let's Encrypt расширен на все три имени.
- Канонический `SITE_URL` приложения изменён на `https://catalog.almatytovar.kz`.
- Резервные URL аналитики и Meta-feed обновлены в исходном коде.
- Meta-feed формирует ссылки товаров на новом поддомене.
- Новый production-релиз собран и активирован.

## Проверки

- `https://catalog.almatytovar.kz/`: HTTP 200.
- `/catalog`: HTTP 200.
- `/admin/login`: HTTP 200.
- `/admin/product-review`: HTTP 200.
- Закрытые API без авторизации: HTTP 401.
- Скрытый debug endpoint: HTTP 404.
- Публичный API: 450 товаров.
- Корзина включена.
- Активных менеджеров: 2.
- Сертификат соответствует `catalog.almatytovar.kz`.
- `almatytovar.kz` продолжает отвечать HTTP 200.
- Финальный серверный тест: `CATALOG_DOMAIN_HEALTH=PASS`.

## Релиз и откат

- Активный релиз: `/srv/katalog-hoz/releases/image-hotfix-20260820T210958Z`.
- Предыдущий рабочий релиз: `/srv/katalog-hoz/releases/image-hotfix-20260820T203740Z`.
- Резервная копия конфигурации перед финальным переключением: `/srv/katalog-hoz/shared/backups/domain-switch-20260820T210615Z/`.
- Архив исходников активного релиза сохранён в `/srv/katalog-hoz/shared/backups/`.
