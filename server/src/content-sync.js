import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, now } from './db.js';

const MEDIA = new Map([
  ['.pdf', ['book_file', 'application/pdf']], ['.epub', ['book_file', 'application/epub+zip']],
  ['.mp3', ['audio', 'audio/mpeg']], ['.m4a', ['audio', 'audio/mp4']], ['.wav', ['audio', 'audio/wav']],
  ['.mp4', ['video', 'video/mp4']], ['.mov', ['video', 'video/quicktime']],
  ['.jpg', ['cover', 'image/jpeg']], ['.jpeg', ['cover', 'image/jpeg']], ['.png', ['cover', 'image/png']], ['.webp', ['cover', 'image/webp']]
]);

function walk(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function packageFor(file, root) {
  const relative = path.relative(root, file);
  const parts = relative.split(path.sep);
  return parts.length > 1 ? path.join(root, parts[0]) : file;
}

function readManifest(packagePath) {
  const folder = fs.statSync(packagePath).isDirectory() ? packagePath : path.dirname(packagePath);
  const candidate = path.join(folder, 'manifest.json');
  if (!fs.existsSync(candidate)) return {};
  try { return JSON.parse(fs.readFileSync(candidate, 'utf8')); }
  catch (error) { throw new Error(`Invalid manifest: ${candidate} (${error.message})`); }
}

function inferLevel(text) {
  return text.match(/(?:level|级别|等级)[-_ ]*([a-z0-9]+)/i)?.[1]?.toUpperCase()
    || text.match(/\b([A-Z])\b/)?.[1]
    || null;
}

function contentType(files, manifest) {
  if (manifest.contentType) return manifest.contentType;
  const extensions = files.map(file => path.extname(file).toLowerCase());
  if (extensions.some(ext => ['.pdf', '.epub', '.jpg', '.jpeg', '.png', '.webp'].includes(ext))) return 'book';
  if (extensions.some(ext => ['.mp4', '.mov'].includes(ext))) return 'video';
  return 'audio';
}

function safeKey(value) {
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function syncContentLibrary(sourcePath = config.contentLibraryPath) {
  fs.mkdirSync(sourcePath, { recursive: true });
  fs.mkdirSync(config.mediaStoragePath, { recursive: true });
  const mediaFiles = walk(sourcePath).filter(file => MEDIA.has(path.extname(file).toLowerCase()));
  const packages = new Map();
  for (const file of mediaFiles) {
    const key = packageFor(file, sourcePath);
    packages.set(key, [...(packages.get(key) || []), file]);
  }
  const result = { scannedFiles: mediaFiles.length, created: 0, updated: 0, assetsAdded: 0, warnings: [] };

  for (const [packagePath, files] of packages) {
    const manifest = readManifest(packagePath);
    const relativePackage = path.relative(sourcePath, packagePath);
    const baseName = fs.statSync(packagePath).isDirectory() ? path.basename(packagePath) : path.basename(packagePath, path.extname(packagePath));
    const key = manifest.contentKey || `local:${safeKey(relativePackage || baseName)}`;
    const title = manifest.title || baseName.replace(/[-_]+/g, ' ');
    const timestamp = now();
    const existing = db().prepare('SELECT id FROM content_items WHERE content_key=?').get(key);
    const metadata = { importedFrom: relativePackage, description: manifest.description || '', author: manifest.author || null };
    db().prepare(`INSERT INTO content_items
      (content_key,content_type,title,language,level,cefr_level,difficulty_score,estimated_minutes,topic_tags,skill_tags,source_type,copyright_status,review_status,metadata,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(content_key) DO UPDATE SET content_type=excluded.content_type,title=excluded.title,language=excluded.language,
      level=excluded.level,cefr_level=excluded.cefr_level,difficulty_score=excluded.difficulty_score,estimated_minutes=excluded.estimated_minutes,
      topic_tags=excluded.topic_tags,skill_tags=excluded.skill_tags,copyright_status=excluded.copyright_status,metadata=excluded.metadata,updated_at=excluded.updated_at`)
      .run(key, contentType(files, manifest), title, manifest.language || 'en', manifest.level || inferLevel(relativePackage), manifest.cefrLevel || null,
        manifest.difficultyScore ?? null, manifest.estimatedMinutes ?? null, JSON.stringify(manifest.topics || []), JSON.stringify(manifest.skills || []),
        'local_upload', manifest.copyrightStatus || 'unverified', manifest.reviewStatus === 'approved' ? 'approved' : 'pending', JSON.stringify(metadata), timestamp, timestamp);
    const item = db().prepare('SELECT id FROM content_items WHERE content_key=?').get(key);
    result[existing ? 'updated' : 'created'] += 1;

    for (const file of files) {
      const checksum = sha256(file);
      if (db().prepare('SELECT id FROM media_assets WHERE checksum=?').get(checksum)) continue;
      const [assetType, mimeType] = MEDIA.get(path.extname(file).toLowerCase());
      const storageKey = `${checksum.slice(0, 2)}/${checksum}${path.extname(file).toLowerCase()}`;
      const destination = path.join(config.mediaStoragePath, storageKey);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file, destination);
      db().prepare(`INSERT INTO media_assets
        (content_id,asset_type,original_path,storage_key,mime_type,file_size,checksum,processing_status,metadata,created_at)
        VALUES (?,?,?,?,?,?,?,'ready','{}',?)`).run(item.id, assetType, file, storageKey, mimeType, fs.statSync(file).size, checksum, timestamp);
      result.assetsAdded += 1;
    }
  }
  return result;
}
