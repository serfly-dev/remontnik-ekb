import { listSections as fetchSections, getSectionByKey, upsertSection as upsertSectionSvc, deleteSection as deleteSectionSvc } from '../services/sections.service.js';

const VALID_SECTION_KEYS = ['hero', 'services', 'portfolio', 'variants', 'calculator', 'cta', 'faq', 'process'];

function isValidKey(key) {
  return VALID_SECTION_KEYS.includes(key);
}

export async function listSections(req, res) {
  try {
    const sections = await fetchSections();
    res.json({ success: true, data: sections });
  } catch (err) {
    console.error('List sections error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке секций' });
  }
}

export async function getSection(req, res) {
  try {
    const { key } = req.params;
    if (!isValidKey(key)) {
      return res.status(400).json({ success: false, message: 'Некорректный ключ секции' });
    }
    const section = await getSectionByKey(key);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Секция не найдена' });
    }
    res.json({ success: true, data: section });
  } catch (err) {
    console.error('Get section error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке секции' });
  }
}

export async function upsertSection(req, res) {
  try {
    const { key } = req.params;
    if (!isValidKey(key)) {
      return res.status(400).json({ success: false, message: 'Некорректный ключ секции' });
    }

    const { content, title } = req.body;

    if (content === undefined || content === null) {
      return res.status(400).json({ success: false, message: 'Поле content обязательно' });
    }

    const section = await upsertSectionSvc(key, content, title ?? undefined);
    res.json({ success: true, data: section, message: 'Секция обновлена' });
  } catch (err) {
    console.error('Upsert section error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при сохранении секции' });
  }
}

export async function deleteSection(req, res) {
  try {
    const { key } = req.params;
    if (!isValidKey(key)) {
      return res.status(400).json({ success: false, message: 'Некорректный ключ секции' });
    }
    const deleted = await deleteSectionSvc(key);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Секция не найдена' });
    }
    res.json({ success: true, message: 'Секция удалена' });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при удалении секции' });
  }
}