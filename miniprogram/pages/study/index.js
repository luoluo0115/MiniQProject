// 学习中心 hub
const app = getApp();

Page({
  data: {
    statusBarH: 20,
    resume: { title: "Little Monkey's Tree", page: 3, level: 'AA', cover: '🐒', key: 'little-monkey-tree' },
    pillars: [
      { key: 'reading', title: '分级阅读', sub: '绘本馆 · 跟读打分', mascot: 'read', cls: 'p-sky', url: '/pages/library/index' },
      { key: 'vocab', title: '科学背词', sub: '艾宾浩斯记忆', mascot: 'vocab', cls: 'p-grape', url: '/pages/vocab/index' },
      { key: 'speaking', title: '口语陪练', sub: '小Q 场景对话', mascot: 'ai', cls: 'p-pinky', url: '/pages/scenes/index' },
      { key: 'listening', title: '磨耳朵', sub: '逐句 · 盲听 · 复读', mascot: 'ear', cls: 'p-grass', url: '/pages/listening/index' }
    ],
    extras: [
      { key: 'wordbook', emoji: '📔', label: '单词图鉴', url: '/pages/wordbook/index' },
      { key: 'quiz', emoji: '🎮', label: '趣味闯关', url: '/pages/quiz/index' },
      { key: 'test', emoji: '📝', label: '英语测评', tip: '📝 AI 定级测评开发中' },
      { key: 'report', emoji: '📈', label: '成长报告', url: '/pages/report/index' }
    ]
  },

  onLoad() {
    this.setData({ statusBarH: app.globalData.statusBarH });
  },

  onResume() {
    wx.navigateTo({ url: `/pages/reader/index?book=${this.data.resume.key}` });
  },

  onPillar(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  },

  onExtra(e) {
    const { url, tip } = e.currentTarget.dataset;
    if (url) { wx.navigateTo({ url }); return; }
    wx.showToast({ title: tip, icon: 'none' });
  }
});
