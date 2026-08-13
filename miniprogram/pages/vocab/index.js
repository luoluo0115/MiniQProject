// 背单词 · 艾宾浩斯翻卡（FSRS 四档，接 /api/words/due + /review）
const api = require('../../utils/api');
const { wordbook } = require('../../data/content');
const app = getApp();

// 词 → emoji（图鉴里有就用，没有给个默认）
const EMOJI = wordbook.words.reduce((m, w) => (m[w.word] = w.emoji, m), {});
// 离线示例（后端无 due 词时兜底展示）
const OFFLINE = [
  { id: null, lemma: 'elephant', phonics: 'el · e · phant', meaning_zh: 'n. 大象', example_en: 'The elephant has a long nose.', state: 'learning', repetitions: 3 }
];

Page({
  data: {
    due: 0,
    done: 0,
    flipped: false,
    card: { word: '', phonics: '', emoji: '🔤', stage: '', mean: '', example: '' },
    finished: false,
    evals: [
      { k: '忘记', sub: '5分',  cls: 'ev-forget' },
      { k: '困难', sub: '12时', cls: 'ev-hard' },
      { k: '良好', sub: '1天',  cls: 'ev-good' },
      { k: '简单', sub: '2天',  cls: 'ev-easy' }
    ],
    collected: 0,
    total: 1000,
    percent: 0
  },

  onLoad() {
    const collected = wordbook.words.filter(w => w.state === 'mastered').length + 316;
    this.setData({ collected, percent: Math.round(collected / this.data.total * 100) });
    this.loadDueWords();
  },

  loadDueWords() {
    api.dueWords(app.globalData.userId, 20).then(({ items }) => {
      this.words = (items && items.length) ? items : OFFLINE;
      this.wordIndex = 0;
      this.setData({ due: this.words.length, done: 0, finished: false });
      this.showWord();
    }).catch(() => {
      this.words = OFFLINE; this.wordIndex = 0;
      this.setData({ due: OFFLINE.length, done: 0, finished: false });
      this.showWord();
      wx.showToast({ title: '当前使用离线示例单词', icon: 'none' });
    });
  },

  showWord() {
    const item = this.words[this.wordIndex];
    if (!item) return;
    this.setData({
      card: {
        id: item.id,
        word: item.lemma,
        phonics: item.phonics || item.lemma.split('').join(' · '),
        emoji: EMOJI[item.lemma] || '🔤',
        stage: `${stateLabel(item.state)} · 第 ${item.repetitions || 0} 轮`,
        mean: item.meaning_zh || '',
        example: item.example_en || ''
      },
      flipped: false
    });
  },

  flip() { this.setData({ flipped: !this.data.flipped }); },

  onEval(e) {
    const grade = Number(e.currentTarget.dataset.grade);
    const id = this.data.card.id;
    const advance = () => {
      this.wordIndex += 1;
      const done = this.data.done + 1;
      if (this.wordIndex >= this.words.length) {
        this.setData({ done, finished: true });
        wx.showToast({ title: '🎉 今日复习完成！', icon: 'none' });
      } else {
        this.setData({ done });
        this.showWord();
      }
    };
    if (!id) { advance(); return; } // 离线示例不上报
    api.reviewWord(id, { userId: app.globalData.userId, grade, reviewUuid: `${Date.now()}-${id}` })
      .then(advance)
      .catch(error => wx.showToast({ title: error.message || '提交失败', icon: 'none' }));
  },

  onAtlas() { wx.navigateTo({ url: '/pages/wordbook/index' }); },

  restart() { this.loadDueWords(); },

  onExport() {
    wx.setClipboardData({ data: api.exportUrl(app.globalData.userId), success: () => wx.showToast({ title: '下载地址已复制', icon: 'none' }) });
  },
  onPrint() {
    wx.setClipboardData({ data: api.printUrl(app.globalData.userId), success: () => wx.showToast({ title: '打印地址已复制，请在浏览器打开', icon: 'none' }) });
  }
});

function stateLabel(s) {
  return ({ new: '新词', learning: '学习中', reviewing: '复习中', relearning: '重新学', mastered: '已掌握' })[s] || '新词';
}
