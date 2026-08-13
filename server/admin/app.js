const state = { files: [], contents: [], status: '', libraryFiles: [], libraries: [], currentLibrary: null, bookStatus: '' };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2600); }
function token() { return $('#admin-token').value.trim(); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', 'x-admin-token': token(), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
  return data;
}
async function uploadRaw(path, file) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream', 'x-admin-token': token() }, body: file });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || `上传失败 ${response.status}`); return data;
}
function date(value) { return value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'; }
function typeName(value) { return ({ book: '绘本', audio: '音频', video: '动画', speaking_scene: '口语场景' })[value] || value; }
function statusName(value) { return ({ pending: '待审核', approved: '已发布', rejected: '已驳回', uploading: '上传中', queued: '等待处理', processing: '处理中', completed: '已完成', failed: '失败' })[value] || value; }

function switchView(name) {
  $$('.nav').forEach(node => node.classList.toggle('active', node.dataset.view === name));
  $$('.view').forEach(node => node.classList.toggle('active', node.id === `view-${name}`));
  $('#page-title').textContent = ({ content: '内容资源', library: '整套书库导入', upload: '上传新内容', jobs: '处理任务' })[name];
  if (name === 'content') loadContent();
  if (name === 'library') loadLibraries();
  if (name === 'jobs') loadJobs();
}

async function loadContent() {
  try {
    const { items } = await api(`/api/content${state.status ? `?status=${state.status}` : ''}`);
    state.contents = items;
    const counts = { total: items.length, pending: items.filter(x => x.review_status === 'pending').length, approved: items.filter(x => x.review_status === 'approved').length, assets: items.reduce((sum, x) => sum + (x.content_type !== 'speaking_scene'), 0) };
    $('#stats').innerHTML = [['全部内容', counts.total], ['待人工审核', counts.pending], ['已正式发布', counts.approved], ['媒体内容', counts.assets]].map(([label, value]) => `<div class="stat-card"><b>${value}</b><span>${label}</span></div>`).join('');
    renderContent();
  } catch (error) { toast(error.message); }
}

function renderContent() {
  const keyword = $('#search').value.trim().toLowerCase();
  const items = state.contents.filter(item => item.title.toLowerCase().includes(keyword));
  $('#content-empty').style.display = items.length ? 'none' : 'block';
  $('#content-list').innerHTML = items.map(item => `<tr><td><div class="content-title">${escapeHtml(item.title)}</div><div class="content-key">${escapeHtml(item.content_key)}</div></td><td>${typeName(item.content_type)}</td><td>${item.level || '-'}</td><td>${item.copyright_status}</td><td><span class="pill ${item.review_status}">${statusName(item.review_status)}</span></td><td>${date(item.updated_at)}</td><td><button data-edit="${item.id}">查看审核</button></td></tr>`).join('');
}

async function openDetail(id) {
  try {
    const { item } = await api(`/api/content/${id}`); const form = $('#detail-form');
    for (const [name, value] of Object.entries({ id: item.id, title: item.title, contentType: item.content_type, level: item.level || '', estimatedMinutes: item.estimated_minutes || '', copyrightStatus: item.copyright_status, topics: item.topic_tags.join(', '), description: item.metadata.description || '' })) if (form.elements[name]) form.elements[name].value = value;
    $('#assets').innerHTML = item.assets.map(asset => `<div class="asset"><b>${asset.asset_type}</b> · ${escapeHtml(asset.original_path.split('/').pop())} · ${Math.ceil(asset.file_size / 1024)} KB</div>`).join('') || '<div class="asset">没有媒体文件</div>';
    const visual = item.assets.find(asset => asset.mime_type?.startsWith('image/'));
    const video = item.assets.find(asset => asset.mime_type?.startsWith('video/'));
    $('#preview').innerHTML = visual ? `<img src="/media/${visual.id}" alt="内容预览">` : video ? `<video src="/media/${video.id}" controls></video>` : `<span>${typeName(item.content_type)} · ${item.level || '待定级'}</span>`;
    $('#detail-dialog').showModal();
  } catch (error) { toast(error.message); }
}

async function saveDetail() {
  const data = Object.fromEntries(new FormData($('#detail-form'))); const id = data.id; delete data.id;
  data.topics = data.topics.split(',').map(x => x.trim()).filter(Boolean); data.estimatedMinutes = Number(data.estimatedMinutes) || null;
  await api(`/api/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  toast('内容信息已保存'); await openDetail(id); await loadContent();
}

async function review(action) {
  const id = $('#detail-form').elements.id.value;
  try { await saveDetail(); await api(`/api/admin/content/${id}/review`, { method: 'POST', body: JSON.stringify({ action, note: action === 'approve' ? '管理台审核发布' : '管理台驳回' }) }); $('#detail-dialog').close(); toast(action === 'approve' ? '内容已发布，可进入学习计划' : '内容已驳回'); loadContent(); }
  catch (error) { toast(error.message); }
}

function renderFiles() { $('#file-list').innerHTML = state.files.map(file => `<div class="file-row"><span>${escapeHtml(file.name)}</span><small>${(file.size / 1024 / 1024).toFixed(2)} MB</small></div>`).join(''); }
function fileBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }

async function submitUpload(event) {
  event.preventDefault();
  if (!state.files.length) return toast('请至少选择一个文件');
  const button = event.submitter; button.disabled = true;
  try {
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const { batch } = await api('/api/admin/batches', { method: 'POST', body: JSON.stringify({ title: fields.title, expectedFiles: state.files.length }) });
    for (let index = 0; index < state.files.length; index++) {
      button.textContent = `正在上传 ${index + 1}/${state.files.length}`;
      const file = state.files[index];
      await api(`/api/admin/batches/${batch.id}/files`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: await fileBase64(file) }) });
    }
    fields.topics = fields.topics.split(',').map(x => x.trim()).filter(Boolean);
    await api(`/api/admin/batches/${batch.id}/finalize`, { method: 'POST', body: JSON.stringify(fields) });
    event.currentTarget.reset(); state.files = []; renderFiles(); toast('上传完成，已经进入处理队列'); switchView('jobs');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = '上传并开始解析'; }
}

async function loadJobs() {
  try {
    const { items } = await api('/api/admin/jobs');
    $('#job-list').innerHTML = items.length ? items.map(job => `<div class="job"><div><b>${escapeHtml(job.title)}</b><small>任务 #${job.id} · 尝试 ${job.attempts} 次${job.error_message ? ` · ${escapeHtml(job.error_message)}` : ''}</small></div><div><div class="progress"><i style="width:${job.progress}%"></i></div><small>${job.progress}%</small></div><span class="pill ${job.status}">${statusName(job.status)}</span>${job.status === 'failed' ? `<button data-retry="${job.id}">重试</button>` : '<span></span>'}</div>`).join('') : '<div class="empty" style="display:block">还没有处理任务。</div>';
  } catch (error) { toast(error.message); }
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

function renderLibrarySelection() {
  const supported = state.libraryFiles.filter(file => /\.(pdf|epub|mp3|m4a|wav|mp4|mov|jpe?g|png|webp)$/i.test(file.name));
  const bytes = supported.reduce((sum, file) => sum + file.size, 0);
  $('#library-selection').textContent = supported.length ? `已选择 ${supported.length} 个支持的文件，共 ${(bytes / 1024 / 1024).toFixed(1)} MB` : '尚未选择支持的文件';
}

async function loadLibraries() {
  try {
    const { items } = await api('/api/admin/libraries'); state.libraries = items;
    $('#library-list').innerHTML = items.length ? items.map(item => `<div class="import-row" data-library="${item.id}"><div><b>${escapeHtml(item.name)}</b><small>${item.detected_series || item.series_hint || '待识别'} · ${item.uploaded_files} 个文件 · ${item.detected_books} 本书</small></div><span class="pill ${item.status}">${statusName(item.status === 'review' ? 'pending' : item.status)}</span></div>`).join('') : '<div class="empty" style="display:block">还没有整套书库导入记录。</div>';
  } catch (error) { toast(error.message); }
}

async function submitLibrary(event) {
  event.preventDefault(); const supported = state.libraryFiles.filter(file => /\.(pdf|epub|mp3|m4a|wav|mp4|mov|jpe?g|png|webp)$/i.test(file.name));
  if (!supported.length) return toast('请选择包含绘本或音视频的文件夹');
  const button = event.submitter; button.disabled = true; const progress = $('#library-progress'); progress.style.display = 'block';
  try {
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const { library } = await api('/api/admin/libraries', { method: 'POST', body: JSON.stringify({ ...fields, expectedFiles: supported.length }) });
    for (let index = 0; index < supported.length; index++) {
      const file = supported[index]; const percent = Math.round((index / supported.length) * 100);
      progress.querySelector('i').style.width = `${percent}%`; progress.querySelector('span').textContent = `正在上传 ${index + 1}/${supported.length} · ${file.webkitRelativePath || file.name}`;
      const relativePath = file.webkitRelativePath || file.name;
      await uploadRaw(`/api/admin/libraries/${library.id}/files/raw?relativePath=${encodeURIComponent(relativePath)}`, file);
    }
    progress.querySelector('i').style.width = '100%'; progress.querySelector('span').textContent = '正在自动拆分并匹配书籍…';
    const result = await api(`/api/admin/libraries/${library.id}/analyze`, { method: 'POST', body: '{}' });
    toast(`分析完成：识别 ${result.library.detected_books} 本书`); state.libraryFiles = []; event.currentTarget.reset(); renderLibrarySelection(); await loadLibraries(); await openLibrary(library.id);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; progress.style.display = 'none'; }
}

async function openLibrary(id) {
  try {
    const { library } = await api(`/api/admin/libraries/${id}`); state.currentLibrary = library;
    $('#library-report').classList.remove('hidden'); $('#report-title').textContent = library.name;
    $('#report-subtitle').textContent = `${library.detected_series || '未识别系列'} · ${library.uploaded_files} 个文件 · 自动识别 ${library.detected_books} 本`;
    const report = library.report || {}; $('#report-stats').innerHTML = [['识别绘本', library.detected_books], ['高置信度', report.highConfidenceBooks || 0], ['待确认', report.needsReviewBooks || 0], ['重复文件', report.duplicateFiles || 0]].map(([label,value]) => `<div class="stat-card"><b>${value}</b><span>${label}</span></div>`).join('');
    renderLibraryBooks(); $('#library-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { toast(error.message); }
}

function renderLibraryBooks() {
  const books = (state.currentLibrary?.books || []).filter(book => !state.bookStatus || book.match_status === state.bookStatus);
  $('#library-books').innerHTML = books.map(book => `<tr><td><div class="content-title">${escapeHtml(book.title)}</div><div class="content-key">${escapeHtml((book.match_reason || []).join(' · '))}</div></td><td>${escapeHtml(book.series_name || '-')} / ${book.source_level || '-'}</td><td><div class="asset-tags">${book.asset_roles.map(role => `<span>${role}</span>`).join('')}</div></td><td><span class="confidence">${Math.round(book.confidence * 100)}%</span></td><td><span class="pill ${book.match_status === 'matched' ? 'approved' : book.match_status === 'needs_review' ? 'pending' : book.match_status}">${({ matched:'高置信度',needs_review:'待确认',approved:'已发布',rejected:'异常' })[book.match_status] || book.match_status}</span></td><td><button data-book="${book.id}">查看匹配</button></td></tr>`).join('');
}

async function openBook(id) {
  try {
    const { book } = await api(`/api/admin/library-books/${id}`); const form = $('#book-form');
    for (const [name,value] of Object.entries({ id: book.id, title: book.title, sourceLevel: book.source_level || '', internalLevel: book.internal_level || '' })) form.elements[name].value = value;
    $('#book-files').innerHTML = book.files.map(file => `<div class="asset"><b>${file.detected_role}</b> · ${escapeHtml(file.relative_path)} · ${Math.ceil(file.file_size / 1024)} KB</div>`).join(''); $('#book-dialog').showModal();
  } catch (error) { toast(error.message); }
}

async function saveBook(matchStatus) {
  const data = Object.fromEntries(new FormData($('#book-form'))); const id = data.id; delete data.id; if (matchStatus) data.matchStatus = matchStatus;
  await api(`/api/admin/library-books/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); toast('匹配结果已保存'); await openLibrary(state.currentLibrary.id); return id;
}

async function approveSelectedBook() {
  try { const id = await saveBook('matched'); await api(`/api/admin/libraries/${state.currentLibrary.id}/approve`, { method: 'POST', body: JSON.stringify({ bookIds: [Number(id)], copyrightStatus: $('#bulk-copyright').value }) }); $('#book-dialog').close(); toast('这本绘本已发布'); openLibrary(state.currentLibrary.id); }
  catch (error) { toast(error.message); }
}

$$('.nav').forEach(node => node.onclick = () => switchView(node.dataset.view));
$$('.filter').forEach(node => node.onclick = () => { $$('.filter').forEach(x => x.classList.remove('active')); node.classList.add('active'); state.status = node.dataset.status; loadContent(); });
$('#refresh').onclick = () => switchView($('.nav.active').dataset.view);
$('#jobs-refresh').onclick = loadJobs;
$('#libraries-refresh').onclick = loadLibraries;
$('#search').oninput = renderContent;
$('#content-list').onclick = event => { const button = event.target.closest('[data-edit]'); if (button) openDetail(button.dataset.edit); };
$('#job-list').onclick = async event => { const button = event.target.closest('[data-retry]'); if (!button) return; try { await api(`/api/admin/jobs/${button.dataset.retry}/retry`, { method: 'POST' }); toast('任务已重新排队'); setTimeout(loadJobs, 500); } catch (error) { toast(error.message); } };
$('#files').onchange = event => { state.files = [...event.target.files]; renderFiles(); };
const dropzone = $('#dropzone');
dropzone.ondragover = event => { event.preventDefault(); dropzone.classList.add('drag'); };
dropzone.ondragleave = () => dropzone.classList.remove('drag');
dropzone.ondrop = event => { event.preventDefault(); dropzone.classList.remove('drag'); state.files = [...event.dataTransfer.files]; renderFiles(); };
$('#upload-form').onsubmit = submitUpload;
$('#library-files').onchange = event => { state.libraryFiles = [...event.target.files]; renderLibrarySelection(); };
$('#library-form').onsubmit = submitLibrary;
$('#library-list').onclick = event => { const row = event.target.closest('[data-library]'); if (row) openLibrary(row.dataset.library); };
$('#library-books').onclick = event => { const button = event.target.closest('[data-book]'); if (button) openBook(button.dataset.book); };
$$('.report-filter').forEach(button => button.onclick = () => { $$('.report-filter').forEach(x => x.classList.remove('active')); button.classList.add('active'); state.bookStatus = button.dataset.bookStatus; renderLibraryBooks(); });
$('#approve-confident').onclick = async () => { if (!state.currentLibrary) return; try { const result = await api(`/api/admin/libraries/${state.currentLibrary.id}/approve`, { method: 'POST', body: JSON.stringify({ approveHighConfidence: true, copyrightStatus: $('#bulk-copyright').value }) }); toast(`已批量发布 ${result.approved} 本`); openLibrary(state.currentLibrary.id); loadContent(); } catch (error) { toast(error.message); } };
$('#book-form').onsubmit = async event => { event.preventDefault(); try { await saveBook(); } catch (error) { toast(error.message); } };
$('#book-reject').onclick = async () => { try { await saveBook('rejected'); $('#book-dialog').close(); } catch (error) { toast(error.message); } };
$('#book-approve').onclick = approveSelectedBook;
$('#detail-form').onsubmit = async event => { event.preventDefault(); try { await saveDetail(); } catch (error) { toast(error.message); } };
$('#approve').onclick = () => review('approve'); $('#reject').onclick = () => review('reject');
$$('[data-close]').forEach(button => button.onclick = () => $('#detail-dialog').close());
$$('[data-close-book]').forEach(button => button.onclick = () => $('#book-dialog').close());
loadContent();
