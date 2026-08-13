import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'miniq-service-'));
process.env.DATABASE_PATH = path.join(sandbox, 'test.sqlite');
process.env.CONTENT_LIBRARY_PATH = path.join(sandbox, 'library');
process.env.MEDIA_STORAGE_PATH = path.join(sandbox, 'media');

const { migrate, db } = await import('../src/db.js');
const { seedDemo } = await import('../src/seed.js');
const { generateDailyPlan } = await import('../src/planner.js');
const { reviewWord } = await import('../src/memory.js');
const { startSession, finishSession, learningSummary } = await import('../src/sessions.js');
const { syncContentLibrary } = await import('../src/content-sync.js');
const { createBatch, uploadBatchFile, finalizeBatch, processJob, reviewContent, contentDetail } = await import('../src/pipeline.js');
const { createLibraryImport, uploadLibraryFile, uploadLibraryFileStream, analyzeLibrary, approveLibraryBooks } = await import('../src/library-import.js');

migrate();
const { userId } = seedDemo();

test('daily plan generation is idempotent and includes the learning loop', () => {
  const first = generateDailyPlan(userId, '2026-08-13');
  const second = generateDailyPlan(userId, '2026-08-13');
  assert.equal(first.id, second.id);
  assert.deepEqual(first.tasks.map(task => task.task_type), ['vocabulary', 'reading', 'speaking']);
});

test('word reviews are idempotent and calculate a future interval', () => {
  const wordId = db().prepare("SELECT id FROM words WHERE lemma='cat'").get().id;
  const input = { reviewUuid: 'review-001', userId, wordId, grade: 3, reviewedAt: '2026-08-13T01:00:00.000Z' };
  const first = reviewWord(input); const second = reviewWord(input);
  assert.ok(first.nextIntervalDays > 0);
  assert.equal(second.duplicate, true);
  assert.equal(db().prepare('SELECT COUNT(*) total FROM word_review_logs').get().total, 1);
});

test('finishing a session updates progress and daily summary', () => {
  const contentId = db().prepare("SELECT id FROM content_items WHERE content_type='book'").get().id;
  startSession({ sessionId: 'session-001', userId, moduleType: 'reading', contentId, startedAt: '2026-08-13T02:00:00.000Z' });
  finishSession('session-001', { effectiveMs: 300000, foregroundMs: 330000, completionRate: 1, completed: true, endedAt: '2026-08-13T02:06:00.000Z' });
  const progress = db().prepare('SELECT * FROM user_content_progress WHERE user_id=? AND content_id=?').get(userId, contentId);
  assert.equal(progress.status, 'completed');
  assert.equal(learningSummary(userId, '2026-08-13').effectiveMinutes, 5);
});

test('local content sync groups a package and deduplicates assets', () => {
  const folder = path.join(process.env.CONTENT_LIBRARY_PATH, 'Level-B-Space');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'story.mp3'), 'audio-test');
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ title: 'Space Trip', level: 'B', copyrightStatus: 'owned', reviewStatus: 'approved' }));
  const first = syncContentLibrary(); const second = syncContentLibrary();
  assert.equal(first.created, 1);
  assert.equal(first.assetsAdded, 1);
  assert.equal(second.assetsAdded, 0);
});

test('admin upload pipeline imports content and requires copyright before publishing', () => {
  const batch = createBatch({ title: 'Family Day', expectedFiles: 1 });
  uploadBatchFile(batch.id, { fileName: 'family.mp3', mimeType: 'audio/mpeg', dataBase64: Buffer.from('family-audio').toString('base64') });
  const queued = finalizeBatch(batch.id, { level: 'A', topics: ['family'] });
  const completed = processJob(queued.id);
  assert.equal(completed.status, 'completed');
  const contentId = completed.result.contentId;
  assert.throws(() => reviewContent(contentId, { action: 'approve' }), /版权状态/);
  const item = contentDetail(contentId);
  assert.equal(item.review_status, 'pending');
  assert.equal(item.assets.length, 1);
});

function libraryFile(importId, relativePath, bytes = relativePath) {
  return uploadLibraryFile(importId, { relativePath, dataBase64: Buffer.from(bytes).toString('base64') });
}

test('RAZ library import detects level and groups matching book media', () => {
  const library = createLibraryImport({ name: 'RAZ H Complete Set', seriesHint: 'RAZ', levelHint: 'H', expectedFiles: 5 });
  libraryFile(library.id, 'RAZ/Level H/All About Spiders/All About Spiders.pdf');
  libraryFile(library.id, 'RAZ/Level H/All About Spiders/All About Spiders Audio.mp3');
  libraryFile(library.id, 'RAZ/Level H/All About Spiders/All About Spiders Video.mp4');
  libraryFile(library.id, 'RAZ/Level H/Amazing Ants/Amazing Ants.pdf');
  libraryFile(library.id, 'RAZ/Level H/Amazing Ants/Amazing Ants.mp3');
  const analyzed = analyzeLibrary(library.id);
  assert.equal(analyzed.detected_series, 'RAZ');
  assert.equal(analyzed.detected_books, 2);
  assert.equal(analyzed.report.highConfidenceBooks, 2);
  assert.deepEqual(analyzed.books.map(book => book.source_level), ['H', 'H']);
  assert.deepEqual(analyzed.books.map(book => book.file_count), [3, 2]);
  const published = approveLibraryBooks(library.id, { approveHighConfidence: true, copyrightStatus: 'owned' });
  assert.equal(published.approved, 2);
  assert.equal(db().prepare("SELECT COUNT(*) total FROM content_items WHERE source_type='library_import' AND review_status='approved'").get().total, 2);
});

test('Oxford library import maps stages and flags books without documents', () => {
  const library = createLibraryImport({ name: 'Oxford Reading Tree Stage 5', expectedFiles: 3 });
  libraryFile(library.id, 'Oxford Reading Tree/Stage 5/The Magic Key/The Magic Key.pdf');
  libraryFile(library.id, 'Oxford Reading Tree/Stage 5/The Magic Key/The Magic Key narration.mp3');
  libraryFile(library.id, 'Oxford Reading Tree/Stage 5/Gran/Gran audio.mp3');
  const analyzed = analyzeLibrary(library.id);
  assert.equal(analyzed.detected_series, 'Oxford Reading Tree');
  assert.equal(analyzed.detected_books, 2);
  assert.equal(analyzed.report.highConfidenceBooks, 1);
  assert.equal(analyzed.report.needsReviewBooks, 1);
  assert.ok(analyzed.books.every(book => book.source_level === '5' && book.internal_level === 'B'));
});

test('library uploads preserve paths, skip unsupported files and overwrite same path safely', () => {
  const library = createLibraryImport({ name: 'RAZ F', seriesHint: 'RAZ', levelHint: 'F' });
  const skipped = libraryFile(library.id, 'RAZ F/readme.txt');
  assert.equal(skipped.skipped, true);
  libraryFile(library.id, 'RAZ F/My Book/My Book.pdf', 'version-one');
  libraryFile(library.id, 'RAZ F/My Book/My Book.pdf', 'version-two');
  const analyzed = analyzeLibrary(library.id);
  assert.equal(analyzed.uploaded_files, 1);
  assert.equal(analyzed.detected_books, 1);
});

test('library raw upload streams large media without base64 and shared assets remain linked', async () => {
  const library = createLibraryImport({ name: 'RAZ F Stream', seriesHint: 'RAZ', levelHint: 'F' });
  const fakeRequest = Readable.from([Buffer.alloc(1024, 7), Buffer.alloc(1024, 8)]);
  const uploaded = await uploadLibraryFileStream(library.id, 'RAZ F/Stream Book/Stream Book video.mp4', 'video/mp4', fakeRequest);
  assert.equal(uploaded.size, 2048);
  libraryFile(library.id, 'RAZ F/Stream Book/Stream Book.pdf');
  const analyzed = analyzeLibrary(library.id);
  const published = approveLibraryBooks(library.id, { approveHighConfidence: true, copyrightStatus: 'owned' });
  assert.equal(published.approved, 1);
  assert.equal(contentDetail(published.contentIds[0]).assets.length, 2);
  assert.equal(analyzed.report.duplicateFiles, 0);
});
