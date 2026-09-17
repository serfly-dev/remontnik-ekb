import { requireAuth } from '../middleware/auth.middleware.js';
import {
  uploadGallery,
  uploadVideo,
  uploadImage,
  uploadGalleryHandler,
  uploadVideoHandler,
  uploadImageHandler,
  deleteUploadedFile,
  ensureUploadDirectories,
  logMultipartParsed
} from '../controllers/upload.controller.js';

function logUploadError(req, err, reason) {
  console.info(JSON.stringify({
    event: 'ADMIN_UPLOAD_FAILED',
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    reason,
    error: err.message,
    stack: err.stack
  }));
}

function uploadErrorHandler(err, req, res, next) {
  if (!err) return next();

  // Custom errors with statusCode (from fileFilter, etc.)
  if (err.statusCode) {
    logUploadError(req, err, 'validation_error');
    return res.status(err.statusCode).json({ success: false, message: err.message || 'Ошибка загрузки файла' });
  }

  if (err.name === 'MulterError') {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        logUploadError(req, err, 'file_too_large');
        return res.status(413).json({ success: false, message: 'Размер файла превышает допустимый лимит' });

      case 'LIMIT_UNEXPECTED_FILE':
        logUploadError(req, err, 'unexpected_field');
        return res.status(400).json({ success: false, message: 'Обнаружены неожиданные файлы' });

      case 'LIMIT_FILE_COUNT':
        logUploadError(req, err, 'too_many_files');
        return res.status(400).json({ success: false, message: 'Превышено количество файлов' });

      case 'LIMIT_FIELD_KEY':
        logUploadError(req, err, 'field_key_too_long');
        return res.status(400).json({ success: false, message: 'Имя поля слишком длинное' });

      case 'LIMIT_FIELD_VALUE':
        logUploadError(req, err, 'field_value_too_long');
        return res.status(400).json({ success: false, message: 'Значение поля слишком длинное' });

      case 'LIMIT_FIELD_COUNT':
        logUploadError(req, err, 'too_many_fields');
        return res.status(400).json({ success: false, message: 'Превышено количество полей' });

      case 'LIMIT_PART_COUNT':
        logUploadError(req, err, 'too_many_parts');
        return res.status(400).json({ success: false, message: 'Превышено количество частей multipart-запроса' });

      default:
        logUploadError(req, err, `multer_error_${err.code}`);
        return res.status(400).json({ success: false, message: 'Ошибка загрузки файла' });
    }
  }

  // Catch-all for any other unexpected errors
  logUploadError(req, err, 'unexpected_error');
  res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера при загрузке' });
}

export function initUploadRoutes(app) {
  // Protected: admin only
  app.post('/api/upload/gallery', requireAuth, ensureUploadDirectories, uploadGallery, logMultipartParsed, uploadGalleryHandler, uploadErrorHandler);
  app.post('/api/upload/video', requireAuth, ensureUploadDirectories, uploadVideo, logMultipartParsed, uploadVideoHandler, uploadErrorHandler);
  app.post('/api/upload/image', requireAuth, ensureUploadDirectories, uploadImage, logMultipartParsed, uploadImageHandler, uploadErrorHandler);
  app.delete('/api/upload/:mediaType/:filename', requireAuth, deleteUploadedFile);
app.delete('/api/upload/:filename', requireAuth, deleteUploadedFile);
}