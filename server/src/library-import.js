import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, json, now } from './db.js';

const TYPES = new Map([
  ['.pdf', ['document', 'application/pdf']], ['.epub', ['document', 'application/epub+zip']],
  ['.mp3', ['audio', 'audio/mpeg']], ['.m4a', ['audio', 'audio/mp4']], ['.wav', ['audio', 'audio/wav']],
  ['.mp4', ['video', 'video/mp4']], ['.mov', ['video', 'video/quicktime']],
  ['.jpg', ['image', 'image/jpeg']], ['.jpeg', ['image', 'image/jpeg']], ['.png', ['image', 'image/png']], ['.webp', ['image', 'image/webp']]
]);
const GENERIC = new Set(['audio','audios','video','videos','pdf','pdfs','book','books','ebook','ebooks','cover','covers','image','images','raz','reading a z','oxford','oxford reading tree','ort']);

function cleanRelativePath(value) {
  const normalized = String(value || '').normalize('NFKC').replaceAll('\\', '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(part => part && part !== '.' && part !== '..').map(part => part.replace(/[^\p{L}\p{N} ._()\[\]-]+/gu, '-'));
  if (!parts.length) throw Object.assign(new Error('relativePath is required'), { status: 400 });
  return parts.join('/');
}

function canonical(value) {
  return String(value || '').normalize('NFKD').replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\p{L}]+/giu, ' ').toLowerCase().trim().replace(/\s+/g, ' ');
}

function detectSeries(text, hint = '') {
  if (hint) return hint;
  const value = canonical(text);
  if (/\braz\b|reading a z|readingaz/.test(value)) return 'RAZ';
  if (/oxford reading tree|\bort\b|biff chip|oxford tree/.test(value)) return 'Oxford Reading Tree';
  return 'Other';
}

function detectLevel(text, series, hint = '') {
  if (hint) {
    const normalizedHint = String(hint).toUpperCase();
    if (series === 'Oxford Reading Tree') return normalizedHint.match(/\d{1,2}/)?.[0] || normalizedHint;
    return normalizedHint.match(/AA|Z[12]|[A-Z]/)?.[0] || normalizedHint;
  }
  const value = String(text).replaceAll('\\', '/');
  if (series === 'RAZ') {
    const explicit = value.match(/(?:level|raz)[\s_\-/]*(AA|[A-Z]|Z[12])(?:\b|[_\-/])/i);
    if (explicit) return explicit[1].toUpperCase();
    const segment = value.split('/').find(part => /^(AA|[A-Z]|Z[12])$/i.test(part.trim()));
    return segment?.trim().toUpperCase() || null;
  }
  if (series === 'Oxford Reading Tree') return value.match(/(?:stage|level|阶段)[\s_-]*(\d{1,2})/i)?.[1] || null;
  return value.match(/(?:level|stage)[\s_-]*([A-Z0-9]+)/i)?.[1]?.toUpperCase() || null;
}

function internalLevel(series, sourceLevel) {
  if (!sourceLevel) return null;
  if (series === 'RAZ') return sourceLevel;
  if (series === 'Oxford Reading Tree') {
    const stage = Number(sourceLevel);
    if (stage <= 2) return 'AA'; if (stage <= 4) return 'A'; if (stage <= 6) return 'B'; if (stage <= 8) return 'C'; return 'D';
  }
  return sourceLevel;
}

function titleFromPath(relativePath) {
  const extension = path.extname(relativePath);
  const parts = relativePath.slice(0, -extension.length).split('/');
  let file = canonical(parts.at(-1))
    .replace(/\b(audio|narration|read aloud|readalong|read along|video|animation|animated|cover|ebook|book|story|track|english|with text)\b/g, ' ')
    .replace(/\b(mp3|mp4|pdf|epub)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const parents = parts.slice(0, -1).map(canonical).filter(Boolean);
  const parent = [...parents].reverse().find(value => !GENERIC.has(value) && !/^(level|stage)\s*[a-z0-9]+$/i.test(value));
  if (!file || GENERIC.has(file) || /^(page|track)?\s*\d+$/i.test(file)) file = parent || file;
  return file || canonical(path.basename(relativePath, extension));
}

function displayTitle(key) {
  return key.split(' ').map(word => /^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
}

function scoreGroup(files, series, level) {
  const roles = new Set(files.map(file => file.detected_role));
  const reasons = [];
  let score = 0.48;
  if (roles.has('document')) { score += .22; reasons.push('包含绘本文档'); }
  else reasons.push('缺少绘本文档');
  if (roles.has('audio')) { score += .12; reasons.push('已匹配音频'); }
  if (roles.has('video')) { score += .08; reasons.push('已匹配视频'); }
  if (roles.has('image')) { score += .04; reasons.push('已匹配封面图片'); }
  if (series !== 'Other') { score += .03; reasons.push(`识别为 ${series}`); }
  if (level) { score += .03; reasons.push(`识别级别 ${level}`); }
  return { confidence: Math.min(.99, score), status: roles.has('document') && score >= .78 ? 'matched' : 'needs_review', reasons };
}

export function createLibraryImport({ name, expectedFiles = 0, seriesHint = '', levelHint = '' }) {
  if (!String(name || '').trim()) throw Object.assign(new Error('name is required'), { status: 400 });
  const id = crypto.randomUUID(); const timestamp = now();
  fs.mkdirSync(path.join(config.uploadStagingPath, 'libraries', id), { recursive: true });
  db().prepare(`INSERT INTO library_imports(id,name,series_hint,level_hint,expected_files,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
    .run(id, String(name).trim(), seriesHint || null, levelHint || null, Number(expectedFiles) || 0, timestamp, timestamp);
  return getLibraryImport(id);
}

export function uploadLibraryFile(importId, { relativePath, mimeType = 'application/octet-stream', dataBase64 }) {
  const library = db().prepare('SELECT * FROM library_imports WHERE id=?').get(importId);
  if (!library) throw Object.assign(new Error('library import not found'), { status: 404 });
  if (library.status !== 'uploading') throw Object.assign(new Error('library no longer accepts files'), { status: 409 });
  const relative = cleanRelativePath(relativePath); const extension = path.extname(relative).toLowerCase();
  if (!TYPES.has(extension)) return { skipped: true, relativePath: relative, reason: 'unsupported extension' };
  const buffer = Buffer.from(String(dataBase64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buffer.length) throw Object.assign(new Error('empty file'), { status: 400 });
  if (buffer.length > 50 * 1024 * 1024) throw Object.assign(new Error('single file exceeds 50MB local limit'), { status: 413 });
  const target = path.join(config.uploadStagingPath, 'libraries', importId, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, buffer);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const [role, inferredMime] = TYPES.get(extension); const series = detectSeries(relative, library.series_hint); const level = detectLevel(relative, series, library.level_hint);
  db().prepare(`INSERT INTO library_files(import_id,relative_path,original_name,staging_path,extension,mime_type,file_size,checksum,detected_role,detected_series,detected_level,normalized_title,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'uploaded',?) ON CONFLICT(import_id,relative_path) DO UPDATE SET staging_path=excluded.staging_path,mime_type=excluded.mime_type,
    file_size=excluded.file_size,checksum=excluded.checksum,detected_role=excluded.detected_role,detected_series=excluded.detected_series,
    detected_level=excluded.detected_level,normalized_title=excluded.normalized_title,status='uploaded',exception_reason=NULL`)
    .run(importId, relative, path.basename(relative), target, extension, mimeType || inferredMime, buffer.length, checksum, role, series, level, titleFromPath(relative), now());
  const count = db().prepare('SELECT COUNT(*) total FROM library_files WHERE import_id=?').get(importId).total;
  db().prepare('UPDATE library_imports SET uploaded_files=?,updated_at=? WHERE id=?').run(count, now(), importId);
  return { skipped: false, relativePath: relative, role, series, level, normalizedTitle: titleFromPath(relative), uploadedFiles: count };
}

export async function uploadLibraryFileStream(importId, relativePath, mimeType, request) {
  const library = db().prepare('SELECT * FROM library_imports WHERE id=?').get(importId);
  if (!library) throw Object.assign(new Error('library import not found'), { status: 404 });
  if (library.status !== 'uploading') throw Object.assign(new Error('library no longer accepts files'), { status: 409 });
  const relative = cleanRelativePath(relativePath); const extension = path.extname(relative).toLowerCase();
  if (!TYPES.has(extension)) return { skipped: true, relativePath: relative, reason: 'unsupported extension' };
  const target = path.join(config.uploadStagingPath, 'libraries', importId, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.uploading`; const fd = fs.openSync(temporary, 'w'); const hash = crypto.createHash('sha256'); let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > config.maxLibraryFileBytes) throw Object.assign(new Error(`single file exceeds ${Math.round(config.maxLibraryFileBytes / 1024 / 1024)}MB limit`), { status: 413 });
      hash.update(chunk); fs.writeSync(fd, chunk);
    }
  } catch (error) { fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); throw error; }
  fs.closeSync(fd);
  if (!size) { fs.unlinkSync(temporary); throw Object.assign(new Error('empty file'), { status: 400 }); }
  fs.renameSync(temporary, target);
  const checksum = hash.digest('hex'); const [role, inferredMime] = TYPES.get(extension); const series = detectSeries(relative, library.series_hint); const level = detectLevel(relative, series, library.level_hint);
  db().prepare(`INSERT INTO library_files(import_id,relative_path,original_name,staging_path,extension,mime_type,file_size,checksum,detected_role,detected_series,detected_level,normalized_title,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'uploaded',?) ON CONFLICT(import_id,relative_path) DO UPDATE SET staging_path=excluded.staging_path,mime_type=excluded.mime_type,
    file_size=excluded.file_size,checksum=excluded.checksum,detected_role=excluded.detected_role,detected_series=excluded.detected_series,
    detected_level=excluded.detected_level,normalized_title=excluded.normalized_title,status='uploaded',exception_reason=NULL`)
    .run(importId, relative, path.basename(relative), target, extension, mimeType || inferredMime, size, checksum, role, series, level, titleFromPath(relative), now());
  const count = db().prepare('SELECT COUNT(*) total FROM library_files WHERE import_id=?').get(importId).total;
  db().prepare('UPDATE library_imports SET uploaded_files=?,updated_at=? WHERE id=?').run(count, now(), importId);
  return { skipped: false, relativePath: relative, role, series, level, normalizedTitle: titleFromPath(relative), uploadedFiles: count, size };
}

export function analyzeLibrary(importId) {
  const conn = db(); const library = conn.prepare('SELECT * FROM library_imports WHERE id=?').get(importId);
  if (!library) throw Object.assign(new Error('library import not found'), { status: 404 });
  const files = conn.prepare('SELECT * FROM library_files WHERE import_id=? ORDER BY relative_path').all(importId);
  if (!files.length) throw Object.assign(new Error('no supported files uploaded'), { status: 400 });
  conn.prepare("UPDATE library_imports SET status='analyzing',updated_at=? WHERE id=?").run(now(), importId);
  conn.prepare('DELETE FROM library_books WHERE import_id=?').run(importId);
  const groups = new Map();
  for (const file of files) {
    const key = `${file.detected_series}|${file.detected_level || ''}|${file.normalized_title}`;
    groups.set(key, [...(groups.get(key) || []), file]);
  }
  const seriesCounts = new Map(); let matchedFiles = 0; let exceptions = 0;
  conn.exec('BEGIN IMMEDIATE');
  try {
    for (const [key, grouped] of groups) {
      const series = grouped[0].detected_series; const level = grouped[0].detected_level; const result = scoreGroup(grouped, series, level);
      const inserted = conn.prepare(`INSERT INTO library_books(import_id,group_key,title,series_name,source_level,internal_level,confidence,match_status,match_reason,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(importId, key, displayTitle(grouped[0].normalized_title), series, level, internalLevel(series, level), result.confidence, result.status, JSON.stringify(result.reasons), now(), now());
      for (const file of grouped) conn.prepare('INSERT INTO library_book_files(book_id,file_id,asset_role,match_score) VALUES (?,?,?,?)').run(inserted.lastInsertRowid, file.id, file.detected_role, result.confidence);
      seriesCounts.set(series, (seriesCounts.get(series) || 0) + 1);
      if (result.status === 'matched') matchedFiles += grouped.length; else exceptions += grouped.length;
    }
    const detectedSeries = [...seriesCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';
    const duplicateFiles = files.length - new Set(files.map(file => file.checksum)).size;
    const report = { series: Object.fromEntries(seriesCounts), books: groups.size, files: files.length, duplicateFiles, highConfidenceBooks: conn.prepare("SELECT COUNT(*) total FROM library_books WHERE import_id=? AND match_status='matched'").get(importId).total, needsReviewBooks: conn.prepare("SELECT COUNT(*) total FROM library_books WHERE import_id=? AND match_status='needs_review'").get(importId).total };
    conn.prepare(`UPDATE library_imports SET detected_series=?,status='review',detected_books=?,matched_files=?,exception_files=?,report=?,updated_at=? WHERE id=?`)
      .run(detectedSeries, groups.size, matchedFiles, exceptions, JSON.stringify(report), now(), importId);
    conn.exec('COMMIT');
  } catch (error) { conn.exec('ROLLBACK'); conn.prepare("UPDATE library_imports SET status='failed',error_message=?,updated_at=? WHERE id=?").run(error.message, now(), importId); throw error; }
  return getLibraryImport(importId);
}

function publishBook(bookId, copyrightStatus) {
  const conn = db(); const book = conn.prepare('SELECT * FROM library_books WHERE id=?').get(bookId);
  if (!book) throw Object.assign(new Error('library book not found'), { status: 404 });
  const timestamp = now(); const key = `library:${book.import_id}:${crypto.createHash('sha1').update(book.group_key).digest('hex').slice(0, 16)}`;
  conn.prepare(`INSERT INTO content_items(content_key,content_type,title,level,topic_tags,skill_tags,source_type,copyright_status,review_status,metadata,published_at,created_at,updated_at)
    VALUES (?,'book',?,?,'[]','["reading","listening"]','library_import',?,'approved',?,?,?,?)
    ON CONFLICT(content_key) DO UPDATE SET title=excluded.title,level=excluded.level,copyright_status=excluded.copyright_status,review_status='approved',published_at=excluded.published_at,updated_at=excluded.updated_at`)
    .run(key, book.title, book.internal_level, copyrightStatus, JSON.stringify({ series: book.series_name, sourceLevel: book.source_level, libraryImportId: book.import_id, confidence: book.confidence }), timestamp, timestamp, timestamp);
  const contentId = conn.prepare('SELECT id FROM content_items WHERE content_key=?').get(key).id;
  const files = conn.prepare(`SELECT f.*,bf.asset_role FROM library_book_files bf JOIN library_files f ON f.id=bf.file_id WHERE bf.book_id=?`).all(bookId);
  for (const file of files) {
    const existing = conn.prepare('SELECT id,content_id FROM media_assets WHERE checksum=?').get(file.checksum);
    let assetId = existing?.id;
    const assetRole = file.asset_role === 'document' ? 'book_file' : file.asset_role === 'image' ? 'cover' : file.asset_role;
    if (!existing) {
      const storageKey = `${file.checksum.slice(0, 2)}/${file.checksum}${file.extension}`; const target = path.join(config.mediaStoragePath, storageKey);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(file.staging_path, target);
      const inserted = conn.prepare(`INSERT INTO media_assets(content_id,asset_type,original_path,storage_key,mime_type,file_size,checksum,processing_status,metadata,created_at)
        VALUES (?,?,?,?,?,?,?,'ready',?,?)`).run(contentId, assetRole, file.relative_path, storageKey, file.mime_type, file.file_size, file.checksum, JSON.stringify({ libraryFileId: file.id }), timestamp);
      assetId = Number(inserted.lastInsertRowid);
    }
    conn.prepare('INSERT INTO content_media_links(content_id,asset_id,asset_role,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').run(contentId, assetId, assetRole, timestamp);
  }
  conn.prepare("UPDATE library_books SET content_id=?,match_status='approved',updated_at=? WHERE id=?").run(contentId, timestamp, bookId);
  return contentId;
}

export function approveLibraryBooks(importId, { bookIds = [], approveHighConfidence = false, copyrightStatus }) {
  if (!['owned', 'licensed', 'public_domain'].includes(copyrightStatus)) throw Object.assign(new Error('valid copyrightStatus is required'), { status: 400 });
  let books;
  if (approveHighConfidence) books = db().prepare("SELECT id FROM library_books WHERE import_id=? AND match_status='matched' AND confidence>=0.78").all(importId);
  else {
    const ids = bookIds.map(Number).filter(Number.isInteger);
    books = ids.length ? db().prepare(`SELECT id FROM library_books WHERE import_id=? AND id IN (${ids.map(() => '?').join(',')})`).all(importId, ...ids) : [];
  }
  const contentIds = books.map(book => publishBook(book.id, copyrightStatus));
  const remaining = db().prepare("SELECT COUNT(*) total FROM library_books WHERE import_id=? AND match_status NOT IN ('approved','rejected')").get(importId).total;
  db().prepare('UPDATE library_imports SET status=?,updated_at=? WHERE id=?').run(remaining ? 'review' : 'completed', now(), importId);
  return { approved: contentIds.length, contentIds, remaining };
}

export function updateLibraryBook(bookId, { title, sourceLevel, internalLevel, matchStatus }) {
  const book = db().prepare('SELECT * FROM library_books WHERE id=?').get(bookId);
  if (!book) throw Object.assign(new Error('library book not found'), { status: 404 });
  db().prepare('UPDATE library_books SET title=?,source_level=?,internal_level=?,match_status=?,updated_at=? WHERE id=?')
    .run(title || book.title, sourceLevel ?? book.source_level, internalLevel ?? book.internal_level, matchStatus || book.match_status, now(), bookId);
  return getLibraryBook(bookId);
}

export function getLibraryBook(bookId) {
  const book = db().prepare('SELECT * FROM library_books WHERE id=?').get(bookId);
  if (!book) return null;
  return { ...book, match_reason: json(book.match_reason, []), files: db().prepare(`SELECT f.id,f.relative_path,f.detected_role,f.detected_level,f.file_size,bf.match_score FROM library_book_files bf JOIN library_files f ON f.id=bf.file_id WHERE bf.book_id=? ORDER BY f.relative_path`).all(bookId) };
}

export function getLibraryImport(id) {
  const item = db().prepare('SELECT * FROM library_imports WHERE id=?').get(id);
  if (!item) return null;
  return { ...item, report: json(item.report, {}), books: db().prepare(`SELECT b.*,COUNT(bf.file_id) file_count,GROUP_CONCAT(DISTINCT bf.asset_role) asset_roles FROM library_books b LEFT JOIN library_book_files bf ON bf.book_id=b.id WHERE b.import_id=? GROUP BY b.id ORDER BY b.source_level,b.title`).all(id).map(book => ({ ...book, match_reason: json(book.match_reason, []), asset_roles: book.asset_roles?.split(',') || [] })) };
}

export function listLibraryImports() {
  return db().prepare('SELECT * FROM library_imports ORDER BY created_at DESC LIMIT 100').all().map(item => ({ ...item, report: json(item.report, {}) }));
}
