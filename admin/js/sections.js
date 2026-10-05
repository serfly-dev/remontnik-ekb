import { api } from './api.js';

/**
 * Sections Editor — Tab-based UI for editing landing page sections.
 * Each section key maps to a specific form configuration.
 */

const SECTION_KEYS = [
  { key: 'hero', label: 'Hero', description: 'Главный экран сайта: заголовок, подзаголовок, кнопки и главное фото' },
  { key: 'services', label: 'Услуги', description: 'Карточки услуг мастера с описанием и списком работ' },
  { key: 'gallery', label: 'Галерея', description: 'Фото работ клиентов: пары изображений до/после' },
  { key: 'clientVideo', label: 'Видео клиента', description: 'Видеоотзывы, которые выводятся на главной странице' },
  { key: 'variants', label: 'Варианты', description: 'Форматы работы: "Замер" и "Замер + материалы" с ценами и этапами' },
  { key: 'calculator', label: 'Калькулятор', description: 'Настройки тарифов, коэффициентов и цены за замер' },
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
      ]}
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
  variants: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'option1', type: 'object', label: 'Вариант 1', itemFields: [
        { name: 'num', type: 'text', label: 'Номер' },
        { name: 'title', type: 'text', label: 'Название' },
        { name: 'price', type: 'number', label: 'Цена (₽)' },
        { name: 'desc', type: 'textarea', label: 'Описание' },
        { name: 'steps', type: 'repeater', label: 'Этапы', itemFields: [
          { name: '', type: 'text', label: 'Этап' }
        ]},
        { name: 'cta', type: 'text', label: 'Текст кнопки' },
        { name: 'cta_href', type: 'text', label: 'Ссылка кнопки' }
      ]},
      { name: 'option2', type: 'object', label: 'Вариант 2', itemFields: [
        { name: 'num', type: 'text', label: 'Номер' },
        { name: 'title', type: 'text', label: 'Название' },
        { name: 'price', type: 'number', label: 'Цена (₽)' },
        { name: 'desc', type: 'textarea', label: 'Описание' },
        { name: 'steps', type: 'repeater', label: 'Этапы', itemFields: [
          { name: '', type: 'text', label: 'Этап' }
        ]},
        { name: 'cta', type: 'text', label: 'Текст кнопки' },
        { name: 'cta_href', type: 'text', label: 'Ссылка кнопки' },
        { name: 'is_featured', type: 'checkbox', label: 'Рекомендуемый' }
      ]},
      { name: 'compare', type: 'object', label: 'Сравнение', itemFields: [
        { name: 'col1_title', type: 'text', label: 'Колонка 1 заголовок' },
        { name: 'col1_text', type: 'textarea', label: 'Колонка 1 текст' },
        { name: 'col2_title', type: 'text', label: 'Колонка 2 заголовок' },
        { name: 'col2_text', type: 'textarea', label: 'Колонка 2 текст' }
      ]}
    ]
  },
  faq: {
    fields: [
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'questions', type: 'repeater', label: 'Вопросы', itemFields: [
        { name: 'question', type: 'text', label: 'Вопрос' },
        { name: 'answer', type: 'textarea', label: 'Ответ' }
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
      { name: 'rates', type: 'object', label: 'Тарифы (₽/м²)', description: 'Стоимость за квадратный метр для разных типов жилья и состояния', itemFields: [
        { name: 'newBuilding', type: 'object', label: 'Новостройка', itemFields: [
          { name: 'finished', type: 'number', label: 'Есть ремонт' },
          { name: 'unfinished', type: 'number', label: 'Без отделки' },
          { name: 'whiteBox', type: 'number', label: 'White Box' }
        ]},
        { name: 'secondary', type: 'object', label: 'Вторичка', itemFields: [
          { name: 'finished', type: 'number', label: 'Есть ремонт' },
          { name: 'unfinished', type: 'number', label: 'Без отделки' },
          { name: 'whiteBox', type: 'number', label: 'White Box' }
        ]}
      ]},
      { name: 'coefficients', type: 'object', label: 'Коэффициенты проекта', description: 'Множители для корректировки цены в зависимости от ситуации', itemFields: [
        { name: 'hasProject', type: 'number', label: 'Есть проект', description: 'Множитель, если у клиента уже есть дизайн-проект' },
        { name: 'needsChanges', type: 'number', label: 'Нужны правки', description: 'Множитель, если требуется доработка проекта' },
        { name: 'noProject', type: 'number', label: 'Нет проекта', description: 'Множитель, если проекта нет' }
      ]},
      { name: 'measurement_fee', type: 'number', label: 'Плата за замер (₽)', description: 'Фиксированная стоимость выезда и замера' }
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
  const res = await api.get(`/api/sections/${key}`);
  if (!res.success) throw new Error(res.message);
  sectionCache.set(key, res.data);
  return res.data;
}

function renderEditor(key, section) {
  const config = SECTION_FIELDS[key];
  if (!config) {
    editorContainer.innerHTML = '<p>Нет конфигурации для этой секции</p>';
    return;
  }

  const content = section.content || {};
  const title = section.title || key;

  let html = `
    <div class="section-editor__head">
      <h2 class="section-editor__title">${escapeHtml(title)}</h2>
      <span class="section-editor__status">Ключ: ${escapeHtml(key)}</span>
    </div>
    <form class="section-editor__form" data-section="${escapeHtml(key)}">
  `;

  for (const field of config.fields) {
    html += renderField(field, content[field.name]);
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
        <input type="file" name="${escapeHtml(fullFileName)}" class="section-editor__file-input" accept="image/*" data-preview="preview-${escapeHtml(urlInputName.replace(/[.]/g, '_').replace(/\[/g, '_').replace(/]/g, '_'))}" data-single-upload="true" data-field-name="${escapeHtml(name)}" data-url-input-name="${escapeHtml(urlInputName)}" data-path-prefix="${escapeHtml(prefix)}">
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
// Accepts optional { onProgress, signal } for progress UI and cancellation.
async function uploadField(file, { fieldName, pathPrefix, urlInputName, previewId, previousUrl }, { onProgress, signal } = {}) {
  const endpoint = fieldName === 'video'
    ? '/api/upload/video'
    : fieldName === 'before' || fieldName === 'after'
      ? '/api/upload/gallery'
      : '/api/upload/image';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const ext = endpoint.includes('video') ? 'mp4' : 'webp';
    const formData = new FormData();
    formData.append(fieldName, file, `${fieldName}.${ext}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
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

      const url = data.paths?.[fieldName];
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
    html += renderRepeaterItem(fieldName, itemFields, item, index);
  });

  html += `
      <button type="button" class="section-editor__repeater-add" data-add-to="${escapeHtml(fieldName)}">
        + Добавить
      </button>
    </div>
  `;
  return html;
}

function renderRepeaterItem(parentName, itemFields, item, index) {
  const isSimpleArray = itemFields.length === 1 && itemFields[0].name === '';
  const itemData = isSimpleArray ? item : (item || {});

  let html = `
    <div class="section-editor__repeater-item" data-index="${index}">
      <div class="section-editor__repeater-header">
        <span class="section-editor__repeater-num">${index + 1}</span>
        <button type="button" class="section-editor__repeater-remove" data-remove-from="${escapeHtml(parentName)}" data-index="${index}">Удалить</button>
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
        <div class="section-editor__repeater-row">
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
      } else {
        const inputType = subType === 'number' ? 'number' : 'text';
        html += `
          <div class="section-editor__group">
            <label class="section-editor__label">${escapeHtml(subLabel)}</label>
            <input type="${inputType}" name="${escapeHtml(`${parentName}[${index}].${subName}`)}" class="section-editor__input"
                   value="${escapeHtml(subValue)}">
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
  if (typeof str !== 'string') return ''; // Guard: prevent [object Object] in inputs
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
  // Add repeater item
  if (e.target.matches('[data-add-to]')) {
    const repeaterName = e.target.dataset.addTo;
    const repeater = editorContainer.querySelector(`[data-repeater="${repeaterName}"]`);
    if (repeater) {
      const items = repeater.querySelectorAll(':scope > .section-editor__repeater-item');
      const newIndex = items.length;
      // Get field config to know itemFields — search nested fields too
      const config = SECTION_FIELDS[currentKey];
      const field = findFieldRecursive(config?.fields, repeaterName);
      if (field && field.itemFields) {
        const html = renderRepeaterItem(repeaterName, field.itemFields, {}, newIndex);
        e.target.insertAdjacentHTML('beforebegin', html);
        reindexRepeater(repeaterName);
      }
    }
  }

  // Remove repeater item
  if (e.target.matches('[data-remove-from]')) {
    const repeaterName = e.target.dataset.removeFrom;
    const index = parseInt(e.target.dataset.index, 10);
    const repeater = editorContainer.querySelector(`[data-repeater="${repeaterName}"]`);
    if (repeater) {
      const item = repeater.querySelector(`[data-index="${index}"]`);
      if (item) item.remove();
      reindexRepeater(repeaterName);
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
    item.querySelectorAll('[data-index]').forEach(el => el.dataset.index = index);
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
  });
}
