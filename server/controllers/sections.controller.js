import { listSections as fetchSections, getSectionByKey, upsertSection as upsertSectionSvc, deleteSection as deleteSectionSvc } from '../services/sections.service.js';

const VALID_SECTION_KEYS = [
  'hero',
  'services',
  'about',
  'gallery',
  'clientVideo',
  'variants',
  'calculator',
  'navigation',
  'privacy',
  'cta',
  'faq',
  'process',
  'applications'
];

const VALID_NAVIGATION_TARGETS = new Set([
  '#hero', '#services', '#formats', '#gallery', '#clientVideo', '#about',
  '#faq', '#calculator', '#application', '#contacts', '#process'
]);

// Fields stored in section content that must never leave the server
// through the public sections list (admin panel still gets full content).
const INTERNAL_FIELDS_BY_SECTION = {
  calculator: ['rates', 'coefficients', 'measurement_fee']
};

// File inputs live only in the admin form. Their *_{field}_file entries are
// upload artifacts (empty objects) and must never reach the database.
function stripFileArtifacts(value) {
  if (Array.isArray(value)) {
    value.forEach(stripFileArtifacts);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.endsWith('_file')) delete value[key];
      else stripFileArtifacts(value[key]);
    }
  }
  return value;
}

function isValidKey(key) {
  return VALID_SECTION_KEYS.includes(key);
}

function isMarked(value) {
  return value === true || value === 1 || ['true', 'yes', 'on', '1'].includes(String(value).toLowerCase());
}

function validateSectionContent(key, content) {
  if (key === 'navigation' && Array.isArray(content?.links)) {
    for (const link of content.links) {
      if (link?.target && !VALID_NAVIGATION_TARGETS.has(String(link.target).trim())) {
        return 'В навигации можно ссылаться только на существующие разделы сайта';
      }
      if (String(link?.label || '').trim() && !VALID_NAVIGATION_TARGETS.has(String(link?.target || '').trim())) {
        return 'Для каждого пункта навигации выберите раздел сайта';
      }
    }
  }

  if (key === 'variants') {
    const variants = Array.isArray(content?.items)
      ? content.items
      : [content?.option1, content?.option2].filter(Boolean);
    if (variants.filter(item => isMarked(item?.is_featured)).length > 1) {
      return 'Можно выбрать только один рекомендуемый вариант';
    }
  }

  if (key === 'privacy') {
    const sections = content?.sections;
    if (!String(content?.title || '').trim() || !Array.isArray(sections) || !sections.length) {
      return 'Укажите заголовок политики и добавьте хотя бы один раздел';
    }
    if (sections.some(section => !String(section?.title || '').trim() || !String(section?.body || '').trim())) {
      return 'У каждого раздела политики должны быть название и текст';
    }
  }

  return null;
}

// Reject content that carries script-capable URL schemes in any string
// value (href/src fields, nested gallery/variants items). This is a
// defense-in-depth guard; the client also sanitizes rendered URLs.
function hasUnsafeUrl(value) {
  if (typeof value === 'string') {
    return /^\s*(javascript|data|vbscript)\s*:/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasUnsafeUrl);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(hasUnsafeUrl);
  }
  return false;
}

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

export async function listSections(req, res) {
  try {
    const sections = req.query?.key === 'privacy'
      ? [await getSectionByKey('privacy')].filter(Boolean)
      : await fetchSections();
    const publicSections = sections.map((section) => {
      const internalFields = INTERNAL_FIELDS_BY_SECTION[section.key];
      if (!internalFields || !section.content) return section;

      const content = { ...section.content };
      for (const field of internalFields) {
        delete content[field];
      }
      return { ...section, content };
    });
    res.json({ success: true, data: publicSections });
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
  const startTime = Date.now();
  const { key } = req.params;
  const { content, title } = req.body;

  logAdminEvent('ADMIN_DATA_UPDATE_STARTED', req, {
    sectionKey: key,
    fields: Object.keys(content || {}),
    hasTitle: title !== undefined
  });

  try {
    if (!isValidKey(key)) {
      logAdminEvent('ADMIN_DATA_UPDATE_FAILED', req, {
        sectionKey: key,
        reason: 'invalid_key',
        durationMs: Date.now() - startTime
      });
      return res.status(400).json({ success: false, message: 'Некорректный ключ секции' });
    }

    if (content === undefined || content === null) {
      logAdminEvent('ADMIN_DATA_UPDATE_FAILED', req, {
        sectionKey: key,
        reason: 'missing_content',
        durationMs: Date.now() - startTime
      });
      return res.status(400).json({ success: false, message: 'Поле content обязательно' });
    }

    if (hasUnsafeUrl(content)) {
      logAdminEvent('ADMIN_DATA_UPDATE_FAILED', req, {
        sectionKey: key,
        reason: 'unsafe_url_scheme',
        durationMs: Date.now() - startTime
      });
      return res.status(400).json({ success: false, message: 'URL содержит недопустимую схему (javascript:, data:, vbscript:)' });
    }

    const validationError = validateSectionContent(key, content);
    if (validationError) {
      logAdminEvent('ADMIN_DATA_UPDATE_FAILED', req, {
        sectionKey: key,
        reason: 'invalid_section_content',
        durationMs: Date.now() - startTime
      });
      return res.status(400).json({ success: false, message: validationError });
    }

    const cleaned = stripFileArtifacts(content);
    const section = await upsertSectionSvc(key, cleaned, title ?? undefined);

    logAdminEvent('ADMIN_DATA_UPDATE_SUCCESS', req, {
      sectionKey: key,
      durationMs: Date.now() - startTime
    });

    res.json({ success: true, data: section, message: 'Секция обновлена' });
  } catch (err) {
    logAdminEvent('ADMIN_DATA_UPDATE_FAILED', req, {
      sectionKey: key,
      reason: 'server_error',
      error: err.message,
      durationMs: Date.now() - startTime
    });
    console.error('Upsert section error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при сохранении секции' });
  }
}

export async function deleteSection(req, res) {
  const startTime = Date.now();
  const { key } = req.params;

  logAdminEvent('ADMIN_DATA_DELETE_STARTED', req, { sectionKey: key });

  try {
    if (!isValidKey(key)) {
      logAdminEvent('ADMIN_DATA_DELETE_FAILED', req, {
        sectionKey: key,
        reason: 'invalid_key',
        durationMs: Date.now() - startTime
      });
      return res.status(400).json({ success: false, message: 'Некорректный ключ секции' });
    }
    const deleted = await deleteSectionSvc(key);
    if (!deleted) {
      logAdminEvent('ADMIN_DATA_DELETE_FAILED', req, {
        sectionKey: key,
        reason: 'not_found',
        durationMs: Date.now() - startTime
      });
      return res.status(404).json({ success: false, message: 'Секция не найдена' });
    }

    logAdminEvent('ADMIN_DATA_DELETE_SUCCESS', req, {
      sectionKey: key,
      durationMs: Date.now() - startTime
    });

    res.json({ success: true, message: 'Секция удалена' });
  } catch (err) {
    logAdminEvent('ADMIN_DATA_DELETE_FAILED', req, {
      sectionKey: key,
      reason: 'server_error',
      error: err.message,
      durationMs: Date.now() - startTime
    });
    console.error('Delete section error:', err);
    res.status(500).json({ success: false, message: 'Ошибка при удалении секции' });
  }
}
