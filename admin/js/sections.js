import { api } from './api.js';

/**
 * Sections Editor — Tab-based UI for editing landing page sections.
 * Each section key maps to a specific form configuration.
 */

const SECTION_KEYS = [
  { key: 'hero', label: 'Hero', description: 'Главный экран сайта: заголовок, подзаголовок, кнопки и главное фото' },
  { key: 'services', label: 'Услуги', description: 'Карточки услуг мастера с описанием и списком работ' },
  { key: 'about', label: 'Обо мне', description: 'Заголовок и текст блока о мастере' },
  { key: 'gallery', label: 'Галерея', description: 'Фото работ клиентов: пары изображений до/после' },
  { key: 'clientVideo', label: 'Видео клиента', description: 'Видеоотзывы, которые выводятся на главной странице' },
  { key: 'variants', label: 'Варианты', description: 'Неограниченное число форматов работы и один рекомендуемый вариант' },
  { key: 'calculator', label: 'Калькулятор', description: 'Сценарии, вопросы, единицы измерения и правила расчёта' },
  { key: 'navigation', label: 'Навигация', description: 'Пункты меню для настольной и мобильной версии сайта' },
  { key: 'privacy', label: 'Политика конфиденциальности', description: 'Текст политики обработки персональных данных' },
  { key: 'cta', label: 'Контакты', description: 'Финальный блок: призыв к действию, телефон, Telegram и WhatsApp' },
  { key: 'faq', label: 'Вопросы', description: 'Частые вопросы и ответы для посетителей' },
  { key: 'process', label: 'Процесс', description: 'Пошаговый путь клиента от заявки до результата' },
  { key: 'applications', label: 'Заявки', description: 'Список заявок клиентов, их статусы и действия с ними' }
];

function logAdminEvent(event, extra = {}) {
  console.info(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    endpoint: extra.endpoint || null,
    method: extra.method || null,
    status: extra.status || null,
    ...extra
  }));
}

const sectionCache = new Map();
let currentKey = null;
let isSaving = false;

const pendingUploads = new Map(); // inputEl → { file, config, objectUrl }

// Queue a file for upload at save time, store it with its config.
// One file per target URL input — replacing a selection for the same field
// discards the previously queued file so it never uploads or leaks.
function queuePendingUpload(inputEl, { file, fieldName, urlInputName, previewId, pathPrefix }) {
  for (const [queuedKey, queuedEntry] of pendingUploads) {
    if (queuedEntry.config.urlInputName === urlInputName) {
      if (queuedEntry.objectUrl) URL.revokeObjectURL(queuedEntry.objectUrl);
      pendingUploads.delete(queuedKey);
    }
  }
  const urlInput = document.querySelector(`input[name="${escapeHtml(urlInputName)}"]`);
  const previousUrl = urlInput ? urlInput.value : '';
  pendingUploads.set(inputEl, {
    file,
    config: { fieldName, urlInputName, previewId, pathPrefix, previousUrl },
    objectUrl: null
  });
}

// Immediately update the preview with a temporary object URL for UX
function showPendingPreview(inputEl, file, previewId) {
  // Revoke any previous object URL for this preview to avoid leaks
  const entry = pendingUploads.get(inputEl);
  if (entry?.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  const objectUrl = URL.createObjectURL(file);
  if (entry) entry.objectUrl = objectUrl;
  setPreviewBackground(document.getElementById(previewId), objectUrl);
}

// Apply a background image to a preview and drop the lazy-load marker, so a
// later viewport entry never overwrites a freshly uploaded image.
function setPreviewBackground(preview, url) {
  if (!preview) return;
  preview.style.backgroundImage = `url('${url}')`;
  delete preview.dataset.bg;
}

// Lazy image previews: assign the background-image only when the row
// approaches the viewport. A gallery with many heavy photos must not load
// every thumbnail the moment its tab is opened.
let previewObserver = null;
if (typeof IntersectionObserver !== 'undefined') {
  previewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      if (el.dataset.bg) {
        el.style.backgroundImage = `url('${el.dataset.bg}')`;
        delete el.dataset.bg;
      }
      previewObserver.unobserve(el);
    }
  }, { rootMargin: '400px' });
}

function observePreview(el) {
  if (!el || !el.dataset.bg) return;
  if (previewObserver) {
    previewObserver.observe(el);
  } else {
    setPreviewBackground(el, el.dataset.bg);
  }
}

// Form field definitions per section
const SECTION_FIELDS = {
  hero: {
    fields: [
      { name: 'title', type: 'textarea', label: 'Заголовок', hint: 'Используйте \\n для переносов строк' },
      { name: 'subtitle', type: 'textarea', label: 'Подзаголовок' },
      { name: 'cta_primary', type: 'text', label: 'Кнопка 1 (текст)' },
      { name: 'cta_primary_href', type: 'text', label: 'Кнопка 1 (ссылка)' },
      { name: 'cta_secondary', type: 'text', label: 'Кнопка 2 (текст)' },
      { name: 'cta_secondary_href', type: 'text', label: 'Кнопка 2 (ссылка)' },
      { name: 'image', type: 'image', label: 'Фоновое изображение' },
      { name: 'imageAlt', type: 'text', label: 'Alt изображения' },
      { name: 'imageCaption', type: 'text', label: 'Подпись под фото' },
      { name: 'signatureRole', type: 'text', label: 'Роль в подписи' },
      { name: 'proof', type: 'repeater', label: 'Доказательства', itemFields: [
        { name: 'label', type: 'text', label: 'Подпись' }
      ]}
    ]
  },
  services: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'items', type: 'repeater', label: 'Услуги', itemFields: [
        { name: 'num', type: 'text', label: 'Номер' },
        { name: 'title', type: 'text', label: 'Название' },
        { name: 'desc', type: 'textarea', label: 'Описание' },
        { name: 'items', type: 'repeater', label: 'Пункты', itemFields: [
          { name: '', type: 'text', label: 'Пункт' }
        ]}
      ]},
      { name: 'footer_note', type: 'textarea', label: 'Подпись под блоком услуг' }
    ]
  },
  gallery: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'items', type: 'repeater', label: 'Изображения', itemFields: [
        { name: 'name', type: 'text', label: 'Название' },
        { name: 'before', type: 'crop-image', label: 'До', aspectRatio: 4 / 3, outputWidth: 1200, outputHeight: 900 },
        { name: 'after', type: 'crop-image', label: 'После', aspectRatio: 4 / 3, outputWidth: 1200, outputHeight: 900 },
        { name: 'description', type: 'textarea', label: 'Описание' }
      ]}
    ]
  },
  clientVideo: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'items', type: 'repeater', label: 'Видео', itemFields: [
        { name: 'name', type: 'text', label: 'Название' },
        { name: 'video', type: 'video', label: 'Видео клиента' },
        { name: 'description', type: 'textarea', label: 'Описание' }
      ]}
    ]
  },
  about: {
    fields: [
      { name: 'title', type: 'textarea', label: 'Заголовок' },
      { name: 'text', type: 'textarea', label: 'Текст (абзацы разделяйте пустой строкой)' },
      { name: 'photo', type: 'image', label: 'Фотография' }
    ]
  },
  privacy: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок страницы' },
      { name: 'sections', type: 'repeater', label: 'Разделы политики', description: 'Абзацы разделяйте пустой строкой. Для списка начинайте каждую строку с «- ». Ссылки и адреса почты на странице станут кликабельными.', itemFields: [
        { name: 'title', type: 'text', label: 'Название раздела' },
        { name: 'body', type: 'textarea', label: 'Текст раздела', hint: 'Абзацы разделяйте пустой строкой; пункты списка начинайте с «- »' }
      ]}
    ]
  },
  variants: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'items', type: 'repeater', label: 'Форматы работы', itemFields: [
        { name: 'num', type: 'text', label: 'Номер' },
        { name: 'title', type: 'text', label: 'Название' },
        { name: 'price', type: 'number', label: 'Цена (₽)' },
        { name: 'desc', type: 'textarea', label: 'Описание' },
        { name: 'include', type: 'repeater', label: 'Пункты', itemFields: [
          { name: '', type: 'text', label: 'Пункт' }
        ]},
        { name: 'cta', type: 'text', label: 'Текст кнопки' },
        { name: 'cta_href', type: 'text', label: 'Ссылка кнопки' },
        { name: 'comment', type: 'textarea', label: 'Комментарий под карточкой', hint: 'Можно добавить отдельно к каждой карточке' },
        { name: 'badge', type: 'text', label: 'Подпись-бейдж (необязательно)' },
        { name: 'is_featured', type: 'checkbox', label: 'Рекомендуемый' }
      ]}
    ]
  },
  faq: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'questions', type: 'repeater', label: 'Вопросы', itemFields: [
        { name: 'question', type: 'text', label: 'Вопрос' },
        { name: 'answer', type: 'textarea', label: 'Ответ 1' },
        { name: 'answer2', type: 'textarea', label: 'Ответ 2 (необязательно)' },
        { name: 'answer3', type: 'textarea', label: 'Ответ 3 (необязательно)' },
        { name: 'answer4', type: 'textarea', label: 'Ответ 4 (необязательно)' }
      ]}
    ]
  },
  process: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'phases', type: 'repeater', label: 'Этапы', itemFields: [
        { name: 'num', type: 'text', label: 'Номер (напр. Этап 01–02)' },
        { name: 'title', type: 'text', label: 'Название этапа' },
        { name: 'steps', type: 'repeater', label: 'Шаги', itemFields: [
          { name: '', type: 'text', label: 'Шаг' }
        ]}
      ]}
    ]
  },
  calculator: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'scenario_question', type: 'text', label: 'Вопрос выбора сценария' },
      { name: 'callback_label', type: 'text', label: 'Текст заявки без расчёта' },
      { name: 'sidebar_content_type', type: 'select', label: 'Содержимое левой колонки', options: [
        { value: 'none', label: 'Не показывать' },
        { value: 'text', label: 'Текст' },
        { value: 'image', label: 'Фотография' }
      ]},
      { name: 'sidebar_text', type: 'textarea', label: 'Текст левой колонки' },
      { name: 'sidebar_image', type: 'image', label: 'Фотография левой колонки' },
      { name: 'scenarios', type: 'repeater', label: 'Сценарии расчёта', description: 'Добавляйте «Вся квартира», комнаты, зоны и другие расчёты. У каждого сценария свои вопросы и варианты.', itemFields: [
        { name: 'key', type: 'text', label: 'Ключ сценария (необязательно)' },
        { name: 'name', type: 'text', label: 'Название сценария' },
        { name: 'area_question', type: 'text', label: 'Подпись количества площади' },
        { name: 'area_position', type: 'select', label: 'Когда спрашивать площадь', options: [
          { value: 'start', label: 'До остальных вопросов' },
          { value: 'end', label: 'После остальных вопросов' }
        ]},
        { name: 'area_required', type: 'select', label: 'Площадь обязательна', options: [
          { value: 'yes', label: 'Да' },
          { value: 'no', label: 'Нет' }
        ]},
        { name: 'area_min', type: 'number', label: 'Минимальная площадь', min: 0, step: 'any' },
        { name: 'area_max', type: 'number', label: 'Максимальная площадь', min: 0, step: 'any' },
        { name: 'questions', type: 'repeater', label: 'Вопросы и параметры', itemFields: [
          { name: 'key', type: 'text', label: 'Ключ вопроса (для источника количества)' },
          { name: 'question', type: 'text', label: 'Текст вопроса' },
          { name: 'type', type: 'select', label: 'Тип ответа', options: [
            { value: 'single', label: 'Один вариант' },
            { value: 'multiple', label: 'Несколько вариантов' },
            { value: 'text', label: 'Текстовый ответ' },
            { value: 'number', label: 'Количество (число)' }
          ]},
          { name: 'required', type: 'select', label: 'Обязательный вопрос', options: [
            { value: 'yes', label: 'Да' },
            { value: 'no', label: 'Нет' }
          ]},
          { name: 'unit', type: 'select', label: 'Единица числового вопроса', options: [
            { value: 'м²', label: 'м²' },
            { value: 'п.м.', label: 'погонный метр' },
            { value: 'шт.', label: 'штука' },
            { value: 'компл.', label: 'комплект' }
          ]},
          { name: 'min', type: 'number', label: 'Минимальное значение', min: 0, step: 'any' },
          { name: 'max', type: 'number', label: 'Максимальное значение', min: 0, step: 'any' },
          { name: 'answers', type: 'repeater', label: 'Варианты ответа', itemFields: [
            { name: 'label', type: 'text', label: 'Текст варианта' },
            { name: 'enabled', type: 'select', label: 'Включён', options: [
              { value: 'yes', label: 'Да' },
              { value: 'no', label: 'Нет' }
            ]},
            { name: 'pricing_type', type: 'select', label: 'Расценка / единица', options: [
              { value: 'none', label: 'Без доплаты' },
              { value: 'per_m2', label: 'Цена за м²' },
              { value: 'per_linear_m', label: 'Цена за погонный метр' },
              { value: 'per_piece', label: 'Цена за штуку' },
              { value: 'per_set', label: 'Цена за комплект' },
              { value: 'fixed', label: 'Фиксированная цена' }
            ]},
            { name: 'quantity_source', type: 'select', label: 'Источник количества', options: [
              { value: 'area', label: 'Площадь сценария (м²)' }
            ]},
            { name: 'price', type: 'number', label: 'Цена, ₽', min: 0, step: 'any' }
          ]}
        ]}
      ]}
    ]
  },
  navigation: {
    fields: [
      { name: 'links', type: 'repeater', label: 'Ссылки в меню', itemFields: [
        { name: 'label', type: 'text', label: 'Название пункта меню' },
        { name: 'target', type: 'select', label: 'Раздел сайта', options: [
          { value: '#hero', label: 'Главная' },
          { value: '#services', label: 'Услуги' },
          { value: '#formats', label: 'Форматы работы' },
          { value: '#gallery', label: 'Портфолио' },
          { value: '#clientVideo', label: 'Видео клиента' },
          { value: '#about', label: 'Обо мне' },
          { value: '#faq', label: 'Вопросы' },
          { value: '#calculator', label: 'Калькулятор' },
          { value: '#application', label: 'Заявка' },
          { value: '#contacts', label: 'Контакты' },
          { value: '#process', label: 'Процесс' }
        ]}
      ]}
    ]
  },
  cta: {
    fields: [
      { name: 'title', type: 'textarea', label: 'Заголовок', hint: 'Используйте \\n для переносов строк' },
      { name: 'subtitle', type: 'textarea', label: 'Подзаголовок' },
      { name: 'cta_primary', type: 'text', label: 'Кнопка 1 (текст)' },
      { name: 'cta_primary_href', type: 'text', label: 'Кнопка 1 (ссылка)' },
      { name: 'cta_secondary', type: 'text', label: 'Кнопка 2 (текст)' },
      { name: 'cta_secondary_href', type: 'text', label: 'Кнопка 2 (ссылка)' },
      { name: 'telegram', type: 'text', label: 'Telegram username', description: 'Ваш Telegram без @, например: nikitachatkin' },
      { name: 'telegram_link', type: 'text', label: 'Telegram URL', description: 'Полная ссылка на Telegram, например: https://t.me/nikitachatkin' },
      { name: 'whatsapp', type: 'text', label: 'WhatsApp (видимый)', description: 'Текст, который увидит клиент при клике на кнопку' },
      { name: 'whatsapp_link', type: 'text', label: 'WhatsApp URL', description: 'Ссылка на WhatsApp, например: https://wa.me/79502085138' },
      { name: 'footer_note', type: 'text', label: 'Подвал' }
    ]
  }
};

function defaultNavigationLinks() {
  return [
    { label: 'Портфолио', target: '#gallery' },
    { label: 'Услуги', target: '#services' },
    { label: 'Форматы', target: '#formats' },
    { label: 'Обо мне', target: '#about' },
    { label: 'Вопросы', target: '#faq' },
    { label: 'Калькулятор', target: '#calculator' },
    { label: 'Контакты', target: '#contacts' }
  ];
}

// DOM elements
const tabsNav = document.getElementById('sectionsTabs');
const editorContainer = document.getElementById('sectionEditor');
let saveStatusEl = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  // Load first tab by default
  if (SECTION_KEYS.length > 0) {
    selectTab(SECTION_KEYS[0].key);
  }
});

async function renderTabs() {
  tabsNav.innerHTML = SECTION_KEYS.map(({ key, label }) => `
    <button class="admin-tab" role="tab" aria-selected="false"
            data-section="${key}" id="tab-${key}">
      ${label}
    </button>
  `).join('');

  tabsNav.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      selectTab(btn.dataset.section);
    });
  });
}

function scrollTabIntoView(key) {
  const target = key === 'applications'
    ? document.getElementById('applicationsSection')
    : document.getElementById('sectionEditor');
  if (!target) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = prefersReduced ? 'auto' : 'smooth';

  target.scrollIntoView({ behavior, block: 'start' });
}

async function selectTab(key) {
  if (currentKey === key && !editorContainer.dataset.loading) return;

  // Update tab UI
  tabsNav.querySelectorAll('.admin-tab').forEach(btn => {
    const isActive = btn.dataset.section === key;
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Handle special applications tab
  if (key === 'applications') {
    currentKey = key;
    // Hide section editor, show applications section
    editorContainer.setAttribute('aria-hidden', 'true');
    const applicationsSection = document.getElementById('applicationsSection');
    if (applicationsSection) {
      applicationsSection.hidden = false;
      scrollTabIntoView(key);
      // Trigger applications loading if needed
      if (window.loadApplications) {
        window.loadApplications();
      }
    }
    return;
  }

  // When switching FROM applications TO a section tab
  if (currentKey === 'applications') {
    const applicationsSection = document.getElementById('applicationsSection');
    if (applicationsSection) {
      applicationsSection.hidden = true;
    }
  }

  // Handle regular section tabs
  currentKey = key;
  editorContainer.setAttribute('aria-hidden', 'true');
  editorContainer.innerHTML = `
    <div class="section-editor__loading">
      <span class="spinner"></span>
      <span>Загрузка…</span>
    </div>
  `;
  editorContainer.dataset.loading = 'true';

  try {
    const section = await fetchSection(key);
    renderEditor(key, section);
    scrollTabIntoView(key);
  } catch (err) {
    console.error('Failed to load section:', err);
    editorContainer.innerHTML = `
      <div class="section-editor__loading" style="color: #dc2626;">
        Ошибка загрузки: ${err.message}
        <button class="btn btn--ghost" onclick="selectTab('${key}')" style="margin-top: 8px;">Повторить</button>
      </div>
    `;
  } finally {
    editorContainer.dataset.loading = 'false';
  }
}

// Make selectTab globally accessible for retry button
window.selectTab = selectTab;

async function fetchSection(key) {
  if (sectionCache.has(key)) return sectionCache.get(key);
  let res;
  try {
    res = await api.get(`/api/sections/${key}`);
  } catch (err) {
    if (err.status !== 404) throw err;
    const defaults = {
      navigation: { title: 'Навигация', content: { links: defaultNavigationLinks() } },
      about: { title: 'Обо мне', content: { title: 'Ваш комфорт —\nнаш приоритет', text: 'Я занимаюсь строительством уже более 10 лет. Начинал с фундаментов, участвовал в проектах Clever Park и аэропорта в Перми, прошёл путь от мастера СМР до руководителя проектов.\n\nСейчас я специализируюсь на ремонте квартир по дизайн-проектам. Главное для меня — прозрачность: понятная смета, аргументация решений, контроль расходов и результат, который радует.\n\nЯ стараюсь держать процесс максимально прозрачным и понятным для клиента. Клиент не должен переплачивать за ненужные процессы и лишних посредников.', photo: '/images/master-photo.jpg' } }
    };
    if (key === 'privacy') {
      const section = { key, title: 'Политика конфиденциальности', content: await loadPrivacyDefaults() };
      sectionCache.set(key, section);
      return section;
    }
    if (!defaults[key]) throw err;
    const section = { key, ...defaults[key] };
    sectionCache.set(key, section);
    return section;
  }
  if (!res.success) throw new Error(res.message);
  sectionCache.set(key, res.data);
  return res.data;
}

async function loadPrivacyDefaults() {
  const response = await fetch('/privacy.html', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Не удалось загрузить текущую политику конфиденциальности');

  const page = new DOMParser().parseFromString(await response.text(), 'text/html');
  const content = page.querySelector('#privacyPolicyContent');
  if (!content) throw new Error('На странице политики не найдена область с текстом');

  const sections = Array.from(content.querySelectorAll('.policy-section')).map((section) => {
    const title = section.querySelector('h2')?.textContent.trim() || '';
    const blocks = [];

    Array.from(section.children).forEach((element) => {
      if (element.matches('h2')) return;

      if (element.matches('ul, ol')) {
        const items = Array.from(element.children)
          .filter(item => item.matches('li'))
          .map(item => '- ' + item.textContent.replace(/\s+/g, ' ').trim());
        if (items.length) blocks.push(items.join('\n'));
        return;
      }

      if (element.matches('dl')) {
        const children = Array.from(element.children);
        for (let index = 0; index < children.length; index += 1) {
          if (!children[index].matches('dt')) continue;
          const label = children[index].textContent.replace(/\s+/g, ' ').trim();
          const value = children[index + 1];
          if (!value?.matches('dd')) continue;
          const list = value.querySelector('ul, ol');
          if (list) {
            blocks.push(label + ':');
            const items = Array.from(list.children)
              .filter(item => item.matches('li'))
              .map(item => '- ' + item.textContent.replace(/\s+/g, ' ').trim());
            if (items.length) blocks.push(items.join('\n'));
          } else {
            blocks.push(label + ': ' + value.textContent.replace(/\s+/g, ' ').trim());
          }
          index += 1;
        }
        return;
      }

      const text = element.textContent.replace(/\s+/g, ' ').trim();
      if (text) blocks.push(text);
    });

    return { title, body: blocks.join('\n\n') };
  }).filter(section => section.title);

  return {
    title: content.querySelector('h1')?.textContent.trim() || 'Политика в отношении обработки персональных данных',
    sections
  };
}

function renderEditor(key, section) {
  const config = SECTION_FIELDS[key];
  if (!config) {
    editorContainer.innerHTML = '<p>Нет конфигурации для этой секции</p>';
    return;
  }

  const content = { ...(section.content || {}) };
  if (key === 'calculator') {
    content.callback_label ||= 'Хочу оставить только заявку на звонок — без расчёта';
    content.scenario_question ||= 'Что будем рассчитывать?';
    content.scenarios = window.CalculatorPricing.normalizeScenarios(content).map((scenario, scenarioIndex) => ({
      ...scenario,
      key: scenario.key || `scenario-${scenarioIndex + 1}`,
      area_required: scenario.area_required === false || scenario.area_required === 'no' ? 'no' : 'yes',
      area_position: scenario.area_position === 'start' ? 'start' : 'end',
      questions: (scenario.questions || []).map((question, questionIndex) => ({
        ...question,
        key: question.key || question.id || `question-${questionIndex + 1}`,
        required: question.required === false || question.required === 'no' ? 'no' : 'yes',
        answers: (question.answers || []).map(answer => ({ ...answer, enabled: answer.enabled === false || answer.enabled === 'no' ? 'no' : 'yes' }))
      }))
    }));
    content.sidebar_content_type ||= content.sidebar_image ? 'image' : content.sidebar_text ? 'text' : 'none';
    content.sidebar_text ||= '';
    content.sidebar_image ||= '';
  }
  if (key === 'about') {
    content.photo ||= '/images/master-photo.jpg';
  }
  if (key === 'variants') {
    if (!Array.isArray(content.items)) {
      content.items = [content.option1, content.option2]
        .filter(item => item && (item.title || item.desc || item.price != null))
        .map((item, index) => ({
          ...item,
          num: item.num || String(index + 1).padStart(2, '0'),
          badge: item.badge || item.num_badge || '',
          is_featured: item.is_featured === true || item.is_featured === 'true' || item.is_featured === 'on'
        }));
    }
    const legacyComments = [content.compare?.col1_text, content.compare?.col2_text];
    let featuredAssigned = false;
    content.items = content.items.map((item, index) => {
      const { steps, ...itemContent } = item;
      const points = [
        ...(Array.isArray(item.include) ? item.include : []),
        ...(Array.isArray(steps) ? steps : [])
      ].filter(Boolean);
      const featured = !featuredAssigned && (item.is_featured === true || item.is_featured === 'true' || item.is_featured === 'on');
      featuredAssigned ||= featured;
      const legacyComment = String(legacyComments[index] || '').trim();
      const comment = String(item.comment || '').trim() || (legacyComment !== String(item.desc || '').trim() ? legacyComment : '');
      return {
        ...itemContent,
        include: points,
        num: item.num || String(index + 1).padStart(2, '0'),
        badge: item.badge || item.num_badge || '',
        comment,
        is_featured: featured
      };
    });
    delete content.compare;
  }
  if (key === 'navigation' && !Array.isArray(content.links)) {
    content.links = defaultNavigationLinks();
  }
  const title = section.title || key;

  let html = `
    <div class="section-editor__head">
      <h2 class="section-editor__title">${escapeHtml(title)}</h2>
      <span class="section-editor__status">Ключ: ${escapeHtml(key)}</span>
    </div>
    <form class="section-editor__form" data-section="${escapeHtml(key)}">
  `;

  if (key === 'calculator') {
    html += renderCalculatorInstructions();
  }

  for (const field of config.fields) {
    html += renderField(field, content[field.name]);
    if (key === 'calculator' && field.name === 'callback_label') {
      html += renderCalculatorSummaryField(content);
    }
  }

  html += `
      <div class="section-editor__foot">
        <div class="section-editor__actions">
          <button type="submit" class="btn btn--primary" id="saveBtn" ${isSaving ? 'disabled' : ''}>
            <span class="btn-text">Сохранить</span>
            <span class="btn-loader" hidden></span>
          </button>
          <button type="button" class="btn btn--ghost" id="resetBtn">Сбросить</button>
          <button type="button" class="btn btn--ghost" id="cancelUploadBtn" style="display:none; border-color:#dc2626; color:#dc2626;">Отменить загрузку</button>
        </div>
        <div class="section-editor__save-status" id="saveStatus"></div>
      </div>
    </form>
  `;

  editorContainer.innerHTML = html;
  editorContainer.querySelectorAll('.section-editor__image-preview[data-bg]').forEach(observePreview);
  editorContainer.setAttribute('aria-hidden', 'false');

  saveStatusEl = document.getElementById('saveStatus');
  const form = editorContainer.querySelector('form');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (key === 'calculator') {
    form.addEventListener('input', () => {
      populateCalculatorQuantitySources(form);
      refreshCalculatorSummary(form);
    });
    form.addEventListener('change', () => {
      populateCalculatorQuantitySources(form);
      refreshCalculatorSummary(form);
    });
    populateCalculatorQuantitySources(form);
    refreshCalculatorSummary(form);
  }
  if (key === 'variants') {
    form.addEventListener('change', event => {
      if (!event.target.matches('input[type="checkbox"][name$=".is_featured"]') || !event.target.checked) return;
      form.querySelectorAll('input[type="checkbox"][name$=".is_featured"]').forEach(input => {
        if (input !== event.target) input.checked = false;
      });
    });
  }

  // Add event listeners for field-level info circles
  editorContainer.addEventListener('mouseenter', (e) => {
    if (e.target.classList.contains('field-info')) {
      const tooltip = e.target.nextElementSibling;
      if (tooltip && tooltip.classList.contains('field-tooltip')) {
        tooltip.classList.add('show');
      }
    }
  });
  editorContainer.addEventListener('mouseleave', (e) => {
    if (e.target.classList.contains('field-info')) {
      const tooltip = e.target.nextElementSibling;
      if (tooltip && tooltip.classList.contains('field-tooltip')) {
        tooltip.classList.remove('show');
      }
    }
  });
  editorContainer.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('field-info')) {
      const tooltip = e.target.nextElementSibling;
      if (tooltip && tooltip.classList.contains('field-tooltip')) {
        tooltip.classList.add('show');
      }
    }
  });
  editorContainer.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('field-info')) {
      const tooltip = e.target.nextElementSibling;
      if (tooltip && tooltip.classList.contains('field-tooltip')) {
        tooltip.classList.remove('show');
      }
    }
  });

  form.addEventListener('submit', (e) => handleSave(e, key, form, saveBtn));
  resetBtn.addEventListener('click', async () => {
    const confirmed = await customConfirm('Сбросить изменения и загрузить текущие данные с сервера?');
    if (!confirmed) return;
    resetForm(key, form);
  });

  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', () => {
      cancelUpload();
    });
  }
}

function renderField(field, value, pathPrefix) {
  const name = field.name;
  const label = field.label;
  const type = field.type;
  const hint = field.hint || '';
  const description = field.description || '';
  const required = field.required ? ' required' : '';

  const prefix = pathPrefix || '';

  let infoHtml = description ? `
    <span class="field-info" tabindex="0" role="img" aria-label="${escapeHtml(description)}">i</span>
    <span class="field-tooltip">${escapeHtml(description)}</span>
  ` : '';

  let html = `
    <div class="section-editor__group" data-field="${escapeHtml(name)}">
      <label class="section-editor__label">${escapeHtml(label)}${infoHtml}</label>
  `;

  switch (type) {
    case 'text':
    case 'number':
      const inputType = type === 'number' ? 'number' : 'text';
      html += `
        <input type="${inputType}" name="${escapeHtml(name)}" class="section-editor__input"
               value="${escapeHtml(value ?? '')}"${required}>
        ${hint ? `<span class="section-editor__hint">${escapeHtml(hint)}</span>` : ''}
      `;
      break;

    case 'textarea':
      html += `
        <textarea name="${escapeHtml(name)}" class="section-editor__textarea"${required}>${escapeHtml(value ?? '')}</textarea>
        ${hint ? `<span class="section-editor__hint">${escapeHtml(hint)}</span>` : ''}
      `;
      break;

    case 'select':
      const options = (field.options || []).map(opt =>
        `<option value="${escapeHtml(opt.value)}" ${value === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
      ).join('');
      html += `
        <select name="${escapeHtml(name)}" class="section-editor__select"${required}>
          ${options}
        </select>
      `;
      break;

    case 'checkbox':
      html += `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" name="${escapeHtml(name)}" ${value ? 'checked' : ''}>
          <span>${escapeHtml(label)}</span>
        </label>
      `;
      html = html.replace(`<label class="section-editor__label">${escapeHtml(label)}</label>`, '');
      break;

    case 'image':
      html += renderImageField(name, value, prefix);
      break;

    case 'crop-image':
      html += renderCropImageField(field, value, prefix);
      break;

    case 'video':
      html += renderVideoField(field, value, prefix);
      break;

    case 'repeater':
      html += renderRepeaterField(field, value);
      break;

    case 'object':
      html += renderObjectField(field, value);
      break;
  }

  html += `</div>`;
  return html;
}

function renderCalculatorInstructions() {
  return `
    <details class="calculator-guide" open>
      <summary class="calculator-guide__title">Инструкция по настройке калькулятора</summary>
      <div class="calculator-guide__content">
        <ol>
          <li>
            <strong>Создайте сценарии расчёта.</strong>
            Каждый сценарий — отдельный расчёт, например «Вся квартира», «Ванная» или «Балкон».
            Укажите название и подпись площади, выберите, когда спрашивать площадь, задайте обязательность и допустимый диапазон.
          </li>
          <li>
            <strong>Добавьте вопросы в нужном порядке.</strong>
            «Один вариант» разрешает выбрать один ответ, «Несколько вариантов» — несколько ответов с суммированием их цен,
            «Количество (число)» запрашивает число, а «Текстовый ответ» собирает комментарий и не влияет на стоимость.
            Для числового вопроса задайте единицу, границы и уникальный ключ: он появится в списке источников количества для тарифов.
          </li>
          <li>
            <strong>Настройте варианты и цены.</strong>
            Заполните название каждого варианта и включите его. «Без доплаты» не меняет сумму;
            для платного ответа укажите цену и тип расценки:
            цена за м² умножается на площадь сценария, цена за погонный метр / штуку / комплект — на число из выбранного числового вопроса,
            а фиксированная цена добавляется один раз без умножения.
            Например: 1&nbsp;200 ₽/м² × 40 м² = 48&nbsp;000 ₽; 2&nbsp;500 ₽/шт. × 3 шт. = 7&nbsp;500 ₽.
          </li>
          <li>
            <strong>Свяжите тариф с количеством.</strong>
            Для переменной расценки выберите источник количества: площадь сценария или числовой вопрос.
            Для оплаты за штуку выбирайте поле с количеством штук, для погонного метра — поле длины и т. п.; единица вопроса должна соответствовать тарифу.
            Если выбранный платный вариант зависит от площади или числового ответа, это значение должно быть заполнено, иначе калькулятор не рассчитает итог.
          </li>
          <li>
            <strong>Проверьте сводку и сам расчёт.</strong>
            Сводка ниже обновляется при изменении настроек: проверьте названия, включённые варианты, цены и источники количества.
            Сохраните секцию, затем пройдите калькулятор на сайте для каждого сценария и проверьте итоговую разбивку.
          </li>
        </ol>
      </div>
    </details>
  `;
}

function renderCalculatorSummaryField(content) {
  return `
    <div class="calculator-summary">
      <label class="calculator-summary__label" for="calculatorPricingSummary">Сводка расчёта и расценок</label>
      <textarea id="calculatorPricingSummary" class="calculator-summary__textarea" readonly aria-live="polite">${escapeHtml(buildCalculatorSummary(content))}</textarea>
      <span class="calculator-summary__hint">Только для просмотра: сводка обновляется при изменении вопросов и цен и не сохраняется отдельно.</span>
    </div>
  `;
}

function refreshCalculatorSummary(form) {
  const summary = form?.querySelector('#calculatorPricingSummary');
  if (!summary) return;

  const content = parseFormData(new FormData(form));
  content.scenarios = Array.isArray(content.scenarios) ? content.scenarios : [];
  content.scenarios.forEach(scenario => {
    scenario.questions = Array.isArray(scenario.questions) ? scenario.questions : [];
    scenario.questions.forEach(question => {
      question.answers = Array.isArray(question.answers) ? question.answers : [];
    });
  });
  content.area_question ||= 'Площадь квартиры по полу';
  content.callback_label ||= 'Хочу оставить только заявку на звонок — без расчёта';
  summary.value = buildCalculatorSummary(content);
}

function populateCalculatorQuantitySources(form) {
  if (!form) return;
  const scenarioRepeater = form.querySelector('[data-repeater="scenarios"]');
  if (!scenarioRepeater) return;

  const scenarios = [...scenarioRepeater.querySelectorAll(':scope > .section-editor__repeater-item')];
  const quantitySelectors = form.querySelectorAll('select[name$=".quantity_source"]');

  quantitySelectors.forEach(selector => {
    const scenarioMatch = selector.name.match(/^scenarios\[(\d+)\]/);
    const scenario = scenarioMatch ? scenarios[Number(scenarioMatch[1])] : null;
    if (!scenario) return;

    const questionRepeater = [...scenario.querySelectorAll('[data-repeater]')]
      .find(repeater => /\.questions$/.test(repeater.dataset.repeater));
    const questionItems = questionRepeater
      ? [...questionRepeater.querySelectorAll(':scope > .section-editor__repeater-item')]
      : [];
    const sources = [{ value: 'area', label: 'Площадь сценария (м²)' }];
    const usedKeys = new Set(['area']);

    questionItems.forEach((item, index) => {
      const type = item.querySelector('select[name$=".type"]')?.value;
      if (type !== 'number') return;
      const key = String(item.querySelector('input[name$=".key"]')?.value || `question-${index + 1}`).trim();
      if (!key || usedKeys.has(key)) return;
      usedKeys.add(key);
      const title = String(item.querySelector('input[name$=".question"]')?.value || `Вопрос ${index + 1}`).trim();
      const unit = item.querySelector('select[name$=".unit"]')?.value || '';
      sources.push({ value: key, label: `${title}${unit ? ` (${unit})` : ''}` });
    });

    const selected = selector.value;
    const answerItem = selector.closest('.section-editor__repeater-item');
    const pricingType = answerItem?.querySelector('select[name$=".pricing_type"]')?.value;
    selector.replaceChildren(new Option('Выберите источник количества', ''));
    sources.forEach(source => selector.add(new Option(source.label, source.value)));
    selector.value = sources.some(source => source.value === selected)
      ? selected
      : pricingType === 'per_m2' ? 'area' : '';
  });
}

function describeCalculatorRate(answer, quantityLabels = {}) {
  const pricingType = answer?.pricing_type || answer?.pricingType || 'none';
  const rawPrice = answer?.price;
  const hasPrice = rawPrice != null && String(rawPrice).trim() !== '';
  const price = hasPrice ? Number(rawPrice) : null;

  if (pricingType === 'none') return 'без доплаты';
  const rateUnits = { per_m2: 'м²', per_linear_m: 'пог. м', per_piece: 'шт.', per_set: 'компл.' };
  if (!['per_m2', 'per_linear_m', 'per_piece', 'per_set', 'fixed'].includes(pricingType)) {
    return `неизвестный тип расценки «${pricingType}»`;
  }
  if (price == null) return pricingType === 'fixed' ? 'фиксированная цена не задана' : 'цена за единицу не задана';
  if (!Number.isFinite(price) || price < 0) return 'некорректная цена (укажите число не меньше 0)';

  const formattedPrice = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(price);
  if (pricingType === 'fixed') return `${formattedPrice} ₽ фиксированно`;
  const source = answer?.quantity_source || answer?.quantitySource || (pricingType === 'per_m2' ? 'area' : '');
  const sourceLabel = source === 'area' ? 'площадь сценария' : quantityLabels[source] || source || 'источник количества не выбран';
  return `${formattedPrice} ₽ / ${rateUnits[pricingType]}; количество из «${sourceLabel}»`;
}

function buildCalculatorSummary(content = {}) {
  const scenarios = Array.isArray(content.scenarios) ? content.scenarios : [];
  const lines = [
    'ПРАВИЛА РАСЧЁТА',
    'Итог = сумма стоимости выбранных вариантов: цена за единицу × количество из указанного числового поля; фиксированная цена добавляется один раз.',
    'После сложения итог округляется до целого рубля. Обязательные вопросы нужно заполнить; необязательные можно пропустить.',
    'Поддерживаются ставки за м², погонный метр, штуку, комплект и фиксированную сумму; варианты «Без доплаты» не входят в сумму.',
    'В вопросе с несколькими вариантами цены всех выбранных ответов складываются. Числовые ответы становятся источниками количества, если к ним привязан тариф.',
    'Для расчёта нужна хотя бы одна выбранная расценка с корректной ценой и заполненным источником количества.',
    `Переключатель первого вопроса «${String(content.callback_label || 'Хочу оставить только заявку на звонок — без расчёта').trim()}» отправляет заявку на звонок без расчёта цены.`,
    '',
    'СЦЕНАРИИ, ВОПРОСЫ И РАСЦЕНКИ'
  ];

  if (!scenarios.length) {
    lines.push('Сценарии пока не добавлены.');
    return lines.join('\n');
  }

  scenarios.forEach((scenario, scenarioIndex) => {
    const scenarioName = String(scenario?.name || '').trim() || `Сценарий ${scenarioIndex + 1} (без названия)`;
    const questions = Array.isArray(scenario?.questions) ? scenario.questions : [];
    const minimum = scenario?.area_min == null || scenario.area_min === '' ? 1 : scenario.area_min;
    const maximum = scenario?.area_max == null || scenario.area_max === '' ? 500 : scenario.area_max;
    const quantityLabels = Object.fromEntries(questions.filter(question => question.type === 'number').map((question, index) => [
      question.key || `question-${index + 1}`,
      `${question.question || `Числовой вопрос ${index + 1}`}${question.unit ? ` (${question.unit})` : ''}`
    ]));
    lines.push('', `${scenarioIndex + 1}. ${scenarioName} — площадь: ${scenario.area_question || 'Площадь помещения'}, диапазон ${minimum}–${maximum} м²${scenario.area_required === 'no' || scenario.area_required === false ? ', необязательно' : ', обязательно'}.`);

    if (!questions.length) {
      lines.push('   Вопросы пока не добавлены.');
      return;
    }

    questions.forEach((question, questionIndex) => {
      const questionText = String(question?.question ?? '').trim();
      const questionType = question?.type || 'single';
      const typeLabels = { single: 'один вариант', multiple: 'несколько вариантов', text: 'текстовый ответ', number: 'числовой ответ' };
      const isRequired = question?.required !== 'no' && question?.required !== false;
      lines.push(`   ${scenarioIndex + 1}.${questionIndex + 1} ${questionText || 'Вопрос без названия'} — ${typeLabels[questionType] || 'один вариант'}, ${isRequired ? 'обязательный' : 'необязательный'}.`);
      if (!questionText) lines.push('      Не отображается на сайте: заполните текст вопроса.');
      if (questionType === 'number') {
        lines.push(`      Числовое поле; единица: ${question.unit || 'не выбрана'}.`);
        return;
      }
      if (questionType === 'text') {
        lines.push('      Свободный текстовый ответ, не участвует в расчёте.');
        return;
      }

      const answers = Array.isArray(question?.answers) ? question.answers : [];
      if (!answers.some(answer => String(answer?.label ?? '').trim() && answer?.enabled !== 'no' && answer?.enabled !== false)) {
        lines.push('      Нет включённых вариантов с заполненным названием.');
      }
      answers.forEach((answer, answerIndex) => {
        const label = String(answer?.label ?? '').trim() || `Вариант ${answerIndex + 1} (без названия, не отображается)`;
        const disabled = answer?.enabled === 'no' || answer?.enabled === false ? ' [выключен]' : '';
        lines.push(`      • ${label}${disabled} — ${describeCalculatorRate(answer, quantityLabels)}.`);
      });
    });
  });

  return lines.join('\n');
}

function renderImageField(name, value, pathPrefix) {
  const prefix = pathPrefix || '';
  const dataBg = value ? ` data-bg="${escapeHtml(value)}"` : '';
  const fileName = `${name}_file`;
  const urlInputName = prefix ? `${prefix}.${name}_url` : `${name}_url`;
  const fullFileName = prefix ? `${prefix}.${fileName}` : fileName;
  return `
    <div class="section-editor__image-row">
      <div class="section-editor__image-preview" id="preview-${escapeHtml(urlInputName.replace(/[.]/g, '_').replace(/\[/g, '_').replace(/]/g, '_'))}"${dataBg}></div>
      <input type="hidden" name="${escapeHtml(urlInputName)}" value="${escapeHtml(value || '')}">
      <div class="section-editor__image-controls">
        <input type="file" name="${escapeHtml(fullFileName)}" class="section-editor__file-input" accept="image/jpeg,image/png,image/webp" data-preview="preview-${escapeHtml(urlInputName.replace(/[.]/g, '_').replace(/\[/g, '_').replace(/]/g, '_'))}" data-single-upload="true" data-field-name="${escapeHtml(name)}" data-url-input-name="${escapeHtml(urlInputName)}" data-path-prefix="${escapeHtml(prefix)}">
      </div>
    </div>
  `;
}

function renderCropImageField(field, value, pathPrefix) {
  const name = field.name;
  const label = field.label || name;
  const dataBg = value ? ` data-bg="${escapeHtml(value)}"` : '';
  const fileName = `${name}_file`;

  // Get crop config from field
  const aspectRatio = field.aspectRatio || 1;
  const outputWidth = field.outputWidth || 800;
  const outputHeight = field.outputHeight || 600;
  const ratioLabel = formatRatio(aspectRatio);

  // Compute the full input names based on the repeater path prefix
  const fullInputName = pathPrefix ? `${pathPrefix}.${fileName}` : fileName;
  const urlInputName = pathPrefix ? `${pathPrefix}.${name}_url` : `${name}_url`;
  const previewId = `preview-${escapeHtml(urlInputName.replace(/[.]/g, '_').replace(/\[/g, '_').replace(/]/g, '_'))}`;

  // Pass crop config to the file input via data attribute — includes stable IDs for confirmation
  const cropConfig = JSON.stringify({
    name, // logical name inside item (before/after) — used when building FormData
    aspectRatio,
    outputWidth,
    outputHeight,
    pathPrefix: pathPrefix || '',
    urlInputName,
    previewId
  });

  return `
    <div class="section-editor__image-row">
      <div class="section-editor__image-preview" id="${previewId}"${dataBg}></div>
      <input type="hidden" name="${escapeHtml(urlInputName)}" value="${escapeHtml(value || '')}">
      <div class="section-editor__image-controls">
        <input type="file" name="${escapeHtml(fullInputName)}" class="section-editor__file-input" accept="image/*"
               data-crop-image='${escapeHtml(cropConfig)}'>
        <div class="section-editor__crop-info" style="margin-top: 8px; font-size: 0.875rem; color: var(--dark-gray);">
          Будет обрезано до ${outputWidth}×${outputHeight} (${ratioLabel})
        </div>
      </div>
    </div>
  `;
}

function renderVideoField(field, value, pathPrefix) {
  const name = field.name;
  const label = field.label || name;
  const previewStyle = value
    ? 'background-size: contain; background-repeat: no-repeat;'
    : 'background: var(--bg); background-size: contain; background-repeat: no-repeat;';
  const dataBg = value ? ` data-bg="${escapeHtml(value)}"` : '';
  const videoName = `${name}_file`;
  const fullVideoName = pathPrefix ? `${pathPrefix}.${videoName}` : videoName;
  const urlInputName = pathPrefix ? `${pathPrefix}.${name}_url` : `${name}_url`;
  const previewId = `preview-${escapeHtml(urlInputName.replace(/[.]/g, '_').replace(/\[/g, '_').replace(/]/g, '_'))}`;
  const dataPath = pathPrefix ? escapeHtml(pathPrefix) : '';
  return `
    <div class="section-editor__image-row">
      <div class="section-editor__image-preview" id="${previewId}" style="${previewStyle}"${dataBg}></div>
      <input type="hidden" name="${escapeHtml(urlInputName)}" value="${escapeHtml(value || '')}">
      <div class="section-editor__image-controls">
        <input type="file" name="${escapeHtml(fullVideoName)}" class="section-editor__file-input"
               accept="video/mp4" data-preview="${previewId}"
               data-video-field="${escapeHtml(name)}"
               data-video-path="${dataPath}">
        <div class="section-editor__crop-info" style="margin-top: 8px; font-size: 0.875rem; color: var(--dark-gray);">
          Формат: MP4 (H.264). Первый кадр видео станет обложкой. Максимальный размер: 100 MB
        </div>
      </div>
    </div>
  `;
}

// ─── Crop Modal State ───
let cropState = {
  cropper: null,
  originalFile: null,
  config: null,
  previousUrl: null,
  objectUrl: null,
  urlInputName: null,
  previewId: null
};

function openCropModal(file, config) {
  console.log('[openCropModal] start, config keys:', Object.keys(config || {}));
  const image = document.getElementById('cropImage');
  const modal = document.getElementById('cropModal');

  if (!image || !modal) return;

  // Revoke any previous temp object URL (do NOT revoke public URLs)
  if (cropState.objectUrl) {
    URL.revokeObjectURL(cropState.objectUrl);
    cropState.objectUrl = null;
  }

  const urlInputName = config.urlInputName || `${config.pathPrefix ? config.pathPrefix + '.' : ''}${config.name}_url`;
  const previewId = config.previewId || `preview-${escapeHtml(urlInputName.replace(/[.]/g, '_').replace(/\[/g, '_').replace(/]/g, '_'))}`;

  // Capture the existing public URL so we can delete it only on successful replacement
  const urlInput = document.querySelector(`input[name="${escapeHtml(urlInputName)}"]`);
  const existingUrl = urlInput ? urlInput.value : '';

  cropState.originalFile = file;
  cropState.config = config;
  cropState.previousUrl = existingUrl;
  cropState.urlInputName = urlInputName;
  cropState.previewId = previewId;

  // Update modal info with human-readable ratio labels
  const ratioLabel = formatRatio(config.aspectRatio);
  document.getElementById('cropAspectRatio').textContent = `Соотношение: ${ratioLabel}`;
  document.getElementById('cropDimensions').textContent = `Размер: ${config.outputWidth}×${config.outputHeight}`;

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');

  // Initialize Cropper.js after image loads
  function initCropper() {
    if (cropState.cropper) {
      cropState.cropper.destroy();
      cropState.cropper = null;
    }
    cropState.objectUrl = URL.createObjectURL(file);
    image.src = cropState.objectUrl;
    cropState.cropper = new Cropper(image, {
      aspectRatio: config.aspectRatio,
      viewMode: 1,
      responsive: true,
      restore: true,
      zoomable: true,
      scalable: true,
      rotatable: false,
      autoCropArea: 1,
      checkOrientation: true
    });
  }

  if (image.complete) {
    // Image is already loaded (cached)
    initCropper();
  } else {
    // Wait for image to load
    image.onload = initCropper;
    image.onerror = () => {
      console.error('Failed to load image for cropping');
      // Show error in modal, keep modal open so user can retry
      const modalBody = document.getElementById('cropModal').querySelector('.admin-table-section__detail-grid') || document.getElementById('cropModal');
      const existingError = modalBody.querySelector('.modal-notification');
      if (existingError) existingError.remove();
      const errorNotify = document.createElement('div');
      errorNotify.className = 'modal-notification modal-notification--error';
      errorNotify.textContent = 'Не удалось загрузить изображение для обрезки. Пожалуйста, выберите другое изображение.';
      errorNotify.setAttribute('role', 'alert');
      Object.assign(errorNotify.style, {
        padding: '12px 16px',
        borderRadius: 'var(--radius)',
        fontSize: '0.875rem',
        fontWeight: '600',
        marginBottom: '16px',
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fecaca'
      });
      // Insert before the image preview if available, otherwise at top of modal
      const preview = document.getElementById(cropState.previewId);
      if (preview && preview.parentNode) {
        preview.parentNode.insertBefore(errorNotify, preview);
      } else {
        modalBody.insertBefore(errorNotify, modalBody.firstChild);
      }
      // Auto-dismiss after 8 seconds
      setTimeout(() => errorNotify.remove(), 8000);
    };
  }
}

function closeCropModal() {
  const modal = document.getElementById('cropModal');
  const image = document.getElementById('cropImage');

  // Destroy cropper
  if (cropState.cropper) {
    cropState.cropper.destroy();
    cropState.cropper = null;
  }

  // Revoke ONLY the temporary object URL — never revoke public URLs
  if (cropState.objectUrl) {
    URL.revokeObjectURL(cropState.objectUrl);
    cropState.objectUrl = null;
  }

  if (image) image.src = '';

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');

  // Clear state but keep previousUrl for potential confirmation
  cropState.originalFile = null;
  cropState.config = null;
  cropState.urlInputName = null;
  cropState.previewId = null;
}

// Helper: display ratio as "4:3" or "16:9" instead of "1.33"/"1.78"
function formatRatio(ratio) {
  const r = Number(ratio);
  if (Math.abs(r - 4 / 3) < 0.001) return '4:3';
  if (Math.abs(r - 16 / 9) < 0.001) return '16:9';
  return r.toFixed(2);
}

// Unified file upload — handles single image, crop-image and video fields.
// Determines the endpoint from the logical field name, uploads the file,
// updates the hidden _url input + preview, and deletes the old file on success.
// Accepts optional progress, processing, and cancellation callbacks.
async function uploadField(file, { fieldName, pathPrefix, urlInputName, previewId, previousUrl }, { onProgress, onProcessing, signal } = {}) {
  const endpoint = fieldName === 'video'
    ? '/api/upload/video'
    : fieldName === 'before' || fieldName === 'after'
      ? '/api/upload/gallery'
      : '/api/upload/image';

  if (endpoint === '/api/upload/image' && file.size > 8 * 1024 * 1024) {
    file = await resizeImageForUpload(file);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const ext = endpoint.includes('video') ? 'mp4' : 'webp';
    const formData = new FormData();
    const uploadFieldName = endpoint === '/api/upload/image' ? 'image' : fieldName;
    formData.append(uploadFieldName, file, `${uploadFieldName}.${ext}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.upload.onload = () => {
      if (fieldName === 'video' && onProcessing) onProcessing();
    };

    xhr.onload = async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let errMsg = `Ошибка загрузки (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          errMsg = data.message || errMsg;
        } catch (_) { /* ignore */ }
        return reject(new Error(errMsg));
      }

      let data;
      try { data = JSON.parse(xhr.responseText); } catch (_) { return reject(new Error('Неверный ответ сервера')); }

      if (!data.success) {
        return reject(new Error(data.message || 'Ошибка загрузки файла'));
      }

      const url = data.paths?.[uploadFieldName];
      if (!url) {
        return reject(new Error('Не получен URL файла из ответа сервера'));
      }

      // Persist URL into the hidden _url input and update the preview
      const urlInput = document.querySelector(`input[name="${escapeHtml(urlInputName)}"]`);
      if (urlInput) urlInput.value = url;

      setPreviewBackground(document.getElementById(previewId), url);

      resolve(url);
    };

    xhr.onerror = () => reject(new Error('Сетевая ошибка при загрузке'));
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки'));

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Загрузка отменена'));
      });
    }

    xhr.open('POST', endpoint);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

async function resizeImageForUpload(file) {
  const image = await createImageBitmap(file);
  try {
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось подготовить фотографию к загрузке');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) throw new Error('Не удалось подготовить фотографию к загрузке');
    if (blob.size > 10 * 1024 * 1024) {
      throw new Error('Фотография после сжатия превышает лимит 10 МиБ');
    }
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  } finally {
    image.close();
  }
}

async function confirmCrop() {
  console.log('[confirmCrop] start, cropState:', { hasCropper: !!cropState.cropper, configName: cropState.config?.name });
  const cropper = cropState.cropper;
  if (!cropper) {
    console.warn('[confirmCrop] no cropper, abort');
    return;
  }

  try {
    // Get cropped canvas with exact output dimensions
    const canvas = cropper.getCroppedCanvas({
      width: cropState.config.outputWidth,
      height: cropState.config.outputHeight
    });

    if (!canvas) {
      throw new Error('Не удалось обрезать изображение');
    }

    // Export as WebP Blob with quality 0.85
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error('Ошибка экспорта WebP')),
        'image/webp',
        0.85
      );
    });

    const config = cropState.config;

    if (config.name === 'before' || config.name === 'after') {
      // Gallery images are queued and uploaded transactionally at save time,
      // together with the PATCH — matching the single-image/video flow.
      // Each request carries one field (before OR after), which the backend
      // accepts for gallery uploads.
      const key = `crop:${config.urlInputName}`;
      queuePendingUpload(key, {
        file: blob,
        fieldName: config.name,
        urlInputName: config.urlInputName,
        previewId: config.previewId,
        pathPrefix: config.pathPrefix || ''
      });
      showPendingPreview(key, blob, config.previewId);
      // Close modal only on success
      closeCropModal();
    } else {
      await uploadField(blob, {
        fieldName: config.name,
        pathPrefix: config.pathPrefix || '',
        urlInputName: config.urlInputName,
        previewId: config.previewId,
        previousUrl: cropState.previousUrl
      });
      // Close modal only on success
      closeCropModal();
    }
  } catch (err) {
    console.error('Crop error:', err);
    // DO NOT close modal on error — preserve user's crop session so they can retry
    const modalBody = document.getElementById('cropModal').querySelector('.admin-table-section__detail-grid') || document.getElementById('cropModal');
    const existingError = modalBody.querySelector('.modal-notification');
    if (existingError) existingError.remove();
    const errorNotify = document.createElement('div');
    errorNotify.className = 'modal-notification modal-notification--error';
    errorNotify.textContent = `Ошибка обрезки/загрузки: ${err.message}`;
    errorNotify.setAttribute('role', 'alert');
    Object.assign(errorNotify.style, {
      padding: '12px 16px',
      borderRadius: 'var(--radius)',
      fontSize: '0.875rem',
      fontWeight: '600',
      marginBottom: '16px',
      background: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca'
    });
    modalBody.insertBefore(errorNotify, modalBody.firstChild);
    setTimeout(() => errorNotify.remove(), 8000);
  }
}

// Create a minimal valid MP4 placeholder for the video field
function createPlaceholderVideo() {
  // Minimal ISO BMFF (MP4) with ftyp + empty mdat boxes
  const ftyp = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, // box size (24)
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6F, 0x6D, // 'isom'
    0x00, 0x00, 0x02, 0x00, // minor version
    0x69, 0x73, 0x6F, 0x6D, // compatible brand
    0x69, 0x73, 0x6F, 0x6D  // compatible brand
  ]);

  const mdat = new Uint8Array([
    0x00, 0x00, 0x00, 0x08, // box size (8)
    0x6D, 0x64, 0x61, 0x74, // 'mdat'
    0x00, 0x00, 0x00, 0x00  // empty data
  ]);

  return new Blob([ftyp, mdat], { type: 'video/mp4' });
}

// Create a minimal 1x1 WebP placeholder image
function createPlaceholderImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, 1, 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Ошибка создания placeholder')),
      'image/webp',
      0.5
    );
  });
}

// Create a minimal 1x1 WebP placeholder thumbnail
function createPlaceholderThumbnail() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, 1, 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Ошибка')),
      'image/webp',
      0.5
    );
  });
}

// Modal event listeners
document.addEventListener('DOMContentLoaded', () => {
  const cropModal = document.getElementById('cropModal');
  if (!cropModal) return;

  document.getElementById('cropCancelBtn')?.addEventListener('click', () => {
    closeCropModal();
  });

  document.getElementById('cropConfirmBtn')?.addEventListener('click', async () => {
    try {
      await confirmCrop();
    } catch (err) {
      console.error('Crop confirm error:', err);
      // Show error inline in the modal
      const modalBody = document.getElementById('cropModal').querySelector('.admin-table-section__detail-grid') || document.getElementById('cropModal');
      const existingError = modalBody.querySelector('.modal-notification');
      if (existingError) existingError.remove();
      const errorNotify = document.createElement('div');
      errorNotify.className = 'modal-notification modal-notification--error';
      errorNotify.textContent = `Ошибка подтверждения: ${err.message}`;
      errorNotify.setAttribute('role', 'alert');
      Object.assign(errorNotify.style, {
        padding: '12px 16px',
        borderRadius: 'var(--radius)',
        fontSize: '0.875rem',
        fontWeight: '600',
        marginBottom: '16px',
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fecaca'
      });
      modalBody.insertBefore(errorNotify, modalBody.firstChild);
      setTimeout(() => errorNotify.remove(), 8000);
    }
  });

  document.getElementById('cropModalClose')?.addEventListener('click', () => {
    closeCropModal();
  });

  // Close on overlay click
  cropModal.addEventListener('click', (e) => {
    if (e.target === cropModal) {
      closeCropModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !cropModal.hidden) {
      closeCropModal();
    } else if (e.key === 'Escape' && isSaving) {
      cancelUpload();
    }
  });
});

// Ловим необработанные.reject промисы для диагностики ошибок
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
});

function renderRepeaterField(field, value) {
  const items = Array.isArray(value) ? value : [];
  const itemFields = field.itemFields || [];
  const fieldName = field.name;

  let html = `
    <div class="section-editor__repeater" data-repeater="${escapeHtml(fieldName)}">
  `;

  items.forEach((item, index) => {
    html += renderRepeaterItem(fieldName, itemFields, item, index, items.length);
  });

  html += `
      <button type="button" class="section-editor__repeater-add" data-add-to="${escapeHtml(fieldName)}">
        + Добавить
      </button>
    </div>
  `;
  return html;
}

function renderRepeaterItem(parentName, itemFields, item, index, itemCount = index + 1) {
  const isSimpleArray = itemFields.length === 1 && itemFields[0].name === '';
  const itemData = isSimpleArray ? item : (item || {});

  let html = `
    <div class="section-editor__repeater-item" data-index="${index}">
      <div class="section-editor__repeater-header">
        <span class="section-editor__repeater-num">${index + 1}</span>
        <div class="section-editor__repeater-actions">
          <button type="button" class="section-editor__repeater-move" data-move-item="up" aria-label="Переместить выше" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="section-editor__repeater-move" data-move-item="down" aria-label="Переместить ниже" ${index === itemCount - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="section-editor__repeater-remove" data-remove-from="${escapeHtml(parentName)}" data-index="${index}">Удалить</button>
        </div>
      </div>
  `;

  if (isSimpleArray) {
    html += `
      <input type="text" name="${escapeHtml(parentName)}[${index}]" class="section-editor__input"
             value="${escapeHtml(item ?? '')}" placeholder="${escapeHtml(itemFields[0].label || 'Значение')}">
    `;
  } else {
    for (const subField of itemFields) {
      const subName = subField.name;
      const subValue = itemData[subName] ?? '';
      const subLabel = subField.label || subName;
      const subType = subField.type || 'text';

      html += `
        <div class="section-editor__repeater-row${subType === 'textarea' ? ' section-editor__repeater-row--full' : ''}">
      `;

      if (subType === 'repeater') {
        html += renderRepeaterField({ ...subField, name: `${parentName}[${index}].${subName}` }, subValue);
      } else if (subType === 'select') {
        const options = (subField.options || []).map(opt =>
          `<option value="${escapeHtml(opt.value)}" ${subValue === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
        ).join('');
        html += `
          <div class="section-editor__group">
            <label class="section-editor__label">${escapeHtml(subLabel)}</label>
            <select name="${escapeHtml(`${parentName}[${index}].${subName}`)}" class="section-editor__select">
              ${options}
            </select>
          </div>
        `;
      } else if (subType === 'crop-image') {
        html += renderCropImageField({ ...subField, name: subName }, subValue, `${parentName}[${index}]`);
      } else if (subType === 'video') {
        html += renderVideoField({ name: subName, type: 'video', label: subLabel }, subValue, `${parentName}[${index}]`);
      } else if (subType === 'textarea') {
        html += `
          <div class="section-editor__group">
            <label class="section-editor__label">${escapeHtml(subLabel)}</label>
            <textarea name="${escapeHtml(`${parentName}[${index}].${subName}`)}" class="section-editor__textarea">${escapeHtml(subValue)}</textarea>
          </div>
        `;
      } else if (subType === 'checkbox') {
        const checked = subValue === true || subValue === 'true' || subValue === 'on' || subValue === 'yes';
        html += `
          <div class="section-editor__group">
            <label class="section-editor__label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" name="${escapeHtml(`${parentName}[${index}].${subName}`)}" value="true" ${checked ? 'checked' : ''}>
              <span>${escapeHtml(subLabel)}</span>
            </label>
          </div>
        `;
      } else {
        const inputType = subType === 'number' ? 'number' : 'text';
        const min = subField.min != null ? ` min="${escapeHtml(subField.min)}"` : '';
        const step = subField.step != null ? ` step="${escapeHtml(subField.step)}"` : '';
        html += `
          <div class="section-editor__group">
            <label class="section-editor__label">${escapeHtml(subLabel)}</label>
            <input type="${inputType}" name="${escapeHtml(`${parentName}[${index}].${subName}`)}" class="section-editor__input"
                   value="${escapeHtml(subValue)}"${min}${step}>
          </div>
        `;
      }

      html += `</div>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderObjectField(field, value) {
  const obj = value || {};
  const itemFields = field.itemFields || [];
  const fieldName = field.name;

  let html = `
    <div class="section-editor__repeater" data-object="${escapeHtml(fieldName)}" style="border: 1px solid var(--light-gray);">
  `;

  for (const subField of itemFields) {
    const subName = subField.name;
    const subValue = obj[subName];
    const subLabel = subField.label || subName;
    const subType = subField.type || 'text';

    if (subType === 'object' || subType === 'repeater') {
      html += `
        <div class="section-editor__group" style="margin-bottom: 8px;">
          <label class="section-editor__label">${escapeHtml(subLabel)}</label>
      `;
      if (subType === 'object') {
        html += renderObjectField({ ...subField, name: `${fieldName}.${subName}` }, subValue);
      } else {
        html += renderRepeaterField({ ...subField, name: `${fieldName}.${subName}` }, subValue);
      }
      html += `</div>`;
    } else {
      const inputType = subType === 'number' ? 'number' : (subType === 'checkbox' ? 'checkbox' : 'text');

      html += `
        <div class="section-editor__group">
          <label class="section-editor__label">${escapeHtml(subLabel)}</label>
      `;

      if (subType === 'checkbox') {
        html += `
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" name="${escapeHtml(`${fieldName}.${subName}`)}" ${subValue ? 'checked' : ''}>
            <span>${escapeHtml(subLabel)}</span>
          </label>
        `;
      } else {
        html += `
          <input type="${inputType}" name="${escapeHtml(`${fieldName}.${subName}`)}" class="section-editor__input"
                 value="${escapeHtml(subValue ?? '')}">
        `;
      }
      html += `</div>`;
    }
  }

  html += `</div>`;
  return html;
}

// Current upload abort controller for cancellation
let currentAbortController = null;

// Cancel ongoing upload
async function cancelUpload() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

// Make cancel function globally accessible for UI
window.cancelUpload = cancelUpload;

// Custom confirmation that returns a Promise resolving to true/false
function customConfirm(message) {
  return new Promise((resolve) => {
    // Create confirm box in save status area
    const confirmBox = document.createElement('div');
    confirmBox.className = 'confirmation-box';
    Object.assign(confirmBox.style, {
      padding: '12px 16px',
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: 'var(--radius)',
      marginBottom: '16px',
      fontSize: '0.875rem',
      fontWeight: '600',
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    });

    const text = document.createElement('span');
    text.textContent = message;
    text.style.flex = '1';

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px' });

    const confirmButton = document.createElement('button');
    confirmButton.className = 'btn btn--danger';
    confirmButton.textContent = 'Да';
    Object.assign(confirmButton.style, { padding: '6px 16px', fontSize: '0.8rem' });

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn--ghost';
    cancelButton.textContent = 'Нет';
    Object.assign(cancelButton.style, { padding: '6px 16px', fontSize: '0.8rem' });

    actions.append(confirmButton, cancelButton);
    confirmBox.append(text, actions);

    // Insert at the beginning of the save status area
    if (saveStatusEl && saveStatusEl.firstChild) {
      saveStatusEl.insertBefore(confirmBox, saveStatusEl.firstChild);
    } else if (saveStatusEl) {
      saveStatusEl.appendChild(confirmBox);
    }

    confirmButton.addEventListener('click', () => {
      confirmBox.remove();
      resolve(true);
    });
    cancelButton.addEventListener('click', () => {
      confirmBox.remove();
      resolve(false);
    });
  });
}

async function handleSave(e, key, form, saveBtn) {
  e.preventDefault();
  if (isSaving) return;

  isSaving = true;
  saveBtn.disabled = true;
  saveBtn.querySelector('.btn-text').textContent = 'Сохранение…';
  saveBtn.querySelector('.btn-loader').hidden = false;
  saveStatusEl.textContent = 'Загружаю файлы...';
  saveStatusEl.className = 'section-editor__save-status';

  // Create abort controller for this save operation
  currentAbortController = new AbortController();

  // Track pending replacements for transactional file replacement
  // Format: { inputEl, urlInputName, previewId, previousUrl, newUrl, cleanedUp }
  const pendingReplacements = [];
  let uploadAborted = false;

  try {
    const uploadEntries = Array.from(pendingUploads.entries());
    let uploadedCount = 0;

    // Upload all queued files first (before serializing form data)
    for (const [inputEl, entry] of uploadEntries) {
      try {
        await uploadField(entry.file, entry.config, {
          onProgress: (percent) => {
            if (uploadedCount > 0) {
              // Show overall progress when processing multiple files
              const totalPercent = Math.round(((uploadedCount - 1 + percent / 100) / uploadEntries.length) * 100);
              saveStatusEl.textContent = `Загружено: ${totalPercent}%`;
            } else {
              saveStatusEl.textContent = `Загружается: ${percent}%`;
            }
          },
          onProcessing: () => {
            saveStatusEl.textContent = 'Сервер обрабатывает видео…';
          },
          signal: currentAbortController.signal
        });
        const urlInput = document.querySelector(`input[name="${entry.config.urlInputName}"]`);
        const newUrl = entry.config.url || (urlInput ? urlInput.value : '');
        if (urlInput) urlInput.value = newUrl;

        uploadedCount++;

        // Track this replacement for transactional handling
        pendingReplacements.push({
          inputEl,
          urlInputName: entry.config.urlInputName,
          previewId: entry.config.previewId,
          previousUrl: entry.config.previousUrl,
          newUrl: newUrl,
          cleanedUp: false
        });
      } catch (err) {
        if (err.message === 'Загрузка отменена') {
          uploadAborted = true;
          saveStatusEl.textContent = 'Загрузка отменена пользователем';
          saveStatusEl.classList.add('warning');
          return;
        }
        console.error('Upload failed:', err);

        // Provide clear error message without redundant prefix
        let errorMessage = err.message;
        if (err.message.startsWith('Ошибка ') && err.message.includes('HTTP')) {
          // Backend HTTP error like "Ошибка 413" - show as-is
          errorMessage = err.message;
        } else if (err.message === 'Не удалось соединиться с сервером') {
          // Network error
          errorMessage = 'Сетевая ошибка: не удалось соединиться с сервером';
        } else {
          // Validation or other backend error - show as-is (already specific)
          errorMessage = err.message;
        }

        saveStatusEl.textContent = errorMessage;
        saveStatusEl.classList.add('error');
        return;
      }
    }

    // Clear pending uploads to prevent re-upload on retry
    pendingUploads.clear();
    currentAbortController = null;

    const formData = new FormData(form);
    const content = parseFormData(formData);
    if (key === 'calculator') {
      content.scenarios = Array.isArray(content.scenarios) ? content.scenarios : [];
      if (!content.scenarios.length) {
        saveStatusEl.textContent = 'Добавьте хотя бы один сценарий расчёта.';
        saveStatusEl.classList.add('error');
        return;
      }
      content.scenarios.forEach(scenario => {
        scenario.questions = Array.isArray(scenario.questions) ? scenario.questions : [];
        scenario.questions.forEach(question => {
          question.answers = Array.isArray(question.answers) ? question.answers : [];
        });
      });
      content.questions = [];
      content.area_question ||= 'Площадь квартиры по полу';
      content.callback_label ||= 'Хочу оставить только заявку на звонок — без расчёта';
    }
    if (key === 'variants') {
      content.items = Array.isArray(content.items) ? content.items : [];
    }
    if (key === 'navigation') {
      content.links = Array.isArray(content.links) ? content.links : [];
    }

    saveStatusEl.textContent = 'Сохраняю данные...';

    const res = await api.patch(`/api/sections/${key}`, { content });

    if (res.success) {
      // PATCH succeeded - now delete old files (transactional replacement)
      let hadDeleteFailure = false;
      let deleteFailureDetails = '';

      for (const replacement of pendingReplacements) {
        if (replacement.cleanedUp || !replacement.previousUrl) continue;

        // Skip if no previousUrl (nothing to delete)
        if (!replacement.previousUrl || !replacement.previousUrl.startsWith('/img/')) continue;

        try {
          const deletePath = replacement.previousUrl.replace('/img/', '');
          const delRes = await api.delete(`/api/upload/${deletePath}`);
          if (delRes.success) {
            replacement.cleanedUp = true;
          } else {
            // Delete failed but data was saved - log but don't fail
            console.error(`[TRANSACTION] Failed to delete old file: ${replacement.previousUrl}`, delRes);
            hadDeleteFailure = true;
            deleteFailureDetails = ` Старый файл не удалён: ${replacement.previousUrl}`;
            replacement.cleanedUp = true; // Mark as handled to prevent retry
          }
        } catch (delErr) {
          // 404 = old file already absent; non-fatal for transactional replacement
          if (delErr.status === 404) {
            replacement.cleanedUp = true;
            console.info(JSON.stringify({
              event: 'ADMIN_FILE_REPLACE_SUCCESS',
              timestamp: new Date().toISOString(),
              endpoint: `/api/sections/${key}`,
              method: 'PATCH',
              status: 200,
              oldFilePath: replacement.previousUrl,
              newFilePath: replacement.newUrl,
              note: 'old file already absent (404), non-fatal'
            }));
          } else {
            console.error(`[TRANSACTION] Delete request failed for old file: ${replacement.previousUrl}`, delErr);
            hadDeleteFailure = true;
            deleteFailureDetails = ` Ошибка удаления старого файла: ${replacement.previousUrl}`;
            replacement.cleanedUp = true;
          }
        }
      }

      const replacementFiles = pendingReplacements
        .filter(replacement => replacement.newUrl)
        .map(replacement => ({
          field: replacement.inputEl?.name || replacement.urlInputName,
          oldFilePath: replacement.previousUrl,
          newFilePath: replacement.newUrl
        }));

      logAdminEvent('ADMIN_FILE_REPLACE_SUCCESS', {
        sectionKey: key,
        endpoint: `/api/sections/${key}`,
        method: 'PATCH',
        status: 200,
        replacements: replacementFiles,
        hadDeleteFailure
      });

      sectionCache.delete(key);
      const replacementNames = replacementFiles.map(replacement => replacement.newFilePath).join(', ');
      saveStatusEl.textContent = hadDeleteFailure
        ? `Сохранено${deleteFailureDetails}`
        : `Сохранено: ${replacementNames || 'данные секции'}`;
      saveStatusEl.classList.remove('error');
      saveStatusEl.classList.add('success');
    } else {
      throw new Error(res.message);
    }
  } catch (err) {
    // Handle PATCH failure or upload abort
    if (err.message === 'Загрузка отменена' || uploadAborted) {
      saveStatusEl.textContent = 'Загрузка отменена пользователем';
      saveStatusEl.className = 'section-editor__save-status warning';
    } else {
      // PATCH failed - revert all new URLs and delete uploaded files
      console.log('[TRANSACTION] PATCH failed, rolling back uploads:', pendingReplacements.length);

      let rollbackError = false;
      for (const replacement of pendingReplacements) {
        if (replacement.cleanedUp || !replacement.newUrl) continue;

        try {
          // Revert URL input and preview
          const urlInput = document.querySelector(`input[name="${escapeHtml(replacement.urlInputName)}"]`);
          if (urlInput && replacement.previousUrl) {
            urlInput.value = replacement.previousUrl;
          }

          const preview = document.getElementById(replacement.previewId);
          if (preview) {
            if (replacement.previousUrl) {
              preview.style.backgroundImage = `url('${escapeHtml(replacement.previousUrl)}')`;
            } else {
              preview.style.backgroundImage = '';
            }
          }

          // Delete newly uploaded file
          const deletePath = replacement.newUrl.replace('/img/', '');
          const delRes = await api.delete(`/api/upload/${deletePath}`);
          if (!delRes.success) {
            console.error(`[TRANSACTION] Failed to delete new file during rollback: ${replacement.newUrl}`, delRes);
          }
        } catch (delErr) {
          console.error(`[TRANSACTION] Error during rollback for: ${replacement.newUrl}`, delErr);
          rollbackError = true;
        }

        replacement.cleanedUp = true;
      }

      saveStatusEl.textContent = rollbackError
        ? `Ошибка: ${err.message} (частичный откат)`
        : `Ошибка: ${err.message}`;
      saveStatusEl.classList.remove('warning');
      saveStatusEl.classList.add('error');
    }
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
    saveBtn.querySelector('.btn-text').textContent = 'Сохранить';
    saveBtn.querySelector('.btn-loader').hidden = true;
    currentAbortController = null;
  }
}

function parseFormData(formData) {
  const result = {};

  for (const [key, value] of formData.entries()) {
    // Skip file inputs — uploaded files are persisted via their *_url field only.
    // Without this, empty file inputs would be saved as junk {}/"" in content.
    if (typeof File !== 'undefined' && value instanceof File) {
      continue;
    }
    if (key.endsWith('_url')) {
      // Handle image/video URL fields - use setNested for proper nested path handling
      if (value) {
        const baseKey = key.slice(0, -4); // Remove '_url' suffix
        setNested(result, baseKey, value);
      }
      continue;
    }
    // Handle dot-notation keys like option1.title, compare.col1_title
    if (key.includes('.')) {
      setNested(result, key, value);
      continue;
    }
    if (key.endsWith(']')) {
      // Nested array/object: items[0].title or items[0]
      setNested(result, key, value);
    } else {
      // Simple field: try parse number, but preserve leading zeros (e.g. '01' → keep as '01', not 1)
      if (value === '') result[key] = null;
      else if (/^0\d/.test(value)) result[key] = value; // keep '01', '001' etc.
      else result[key] = isNaN(value) ? value : Number(value);
    }
  }

  return result;
}

// Recursive descent parser for dot/bracket paths.
// Handles: "option1.title", "items[0].title", "items[0]", "compare.col1_title"
function setNested(obj, path, value) {
  const match = path.match(/^([^\.\[]+)(?:\[(\d+)\])?(?:\.(.+))?$/);
  if (!match) return;

  const [, baseKey, indexStr, rest] = match;
  const index = indexStr !== undefined ? parseInt(indexStr, 10) : undefined;

  // Array index path: items[0], items[0].title, etc.
  if (index !== undefined) {
    if (!obj[baseKey]) obj[baseKey] = [];
    if (!Array.isArray(obj[baseKey])) obj[baseKey] = [obj[baseKey]];
    if (!obj[baseKey][index]) obj[baseKey][index] = {};
    if (rest) {
      setNested(obj[baseKey][index], rest, value);
    } else {
      // Leaf value — preserve leading zeros and numeric coercion
      if (value === '') obj[baseKey][index] = null;
      else if (/^0\d/.test(value)) obj[baseKey][index] = value;
      else obj[baseKey][index] = isNaN(value) ? value : Number(value);
    }
    return;
  }

  // Nested object path: option1.title, compare.col1_title
  if (rest) {
    if (!obj[baseKey] || typeof obj[baseKey] !== 'object' || Array.isArray(obj[baseKey])) {
      obj[baseKey] = {};
    }
    setNested(obj[baseKey], rest, value);
    return;
  }

  // Simple key — preserve leading zeros, coerce numbers
  if (value === '') {
    obj[baseKey] = null;
  } else if (/^0\d/.test(value)) {
    obj[baseKey] = value;
  } else {
    obj[baseKey] = isNaN(value) ? value : Number(value);
  }
}

function resetForm(key, form) {
  sectionCache.delete(key); // Force fresh fetch on next selectTab
  selectTab(key);
}

function escapeHtml(str) {
  if (str == null) return '';
  if (typeof str !== 'string' && typeof str !== 'number') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Recursively find a nested field config by its path (e.g. "items[0].items")
function findNestedField(fields, path) {
  const match = path.match(/^([^\[]+)(.*)$/);
  const name = match[1];
  const rest = match[2]; // e.g. [0].items or empty
  const field = fields?.find(f => f.name === name);
  if (!field) return null;
  if (rest === '') return field;
  // rest is like [0].subField — parse the index and sub-path
  const next = rest.match(/^\[(\d+)\](.*)$/);
  if (!next) return null;
  const subIndex = parseInt(next[1], 10);
  const subRest = next[2]; // .subField or .subField[0].deeper
  if (subRest.startsWith('.')) {
    const subName = subRest.slice(1).replace(/^\d+\]\./, '').replace(/^\d+\]/, '');
    // Find the parent repeater item's index to get the right itemFields
    const subFieldName = subName.replace(/\[\d+\]$/, '');
    const idxMatch = subRest.match(/\[\d+\]/g);
    // Walk down nested itemFields
    let currentFields = field.itemFields;
    const indices = (subRest.match(/\[\d+\]/g) || []).map(s => parseInt(s.slice(1, -1), 10));
    for (let i = 0; i < indices.length - 1; i++) {
      const sub = currentFields?.find(f => f.name?.startsWith(subName.split('[')[0]));
      if (sub?.itemFields) currentFields = sub.itemFields;
      else break;
    }
    // Find the final field
    const finalName = subRest.replace(/^\./, '').replace(/\[\d+\]\.?/g, '').replace(/\[\d+\]$/, '');
    return currentFields?.find(f => f.name === finalName || f.name?.startsWith(finalName));
  }
  return null;
}

// Find a field config by its full path (e.g. "items[0].items" or "tags[0]").
// Walks down the field tree, skipping array indices, following itemFields.
function findFieldRecursive(fields, targetName) {
  if (!fields) return null;
  // Extract just the field names, skipping indices: "items[0].items" → ["items","items"]
  const names = targetName.split(/[.\[\]]/).filter(s => s && !/^\d+$/.test(s));
  let currentFields = fields;
  for (let i = 0; i < names.length; i++) {
    const field = currentFields?.find(f => f.name === names[i]);
    if (!field) return null;
    if (i === names.length - 1) return field;
    if (field.itemFields) currentFields = field.itemFields;
    else return null;
  }
  return null;
}

// Handle dynamic events (add/remove repeater items, image preview)
editorContainer.addEventListener('click', (e) => {
  const moveButton = e.target.closest('[data-move-item]');
  if (moveButton) {
    const item = moveButton.closest('.section-editor__repeater-item');
    const repeater = item?.parentElement;
    if (!item || !repeater?.matches('[data-repeater]')) return;
    const sibling = moveButton.dataset.moveItem === 'up' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling?.matches('.section-editor__repeater-item')) return;
    if (moveButton.dataset.moveItem === 'up') repeater.insertBefore(item, sibling);
    else repeater.insertBefore(sibling, item);
    reindexRepeater(repeater.dataset.repeater);
    const form = editorContainer.querySelector('form');
  if (currentKey === 'calculator') populateCalculatorQuantitySources(form);
    refreshCalculatorSummary(form);
    return;
  }

  // Add repeater item
  const addButton = e.target.closest('[data-add-to]');
  if (addButton) {
    const repeaterName = addButton.dataset.addTo;
    const repeater = editorContainer.querySelector(`[data-repeater="${repeaterName}"]`);
    if (repeater) {
      const items = repeater.querySelectorAll(':scope > .section-editor__repeater-item');
      const newIndex = items.length;
      // Get field config to know itemFields — search nested fields too
      const config = SECTION_FIELDS[currentKey];
      const field = findFieldRecursive(config?.fields, repeaterName);
      if (field && field.itemFields) {
        const html = renderRepeaterItem(repeaterName, field.itemFields, {}, newIndex, newIndex + 1);
        addButton.insertAdjacentHTML('beforebegin', html);
        reindexRepeater(repeaterName);
        const form = editorContainer.querySelector('form');
        if (currentKey === 'calculator') populateCalculatorQuantitySources(form);
        refreshCalculatorSummary(form);
      }
    }
  }

  // Remove repeater item
  const removeButton = e.target.closest('[data-remove-from]');
  if (removeButton) {
    const repeaterName = removeButton.dataset.removeFrom;
    const index = parseInt(removeButton.dataset.index, 10);
    const repeater = editorContainer.querySelector(`[data-repeater="${repeaterName}"]`);
    if (repeater) {
      const item = repeater.querySelector(`[data-index="${index}"]`);
      if (item) item.remove();
      reindexRepeater(repeaterName);
      const form = editorContainer.querySelector('form');
      if (currentKey === 'calculator') populateCalculatorQuantitySources(form);
      refreshCalculatorSummary(form);
    }
  }
});

// Single image file select — queue upload for save time (no immediate upload)
editorContainer.addEventListener('change', (e) => {
  if (e.target.matches('input[type="file"][data-single-upload]')) {
    const file = e.target.files[0];
    const urlInputName = e.target.dataset.urlInputName;
    const previewId = e.target.dataset.preview;
    const fieldName = e.target.dataset.fieldName || 'image';
    if (file && urlInputName && previewId) {
      queuePendingUpload(e.target, {
        file,
        fieldName,
        urlInputName,
        previewId,
        pathPrefix: e.target.dataset.pathPrefix || '',
      });
      showPendingPreview(e.target, file, previewId);
    }
  }
});

// Crop-image file select — open crop modal
editorContainer.addEventListener('change', (e) => {
  if (e.target.matches('input[type="file"][data-crop-image]')) {
    const file = e.target.files[0];
    const fieldConfig = JSON.parse(e.target.dataset.cropImage);
    if (file) {
      openCropModal(file, fieldConfig);
    }
  }
});

// Video file select — queue upload for save time (no immediate upload)
editorContainer.addEventListener('change', (e) => {
  if (e.target.matches('input[type="file"][data-video-field]')) {
    const file = e.target.files[0];
    const fieldName = 'video';
    const pathPrefix = e.target.dataset.videoPath || '';
    const fieldKey = e.target.dataset.videoField;
    const urlInputName = pathPrefix ? `${pathPrefix}.${fieldKey}_url` : `${fieldKey}_url`;
    const previewId = e.target.dataset.preview;
    if (file && urlInputName && previewId) {
      queuePendingUpload(e.target, {
        file,
        fieldName,
        urlInputName,
        previewId,
        pathPrefix,
      });
      showPendingPreview(e.target, file, previewId);
    }
  }
});

function reindexRepeater(repeaterName) {
  const repeater = editorContainer.querySelector(`[data-repeater="${repeaterName}"]`);
  if (!repeater) return;
  const items = repeater.querySelectorAll(':scope > .section-editor__repeater-item');
  items.forEach((item, index) => {
    item.dataset.index = index;
    item.querySelector('.section-editor__repeater-num').textContent = index + 1;
    const removeButton = item.querySelector(':scope > .section-editor__repeater-header [data-remove-from]');
    if (removeButton) removeButton.dataset.index = index;
    const moveUpButton = item.querySelector(':scope > .section-editor__repeater-header [data-move-item="up"]');
    const moveDownButton = item.querySelector(':scope > .section-editor__repeater-header [data-move-item="down"]');
    if (moveUpButton) moveUpButton.disabled = index === 0;
    if (moveDownButton) moveDownButton.disabled = index === items.length - 1;
    // Update input names — only replace the outermost bracket index (the one
    // matching this repeater), preserving inner indices for nested repeaters.
    item.querySelectorAll('[name]').forEach(input => {
      const name = input.getAttribute('name');
      const prefix = `${repeaterName}[`;
      if (name.startsWith(prefix)) {
        const rest = name.slice(prefix.length);
        const bracketEnd = rest.indexOf(']');
        if (bracketEnd !== -1) {
          const newName = `${repeaterName}[${index}]${rest.slice(bracketEnd + 1)}`;
          input.setAttribute('name', newName);
        }
      }
    });
    item.querySelectorAll('[data-repeater], [data-add-to], [data-remove-from]').forEach(element => {
      for (const attribute of ['data-repeater', 'data-add-to', 'data-remove-from']) {
        const value = element.getAttribute(attribute);
        const prefix = `${repeaterName}[`;
        if (!value?.startsWith(prefix)) continue;
        const bracketEnd = value.indexOf(']', prefix.length);
        if (bracketEnd !== -1) {
          element.setAttribute(attribute, `${repeaterName}[${index}]${value.slice(bracketEnd + 1)}`);
        }
      }
    });
  });
}
