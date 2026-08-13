// 单词图鉴：本地 wordbook 主题分组 + 掌握度；叠加 /api/words/due 收集的真实词
const api = require('../../utils/api');
const { wordbook } = require('../../data/content');
const app = getApp();

const STATE_LABEL = { mastered: '已掌握', learning: '复习中', new: '新收集' };

Page({
  data: {
    statusBarH: 20,
    themes: wordbook.themes,
    theme: 'all',
    all: [],
    filtered: [],
    collected: 0,
    total: 1000,
    percent: 0
  },

  onLoad() {
    const all = wordbook.words.map(w => ({ ...w, label: STATE_LABEL[w.state] || '新收集' }));
    const collected = wordbook.words.filter(w => w.state === 'mastered').length + 316;
    this.setData({
      statusBarH: app.globalData.statusBarH,
      all,
      collected,
      percent: Math.round(collected / this.data.total * 100)
    });
    this.applyFilter('all');

    // 叠加真实待复习词（后端有则并入「全部」）
    api.dueWords(app.globalData.userId, 40).then(({ items }) => {
      const have = new Set(all.map(w => w.word));
      const extra = (items || [])
        .filter(it => !have.has(it.lemma))
        .map(it => ({
          word: it.lemma, emoji: '🔤',
          theme: 'life',
          mastery: Math.min(95, (it.repetitions || 0) * 15 + 20),
          state: it.state === 'mastered' ? 'mastered' : it.state === 'new' ? 'new' : 'learning',
          label: STATE_LABEL[it.state] || '复习中'
        }));
      if (extra.length) {
        const merged = all.concat(extra);
        this.setData({ all: merged });
        this.applyFilter(this.data.theme);
      }
    }).catch(() => {});
  },

  onTheme(e) { this.applyFilter(e.currentTarget.dataset.key); },

  applyFilter(theme) {
    const filtered = theme === 'all' ? this.data.all : this.data.all.filter(w => w.theme === theme);
    this.setData({ theme, filtered });
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/study/index' });
  }
});
