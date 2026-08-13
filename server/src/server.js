import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { config } from './config.js';
import { migrate, db } from './db.js';
import { recordEvent } from './events.js';
import { wordsCsv, wordsPrintHtml } from './export.js';
import { dueWords, reviewWord } from './memory.js';
import { generateDailyPlan, getDailyPlan } from './planner.js';
import { createRealtimeCall } from './realtime.js';
import { syncContentLibrary } from './content-sync.js';
import { finishSession, learningSummary, startSession } from './sessions.js';
import { contentDetail, createBatch, finalizeBatch, getBatch, getJob, listBatches, listJobs, resumeQueuedJobs, retryJob, reviewContent, updateContent, uploadBatchFile } from './pipeline.js';
import { analyzeLibrary, approveLibraryBooks, createLibraryImport, getLibraryBook, getLibraryImport, listLibraryImports, updateLibraryBook, uploadLibraryFile, uploadLibraryFileStream } from './library-import.js';

migrate();

function send(response, status, value, contentType = 'application/json; charset=utf-8', headers = {}) {
  const body = contentType.startsWith('application/json') ? JSON.stringify(value) : value;
  response.writeHead(status, { 'content-type': contentType, 'access-control-allow-origin': '*', ...headers });
  response.end(body);
}

async function body(request, maxBytes = 1_000_000) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) { const error = new Error('request body too large'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('invalid JSON body'); error.status = 400; throw error; }
}

function requireAdmin(request, url) {
  const token = request.headers['x-admin-token'] || url.searchParams.get('token');
  if (token !== config.adminToken) throw Object.assign(new Error('admin authorization required'), { status: 401 });
}

function serveFile(response, file, contentType) {
  if (!fs.existsSync(file)) return send(response, 404, { error: 'not found' });
  return send(response, 200, fs.readFileSync(file), contentType);
}

function int(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) { const error = new Error(`${name} must be a positive integer`); error.status = 400; throw error; }
  return parsed;
}

function serviceHome() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小Q学习服务</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f3f7ff;color:#202634;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.wrap{max-width:880px;margin:60px auto;padding:24px}.hero{background:linear-gradient(135deg,#7968ed,#3d8bff);color:#fff;padding:38px;border-radius:28px;box-shadow:0 16px 45px #7968ed33}h1{margin:0 0 8px;font-size:38px}.hero p{opacity:.9}.status{display:inline-flex;align-items:center;gap:8px;background:#ffffff26;padding:8px 14px;border-radius:99px}.dot{width:9px;height:9px;border-radius:50%;background:#62e59a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:22px}a{display:block;text-decoration:none;color:inherit;background:#fff;padding:22px;border-radius:20px;border:1px solid #e6eaff;transition:.2s}a:hover{transform:translateY(-2px);box-shadow:0 10px 30px #5666a51c}.title{font-weight:800;color:#604fd0;margin-bottom:6px}.sub{font-size:14px;color:#7d8799;line-height:1.6}code{background:#eef1fa;padding:2px 6px;border-radius:6px}</style></head><body><main class="wrap"><section class="hero"><div class="status"><i class="dot"></i>服务运行正常</div><h1>小Q学习服务</h1><p>内容管理、每日计划、艾宾浩斯复习与学习数据 API 已启动。</p></section><section class="grid">
  <a href="/admin"><div class="title">内容管理后台</div><div class="sub">上传资源、查看处理任务并审核发布。</div></a>
  <a href="/prototype"><div class="title">打开小Q高保真原型</div><div class="sub">查看完整的小程序页面规划和交互原型。</div></a>
  <a href="/health"><div class="title">健康检查</div><div class="sub"><code>GET /health</code> 查看服务状态。</div></a>
  <a href="/api/plans/today?userId=1"><div class="title">今日学习计划</div><div class="sub">查看体验账号自动生成的当天任务。</div></a>
  <a href="/api/words/due?userId=1"><div class="title">待复习单词</div><div class="sub">查看艾宾浩斯算法计算出的到期单词。</div></a>
  <a href="/api/words/print?userId=1"><div class="title">单词打印页</div><div class="sub">A4 排版，可直接打印或保存为 PDF。</div></a>
  <a href="/api/content"><div class="title">内容资源</div><div class="sub">查看已经入库的绘本、音频、动画和口语场景。</div></a>
  </section></main></body></html>`;
}

export async function handle(request, response) {
  if (request.method === 'OPTIONS') return send(response, 204, '', 'text/plain', { 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type,x-admin-token' });
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (request.method === 'GET' && pathname === '/') return send(response, 200, serviceHome(), 'text/html; charset=utf-8');
    if (request.method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) return serveFile(response, path.join(config.root, 'admin/index.html'), 'text/html; charset=utf-8');
    if (request.method === 'GET' && pathname === '/admin/app.js') return serveFile(response, path.join(config.root, 'admin/app.js'), 'text/javascript; charset=utf-8');
    if (request.method === 'GET' && pathname === '/admin/styles.css') return serveFile(response, path.join(config.root, 'admin/styles.css'), 'text/css; charset=utf-8');
    if (request.method === 'GET' && pathname === '/admin/library.css') return serveFile(response, path.join(config.root, 'admin/library.css'), 'text/css; charset=utf-8');
    if (request.method === 'GET' && (pathname === '/prototype' || pathname === '/prototype.html')) {
      const prototypePath = pathResolvePrototype();
      return send(response, 200, fs.readFileSync(prototypePath, 'utf8'), 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && pathname === '/health') return send(response, 200, { ok: true, service: '小Q learning service' });
    if (request.method === 'GET' && pathname === '/api/content') {
      const status = url.searchParams.get('status');
      const records = status
        ? db().prepare('SELECT * FROM content_items WHERE review_status=? ORDER BY updated_at DESC LIMIT ?').all(status, Math.min(Number(url.searchParams.get('limit') || 50), 200))
        : db().prepare('SELECT * FROM content_items ORDER BY updated_at DESC LIMIT ?').all(Math.min(Number(url.searchParams.get('limit') || 50), 200));
      return send(response, 200, { items: records });
    }
    const detailMatch = request.method === 'GET' && pathname.match(/^\/api\/content\/(\d+)$/);
    if (detailMatch) return send(response, 200, { item: contentDetail(int(detailMatch[1], 'contentId')) });
    const mediaMatch = request.method === 'GET' && pathname.match(/^\/media\/(\d+)$/);
    if (mediaMatch) {
      const asset = db().prepare('SELECT * FROM media_assets WHERE id=?').get(int(mediaMatch[1], 'assetId'));
      if (!asset) return send(response, 404, { error: 'asset not found' });
      return serveFile(response, path.resolve(config.mediaStoragePath, asset.storage_key), asset.mime_type || 'application/octet-stream');
    }
    if (request.method === 'POST' && pathname === '/api/content/sync') return send(response, 200, syncContentLibrary());
    if (request.method === 'GET' && pathname === '/api/admin/batches') { requireAdmin(request, url); return send(response, 200, { items: listBatches() }); }
    if (request.method === 'POST' && pathname === '/api/admin/batches') { requireAdmin(request, url); return send(response, 201, { batch: createBatch(await body(request)) }); }
    const batchMatch = pathname.match(/^\/api\/admin\/batches\/([^/]+)$/);
    if (request.method === 'GET' && batchMatch) { requireAdmin(request, url); return send(response, 200, { batch: getBatch(batchMatch[1]) }); }
    const uploadMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/batches\/([^/]+)\/files$/);
    if (uploadMatch) { requireAdmin(request, url); return send(response, 201, { file: uploadBatchFile(uploadMatch[1], await body(request, 36 * 1024 * 1024)) }); }
    const finalizeMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/batches\/([^/]+)\/finalize$/);
    if (finalizeMatch) { requireAdmin(request, url); return send(response, 202, { job: finalizeBatch(finalizeMatch[1], await body(request)) }); }
    if (request.method === 'GET' && pathname === '/api/admin/jobs') { requireAdmin(request, url); return send(response, 200, { items: listJobs() }); }
    const jobMatch = request.method === 'GET' && pathname.match(/^\/api\/admin\/jobs\/(\d+)$/);
    if (jobMatch) { requireAdmin(request, url); return send(response, 200, { job: getJob(int(jobMatch[1], 'jobId')) }); }
    const retryMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/jobs\/(\d+)\/retry$/);
    if (retryMatch) { requireAdmin(request, url); return send(response, 202, { job: retryJob(int(retryMatch[1], 'jobId')) }); }
    const editMatch = request.method === 'PATCH' && pathname.match(/^\/api\/admin\/content\/(\d+)$/);
    if (editMatch) { requireAdmin(request, url); return send(response, 200, { item: updateContent(int(editMatch[1], 'contentId'), await body(request)) }); }
    const reviewMatchAdmin = request.method === 'POST' && pathname.match(/^\/api\/admin\/content\/(\d+)\/review$/);
    if (reviewMatchAdmin) { requireAdmin(request, url); return send(response, 200, { item: reviewContent(int(reviewMatchAdmin[1], 'contentId'), await body(request)) }); }
    if (request.method === 'GET' && pathname === '/api/admin/libraries') { requireAdmin(request, url); return send(response, 200, { items: listLibraryImports() }); }
    if (request.method === 'POST' && pathname === '/api/admin/libraries') { requireAdmin(request, url); return send(response, 201, { library: createLibraryImport(await body(request)) }); }
    const libraryMatch = pathname.match(/^\/api\/admin\/libraries\/([^/]+)$/);
    if (request.method === 'GET' && libraryMatch) { requireAdmin(request, url); return send(response, 200, { library: getLibraryImport(libraryMatch[1]) }); }
    const libraryFileMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/libraries\/([^/]+)\/files$/);
    if (libraryFileMatch) { requireAdmin(request, url); return send(response, 201, { file: uploadLibraryFile(libraryFileMatch[1], await body(request, 70 * 1024 * 1024)) }); }
    const libraryRawFileMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/libraries\/([^/]+)\/files\/raw$/);
    if (libraryRawFileMatch) { requireAdmin(request, url); return send(response, 201, { file: await uploadLibraryFileStream(libraryRawFileMatch[1], url.searchParams.get('relativePath'), request.headers['content-type'], request) }); }
    const analyzeMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/libraries\/([^/]+)\/analyze$/);
    if (analyzeMatch) { requireAdmin(request, url); return send(response, 200, { library: analyzeLibrary(analyzeMatch[1]) }); }
    const approveLibraryMatch = request.method === 'POST' && pathname.match(/^\/api\/admin\/libraries\/([^/]+)\/approve$/);
    if (approveLibraryMatch) { requireAdmin(request, url); return send(response, 200, approveLibraryBooks(approveLibraryMatch[1], await body(request))); }
    const libraryBookMatch = pathname.match(/^\/api\/admin\/library-books\/(\d+)$/);
    if (request.method === 'GET' && libraryBookMatch) { requireAdmin(request, url); return send(response, 200, { book: getLibraryBook(int(libraryBookMatch[1], 'bookId')) }); }
    if (request.method === 'PATCH' && libraryBookMatch) { requireAdmin(request, url); return send(response, 200, { book: updateLibraryBook(int(libraryBookMatch[1], 'bookId'), await body(request)) }); }
    if (request.method === 'POST' && pathname === '/api/events') return send(response, 201, { event: recordEvent(await body(request)) });
    if (request.method === 'POST' && pathname === '/api/sessions/start') {
      const data = await body(request);
      return send(response, 201, startSession({ ...data, userId: int(data.userId, 'userId'), contentId: data.contentId ? int(data.contentId, 'contentId') : null, planTaskId: data.planTaskId ? int(data.planTaskId, 'planTaskId') : null }));
    }
    const finishMatch = request.method === 'POST' && pathname.match(/^\/api\/sessions\/([^/]+)\/finish$/);
    if (finishMatch) return send(response, 200, finishSession(decodeURIComponent(finishMatch[1]), await body(request)));
    if (request.method === 'GET' && pathname === '/api/dashboard/summary') {
      const userId = int(url.searchParams.get('userId'), 'userId');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      return send(response, 200, learningSummary(userId, date));
    }
    if (request.method === 'GET' && pathname === '/api/plans/today') {
      const userId = int(url.searchParams.get('userId'), 'userId');
      const date = url.searchParams.get('date');
      return send(response, 200, { plan: date ? (getDailyPlan(userId, date) || generateDailyPlan(userId, date)) : generateDailyPlan(userId) });
    }
    if (request.method === 'GET' && pathname === '/api/words/due') {
      const userId = int(url.searchParams.get('userId'), 'userId');
      return send(response, 200, { items: dueWords(userId, undefined, Math.min(Number(url.searchParams.get('limit') || 20), 100)) });
    }
    const reviewMatch = request.method === 'POST' && pathname.match(/^\/api\/words\/(\d+)\/review$/);
    if (reviewMatch) {
      const data = await body(request);
      return send(response, 200, reviewWord({ ...data, userId: int(data.userId, 'userId'), wordId: int(reviewMatch[1], 'wordId') }));
    }
    if (request.method === 'GET' && pathname === '/api/words/export.csv') {
      const userId = int(url.searchParams.get('userId'), 'userId');
      return send(response, 200, wordsCsv(userId), 'text/csv; charset=utf-8', { 'content-disposition': 'attachment; filename="miniq-words.csv"' });
    }
    if (request.method === 'GET' && pathname === '/api/words/print') {
      const userId = int(url.searchParams.get('userId'), 'userId');
      return send(response, 200, wordsPrintHtml(userId), 'text/html; charset=utf-8');
    }
    if (request.method === 'POST' && pathname === '/api/realtime/session') {
      const data = await body(request);
      if (!data.sdp) { const error = new Error('sdp is required'); error.status = 400; throw error; }
      const answerSdp = await createRealtimeCall({ userId: int(data.userId, 'userId'), sceneId: data.sceneId ? int(data.sceneId, 'sceneId') : null, sdp: data.sdp });
      return send(response, 200, answerSdp, 'application/sdp');
    }
    return send(response, 404, { error: 'not found' });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || 'internal server error' });
  }
}

function pathResolvePrototype() {
  return path.resolve(config.root, '..', 'prototype.html');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  resumeQueuedJobs();
  http.createServer(handle).listen(config.port, () => console.log(`小Q learning service: http://localhost:${config.port}`));
}
