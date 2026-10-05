# Ремонт квартир — лендинг + админ-панель

Лендинг специалиста по ремонту квартир (Никита Начаткин) с калькулятором стоимости,
формой заявок и админ-панелью управления секциями, заявками и медиафайлами.

## Стек

- `Node.js` ≥ 18, `Express` 4
- `SQLite` (драйвер `sqlite3` v5)
- HTML + CSS + JS (без фреймворков), админка — отдельная статическая часть
- `multer` + `sharp` — загрузка и обработка изображений
- `helmet`, `express-rate-limit`, `express-session`, `bcryptjs`

## Быстрый старт

```bash
cp .env.example .env        # заполнить SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
npm ci                      # установить зависимости (без dev-зависимостей)
npm run init-db             # ТОЛЬКО при первой инициализации — УДАЛЯЕТ текущую БД
npm start                   # по умолчанию http://localhost:3000
```

- Публичная страница: `/`
- Админ-панель: `/admin/`
- Логин: `ADMIN_USERNAME` / `ADMIN_PASSWORD` из `.env`

## Структура

```
/           публичные страницы: index.html, privacy.html, robots.txt, sitemap.xml
admin/      админ-панель (html/css/js)
css/ js/    стили и скрипты фронтенда
data/       контент в JSON (sections, projects, prices и т.д.)
public/     статика: font/ (шрифты), images/, img/ (загруженные медиа)
server/     backend: server.js, middleware/, controllers/, services/, database/
```

## Важно

- `.env` и `server/database/*.sqlite*` не коммитятся (см. `.gitignore`).
- `npm run init-db` **пересоздаёт базу с нуля** — перед запуском делайте бэкап.
- Папки `public/images`, `public/img`, `public/icons` сейчас пустые:
  перед публикацией добавьте реальные фотографии работ и мастера.

Подробности: `DEPLOYMENT.md`, `SECURITY_REPORT.md`, `BACKUP_RESTORE.md`, `HANDOVER.md`.
# remontnik-ekb
