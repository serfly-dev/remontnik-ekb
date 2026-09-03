import { getApplications, getApplicationById, createApplication, updateApplicationStatus, deleteApplication, getApplicationStats } from '../services/applications.service.js';

const VALID_STATUSES = ['new', 'in_progress', 'completed', 'cancelled'];

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
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('List applications error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке заявок' });
  }
}

export async function getApplication(req, res) {
  try {
    const app = await getApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    }
    res.json({ success: true, data: app });
  } catch (err) {
    console.error('Get application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке заявки' });
  }
}

export async function createApplicationHandler(req, res) {
  try {
    const { name, phone, preferred_time, comment, calculator_data, calculated_price } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Имя обязательно' });
    }

    if (!phone || !validatePhone(phone)) {
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

    res.status(201).json({ success: true, data: app, message: 'Заявка создана' });
  } catch (err) {
    console.error('Create application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при создании заявки' });
  }
}

export async function updateApplicationHandler(req, res) {
  try {
    const { status } = req.body;
    const id = req.params.id;

    if (status) {
      const safeStatus = sanitizeStatus(status);
      await updateApplicationStatus(id, safeStatus);
    }

    const app = await getApplicationById(id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    }

    res.json({ success: true, data: app, message: 'Статус обновлён' });
  } catch (err) {
    console.error('Update application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при обновлении заявки' });
  }
}

export async function deleteApplicationHandler(req, res) {
  try {
    const id = req.params.id;
    const deleted = await deleteApplication(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    }
    res.json({ success: true, message: 'Заявка удалена' });
  } catch (err) {
    console.error('Delete application error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при удалении заявки' });
  }
}

export async function getStats(req, res) {
  try {
    const stats = await getApplicationStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке статистики' });
  }
}
