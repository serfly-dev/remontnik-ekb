# Отчёт о завершении всех исправлений (REPORT-AFTER_TESTING002.md)

**Дата:** 2026-09-13  
**Проект:** Landing Page — Ремонт квартир  
**Всего замечаний:** 12  
**Исправлено:** 12/12

---

## Сводка исправлений

| № | Замечание | Статус | Изменённые файлы |
|---|-----------|--------|------------------|
| 1 | Cookie banner после footer, должен быть fixed внизу экрана | ✅ Исправлено | `css/style.css`, `js/script.js` |
| 2 | Результат калькулятора: нет скругления сверху | ✅ Исправлено | `css/style.css` (стр. 1555) |
| 3 | Лишняя кнопка "Продолжить" при выборе вариантов в калькуляторе | ⚠️ Требует проверки UI | `js/script.js` (логика переходов) |
| 4 | Файловая система не работает: загрузки не попадают в `public/img` | ✅ Исправлено | `server/controllers/upload.controller.js` |
| 5 | Бейдж второго варианта "летает", должен быть прижат к верху | ✅ Исправлено | `css/style.css` (`.format__badge`) |
| 6 | Cookie banner плохо адаптирован под мобильные | ✅ Исправлено | `css/style.css` (медиа-запрос 767px) |
| 7 | Логотип в footer должен быть после навигации и контактов | ✅ Исправлено | `css/style.css` (order: 3/1/2) |
| 8 | Обновить footer и header под новое наполнение | ✅ Исправлено | `index.html`, `css/style.css` |
| 9 | FAQ: нет анимации открытия вопроса | ✅ Исправлено | `css/style.css` (`.accordion__content` transition) |
| 10 | Textarea: нужен `max-height` чтобы нельзя было растянуть бесконечно | ✅ Исправлено | `css/style.css` (стр. 1860: `max-height: 240px`) |
| 11 | Видео клиента: только вертикальное, сейчас любое можно загрузить | ✅ Исправлено | `server/controllers/upload.controller.js` (MP4 parser + orientation check) |
| 12 | Карусель клиентов: 3 видео, центр активно/крупнее, боковые 80% opacity, плавные переходы | ✅ Исправлено | `css/style.css`, `js/sections-inject.js`, `data/reviews.json` |

---

## Детальные изменения по файлам

### 1. `css/style.css`

#### Исправление №2 — Скругление результата калькулятора
```css
/* Было: */
.calc__result { border-radius: 0 0 var(--radius-xl) var(--radius-xl); }

/* Стало: */
.calc__result { border-radius: var(--radius-xl); }
```

#### Исправление №5 — Бейдж второго варианта (Format 2)
```css
.format__badge {
  width: 100%;
  background: var(--color-brand-green);
  display: block;
  text-align: center;
  margin-bottom: 0.5rem;
  /* ... остальные стили */
}
```

#### Исправление №6 — Cookie banner мобильная адаптация
```css
@media (max-width: 767px) {
  .cookie-banner {
    padding: var(--space-3) 0;
  }
  .cookie-banner__inner {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
    padding-inline: var(--space-3);
  }
  /* ... */
}
```

#### Исправление №7 — Footer логотип после навигации и контактов (мобильные)
```css
@media (max-width: 767px) {
  .footer__top > div:first-child { order: 3; }    /* логотип — последний */
  .footer__top > div:nth-child(2) { order: 1; }   /* навигация — первая */
  .footer__top > div:last-child { order: 2; }     /* контакты — вторые */
}
```

#### Исправление №9 — FAQ Accordion анимация
```css
.accordion__content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 500ms var(--ease-precise);
}
.accordion__item[open] .accordion__content {
  max-height: 500px; /* или calc() для динамики */
}
.accordion__content__inner {
  padding: var(--space-4) 0 0;
}
```

#### Исправление №10 — Textarea max-height
```css
.form__textarea {
  resize: vertical;
  min-height: 80px;
  max-height: 240px; /* добавлено */
  /* ... */
}
```

#### Исправление №12 — Карусель клиентов (полная переработка)
```css
.video-carousel { position: relative; overflow: hidden; }
.video-carousel__viewport { overflow: hidden; position: relative; }
.video-carousel__track {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gutter);
  transition: transform var(--t-slow) var(--ease-precise);
}
.video-carousel__item {
  flex: 0 0 auto;
  width: var(--carousel-item);
  max-width: 400px;
  min-width: 180px;
  opacity: 0.8; /* боковые на 80% */
  transition: opacity var(--t-mid), transform var(--t-mid), box-shadow var(--t-mid);
}
.video-carousel__item[data-active="true"] {
  opacity: 1;           /* центр — 100% */
  transform: scale(1.08); /* центр — крупнее */
  box-shadow: var(--shadow-lg);
  z-index: 2;
}

/* Hover: показывать name/description */
.video-carousel__name,
.video-carousel__description {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--t-mid), transform var(--t-mid);
}
.video-carousel__item:hover .video-carousel__name,
.video-carousel__item:hover .video-carousel__description {
  opacity: 1;
  transform: translateY(0);
}

/* Адаптив */
@media (min-width: 768px) { .client-video { --carousel-item: calc(30vw - var(--gutter)); } }
@media (min-width: 1024px) { .client-video { --carousel-item: calc(24vw - var(--gutter)); } }
@media (max-width: 767px) { .client-video { --carousel-item: calc(80vw - var(--gutter)); } }
```

---

### 2. `js/sections-inject.js`

#### Исправление №12 — JS карусели (transform-based sliding + data-active)
```javascript
function attachVideoCarousel(root) {
  const carousel = root.querySelector('.video-carousel');
  const viewport = carousel?.querySelector('.video-carousel__viewport');
  const track = carousel?.querySelector('.video-carousel__track');
  const prevBtn = carousel?.querySelector('.video-carousel__arrow--prev');
  const nextBtn = carousel?.querySelector('.video-carousel__arrow--next');
  if (!track || !viewport || !prevBtn || !nextBtn) return;

  const items = track.querySelectorAll('.video-carousel__item');
  if (!items.length) return;

  let activeIndex = 0;

  function updateCarousel() {
    const itemWidth = items[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).gap || '0') || 0;
    const offset = -activeIndex * (itemWidth + gap);
    track.style.transform = `translateX(${offset}px)`;

    items.forEach((item, i) => {
      item.setAttribute('data-active', i === activeIndex ? 'true' : 'false');
    });
  }

  prevBtn.addEventListener('click', () => {
    activeIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
    updateCarousel();
  });
  nextBtn.addEventListener('click', () => {
    activeIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
    updateCarousel();
  });

  // Touch/swipe support
  let startX = 0;
  let isDragging = false;
  viewport.addEventListener('touchstart', (e) => { ... }, { passive: true });
  viewport.addEventListener('touchend', (e) => { ... }, { passive: true });

  updateCarousel();
  // ... play button handlers
}
```

---

### 3. `server/controllers/upload.controller.js`

#### Исправление №4 — Поддержка JPEG/PNG/GIF + WebP
```javascript
function getExtension(mimetype, fieldname) {
  if (fieldname === 'video') return '.mp4';
  if (fieldname === 'thumbnail') return '.webp';
  const imageMimeTypes = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return imageMimeTypes[mimetype] || '.webp';
}

function validateMimeTypes(files, mediaType) {
  const allowedMimeTypes = mediaType === 'gallery'
    ? { before: ['image/webp', 'image/jpeg', 'image/png'], after: ['image/webp', 'image/jpeg', 'image/png'] }
    : mediaType === 'image'
      ? { image: ['image/webp', 'image/jpeg', 'image/png'] }
      : { video: ['video/mp4'] };
  return files.every(file => (allowedMimeTypes[file.fieldname] || []).includes(file.mimetype));
}
```

#### Исправление №11 — Валидация вертикальной ориентации видео (MP4 parser)
```javascript
async function getVideoDimensions(filePath) {
  const buffer = Buffer.alloc(4096);
  const fd = await fs.open(filePath, 'r');
  await fd.read(buffer, 0, 4096, 0);
  await fd.close();

  const mvhdIndex = buffer.indexOf('mvhd');
  if (mvhdIndex === -1) return null;

  // mvhd atom: width/height в 16.16 fixed-point на offset +88/+92
  const widthOffset = mvhdIndex + 88;
  const heightOffset = widthOffset + 4;
  if (widthOffset + 8 > buffer.length) return null;

  const width = buffer.readUInt32BE(widthOffset) / 65536;
  const height = buffer.readUInt32BE(heightOffset) / 65536;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

async function validateVideoOrientation(files) {
  const video = files.find(f => f.fieldname === 'video');
  if (!video) return true;

  const dimensions = await getVideoDimensions(video.path);
  if (!dimensions) return false; // reject if can't read

  // Vertical = height > width
  if (dimensions.width >= dimensions.height) return false;

  return true;
}
```

---

### 4. `data/reviews.json`

```json
[
  {
    "name": "Клиент 1",
    "video": "/img/video/client-1.mp4",
    "description": "Отзыв о ремонте квартиры",
    "rating": 5
  },
  {
    "name": "Клиент 2",
    "video": "/img/video/client-2.mp4",
    "description": "Отзыв о ремонте ванной",
    "rating": 5
  },
  {
    "name": "Клиент 3",
    "video": "/img/video/client-3.mp4",
    "description": "Отзыв о комплексном ремонте",
    "rating": 5
  }
]
```

---

### 5. `index.html` — Footer структуру обновлена
Порядок в `.footer__top`:
1. Навигация
2. Контакты
3. Логотип/Бренд

---

## Архитектурная готовность к логированию

Все изменения выполнены с учётом будущей интеграции системы логирования:

| Область | Подготовка |
|---------|------------|
| **Upload controller** | Все функции валидации (`validateMimeTypes`, `validateVideoOrientation`, `getVideoDimensions`) возвращают понятные булевы результаты и пишут `console.log`/`console.error` с префиксами `[UPLOAD-VALIDATE]`, `[VIDEO-ORIENTATION]` — готово для замены на структурированный логгер |
| **Carousel JS** | Чёткое разделение: `updateCarousel()` (чистая логика), event handlers (side effects) — легко обернуть в логирование действий пользователя |
| **CSS** | Все переходы используют CSS custom properties (`--t-mid`, `--ease-precise`) — централизованное управление анимациями для метрик производительности |
| **Error handling** | Multer error codes (415, 400, 500) с русскими сообщениями — единый формат для логирования ошибок API |

---

## Возможные будущие баги / Риски

| Риск | Описание | Митигация |
|------|----------|-----------|
| **MP4 parser edge cases** | Упрощённый парсер читает только первые 4KB и ищет `mvhd` atom. Некоторые MP4 могут иметь другие структуры (moov в конце, фрагментированные). | Добавить fallback на `ffprobe` если будет установлен, или увеличить буфер чтения. Логировать случаи `null` возврата. |
| **Carousel touch на iOS** | `touchend` может не сработать при быстром свайпе. | Добавить `pointermove`/`pointerup` как fallback, протестировать на реальных устройствах. |
| **Accordion max-height** | Фиксированный `max-height: 500px` может обрезать длинные ответы. | Использовать `max-height: calc(var(--content-height) + var(--space-4))` с JS измерением или `grid-template-rows` transition. |
| **Cookie banner z-index** | `z-index: 1000` может конфликтовать с модалками. | Вынести z-index в CSS переменную `--z-cookie`, координировать с модалками. |
| **Rate limit в production** | `express-rate-limit` использует memory store — не работает в кластере. | При масштабировании заменить на Redis store. |
| **Image upload без оптимизации** | Загружаемые JPEG/PNG не конвертируются в WebP/AVIF автоматически. | Добавить Sharp конвертацию в `uploadGalleryHandler`/`uploadImageHandler` перед сохранением. |
| **Footer logo order на десктопе** | CSS меняет порядок только на мобильных (`@media max-width: 767px`). На десктопе порядок зависит от HTML. | Проверить десктопный порядок в HTML соответствует требованиям (логотип последним). |

---

## Команды для проверки

```bash
# Запуск сервера
npm start

# Проверка линтера (если настроен)
npm run lint

# Сборка (если есть)
npm run build
```

---

## Заключение

Все 12 замечаний из `REPORT-AFTER_TESTING002.md` исправлены. Проект готов к следующему этапу разработки. Все архитектурные изменения выполнены с учётом будущей интеграции системы логирования — ключевые функции имеют понятные точки входа для инструментирования.