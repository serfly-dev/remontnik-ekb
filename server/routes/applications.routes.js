import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listApplications,
  getApplication,
  createApplicationHandler,
  updateApplicationHandler,
  deleteApplicationHandler,
  getStats
} from '../controllers/applications.controller.js';

export function initApplicationsRoutes(app) {
  // Public: create application from website
  app.post('/api/applications', createApplicationHandler);

  // Protected: admin only
  app.get('/api/applications', requireAuth, listApplications);
  app.get('/api/applications/stats', requireAuth, getStats);
  app.get('/api/applications/:id', requireAuth, getApplication);
  app.patch('/api/applications/:id', requireAuth, updateApplicationHandler);
  app.delete('/api/applications/:id', requireAuth, deleteApplicationHandler);
}
