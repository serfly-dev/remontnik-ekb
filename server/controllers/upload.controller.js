import { randomUUID } from 'crypto';
import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import multer from 'multer';
import config from '../config/index.js';

// ─── Robust MP4 dimension parsing ──────────────────────────────────────────
// Width/height are read from the `tkhd` (Track Header) box, which per
// ISO/IEC 14496-12 is mandatory in every valid MP4 and always carries the
// track display size. Offsets are version-dependent:
//   v0: width at box start + 84, height at + 88
//   v1: width at box start + 92, height at + 96  (8-byte creation/modification)
//   v2: width at box start + 96, height at + 100 (8-byte duration as well)
// Values are stored as 16.16 fixed-point 32-bit integers.

function readBoxSize(buffer, offset) {
  const size32 = buffer.readUInt32BE(offset);
  if (size32 === 1) {
    // 64-bit box size
    return Number(buffer.readBigUInt64BE(offset + 8));
  }
  return size32;
}

function findBox(buffer, start, end, target) {
  let offset = start;
  while (offset + 8 <= end) {
    const size = readBoxSize(buffer, offset);
    if (size < 8 || offset + size > end) return -1;
    if (buffer.toString('ascii', offset + 4, offset + 8) === target) return offset;
    offset += size;
  }
  return -1;
}

function findTkhd(buffer) {
  // tkhd lives at moov → trak → tkhd
  const moov = findBox(buffer, 0, buffer.length, 'moov');
  if (moov === -1) return -1;
  const moovSize = readBoxSize(buffer, moov);
  const moovEnd = moov + moovSize;
  let offset = moov + 8;
  while (offset + 8 <= moovEnd) {
    const size = readBoxSize(buffer, offset);
    if (size < 8 || offset + size > moovEnd) break;
    if (buffer.toString('ascii', offset + 4, offset + 8) === 'trak') {
      const tkhd = findBox(buffer, offset + 8, offset + size, 'tkhd');
      if (tkhd !== -1) return tkhd;
    }
    offset += size;
  }
  return -1;
}

function fixedPointToDimension(raw) {
  if (raw > 0 && raw < 0x10000) return raw; // plain integer
  if (raw % 65536 === 0) {
    const fixed = raw / 65536;
    if (fixed >= 1 && fixed < 0x10000) return fixed; // 16.16 fixed-point
  }
  const high = raw >>> 16;
  if (high >= 1 && high < 0x10000) return high;
  return null;
}

function readVideoDimensions(filePath) {
  return fs.open(filePath, 'r').then(async (fd) => {
    try {
      const stat = await fd.stat();
      if (!stat.isFile() || stat.size <= 0) return null;
      const buffer = Buffer.alloc(stat.size);
      const { bytesRead } = await fd.read(buffer, 0, stat.size, 0);
      const data = bytesRead === stat.size ? buffer : buffer.slice(0, bytesRead);
      if (data.length < 16) return null;

      const tkhd = findTkhd(data);
      if (tkhd === -1 || tkhd + 100 > data.length) return null;

      const version = data.readUInt8(tkhd + 8);
      const widthRel = version === 1 ? 92 : version === 2 ? 96 : 84;
      const width = fixedPointToDimension(data.readUInt32BE(tkhd + widthRel));
      const height = fixedPointToDimension(data.readUInt32BE(tkhd + widthRel + 4));

      if (!width || !height) return null;
      return { width, height };
    } finally {
      await fd.close();
    }
  }).catch((err) => {
    console.error('[VIDEO-DIMENSIONS] Error reading video dimensions:', err.message);
    return null;
  });
}

async function getVideoDimensions(filePath) {
  return readVideoDimensions(filePath);
}

// Check image file integrity via magic bytes
async function isImageCorrupted(filePath, mimetype) {
  try {
    const fd = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(8);
    await fd.read(buffer, 0, 8, 0);
    await fd.close();

    // JPEG: starts with FF D8 FF
    if (mimetype === 'image/jpeg') {
      return !(buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF);
    }

    // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    if (mimetype === 'image/png') {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      return !buffer.equals(pngSignature);
    }

    // WebP: starts with RIFF header, first 4 bytes should be 'RIFF'
    if (mimetype === 'image/webp') {
      // WebP RIFF header: 'RIFF' + size + 'WEBP' + 'VP80'
      return !(buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46);
    }

    // Unknown format - cannot verify
    return false;
  } catch (err) {
    console.error('[IMAGE-CORRUPTION] Error checking file:', err.message);
    return false;
  }
}

const GALLERY_DIR = path.join(config.rootDir, 'public', 'img', 'gallery');
const VIDEO_DIR = path.join(config.rootDir, 'public', 'img', 'video');
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const IMAGE_DIR = path.join(config.rootDir, 'public', 'img');
const MEDIA_CONFIG = {
  gallery: {
    directory: GALLERY_DIR,
    fields: ['before', 'after'],
    extension: '.webp',
    publicPath: '/img/gallery'
  },
  video: {
    directory: VIDEO_DIR,
    fields: ['video'],
    extension: null,
    publicPath: '/img/video'
  },
  image: {
    directory: IMAGE_DIR,
    fields: ['image'],
    extension: '.webp',
    publicPath: '/img'
  }
};

function getExtension(mimetype, fieldname) {
  if (fieldname === 'video') return '.mp4';
  if (fieldname === 'thumbnail') return '.webp';
  const imageMimeTypes = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return imageMimeTypes[mimetype] || '.webp';
}

function getStorage(mediaType) {
  return multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, MEDIA_CONFIG[mediaType].directory);
    },
    filename: (req, file, callback) => {
      const extension = getExtension(file.mimetype, file.fieldname);
      const filename = `${Date.now()}-${randomUUID()}${extension}`;
      callback(null, filename);
    }
  });
}

function fileFilter(expectedMimetypes) {
  return (req, file, callback) => {
    if (!expectedMimetypes.includes(file.mimetype)) {
      const allowed = expectedMimetypes.join(', ');
      const error = new Error(`Недопустимый тип файла. Разрешены: ${allowed}`);
      error.statusCode = 415;
      return callback(error);
    }

    callback(null, true);
  };
}

function getLimits(mediaType) {
  if (mediaType === 'video') {
    return {
      fileSize: MAX_VIDEO_SIZE,
      files: 2
    };
  }

  return {
    fileSize: 10 * 1024 * 1024,
    files: 2
  };
}

export const uploadGallery = multer({
  storage: getStorage('gallery'),
  fileFilter: fileFilter(['image/webp', 'image/jpeg', 'image/png']),
  limits: getLimits('gallery')
}).fields([
  { name: 'before', maxCount: 1 },
  { name: 'after', maxCount: 1 }
]);

export const uploadVideo = multer({
  storage: getStorage('video'),
  fileFilter: fileFilter(['video/mp4']),
  limits: getLimits('video')
}).fields([
  { name: 'video', maxCount: 1 }
]);

export const uploadImage = multer({
  storage: getStorage('image'),
  fileFilter: fileFilter(['image/webp', 'image/jpeg', 'image/png']),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
}).fields([
  { name: 'image', maxCount: 1 }
]);

export async function ensureUploadDirectories(req, res, next) {
  const rid = req ? req.id : 'no-request-id';
  if (req) {
    console.info(JSON.stringify({
      event: 'UPLOAD_REQUEST_RECEIVED',
      timestamp: new Date().toISOString(),
      requestId: rid,
      endpoint: req.originalUrl || req.url,
      method: req.method
    }));
  }
  console.log('[UPLOAD-MIDDLEWARE] ensureUploadDirectories called');
  try {
    await Promise.all([
      fs.mkdir(GALLERY_DIR, { recursive: true }),
      fs.mkdir(VIDEO_DIR, { recursive: true }),
      fs.mkdir(IMAGE_DIR, { recursive: true })
    ]);
    console.log('[UPLOAD-MIDDLEWARE] Directories ensured');
    if (next) next();
  } catch (err) {
    console.error('[UPLOAD-MIDDLEWARE] Directory creation failed:', err);
    if (next) next(err);
  }
}

export function logMultipartParsed(req, res, next) {
  const rid = req.id;
  const files = req.files ? Object.values(req.files).flat() : [];
  console.info(JSON.stringify({
    event: 'UPLOAD_MULTIPART_PARSED',
    timestamp: new Date().toISOString(),
    requestId: rid,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    fileCount: files.length,
    fields: files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype, size: f.size }))
  }));
  next();
}

function getUploadedFiles(req) {
  const files = req.files ? Object.values(req.files).flat() : [];
  return files.filter(file => file.path);
}

async function removeUploadedFiles(files) {
  await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));
}

function hasExpectedFiles(files, expectedFields, allowPartial) {
  // Gallery requests upload one image at a time (before OR after), so a
  // partial set is valid. Other media types require all expected fields.
  if (allowPartial) {
    return expectedFields.some(field => files.some(file => file.fieldname === field));
  }
  return expectedFields.every(field => files.some(file => file.fieldname === field));
}

function validateMimeTypes(files, mediaType) {
  const allowedMimeTypes = mediaType === 'gallery'
    ? { before: ['image/webp', 'image/jpeg', 'image/png'], after: ['image/webp', 'image/jpeg', 'image/png'] }
    : mediaType === 'image'
      ? { image: ['image/webp', 'image/jpeg', 'image/png'] }
      : { video: ['video/mp4'] };

  return files.every(file => (allowedMimeTypes[file.fieldname] || []).includes(file.mimetype));
}

function validateVideoSize(files) {
  const video = files.find(file => file.fieldname === 'video');
  return !video || video.size <= MAX_VIDEO_SIZE;
}

async function validateVideoOrientation(files) {
  const video = files.find(f => f.fieldname === 'video');
  if (!video) return true; // No video = ok (will be handled elsewhere)

  const dimensions = await getVideoDimensions(video.path);
  if (!dimensions) {
    // Can't read dimensions - reject to be safe
    console.error('[VIDEO-ORIENTATION] Could not read video dimensions, rejecting');
    return false;
  }

  // Vertical (portrait) means height > width
  if (dimensions.width >= dimensions.height) {
    console.error(`[VIDEO-ORIENTATION] Rejected: ${dimensions.width}x${dimensions.height} - not vertical`);
    return false;
  }

  console.log(`[VIDEO-ORIENTATION] Accepted: ${dimensions.width}x${dimensions.height} (vertical)`);
  return true;
}

function createPublicPath(mediaType, filename) {
  return `${MEDIA_CONFIG[mediaType].publicPath}/${filename}`;
}

function createPaths(files, mediaType) {
  return files.reduce((paths, file) => {
    paths[file.fieldname] = createPublicPath(mediaType, file.filename);
    return paths;
  }, {});
}

async function validateUploadedFiles(req, res, mediaType) {
  const rid = req.id;
  console.info(JSON.stringify({
    event: 'UPLOAD_VALIDATION_STARTED',
    timestamp: new Date().toISOString(),
    requestId: rid,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    mediaType
  }));

  console.log('[UPLOAD-VALIDATE] validateUploadedFiles start', { mediaType, bodyLength: JSON.stringify(req.body).length });
  const config = MEDIA_CONFIG[mediaType];
  const files = getUploadedFiles(req);
  console.log('[UPLOAD-VALIDATE] files count:', files.length);

  const allowPartial = mediaType === 'gallery';
  if (!hasExpectedFiles(files, config.fields, allowPartial)) {
    console.log('[UPLOAD-VALIDATE] missing expected fields');
    await removeUploadedFiles(files);
    console.info(JSON.stringify({
      event: 'UPLOAD_VALIDATION_FAILED',
      timestamp: new Date().toISOString(),
      requestId: rid,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      reason: 'missing_fields',
      expectedFields: config.fields
    }));
    res.status(400).json({
      success: false,
      message: allowPartial
        ? `Загрузите фото: ${config.fields.join(' или ')}`
        : `Загрузите файлы: ${config.fields.join(', ')}`
    });
    return false;
  }

  if (!validateMimeTypes(files, mediaType) || !validateVideoSize(files)) {
    console.log('[UPLOAD-VALIDATE] mime/type or video size validation failed');
    await removeUploadedFiles(files);
    console.info(JSON.stringify({
      event: 'UPLOAD_VALIDATION_FAILED',
      timestamp: new Date().toISOString(),
      requestId: rid,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      reason: 'invalid_mime_or_size',
      files: files.map(f => ({ field: f.fieldname, mimetype: f.mimetype, size: f.size }))
    }));
    res.status(415).json({
      success: false,
      message: mediaType === 'video'
        ? 'Загрузите видео MP4/H.264. Максимальный размер видео — 100 MB'
        : 'Загрузите изображения WebP, JPEG или PNG'
    });
    return false;
  }

  // Check for empty files
  const emptyFile = files.find(f => f.size === 0);
  if (emptyFile) {
    console.log('[UPLOAD-VALIDATE] empty file:', emptyFile.filename);
    await removeUploadedFiles(files);
    console.info(JSON.stringify({
      event: 'UPLOAD_VALIDATION_FAILED',
      timestamp: new Date().toISOString(),
      requestId: rid,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      reason: 'empty_file',
      file: emptyFile.filename
    }));
    res.status(400).json({
      success: false,
      message: `Файл ${emptyFile.originalname || emptyFile.filename} пустой`
    });
    return false;
  }

  // Check for corrupted images (magic bytes)
  if (mediaType !== 'video') {
    for (const file of files) {
      if (file.mimetype.startsWith('image/')) {
        const corrupted = await isImageCorrupted(file.path, file.mimetype);
        if (corrupted) {
          console.log('[UPLOAD-VALIDATE] corrupted image:', file.filename);
          await removeUploadedFiles(files);
          console.info(JSON.stringify({
            event: 'UPLOAD_VALIDATION_FAILED',
            timestamp: new Date().toISOString(),
            requestId: rid,
            endpoint: req.originalUrl || req.url,
            method: req.method,
            reason: 'corrupted_file',
            file: file.filename
          }));
          res.status(400).json({
            success: false,
            message: `Файл ${file.originalname || file.filename} повреждён`
          });
          return false;
        }
      }
    }
  }

  // Vertical orientation check for video uploads
  if (mediaType === 'video') {
    const isVertical = await validateVideoOrientation(files);
    if (!isVertical) {
      console.log('[UPLOAD-VALIDATE] video orientation check failed');
      await removeUploadedFiles(files);
      console.info(JSON.stringify({
        event: 'UPLOAD_VALIDATION_FAILED',
        timestamp: new Date().toISOString(),
        requestId: rid,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        reason: 'wrong_orientation',
        message: 'Видео должно быть вертикальным (портретная ориентация). Загрузите видео, где высота больше ширины.'
      }));
      res.status(415).json({
        success: false,
        message: 'Видео должно быть вертикальным (портретная ориентация). Загрузите видео, где высота больше ширины.'
      });
      return false;
    }
  }

  console.info(JSON.stringify({
    event: 'UPLOAD_VALIDATION_PASSED',
    timestamp: new Date().toISOString(),
    requestId: rid,
    endpoint: req.originalUrl || req.url,
    method: req.method
  }));
  console.log('[UPLOAD-VALIDATE] validation passed');
  return true;
}

export async function uploadGalleryHandler(req, res) {
  const startTime = Date.now();
  const files = getUploadedFiles(req);
  const fileNames = files.map(f => f.filename);
  const fileSizes = files.map(f => f.size);
  const mimeTypes = files.map(f => f.mimetype);
  const rid = req.id;

  console.info(JSON.stringify({
    event: 'ADMIN_UPLOAD_STARTED',
    timestamp: new Date().toISOString(),
    requestId: rid,
    endpoint: '/api/upload/gallery',
    method: 'POST',
    fileNames,
    fileSizes,
    mimeTypes
  }));

  try {
    const isValid = await validateUploadedFiles(req, res, 'gallery');
    if (!isValid) {
      console.info(JSON.stringify({
        event: 'UPLOAD_SAVE_FAILED',
        timestamp: new Date().toISOString(),
        requestId: rid,
        endpoint: '/api/upload/gallery',
        method: 'POST',
        reason: 'validation_failed',
        durationMs: Date.now() - startTime
      }));
      return;
    }

    const uploadedFiles = getUploadedFiles(req);
    console.info(JSON.stringify({
      event: 'ADMIN_UPLOAD_SUCCESS',
      timestamp: new Date().toISOString(),
      endpoint: '/api/upload/gallery',
      method: 'POST',
      fileNames: uploadedFiles.map(f => f.filename),
      fileSizes: uploadedFiles.map(f => f.size),
      mimeTypes: uploadedFiles.map(f => f.mimetype),
      destinationPath: '/img/gallery',
      durationMs: Date.now() - startTime
    }));
    res.status(201).json({
      success: true,
      paths: createPaths(uploadedFiles, 'gallery')
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: 'ADMIN_UPLOAD_FAILED',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      endpoint: '/api/upload/gallery',
      method: 'POST',
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime
    }));
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке изображений галереи'
    });
  }
}

export async function uploadVideoHandler(req, res) {
  const startTime = Date.now();
  const files = getUploadedFiles(req);
  const fileNames = files.map(f => f.filename);
  const fileSizes = files.map(f => f.size);
  const mimeTypes = files.map(f => f.mimetype);

  console.info(JSON.stringify({
    event: 'ADMIN_UPLOAD_STARTED',
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: '/api/upload/video',
    method: 'POST',
    fileNames,
    fileSizes,
    mimeTypes
  }));

  try {
    const isValid = await validateUploadedFiles(req, res, 'video');
    if (!isValid) {
      console.info(JSON.stringify({
        event: 'ADMIN_UPLOAD_FAILED',
        timestamp: new Date().toISOString(),
        endpoint: '/api/upload/video',
        method: 'POST',
        reason: 'validation_failed',
        durationMs: Date.now() - startTime
      }));
      return;
    }

    const uploadedFiles = getUploadedFiles(req);
    console.info(JSON.stringify({
      event: 'ADMIN_UPLOAD_SUCCESS',
      timestamp: new Date().toISOString(),
      endpoint: '/api/upload/video',
      method: 'POST',
      fileNames: uploadedFiles.map(f => f.filename),
      fileSizes: uploadedFiles.map(f => f.size),
      mimeTypes: uploadedFiles.map(f => f.mimetype),
      destinationPath: '/img/video',
      durationMs: Date.now() - startTime
    }));
    res.status(201).json({
      success: true,
      paths: createPaths(uploadedFiles, 'video')
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: 'ADMIN_UPLOAD_FAILED',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      endpoint: '/api/upload/video',
      method: 'POST',
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime
    }));
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке видео'
    });
  }
}

export async function uploadImageHandler(req, res) {
  const startTime = Date.now();
  const files = getUploadedFiles(req);
  const fileNames = files.map(f => f.filename);
  const fileSizes = files.map(f => f.size);
  const mimeTypes = files.map(f => f.mimetype);

  console.info(JSON.stringify({
    event: 'ADMIN_UPLOAD_STARTED',
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: '/api/upload/image',
    method: 'POST',
    fileNames,
    fileSizes,
    mimeTypes
  }));

  try {
    const isValid = await validateUploadedFiles(req, res, 'image');
    if (!isValid) {
      console.info(JSON.stringify({
        event: 'ADMIN_UPLOAD_FAILED',
        timestamp: new Date().toISOString(),
        endpoint: '/api/upload/image',
        method: 'POST',
        reason: 'validation_failed',
        durationMs: Date.now() - startTime
      }));
      return;
    }

    const uploadedFiles = getUploadedFiles(req);
    console.info(JSON.stringify({
      event: 'ADMIN_UPLOAD_SUCCESS',
      timestamp: new Date().toISOString(),
      endpoint: '/api/upload/image',
      method: 'POST',
      fileNames: uploadedFiles.map(f => f.filename),
      fileSizes: uploadedFiles.map(f => f.size),
      mimeTypes: uploadedFiles.map(f => f.mimetype),
      destinationPath: '/img',
      durationMs: Date.now() - startTime
    }));
    res.status(201).json({
      success: true,
      paths: createPaths(uploadedFiles, 'image')
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: 'ADMIN_UPLOAD_FAILED',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      endpoint: '/api/upload/image',
      method: 'POST',
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime
    }));
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке изображения'
    });
  }
}

async function resolveAllowedPath(rawPath) {
  const normalizedPath = rawPath.replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = normalizedPath.split('/');

  let mediaType;
  let filename;

  if (segments.length === 2 && ['gallery', 'video', 'image'].includes(segments[0])) {
    // gallery/filename.webp, video/filename.mp4, or image/filename.webp
    mediaType = segments[0];
    filename = segments[1];
  } else if (segments.length === 1 && segments[0]) {
    // filename.webp — single images stored directly in public/img
    mediaType = 'image';
    filename = segments[0];
  } else {
    return null;
  }

  if (!filename || filename === '.' || filename === '..' || path.basename(filename) !== filename) {
    return null;
  }

  const allowedDirectory = MEDIA_CONFIG[mediaType].directory;
  const resolvedPath = path.resolve(allowedDirectory, filename);
  const relativePath = path.relative(allowedDirectory, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return { mediaType, resolvedPath, allowedDirectory };
}

export async function deleteUploadedFile(req, res) {
  const startTime = Date.now();
  const { mediaType, filename } = req.params;
  const rawPath = mediaType && filename
    ? `${mediaType}/${filename}`
    : filename;

  console.info(JSON.stringify({
    event: 'ADMIN_FILE_DELETE_STARTED',
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: `/api/upload/${rawPath}`,
    method: 'DELETE',
    filePath: rawPath
  }));

  try {
    await ensureUploadDirectories(req, res, () => {});

    const target = await resolveAllowedPath(rawPath);
    if (!target) {
      console.info(JSON.stringify({
        event: 'ADMIN_FILE_DELETE_FAILED',
        timestamp: new Date().toISOString(),
        endpoint: `/api/upload/${rawPath}`,
        method: 'DELETE',
        filePath: rawPath,
        reason: 'invalid_path',
        error: 'Разрешено удалять только файлы из image, gallery или video',
        durationMs: Date.now() - startTime
      }));
      return res.status(400).json({
        success: false,
        message: 'Разрешено удалять только файлы из image, gallery или video'
      });
    }

    try {
      await fs.access(target.resolvedPath, constants.F_OK);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.info(JSON.stringify({
          event: 'ADMIN_FILE_DELETE_ALREADY_ABSENT',
          timestamp: new Date().toISOString(),
          endpoint: `/api/upload/${rawPath}`,
          method: 'DELETE',
          filePath: rawPath,
          reason: 'not_found',
          error: 'Файл уже отсутствует, повторное удаление не является ошибкой',
          durationMs: Date.now() - startTime
        }));
        // Idempotent delete: file already absent is not fatal (per plan edge-case matrix)
        return res.status(200).json({
          success: true,
          message: 'Файл уже удалён'
        });
      }
      throw err;
    }

    const stats = await fs.stat(target.resolvedPath);
    if (!stats.isFile()) {
      console.info(JSON.stringify({
        event: 'ADMIN_FILE_DELETE_FAILED',
        timestamp: new Date().toISOString(),
        endpoint: `/api/upload/${rawPath}`,
        method: 'DELETE',
        filePath: rawPath,
        reason: 'not_a_file',
        error: 'Удаление разрешено только для файлов',
        durationMs: Date.now() - startTime
      }));
      return res.status(400).json({
        success: false,
        message: 'Удаление разрешено только для файлов'
      });
    }

    await fs.unlink(target.resolvedPath);

    console.info(JSON.stringify({
      event: 'ADMIN_FILE_DELETE_SUCCESS',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      endpoint: `/api/upload/${rawPath}`,
      method: 'DELETE',
      filePath: rawPath,
      durationMs: Date.now() - startTime
    }));

    res.json({
      success: true,
      message: 'Файл удалён'
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: 'ADMIN_FILE_DELETE_FAILED',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      endpoint: `/api/upload/${rawPath}`,
      method: 'DELETE',
      filePath: rawPath,
      reason: 'server_error',
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime
    }));
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении файла'
    });
  }
}
