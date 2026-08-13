import { db } from './db.js';

function rows(userId) {
  return db().prepare(`SELECT w.lemma,w.phonics,w.meaning_zh,w.example_en,w.example_zh,w.level,
    COALESCE(m.state,'new') AS memory_state,m.repetitions,m.last_reviewed_at,m.next_review_at
    FROM user_words uw JOIN words w ON w.id=uw.word_id
    LEFT JOIN word_memory_states m ON m.user_id=uw.user_id AND m.word_id=uw.word_id
    WHERE uw.user_id=? AND uw.archived_at IS NULL ORDER BY w.level,w.lemma`).all(userId);
}

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function html(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

export function wordsCsv(userId) {
  const headings = ['单词', '音标/自然拼读', '中文释义', '英文例句', '中文例句', '级别', '记忆状态', '复习次数', '上次复习', '下次复习'];
  const body = rows(userId).map(row => [row.lemma, row.phonics, row.meaning_zh, row.example_en, row.example_zh, row.level, row.memory_state, row.repetitions, row.last_reviewed_at, row.next_review_at].map(csvCell).join(','));
  return `\uFEFF${headings.map(csvCell).join(',')}\n${body.join('\n')}`;
}

export function wordsPrintHtml(userId) {
  const cards = rows(userId).map((row, index) => `<article class="card"><div class="number">${index + 1}</div><h2>${html(row.lemma)}</h2><p class="phonics">${html(row.phonics)}</p><p>${html(row.meaning_zh)}</p><p class="example">${html(row.example_en)}</p><label>□ 不认识　□ 模糊　□ 认识　□ 熟练</label></article>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>小Q每日单词</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#24304a;margin:0}header{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #7656d6;margin-bottom:12px}h1{margin:0 0 8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{position:relative;border:1.5px solid #d9d2f4;border-radius:12px;padding:12px;break-inside:avoid;min-height:145px}.number{position:absolute;right:10px;color:#947de1}h2{margin:0;font-size:25px;color:#6042c0}.phonics{color:#777}.example{font-style:italic;border-top:1px dashed #ddd;padding-top:7px}label{font-size:11px;color:#666}@media print{button{display:none}}</style></head><body><header><div><h1>小Q · 每日必备单词</h1><p>姓名：__________　日期：__________</p></div><button onclick="print()">打印 / 保存为 PDF</button></header><main class="grid">${cards}</main></body></html>`;
}

