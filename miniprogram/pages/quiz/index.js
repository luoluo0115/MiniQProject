// 趣味闯关 · 图文匹配（题库多题循环 + 连击 + 通关）
const api = require('../../utils/api');
const { quizzes } = require('../../data/content');
const app = getApp();

// 洗牌选项（不依赖 Math.random 顺序也可，这里用题目自带 options）
function buildOptions(q) {
  return q.options.map(label => ({ label, ok: label === q.answer, state: '' }));
}

Page({
  data: {
    statusBarH: 20,
    combo: 0,
    step: 1,
    total: quizzes.length,
    percent: 0,
    q: {},
    options: [],
    locked: false,
    done: false,
    correct: 0
  },

  onLoad() {
    this.qi = 0;
    this.startedAt = Date.now();
    this.sessionId = `quiz-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    this.setData({ statusBarH: app.globalData.statusBarH });
    this.loadQuestion();
    api.startSession({ sessionId: this.sessionId, userId: app.globalData.userId, moduleType: 'quiz' }).catch(() => {});
  },

  onUnload() {
    if (this.finished) return;
    api.finishSession(this.sessionId, {
      foregroundMs: Date.now() - this.startedAt, effectiveMs: Date.now() - this.startedAt,
      completionRate: this.qi / this.data.total, completed: false, lastPosition: { step: this.qi }
    }).catch(() => {});
  },

  loadQuestion() {
    const q = quizzes[this.qi];
    this.setData({
      q,
      options: buildOptions(q),
      locked: false,
      step: this.qi + 1,
      percent: Math.round(this.qi / this.data.total * 100)
    });
  },

  onAnswer(e) {
    if (this.data.locked) return;
    const i = Number(e.currentTarget.dataset.i);
    const opt = this.data.options[i];
    if (!opt.ok) {
      this.setData({ [`options[${i}].state`]: 'wrong', combo: 0 });
      wx.showToast({ title: '❌ 再试一次', icon: 'none' });
      return;
    }
    const combo = this.data.combo + 1;
    this.setData({ [`options[${i}].state`]: 'right', locked: true, combo, correct: this.data.correct + 1 });
    api.event({
      userId: app.globalData.userId, sessionId: this.sessionId,
      eventType: 'quiz_answered', objectType: 'quiz', objectId: this.qi,
      result: 'correct', metadata: { combo, step: this.qi + 1 }
    }).catch(() => {});

    setTimeout(() => {
      this.qi += 1;
      if (this.qi >= this.data.total) this.finish();
      else this.loadQuestion();
    }, 650);
  },

  finish() {
    this.finished = true;
    this.setData({ done: true, percent: 100 });
    api.finishSession(this.sessionId, {
      foregroundMs: Date.now() - this.startedAt, effectiveMs: Date.now() - this.startedAt,
      completionRate: 1, completed: true, finalScore: Math.round(this.data.correct / this.data.total * 100),
      lastPosition: { step: this.data.total }
    }).catch(() => {});
  },

  restart() {
    this.qi = 0; this.finished = false;
    this.startedAt = Date.now();
    this.sessionId = `quiz-${this.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    this.setData({ done: false, combo: 0, correct: 0 });
    this.loadQuestion();
    api.startSession({ sessionId: this.sessionId, userId: app.globalData.userId, moduleType: 'quiz' }).catch(() => {});
  },

  goStudy() { wx.reLaunch({ url: '/pages/study/index' }); }
});
