// 星学院 · 绘本阅读器
const api = require('../../utils/api');
const app = getApp();
Page({
  data: {
    levels: [
      { key: 'AA', label: 'Level AA' },
      { key: 'A',  label: 'Level A' },
      { key: 'B',  label: 'Level B' },
      { key: 'ear', label: '🎧 磨耳朵' }
    ],
    level: 'AA',
    book: {
      title: "Little Monkey's Tree",
      page: 3,
      total: 10,
      art: '🐒🌳'
    },
    // 句子分词：plain 直接显示；word 可点查词（hl 决定高亮色）
    tokens: [
      { t: 'The ' },
      { t: 'little', w: 1, hl: 'amber', mean: 'adj. 小的', ph: 'lit·tle' },
      { t: ' ' },
      { t: 'monkey', w: 1, hl: 'sky', mean: 'n. 猴子', ph: 'mon·key' },
      { t: ' is ' },
      { t: 'climbing', w: 1, hl: 'amber', mean: 'v. 攀爬', ph: 'climb·ing' },
      { t: ' a ' },
      { t: 'tall', w: 1, hl: 'amber', mean: 'adj. 高的', ph: 'tall' },
      { t: ' ', },
      { t: 'tree', w: 1, hl: 'amber', mean: 'n. 树', ph: 'tree' },
      { t: '.' }
    ],
    // 查词弹窗
    wordModal: false,
    word: null,
    // 跟读评分
    loading: false,
    scoreModal: false
  },

  onLoad(options) {
    this.contentId = Number(options.contentId) || null;
    this.planTaskId = Number(options.taskId) || null;
    this.startedAt = Date.now();
    this.sessionId = `reading-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    if (!this.contentId) return;
    api.content(this.contentId).then(({ item }) => this.setData({ 'book.title': item.title })).catch(() => {});
    api.startSession({ sessionId: this.sessionId, userId: app.globalData.userId, moduleType: 'reading', contentId: this.contentId, planTaskId: this.planTaskId }).catch(() => {});
  },

  onUnload() { this.finishLearning(false); },

  finishLearning(forceCompleted) {
    if (!this.contentId || this.finished) return;
    this.finished = true;
    const rate = this.data.book.page / this.data.book.total;
    api.finishSession(this.sessionId, {
      foregroundMs: Date.now() - this.startedAt,
      effectiveMs: Date.now() - this.startedAt,
      completionRate: rate,
      completed: forceCompleted || rate >= 1,
      lastPosition: { page: this.data.book.page, total: this.data.book.total }
    }).catch(() => { this.finished = false; });
  },

  onSwitchLevel(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'ear') { wx.showToast({ title: '🎧 磨耳朵模式', icon: 'none' }); return; }
    this.setData({ level: key });
    wx.showToast({ title: '切换到 Level ' + key + ' 书库', icon: 'none' });
  },

  onWordTap(e) {
    const i = e.currentTarget.dataset.i;
    this.setData({ word: this.data.tokens[i], wordModal: true });
  },

  closeWordModal() {
    this.setData({ wordModal: false });
  },

  addToWordbook() {
    this.setData({ wordModal: false });
    wx.showToast({ title: '已加入生词本！', icon: 'success' });
  },

  changePage(e) {
    const d = Number(e.currentTarget.dataset.d);
    const p = Math.max(1, Math.min(this.data.book.total, this.data.book.page + d));
    if (p === this.data.book.page) return;
    this.setData({ 'book.page': p });
    if (p === this.data.book.total) this.finishLearning(true);
    else if (this.contentId) api.event({ userId: app.globalData.userId, sessionId: this.sessionId, planTaskId: this.planTaskId, eventType: 'page_changed', objectType: 'content', objectId: this.contentId, metadata: { page: p, total: this.data.book.total, taskProgress: p / this.data.book.total } }).catch(() => {});
    wx.showToast({ title: '已翻到第 ' + p + ' 页', icon: 'none' });
  },

  readAlong() {
    this.setData({ loading: true });
    setTimeout(() => {
      this.setData({ loading: false, scoreModal: true });
    }, 1100);
  },

  closeScore() {
    this.setData({ scoreModal: false });
  },

  noop() {}
});
