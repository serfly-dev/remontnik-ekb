import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listApplications,
  getApplication,
  createApplicationHandler,
  updateApplicationHandler,
  deleteApplicationHandler,
  getStats
} from '../controllers/applications.controller.js';

const applicationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 2,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  trustProxy: true,
  message: {
    success: false,
    message: 'Слишком много заявок. Повторите попытку через 5 минут'
  }
});

export function initApplicationsRoutes(app) {
  // Public: create application from website
  app.post('/api/applications', applicationLimiter, createApplicationHandler);

  // Protected: admin only
  app.get('/api/applications', requireAuth, listApplications);
  app.get('/api/applications/stats', requireAuth, getStats);
  app.get('/api/applications/:id', requireAuth, getApplication);
  app.patch('/api/applications/:id', requireAuth, updateApplicationHandler);
  app.delete('/api/applications/:id', requireAuth, deleteApplicationHandler);
}
