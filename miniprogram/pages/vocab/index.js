// 背单词 · 艾宾浩斯翻卡
const api = require('../../utils/api');
const app = getApp();
Page({
  data: {
    due: 15,
    done: 5,
    flipped: false,
    card: {
      word: 'elephant',
      phonics: 'el · e · phant',
      emoji: '🐘',
      stage: 'Stage 3 · 1天间隔',
      mean: 'n. 大象',
      example: 'The elephant has a long nose.'
    },
    // 四档评价（FSRS）
    evals: [
      { k: '忘记', sub: '5分',  cls: 'ev-forget' },
      { k: '困难', sub: '12时', cls: 'ev-hard' },
      { k: '良好', sub: '1天',  cls: 'ev-good' },
      { k: '简单', sub: '2天',  cls: 'ev-easy' }
    ],
    collected: 320,
    total: 1000,
    percent: 32
  },

  onLoad() { this.loadDueWords(); },

  loadDueWords() {
    api.dueWords(app.globalData.userId).then(({ items }) => {
      this.words = items;
      this.wordIndex = 0;
      this.setData({ due: items.length, done: 0 });
      this.showWord();
    }).catch(() => wx.showToast({ title: '当前使用离线示例单词', icon: 'none' }));
  },

  showWord() {
    const item = this.words && this.words[this.wordIndex];
    if (!item) return;
    this.setData({ card: { id: item.id, word: item.lemma, phonics: item.phonics || '', emoji: '🔤', stage: `${item.state || 'new'} · 第${item.repetitions || 0}轮`, mean: item.meaning_zh || '', example: item.example_en || '' }, flipped: false });
  },

  flip() {
    this.setData({ flipped: !this.data.flipped });
  },

  onEval(e) {
    if (!this.data.card.id) return wx.showToast({ title: '离线示例暂不记录', icon: 'none' });
    const grade = Number(e.currentTarget.dataset.grade);
    api.reviewWord(this.data.card.id, { userId: app.globalData.userId, grade, reviewUuid: `${Date.now()}-${this.data.card.id}` }).then(() => {
      this.wordIndex += 1;
      this.setData({ done: this.data.done + 1 });
      if (this.wordIndex >= this.words.length) wx.showToast({ title: '今日复习完成！', icon: 'success' });
      else this.showWord();
    }).catch(error => wx.showToast({ title: error.message || '提交失败', icon: 'none' }));
  },

  onExport() {
    wx.setClipboardData({ data: api.exportUrl(app.globalData.userId), success: () => wx.showToast({ title: '下载地址已复制', icon: 'none' }) });
  },

  onPrint() {
    wx.setClipboardData({ data: api.printUrl(app.globalData.userId), success: () => wx.showToast({ title: '打印地址已复制，请在浏览器打开', icon: 'none' }) });
  }
});
