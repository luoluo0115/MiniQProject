import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  port: Number(process.env.PORT || 8787),
  databasePath: path.resolve(root, process.env.DATABASE_PATH || './data/miniq.sqlite'),
  contentLibraryPath: path.resolve(root, process.env.CONTENT_LIBRARY_PATH || './content-library'),
  mediaStoragePath: path.resolve(root, process.env.MEDIA_STORAGE_PATH || './data/media'),
  uploadStagingPath: path.resolve(root, process.env.UPLOAD_STAGING_PATH || './data/uploads'),
  maxLibraryFileBytes: Number(process.env.MAX_LIBRARY_FILE_MB || 2048) * 1024 * 1024,
  adminToken: process.env.ADMIN_TOKEN || 'miniq-local-admin',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  realtimeModel: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
};
