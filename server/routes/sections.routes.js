import { requireAuth, requireSameOrigin } from '../middleware/auth.middleware.js';
import {
  listSections,
  getSection,
  upsertSection,
  deleteSection
} from '../controllers/sections.controller.js';

export function initSectionsRoutes(app) {
  // Public: list all sections (for frontend data fetch on page load)
  app.get('/api/sections', listSections);

  // Protected: admin only
  app.get('/api/sections/:key', requireAuth, getSection);
  app.patch('/api/sections/:key', requireAuth, requireSameOrigin, upsertSection);
  app.delete('/api/sections/:key', requireAuth, requireSameOrigin, deleteSection);
}