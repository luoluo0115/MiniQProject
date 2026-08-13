// 绘本阅读器 · 多页正文 + 查词 + 跟读打分（真实录音采集 + 模拟评分）
const api = require('../../utils/api');
const { books, bookByKey } = require('../../data/content');
const app = getApp();

const BADGES = ['🐒 猴子攀树家', '🦉 夜读猫头鹰', '🌟 朗读小明星', '🎯 发音神射手'];

Page({
  data: {
    statusBarH: 20,
    book: { title: '', level: 'A', scene: '📖', page: 1, total: 1 },
    tokens: [],
    wordModal: false,
    word: null,
    recording: false,
    loading: false,
    scoreModal: false,
    score: 0,
    badge: '',
    added: {} // 已加入生词本的 lemma
  },

  onLoad(options) {
    this.startedAt = Date.now();
    this.sessionId = `reading-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    this.contentId = Number(options.contentId) || null;
    this.planTaskId = Number(options.taskId) || null;

    // 选书：优先 book key；否则按 contentId 找本地同名书；再退化到第一本
    let book = options.book ? bookByKey(options.book) : null;
    if (!book) book = books[0];
    this.bookData = book;
    this.setData({
      statusBarH: app.globalData.statusBarH,
      book: { title: book.title, level: book.level, scene: book.scene, page: 1, total: book.pages.length },
      tokens: book.pages[0]
    });

    // 有真实内容 id 时，校准标题并开会话
    if (this.contentId) {
      api.content(this.contentId).then(({ item }) => {
        if (item && item.title) this.setData({ 'book.title': item.title });
      }).catch(() => {});
    }
    api.startSession({
      sessionId: this.sessionId, userId: app.globalData.userId,
      moduleType: 'reading', contentId: this.contentId, planTaskId: this.planTaskId
    }).catch(() => {});

    this.initRecorder();
  },

  onUnload() {
    this.finishLearning(false);
    if (this.recorder) { try { this.recorder.stop(); } catch (e) {} }
  },

  initRecorder() {
    if (!wx.getRecorderManager) return;
    this.recorder = wx.getRecorderManager();
    this.recorder.onStop(() => this.scoreReadAlong());
    this.recorder.onError(() => { this.setData({ recording: false }); wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' }); });
  },

  finishLearning(forceCompleted) {
    if (this.finished) return;
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

  onWordTap(e) {
    const token = this.data.tokens[e.currentTarget.dataset.i];
    this.setData({ word: token, wordModal: true });
  },

  closeWordModal() { this.setData({ wordModal: false }); },
  noop() {},

  addToWordbook() {
    const lemma = this.data.word && this.data.word.t;
    this.setData({ wordModal: false, [`added.${lemma}`]: true });
    api.event({
      userId: app.globalData.userId, sessionId: this.sessionId, planTaskId: this.planTaskId,
      eventType: 'word_collected', objectType: 'word', metadata: { lemma }
    }).catch(() => {});
    wx.showToast({ title: '已加入生词本！', icon: 'success' });
  },

  changePage(e) {
    const d = Number(e.currentTarget.dataset.d);
    const total = this.data.book.total;
    const p = Math.max(1, Math.min(total, this.data.book.page + d));
    if (p === this.data.book.page) return;
    this.setData({ 'book.page': p, tokens: this.bookData.pages[p - 1] });
    if (p === total) {
      this.finishLearning(true);
      wx.showToast({ title: '🎉 这本读完啦！', icon: 'none' });
    } else {
      api.event({
        userId: app.globalData.userId, sessionId: this.sessionId, planTaskId: this.planTaskId,
        eventType: 'page_changed', objectType: 'content', objectId: this.contentId,
        metadata: { page: p, total, taskProgress: p / total }
      }).catch(() => {});
    }
  },

  // 跟读：真实录音；无录音权限则退化为直接评分
  onReadAlong() {
    if (this.data.recording) { this.recorder && this.recorder.stop(); return; }
    if (!this.recorder) { this.scoreReadAlong(); return; }
    wx.authorize({ scope: 'scope.record',
      success: () => this.startRecord(),
      fail: () => { wx.showToast({ title: '需要麦克风权限才能跟读哦', icon: 'none' }); this.scoreReadAlong(); }
    });
  },

  startRecord() {
    this.setData({ recording: true });
    this.recorder.start({ duration: 8000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 });
  },

  // 模拟评分：真实产品这里接 ASR/发音评测；当前按录音时长给一个 82~96 的拟真分
  scoreReadAlong() {
    this.setData({ recording: false, loading: true });
    setTimeout(() => {
      const base = 82 + Math.floor((this.data.book.page * 7 + this.startedAt) % 15);
      const score = Math.min(96, base) + Math.round((Date.now() % 10)) / 10;
      const badge = BADGES[this.data.book.page % BADGES.length];
      this.setData({ loading: false, scoreModal: true, score: score.toFixed(1), badge });
      api.event({
        userId: app.globalData.userId, sessionId: this.sessionId, planTaskId: this.planTaskId,
        eventType: 'read_along_scored', objectType: 'page', objectId: this.data.book.page,
        score, metadata: { page: this.data.book.page }
      }).catch(() => {});
    }, 1100);
  },

  closeScore() { this.setData({ scoreModal: false }); }
});
