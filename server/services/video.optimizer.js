import { spawn } from 'node:child_process';
import fs from 'fs/promises';
import path from 'path';

const ENCODE_TIMEOUT_MS = 5 * 60 * 1000;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timeout = setTimeout(() => process.kill('SIGKILL'), ENCODE_TIMEOUT_MS);

    process.stderr.setEncoding('utf8');
    process.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-2000);
    });
    process.once('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
    process.once('close', code => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(stderr.trim() || `ffmpeg завершился с кодом ${code}`));
    });
  });
}

export async function optimizeUploadedVideo(file) {
  if (!file?.path || file.mimetype !== 'video/mp4') return file;

  const tempPath = path.join(
    path.dirname(file.path),
    `.${path.basename(file.path, path.extname(file.path))}.compressed.tmp.mp4`
  );

  try {
    const input = await fs.stat(file.path);
    await runFfmpeg([
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
      '-i', file.path,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', "scale=w='min(720,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-f', 'mp4', tempPath
    ]);

    const output = await fs.stat(tempPath);
    if (!output.isFile() || output.size === 0 || output.size >= input.size) return file;

    await fs.rename(tempPath, file.path);
    file.size = output.size;
    console.info(`[VIDEO-OPTIMIZER] ${file.filename}: ${input.size} -> ${output.size} bytes`);
  } catch (err) {
    console.warn(`[VIDEO-OPTIMIZER] Could not compress ${file.filename}; original kept: ${err.message}`);
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }

  return file;
}
