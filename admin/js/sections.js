import { api } from './api.js';

/**
 * Sections Editor — Tab-based UI for editing landing page sections.
 * Each section key maps to a specific form configuration.
 */

const SECTION_KEYS = [
  { key: 'hero', label: 'Hero' },
  { key: 'services', label: 'Услуги' },
  { key: 'portfolio', label: 'Портфолио' },
  { key: 'variants', label: 'Варианты' },
  { key: 'calculator', label: 'Калькулятор' },
  { key: 'cta', label: 'CTA' },
  { key: 'faq', label: 'FAQ' },
  { key: 'process', label: 'Процесс' },
  { key: 'applications', label: 'Заявки' } // Special tab for applications
];

const sectionCache = new Map();
let currentKey = null;
let isSaving = false;

// Form field definitions per section
const SECTION_FIELDS = {
  hero: {
    fields: [
      { name: 'eyebrow', type: 'text', label: 'Эйбров (надзаголовок)' },
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
        { name: 'num', type: 'text', label: 'Число' },
        { name: 'label', type: 'text', label: 'Подпись' }
      ]}
    ]
  },
  services: {
    fields: [
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
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
  portfolio: {
    fields: [
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'note', type: 'textarea', label: 'Примечание' },
      { name: 'items', type: 'repeater', label: 'Работы', itemFields: [
        { name: 'title', type: 'text', label: 'Название' },
        { name: 'type', type: 'select', label: 'Тип', options: [
          { value: 'feature', label: 'Feature (крупное)' },
          { value: 'wide', label: 'Wide (широкое)' },
          { value: 'std', label: 'Standard' },
          { value: 'tall', label: 'Tall (высокое)' }
        ] },
        { name: 'image', type: 'image', label: 'Изображение' },
        { name: 'alt', type: 'text', label: 'Alt' },
        { name: 'tags', type: 'repeater', label: 'Теги', itemFields: [
          { name: '', type: 'text', label: 'Тег' }
        ]}
      ]}
    ]
  },
  variants: {
    fields: [
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
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
        { name: 'num_badge', type: 'text', label: 'Бейдж' },
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
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'questions', type: 'repeater', label: 'Вопросы', itemFields: [
        { name: 'question', type: 'text', label: 'Вопрос' },
        { name: 'answer', type: 'textarea', label: 'Ответ' }
      ]}
    ]
  },
  process: {
    fields: [
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
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
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
      { name: 'title', type: 'text', label: 'Заголовок' },
      { name: 'rates', type: 'object', label: 'Тарифы (₽/м²)', itemFields: [
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
      { name: 'coefficients', type: 'object', label: 'Коэффициенты проекта', itemFields: [
        { name: 'hasProject', type: 'number', label: 'Есть проект' },
        { name: 'needsChanges', type: 'number', label: 'Нужны правки' },
        { name: 'noProject', type: 'number', label: 'Нет проекта' }
      ]},
      { name: 'measurement_fee', type: 'number', label: 'Плата за замер (₽)' }
    ]
  },
  cta: {
    fields: [
      { name: 'eyebrow', type: 'text', label: 'Эйбров' },
      { name: 'eyebrow_num', type: 'text', label: 'Номер секции' },
      { name: 'title', type: 'textarea', label: 'Заголовок', hint: 'Используйте \\n для переносов строк' },
      { name: 'subtitle', type: 'textarea', label: 'Подзаголовок' },
      { name: 'cta_primary', type: 'text', label: 'Кнопка 1 (текст)' },
      { name: 'cta_primary_href', type: 'text', label: 'Кнопка 1 (ссылка)' },
      { name: 'cta_secondary', type: 'text', label: 'Кнопка 2 (текст)' },
      { name: 'cta_secondary_href', type: 'text', label: 'Кнопка 2 (ссылка)' },
      { name: 'telegram', type: 'text', label: 'Telegram username' },
      { name: 'telegram_link', type: 'text', label: 'Telegram URL' },
      { name: 'whatsapp', type: 'text', label: 'WhatsApp (видимый)' },
      { name: 'whatsapp_link', type: 'text', label: 'WhatsApp URL' },
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
    btn.addEventListener('click', () => selectTab(btn.dataset.section));
  });
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
          <button type="submit" class="btn btn--primary" id="saveBtn">
            <span class="btn-text">Сохранить</span>
            <span class="btn-loader" hidden></span>
          </button>
          <button type="button" class="btn btn--ghost" id="resetBtn">Сбросить</button>
        </div>
        <div class="section-editor__save-status" id="saveStatus"></div>
      </div>
    </form>
  `;

  editorContainer.innerHTML = html;
  editorContainer.setAttribute('aria-hidden', 'false');

  saveStatusEl = document.getElementById('saveStatus');
  const form = editorContainer.querySelector('form');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');

  form.addEventListener('submit', (e) => handleSave(e, key, form, saveBtn));
  resetBtn.addEventListener('click', () => resetForm(key, form));
}

function renderField(field, value) {
  const name = field.name;
  const label = field.label;
  const type = field.type;
  const hint = field.hint || '';
  const required = field.required ? ' required' : '';

  let html = `
    <div class="section-editor__group" data-field="${escapeHtml(name)}">
      <label class="section-editor__label">${escapeHtml(label)}</label>
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
      // Don't add label again since we did inline
      html = html.replace(`<label class="section-editor__label">${escapeHtml(label)}</label>`, '');
      break;

    case 'image':
      html += renderImageField(name, value);
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

function renderImageField(name, value) {
  const previewStyle = value ? `background-image: url('${escapeHtml(value)}')` : '';
  // Use _file suffix so the File object doesn't overwrite the URL field
  const fileName = `${name}_file`;
  return `
    <div class="section-editor__image-row">
      <div class="section-editor__image-preview" id="preview-${escapeHtml(name)}" style="${previewStyle}"></div>
      <div class="section-editor__image-controls">
        <input type="file" name="${escapeHtml(fileName)}" class="section-editor__file-input" accept="image/*" data-preview="preview-${escapeHtml(name)}">
        <input type="text" name="${escapeHtml(name)}_url" class="section-editor__input" placeholder="Или вставьте URL изображения" value="${escapeHtml(value ?? '')}">
      </div>
    </div>
  `;
}

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

async function handleSave(e, key, form, saveBtn) {
  e.preventDefault();
  if (isSaving) return;

  isSaving = true;
  saveBtn.disabled = true;
  saveBtn.querySelector('.btn-text').textContent = 'Сохранение…';
  saveBtn.querySelector('.btn-loader').hidden = false;
  saveStatusEl.textContent = '';
  saveStatusEl.className = 'section-editor__save-status';

  try {
    const formData = new FormData(form);
    const content = parseFormData(formData);

    const res = await api.patch(`/api/sections/${key}`, { content });

    if (res.success) {
      sectionCache.delete(key);
      saveStatusEl.textContent = 'Сохранено';
      saveStatusEl.classList.add('success');
    } else {
      throw new Error(res.message);
    }
  } catch (err) {
    saveStatusEl.textContent = `Ошибка: ${err.message}`;
    saveStatusEl.classList.add('error');
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
    saveBtn.querySelector('.btn-text').textContent = 'Сохранить';
    saveBtn.querySelector('.btn-loader').hidden = true;
  }
}

function parseFormData(formData) {
  const result = {};

  for (const [key, value] of formData.entries()) {
    if (key.endsWith('_url') && value) {
      // Handle image URL fallback
      const baseKey = key.replace('_url', '');
      if (!result[baseKey]) result[baseKey] = value;
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
  if (!confirm('Сбросить изменения и загрузить текущие данные с сервера?')) return;
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

// Image preview on file select
editorContainer.addEventListener('change', (e) => {
  if (e.target.matches('input[type="file"][data-preview]')) {
    const file = e.target.files[0];
    const previewId = e.target.dataset.preview;
    const preview = document.getElementById(previewId);
    if (file && preview) {
      const url = URL.createObjectURL(file);
      preview.style.backgroundImage = `url('${url}')`;
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