import { api } from './api.js';

const state = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  status: '',
  search: '',
  sort: 'created_at:desc',
  currentApplicationId: null
};

const STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена'
};

const STATUS_CLASS = {
  new: 'status-badge--new',
  in_progress: 'status-badge--in_progress',
  completed: 'status-badge--completed',
  cancelled: 'status-badge--cancelled'
};

const TARIFF_LABELS = {
  measurement: 'Замер + смета работ (3 000 ₽)',
  full: 'Замер + смета работ и материалов (10 000 ₽)',
  '3 000': '3 000 ₽',
  '10 000': '10 000 ₽',
  unknown: 'Не указан'
};

// Локализация данных калькулятора
const CALC_LABELS = {
  propertyType: 'Тип объекта',
  newBuilding: 'Новостройка',
  secondary: 'Вторичное жильё',
  condition: 'Состояние квартиры',
  finished: 'Есть ремонт',
  unfinished: 'Без отделки',
  whiteBox: 'White Box',
  area: 'Площадь',
  hasProject: 'Наличие проекта',
  hasProject_label: 'Есть проект',
  needsChanges: 'Есть проект, нужны правки',
  noProject: 'Нет проекта',
  measurement: 'Нужен замер',
  yes: 'Да',
  no: 'Нет'
};

const PREFERRED_TIME_LABELS = {
  morning: 'Утро (9:00 – 12:00)',
  day: 'День (12:00 – 17:00)',
  evening: 'Вечер (17:00 – 21:00)',
  anytime: 'В любое время'
};

function localizeCalcKey(key) {
  return CALC_LABELS[key] || key;
}

function localizeCalcValue(key, value) {
  const labelKey = key + '_label';
  if (CALC_LABELS[labelKey]) return CALC_LABELS[labelKey];
  if (CALC_LABELS[value]) return CALC_LABELS[value];
  if (key === 'area') return `${value} м²`;
  return value;
}

function localizePreferredTime(value) {
  return PREFERRED_TIME_LABELS[value] || value || '—';
}

function formatDate(iso) {
  if (!iso) return '—';
  // SQLite stores local server time (UTC+5, Екатеринбург).
  // Parse as UTC then render in Asia/Yekaterinburg so any browser
  // shows the same wall-clock time regardless of the viewer's TZ.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '—';
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return new Date(utc).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Yekaterinburg'
  });
}

function formatPrice(price) {
  if (price == null || isNaN(price)) return '—';
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detectTariff(app) {
  if (app.tariff) return TARIFF_LABELS[app.tariff] || app.tariff;
  if (app.calculated_price != null) {
    if (app.calculated_price <= 3500) return TARIFF_LABELS.measurement;
    if (app.calculated_price <= 12000) return TARIFF_LABELS.full;
  }
  if (app.calculator_data && app.calculator_data.tariff) {
    return TARIFF_LABELS[app.calculator_data.tariff] || TARIFF_LABELS.unknown;
  }
  return TARIFF_LABELS.unknown;
}

// ── DOM refs ──
const $loadingState = document.getElementById('loadingState');
const $emptyState = document.getElementById('emptyState');
const $errorState = document.getElementById('errorState');
const $retryBtn = document.getElementById('retryBtn');
const $tableWrapper = document.getElementById('tableWrapper');
const $tableBody = document.getElementById('tableBody');
const $pagination = document.getElementById('pagination');
const $searchInput = document.getElementById('searchInput');
const $statusFilter = document.getElementById('statusFilter');
const $sortSelect = document.getElementById('sortSelect');
const $refreshBtn = document.getElementById('refreshBtn');
const $modal = document.getElementById('detailModal');
const $modalBody = document.getElementById('modalBody');
const $modalClose = document.getElementById('modalClose');
const $statusSelect = document.getElementById('statusSelect');
const $saveStatusBtn = document.getElementById('saveStatusBtn');
const $deleteStatusBtn = document.getElementById('deleteStatusBtn');
const $adminUser = document.getElementById('adminUser');
const $logoutBtn = document.getElementById('logoutBtn');

// ── UI state helpers ──
function showLoading() {
  $loadingState.hidden = false;
  $emptyState.hidden = true;
  $errorState.hidden = true;
  $tableWrapper.hidden = true;
  $pagination.hidden = true;
}

function showEmpty() {
  $loadingState.hidden = true;
  $emptyState.hidden = false;
  $errorState.hidden = true;
  $tableWrapper.hidden = true;
  $pagination.hidden = true;
}

function showError() {
  $loadingState.hidden = true;
  $emptyState.hidden = true;
  $errorState.hidden = false;
  $tableWrapper.hidden = true;
  $pagination.hidden = true;
}

function showTable() {
  $loadingState.hidden = true;
  $emptyState.hidden = true;
  $errorState.hidden = true;
  $tableWrapper.hidden = false;
  $pagination.hidden = state.totalPages <= 1;
}

// ── Table rendering ──
function renderTable(applications) {
  $tableBody.innerHTML = applications.map(app => {
    const createdAt = app.created_at ? new Date(app.created_at).toLocaleDateString('ru-RU') : '—';
    const phoneDisplay = app.phone || '—';
    const statusLabel = STATUS_LABELS[app.status] || app.status;
    const statusClass = STATUS_CLASS[app.status] || 'status-badge--new';
    return `
      <tr data-id="${app.id}">
        <td>#${app.id}</td>
        <td>${escapeHtml(app.name)}</td>
        <td>${escapeHtml(phoneDisplay)}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>${createdAt}</td>
        <td><button class="btn btn--ghost" data-action="view" data-id="${app.id}">Открыть</button></td>
      </tr>`;
  }).join('');

  $tableBody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openApplication(row.dataset.id);
    });
  });

  $tableBody.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openApplication(btn.dataset.id);
    });
  });
}

// ── Pagination ──
function renderPagination() {
  const nav = $pagination;
  if (state.totalPages <= 1) {
    nav.innerHTML = '';
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  const parts = [];
  parts.push(`<span class="pagination-info">${state.total} заявок</span>`);
  parts.push(`<button class="pagination-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>←</button>`);

  const maxButtons = 5;
  let start = Math.max(1, state.page - Math.floor(maxButtons / 2));
  let end = Math.min(state.totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  for (let i = start; i <= end; i++) {
    parts.push(`<button class="pagination-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`);
  }

  parts.push(`<button class="pagination-btn" data-page="${state.page + 1}" ${state.page === state.totalPages ? 'disabled' : ''}>→</button>`);

  nav.innerHTML = parts.join('');
  nav.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (page >= 1 && page <= state.totalPages) {
        state.page = page;
        loadApplications();
      }
    });
  });
}

// ── Stats ──
function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total ?? 0;
  document.getElementById('statNew').textContent = stats.byStatus?.new ?? 0;
  document.getElementById('statProgress').textContent = stats.byStatus?.in_progress ?? 0;
  document.getElementById('statCompleted').textContent = stats.byStatus?.completed ?? 0;
}

// Expose for tab switching
window.loadApplications = loadApplications;

// ── Load data ──
async function loadApplications() {
  showLoading();
  const [sortField, sortOrder] = state.sort.split(':');
  const params = {
    page: state.page,
    limit: state.limit,
    sort: sortField,
    order: sortOrder
  };
  if (state.status) params.status = state.status;
  if (state.search) params.search = state.search;

  try {
    const response = await api.get('/api/applications', params);
    const apps = response.applications || [];
    const pagination = response.pagination || {};
    state.total = pagination.total || 0;
    state.totalPages = Math.max(1, pagination.totalPages || 1);

    if (!apps.length) {
      showEmpty();
      return;
    }
    renderTable(apps);
    renderPagination();
    showTable();
  } catch (err) {
    console.error('Load error:', err);
    $errorState.textContent = err.message || 'Не удалось загрузить заявки';
    showError();
  }
}

async function loadStats() {
  try {
    const stats = await api.get('/api/applications/stats');
    renderStats(stats);
  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function loadMe() {
  try {
    const me = await api.get('/api/auth/me');
    if (me && me.user && me.user.username) {
      $adminUser.textContent = me.user.username;
    }
  } catch (err) {
    console.error('Me error:', err);
  }
}

// ── Modal: open / close ──
function closeModal() {
  $modal.hidden = true;
  $modal.setAttribute('aria-hidden', 'true');
  state.currentApplicationId = null;
}

async function openApplication(id) {
  state.currentApplicationId = id;
  $modal.hidden = false;
  $modal.setAttribute('aria-hidden', 'false');
  $modalBody.innerHTML = '<div class="admin-table-section__loading"><span class="spinner"></span></div>';

  try {
    const res = await api.get(`/api/applications/${id}`);
    const app = res.data;
    $statusSelect.value = app.status || 'new';

    $modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#${app.id}</span></div>
        <div class="detail-row"><span class="detail-label">Имя</span><span class="detail-value">${escapeHtml(app.name)}</span></div>
        <div class="detail-row"><span class="detail-label">Телефон</span><span class="detail-value detail-value--phone">${escapeHtml(app.phone || '—')}</span></div>
        <div class="detail-row"><span class="detail-label">Время связи</span><span class="detail-value">${escapeHtml(localizePreferredTime(app.preferred_time))}</span></div>
        <div class="detail-row"><span class="detail-label">Комментарий</span><span class="detail-value">${escapeHtml(app.comment || '—')}</span></div>
        <div class="detail-row"><span class="detail-label">Создана</span><span class="detail-value">${formatDate(app.created_at)}</span></div>
        <div class="detail-row"><span class="detail-label">Обновлена</span><span class="detail-value">${formatDate(app.updated_at)}</span></div>
      </div>
    `;
  } catch (err) {
    $modalBody.innerHTML = `<p class="admin-table-section__error-text">Не удалось загрузить заявку: ${err.message}</p>`;
  }
}

// ── Inline notification helpers ──
function showModalNotification(type, text) {
  const existing = $modalBody.querySelector('.modal-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `modal-notification modal-notification--${type}`;
  notification.setAttribute('role', 'alert');
  notification.textContent = text;
  Object.assign(notification.style, {
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '16px',
    lineHeight: '1.5'
  });
  if (type === 'error') {
    Object.assign(notification.style, {
      background: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca'
    });
  } else {
    Object.assign(notification.style, {
      background: '#f0fdf4',
      color: '#16a34a',
      border: '1px solid #bbf7d0'
    });
  }
  // Insert at the top of modal body, after any existing header content
  if ($modalBody.firstChild) {
    $modalBody.insertBefore(notification, $modalBody.firstChild);
  } else {
    $modalBody.appendChild(notification);
  }
  // Auto-dismiss after 8 seconds
  setTimeout(() => notification.remove(), 8000);
}

function showModalLoading() {
  const existing = $modalBody.querySelector('.modal-notification');
  if (existing) existing.remove();
  $modalBody.textContent = '';
  const loading = document.createElement('div');
  loading.className = 'admin-table-section__loading';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  const label = document.createElement('span');
  label.textContent = 'Сохранение…';
  loading.append(spinner, label);
  $modalBody.appendChild(loading);
}

// Custom confirmation that returns a Promise resolving to true/false
function customConfirm(message) {
  return new Promise((resolve) => {
    // Remove any existing confirm overlay
    const existing = $modalBody.querySelector('.modal-confirm');
    if (existing) existing.remove();

    const confirmBox = document.createElement('div');
    confirmBox.className = 'modal-confirm';
    Object.assign(confirmBox.style, {
      padding: '16px',
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: 'var(--radius)',
      marginBottom: '16px'
    });

    const text = document.createElement('p');
    text.textContent = message;
    Object.assign(text.style, {
      marginBottom: '12px',
      fontSize: '0.875rem',
      color: '#dc2626'
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px' });

    const confirmButton = document.createElement('button');
    confirmButton.className = 'btn btn--danger';
    confirmButton.textContent = 'Удалить';
    Object.assign(confirmButton.style, { padding: '6px 16px', fontSize: '0.8rem' });

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn--ghost';
    cancelButton.textContent = 'Отмена';
    Object.assign(cancelButton.style, { padding: '6px 16px', fontSize: '0.8rem' });

    actions.append(confirmButton, cancelButton);
    confirmBox.append(text, actions);

    if ($modalBody.firstChild) {
      $modalBody.insertBefore(confirmBox, $modalBody.firstChild);
    } else {
      $modalBody.appendChild(confirmBox);
    }

    confirmButton.addEventListener('click', () => { confirmBox.remove(); resolve(true); });
    cancelButton.addEventListener('click', () => { confirmBox.remove(); resolve(false); });
  });
}

// ── Save status ──
async function saveStatus() {
  if (!state.currentApplicationId) return;
  const newStatus = $statusSelect.value;
  $saveStatusBtn.disabled = true;
  $saveStatusBtn.textContent = 'Сохранение…';

  try {
    await api.patch(`/api/applications/${state.currentApplicationId}`, { status: newStatus });
    showModalNotification('success', 'Статус заявки #' + state.currentApplicationId + ' обновлён');
    closeModal();
    await Promise.all([loadApplications(), loadStats()]);
  } catch (err) {
    showModalNotification('error', 'Не удалось сохранить статус: ' + err.message);
  } finally {
    $saveStatusBtn.disabled = false;
    $saveStatusBtn.textContent = 'Сохранить';
  }
}

// ── Delete ──
async function deleteApplication() {
  if (!state.currentApplicationId) return;

  const confirmed = await customConfirm('Удалить заявку #' + state.currentApplicationId + '?');
  if (!confirmed) return;

  $deleteStatusBtn.disabled = true;
  $deleteStatusBtn.textContent = 'Удаление…';

  try {
    await api.delete(`/api/applications/${state.currentApplicationId}`);
    showModalNotification('success', 'Заявка #' + state.currentApplicationId + ' удалена');
    closeModal();
    await Promise.all([loadApplications(), loadStats()]);
  } catch (err) {
    showModalNotification('error', 'Не удалось удалить заявку: ' + err.message);
  } finally {
    $deleteStatusBtn.disabled = false;
    $deleteStatusBtn.textContent = 'Удалить';
  }
}

// ── Logout ──
async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    window.location.href = '/admin/login.html';
  }
}

// ── Bind events ──
function bindEvents() {
  $statusFilter.addEventListener('change', () => {
    state.status = $statusFilter.value;
    state.page = 1;
    loadApplications();
  });

  $sortSelect.addEventListener('change', () => {
    state.sort = $sortSelect.value;
    state.page = 1;
    loadApplications();
  });

  let searchTimeout;
  $searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = $searchInput.value.trim();
      state.page = 1;
      loadApplications();
    }, 300);
  });

  $refreshBtn.addEventListener('click', () => {
    loadApplications();
    loadStats();
  });

  if ($retryBtn) {
    $retryBtn.addEventListener('click', () => loadApplications());
  }

  if ($logoutBtn) {
    $logoutBtn.addEventListener('click', logout);
  }

  if ($modalClose) {
    $modalClose.addEventListener('click', closeModal);
  }

  if ($modal) {
    $modal.addEventListener('click', (e) => {
      if (e.target.id === 'detailModal') closeModal();
    });
  }

  if ($saveStatusBtn) {
    $saveStatusBtn.addEventListener('click', saveStatus);
  }

  if ($deleteStatusBtn) {
    $deleteStatusBtn.addEventListener('click', deleteApplication);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// ── Init ──
(async function init() {
  bindEvents();
  await loadMe();
  await Promise.all([loadApplications(), loadStats()]);
  closeModal();
})();
