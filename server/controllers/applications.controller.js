import { getApplications, getApplicationById, createApplication, updateApplicationStatus, deleteApplication, getApplicationStats } from '../services/applications.service.js';

const VALID_STATUSES = ['new', 'in_progress', 'completed', 'cancelled'];

function logAdminEvent(event, req, extra = {}) {
  console.info(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    ...extra
  }));
}

function validatePhone(phone) {
  return /^\+7\s*\(\d{3}\)\s*\d{3}[-\s]*\d{2}[-\s]*\d{2}$/.test(phone);
}

function sanitizeStatus(status) {
  if (!status || !VALID_STATUSES.includes(status)) return 'new';
  return status;
}

function sanitizeSort(sort) {
  const validColumns = ['id', 'name', 'phone', 'status', 'created_at', 'updated_at', 'calculated_price'];
  const [field, order] = sort.split(':');
  const safeField = validColumns.includes(field) ? field : 'created_at';
  const safeOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `${safeField}:${safeOrder}`;
}

export async function listApplications(req, res) {
  try {
    logAdminEvent('ADMIN_APPLICATIONS_LIST_STARTED', req);
    const { status, search, page, limit, sort } = req.query;

    const sortField = sort ? sort.split(':')[0] : 'created_at';
    const sortOrder = sort?.includes(':') ? sort.split(':')[1] : 'DESC';

    const options = {
      status: status || undefined,
      search: search || undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      sortBy: sortField,
      sortOrder
    };

    const result = await getApplications(options);
    logAdminEvent('ADMIN_APPLICATIONS_LIST_SUCCESS', req, { count: result?.length || 0, status, search });
    res.json({ success: true, ...result });
  } catch (err) {
    logAdminEvent('ADMIN_APPLICATIONS_LIST_FAILED', req, { error: err.message });
    console.error('List applications error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке заявок' });
  }
}

export async function getApplication(req, res) {
  try {
    logAdminEvent('ADMIN_APPLICATION_GET_STARTED', req, { id: req.params.id });
    const app = await getApplicationById(req.params.id);
    if (!app) {
      logAdminEvent('ADMIN_APPLICATION_GET_FAILED', req, { id: req.params.id, error: 'not_found', status: 404 });
      return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    }
    logAdminEvent('ADMIN_APPLICATION_GET_SUCCESS', req, { id: req.params.id });
    res.json({ success: true, data: app });
  } catch (err) {
    logAdminEvent('ADMIN_APPLICATION_GET_FAILED', req, { id: req.params.id, error: err.message });
    console.error('Get application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке заявки' });
  }
}

export async function createApplicationHandler(req, res) {
  try {
    logAdminEvent('ADMIN_APPLICATION_CREATE_STARTED', req, { name: req.body.name?.trim(), phone: req.body.phone });
    const { name, phone, preferred_time, comment, calculator_data, calculated_price } = req.body;

    // Validation
    if (!name || !name.trim()) {
      logAdminEvent('ADMIN_APPLICATION_CREATE_FAILED', req, { error: 'name_required', status: 400 });
      return res.status(400).json({ success: false, message: 'Имя обязательно' });
    }

    if (!phone || !validatePhone(phone)) {
      logAdminEvent('ADMIN_APPLICATION_CREATE_FAILED', req, { error: 'invalid_phone', status: 400 });
      return res.status(400).json({ success: false, message: 'Телефон должен быть в формате +7 (___) ___-__-__' });
    }

    const app = await createApplication({
      name: name.trim(),
      phone,
      preferred_time: preferred_time || null,
      comment: comment || null,
      calculator_data: calculator_data || null,
      calculated_price: calculated_price || null,
      status: 'new'
    });

    logAdminEvent('ADMIN_APPLICATION_CREATE_SUCCESS', req, { id: app?.id, name: app?.name });
    res.status(201).json({ success: true, data: app, message: 'Заявка создана' });
  } catch (err) {
    logAdminEvent('ADMIN_APPLICATION_CREATE_FAILED', req, { error: err.message });
    console.error('Create application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при создании заявки' });
  }
}

export async function updateApplicationHandler(req, res) {
  try {
    logAdminEvent('ADMIN_APPLICATION_UPDATE_STARTED', req, { id: req.params.id, status: req.body.status });
    const { status } = req.body;
    const id = req.params.id;

    if (status) {
      const safeStatus = sanitizeStatus(status);
      await updateApplicationStatus(id, safeStatus);
    }

    const app = await getApplicationById(id);
    if (!app) {
      logAdminEvent('ADMIN_APPLICATION_UPDATE_FAILED', req, { id, error: 'not_found', status: 404 });
      return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    }

    logAdminEvent('ADMIN_APPLICATION_UPDATE_SUCCESS', req, { id, status: app.status });
    res.json({ success: true, data: app, message: 'Статус обновлён' });
  } catch (err) {
    logAdminEvent('ADMIN_APPLICATION_UPDATE_FAILED', req, { id: req.params.id, error: err.message });
    console.error('Update application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при обновлении заявки' });
  }
}

export async function deleteApplicationHandler(req, res) {
  try {
    logAdminEvent('ADMIN_APPLICATION_DELETE_STARTED', req, { id: req.params.id });
    const id = req.params.id;
    const deleted = await deleteApplication(id);
    if (!deleted) {
      logAdminEvent('ADMIN_APPLICATION_DELETE_FAILED', req, { id, error: 'not_found', status: 404 });
      return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    }
    logAdminEvent('ADMIN_APPLICATION_DELETE_SUCCESS', req, { id });
    res.json({ success: true, message: 'Заявка удалена' });
  } catch (err) {
    logAdminEvent('ADMIN_APPLICATION_DELETE_FAILED', req, { id: req.params.id, error: err.message });
    console.error('Delete application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при удалении заявки' });
  }
}

export async function getStats(req, res) {
  try {
    logAdminEvent('ADMIN_APPLICATION_STATS_STARTED', req);
    const stats = await getApplicationStats();
    logAdminEvent('ADMIN_APPLICATION_STATS_SUCCESS', req, { total: stats?.total });
    res.json({ success: true, ...stats });
  } catch (err) {
    logAdminEvent('ADMIN_APPLICATION_STATS_FAILED', req, { error: err.message });
    console.error('Get stats error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке статистики' });
  }
}
