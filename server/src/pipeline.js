import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, json, now } from './db.js';
import { syncContentLibrary } from './content-sync.js';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.epub', '.mp3', '.m4a', '.wav', '.mp4', '.mov', '.jpg', '.jpeg', '.png', '.webp']);

function safeName(value) {
  return path.basename(String(value)).normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu, '-');
}

export function createBatch({ title, expectedFiles = 0, createdBy = 'local-admin' }) {
  if (!String(title || '').trim()) throw Object.assign(new Error('title is required'), { status: 400 });
  const id = crypto.randomUUID(); const timestamp = now();
  fs.mkdirSync(path.join(config.uploadStagingPath, id), { recursive: true });
  db().prepare(`INSERT INTO upload_batches(id,title,expected_files,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run(id, String(title).trim(), Number(expectedFiles) || 0, createdBy, timestamp, timestamp);
  return getBatch(id);
}

export function uploadBatchFile(batchId, { fileName, mimeType = 'application/octet-stream', dataBase64 }) {
  const batch = getBatch(batchId);
  if (!batch) throw Object.assign(new Error('batch not found'), { status: 404 });
  if (!['uploading', 'failed'].includes(batch.status)) throw Object.assign(new Error('batch no longer accepts files'), { status: 409 });
  const name = safeName(fileName); const extension = path.extname(name).toLowerCase();
  if (!name || !ALLOWED_EXTENSIONS.has(extension)) throw Object.assign(new Error(`unsupported file: ${name}`), { status: 415 });
  const buffer = Buffer.from(String(dataBase64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buffer.length) throw Object.assign(new Error('empty file'), { status: 400 });
  if (buffer.length > 25 * 1024 * 1024) throw Object.assign(new Error('single file exceeds 25MB MVP limit'), { status: 413 });
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const target = path.join(config.uploadStagingPath, batchId, name);
  fs.writeFileSync(target, buffer);
  const timestamp = now();
  db().prepare(`INSERT INTO upload_files(batch_id,original_name,staging_path,mime_type,file_size,checksum,status,created_at)
    VALUES (?,?,?,?,?,?,'uploaded',?) ON CONFLICT(batch_id,original_name) DO UPDATE SET staging_path=excluded.staging_path,
    mime_type=excluded.mime_type,file_size=excluded.file_size,checksum=excluded.checksum,status='uploaded'`)
    .run(batchId, name, target, mimeType, buffer.length, checksum, timestamp);
  const total = db().prepare('SELECT COUNT(*) total FROM upload_files WHERE batch_id=?').get(batchId).total;
  db().prepare("UPDATE upload_batches SET uploaded_files=?,status='uploading',error_message=NULL,updated_at=? WHERE id=?").run(total, timestamp, batchId);
  return { name, size: buffer.length, checksum, uploadedFiles: total };
}

export function finalizeBatch(batchId, metadata = {}) {
  const batch = getBatch(batchId);
  if (!batch) throw Object.assign(new Error('batch not found'), { status: 404 });
  if (!batch.files.length) throw Object.assign(new Error('upload at least one supported file'), { status: 400 });
  const timestamp = now();
  db().prepare("UPDATE upload_batches SET status='queued',updated_at=? WHERE id=?").run(timestamp, batchId);
  const job = db().prepare(`INSERT INTO processing_jobs(batch_id,job_type,status,payload,created_at,updated_at)
    VALUES (?,'classify_and_import','queued',?,?,?)`).run(batchId, JSON.stringify(metadata), timestamp, timestamp);
  setImmediate(() => processJob(Number(job.lastInsertRowid)));
  return getJob(Number(job.lastInsertRowid));
}

export function processJob(jobId) {
  const conn = db(); const job = conn.prepare('SELECT * FROM processing_jobs WHERE id=?').get(jobId);
  if (!job) throw Object.assign(new Error('job not found'), { status: 404 });
  if (job.status === 'completed') return getJob(jobId);
  if (job.status === 'processing') return getJob(jobId);
  const batch = conn.prepare('SELECT * FROM upload_batches WHERE id=?').get(job.batch_id);
  const timestamp = now();
  conn.prepare("UPDATE processing_jobs SET status='processing',progress=10,attempts=attempts+1,started_at=?,error_message=NULL,updated_at=? WHERE id=?").run(timestamp, timestamp, jobId);
  conn.prepare("UPDATE upload_batches SET status='processing',error_message=NULL,updated_at=? WHERE id=?").run(timestamp, batch.id);
  try {
    const metadata = json(job.payload, {});
    const packageName = `upload-${batch.id}`;
    const targetFolder = path.join(config.contentLibraryPath, packageName);
    fs.mkdirSync(targetFolder, { recursive: true });
    const files = conn.prepare('SELECT * FROM upload_files WHERE batch_id=?').all(batch.id);
    for (const file of files) fs.copyFileSync(file.staging_path, path.join(targetFolder, file.original_name));
    const manifest = {
      contentKey: `upload:${batch.id}`, title: metadata.title || batch.title, contentType: metadata.contentType || undefined,
      level: metadata.level || null, cefrLevel: metadata.cefrLevel || null, estimatedMinutes: Number(metadata.estimatedMinutes) || null,
      topics: metadata.topics || [], skills: metadata.skills || [], copyrightStatus: metadata.copyrightStatus || 'unverified',
      reviewStatus: 'pending', description: metadata.description || '', author: metadata.author || ''
    };
    fs.writeFileSync(path.join(targetFolder, 'manifest.json'), JSON.stringify(manifest, null, 2));
    conn.prepare('UPDATE processing_jobs SET progress=55,updated_at=? WHERE id=?').run(now(), jobId);
    const syncResult = syncContentLibrary(config.contentLibraryPath);
    const content = conn.prepare('SELECT * FROM content_items WHERE content_key=?').get(manifest.contentKey);
    if (!content) throw new Error('content import did not create a record');
    conn.prepare("UPDATE processing_jobs SET status='completed',progress=100,result=?,completed_at=?,updated_at=? WHERE id=?")
      .run(JSON.stringify({ contentId: content.id, sync: syncResult, parser: { ocr: 'not_configured', transcription: 'not_configured', alignment: 'not_configured' } }), now(), now(), jobId);
    conn.prepare("UPDATE upload_batches SET status='completed',content_id=?,updated_at=? WHERE id=?").run(content.id, now(), batch.id);
  } catch (error) {
    conn.prepare("UPDATE processing_jobs SET status='failed',error_message=?,updated_at=? WHERE id=?").run(error.message, now(), jobId);
    conn.prepare("UPDATE upload_batches SET status='failed',error_message=?,updated_at=? WHERE id=?").run(error.message, now(), batch.id);
  }
  return getJob(jobId);
}

export function retryJob(jobId) {
  const job = getJob(jobId);
  if (!job) throw Object.assign(new Error('job not found'), { status: 404 });
  if (job.status !== 'failed') throw Object.assign(new Error('only failed jobs can be retried'), { status: 409 });
  db().prepare("UPDATE processing_jobs SET status='queued',progress=0,error_message=NULL,updated_at=? WHERE id=?").run(now(), jobId);
  setImmediate(() => processJob(jobId));
  return getJob(jobId);
}

export function resumeQueuedJobs() {
  for (const row of db().prepare("SELECT id FROM processing_jobs WHERE status IN ('queued','processing')").all()) {
    db().prepare("UPDATE processing_jobs SET status='queued',progress=0,updated_at=? WHERE id=?").run(now(), row.id);
    setImmediate(() => processJob(row.id));
  }
}

export function getBatch(id) {
  const batch = db().prepare('SELECT * FROM upload_batches WHERE id=?').get(id);
  if (!batch) return null;
  return { ...batch, files: db().prepare('SELECT id,original_name,mime_type,file_size,status,created_at FROM upload_files WHERE batch_id=? ORDER BY id').all(id) };
}

export function listBatches(limit = 100) {
  return db().prepare(`SELECT b.*,j.id job_id,j.status job_status,j.progress job_progress,j.error_message job_error
    FROM upload_batches b LEFT JOIN processing_jobs j ON j.id=(SELECT MAX(id) FROM processing_jobs WHERE batch_id=b.id)
    ORDER BY b.created_at DESC LIMIT ?`).all(limit);
}

export function getJob(id) {
  const job = db().prepare('SELECT * FROM processing_jobs WHERE id=?').get(id);
  return job ? { ...job, payload: json(job.payload, {}), result: json(job.result, {}) } : null;
}

export function listJobs(limit = 100) {
  return db().prepare(`SELECT j.*,b.title FROM processing_jobs j JOIN upload_batches b ON b.id=j.batch_id ORDER BY j.created_at DESC LIMIT ?`).all(limit).map(job => ({ ...job, payload: json(job.payload, {}), result: json(job.result, {}) }));
}

export function updateContent(contentId, fields) {
  const item = db().prepare('SELECT * FROM content_items WHERE id=?').get(contentId);
  if (!item) throw Object.assign(new Error('content not found'), { status: 404 });
  const allowedTypes = ['book', 'audio', 'video', 'lesson', 'quiz', 'speaking_scene'];
  const type = fields.contentType || item.content_type;
  if (!allowedTypes.includes(type)) throw Object.assign(new Error('invalid contentType'), { status: 400 });
  db().prepare(`UPDATE content_items SET title=?,content_type=?,level=?,cefr_level=?,estimated_minutes=?,topic_tags=?,skill_tags=?,copyright_status=?,metadata=?,updated_at=? WHERE id=?`)
    .run(fields.title ?? item.title, type, fields.level ?? item.level, fields.cefrLevel ?? item.cefr_level,
      fields.estimatedMinutes ?? item.estimated_minutes, JSON.stringify(fields.topics ?? json(item.topic_tags, [])), JSON.stringify(fields.skills ?? json(item.skill_tags, [])),
      fields.copyrightStatus ?? item.copyright_status, JSON.stringify({ ...json(item.metadata, {}), description: fields.description ?? json(item.metadata, {}).description }), now(), contentId);
  return contentDetail(contentId);
}

export function reviewContent(contentId, { action, reviewer = 'local-admin', note = '' }) {
  const item = db().prepare('SELECT * FROM content_items WHERE id=?').get(contentId);
  if (!item) throw Object.assign(new Error('content not found'), { status: 404 });
  const target = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'unpublish' ? 'pending' : null;
  if (!target) throw Object.assign(new Error('action must be approve, reject or unpublish'), { status: 400 });
  if (target === 'approved' && !['owned', 'licensed', 'public_domain'].includes(item.copyright_status)) {
    throw Object.assign(new Error('发布前必须确认版权状态为 owned、licensed 或 public_domain'), { status: 409 });
  }
  const timestamp = now();
  db().prepare('UPDATE content_items SET review_status=?,published_at=?,updated_at=? WHERE id=?').run(target, target === 'approved' ? timestamp : null, timestamp, contentId);
  db().prepare(`INSERT INTO content_review_logs(content_id,action,from_status,to_status,reviewer,note,created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(contentId, action, item.review_status, target, reviewer, note, timestamp);
  return contentDetail(contentId);
}

export function contentDetail(id) {
  const item = db().prepare('SELECT * FROM content_items WHERE id=?').get(id);
  if (!item) return null;
  return {
    ...item, topic_tags: json(item.topic_tags, []), skill_tags: json(item.skill_tags, []), metadata: json(item.metadata, {}),
    assets: db().prepare(`SELECT DISTINCT a.id,COALESCE(l.asset_role,a.asset_type) asset_type,a.original_path,a.storage_key,a.mime_type,a.file_size,a.processing_status,a.metadata
      FROM media_assets a LEFT JOIN content_media_links l ON l.asset_id=a.id AND l.content_id=?
      WHERE a.content_id=? OR l.content_id=? ORDER BY a.id`).all(id, id, id),
    reviews: db().prepare('SELECT * FROM content_review_logs WHERE content_id=? ORDER BY id DESC').all(id)
  };
}
